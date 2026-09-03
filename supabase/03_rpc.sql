-- =====================================================================
-- CG DULCES · Funciones transaccionales (RPC)
-- =====================================================================
-- QUÉ ARREGLA ESTO:
--   • Condición de carrera en el stock: hoy la app hace
--     "leo stock en memoria → resto → escribo". Dos ventas a la vez
--     (o desde dos celulares) se pisan y el stock queda mal.
--   • Venta a medias: si falla un paso intermedio, quedaban ventas sin
--     items, o stock descontado sin venta, o caja sin movimiento.
--
--   Ahora cada operación es UNA transacción en la base, con bloqueo de
--   fila (SELECT ... FOR UPDATE). O se hace todo, o no se hace nada.
--
-- CÓMO LO USA EL FRONTEND:
--   const { data, error } = await sb.rpc('registrar_venta', { p: {...} });
--   (los contratos JSON están documentados arriba de cada función)
--
-- Todas son SECURITY DEFINER y solo las puede ejecutar un usuario logueado.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------

create or replace function public._hist(
  p_tabla text, p_registro_id bigint, p_accion text, p_detalle text, p_usuario text
) returns void
language sql security definer set search_path = public as $$
  insert into public.historial (tabla, registro_id, accion, detalle, usuario, auth_uid)
  values (p_tabla, p_registro_id, p_accion, p_detalle, coalesce(p_usuario,''), auth.uid());
$$;

-- Saldos de una caja (misma regla que la app: apertura +/- movimientos)
create or replace function public.saldos_caja(p_caja_id bigint)
returns table (efectivo numeric, banco numeric)
language sql stable security definer set search_path = public as $$
  select
    coalesce(c.apertura_efectivo,0) + coalesce(sum(
      case when m.medio_pago in ('transferencia','qr') then 0
           when m.tipo in ('venta','cobro','ingreso_extra') then m.monto
           else -m.monto end), 0),
    coalesce(c.apertura_banco,0) + coalesce(sum(
      case when m.medio_pago in ('transferencia','qr')
           then (case when m.tipo in ('venta','cobro','ingreso_extra') then m.monto else -m.monto end)
           else 0 end), 0)
  from public.caja c
  left join public.caja_movimientos m on m.caja_id = c.id
  where c.id = p_caja_id
  group by c.id;
$$;

create or replace function public.caja_abierta_id()
returns bigint
language sql stable security definer set search_path = public as $$
  select id from public.caja where estado = 'abierta' order by fecha_apertura desc limit 1;
$$;

-- Consumo "ilimitado mientras el paquete esté abierto" (baldes, coberturas,
-- servilletas, cucharitas, pajitas, bolsitas de hielo). Con bloqueo de fila.
create or replace function public._consumir_ilimitado(p_producto_id bigint, p_cantidad numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare v_stock numeric; v_abiertas numeric; v_nombre text; v_pres text;
begin
  if p_producto_id is null or coalesce(p_cantidad,0) = 0 then return; end if;
  select stock, bolas_vendidas_actual, nombre, presentacion
    into v_stock, v_abiertas, v_nombre, v_pres
  from public.productos where id = p_producto_id for update;

  if v_abiertas is null then v_abiertas := 0; end if;

  if v_abiertas = 0 then
    if coalesce(v_stock,0) <= 0 then
      raise exception 'SIN_INSUMO: No hay más "%" disponible. Comprá o reponé el insumo.',
        coalesce(v_pres, v_nombre) using errcode = 'P0001';
    end if;
    update public.productos
      set stock = v_stock - 1, bolas_vendidas_actual = p_cantidad
      where id = p_producto_id;
  else
    update public.productos
      set bolas_vendidas_actual = v_abiertas + p_cantidad
      where id = p_producto_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- CAJA
-- ---------------------------------------------------------------------

-- Abrir caja. Repone lo que quedó al cerrar la última (igual que la app).
create or replace function public.abrir_caja(
  p_apertura_efectivo numeric default null,
  p_apertura_banco     numeric default null,
  p_registrado_por     text    default ''
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_prev record; v_ef numeric; v_ba numeric;
begin
  if public.caja_abierta_id() is not null then
    raise exception 'CAJA_YA_ABIERTA' using errcode = 'P0001';
  end if;
  if p_apertura_efectivo is null then
    select cierre_efectivo, cierre_banco into v_prev
    from public.caja where estado = 'cerrada' order by fecha_cierre desc limit 1;
    v_ef := coalesce(v_prev.cierre_efectivo, 0);
    v_ba := coalesce(v_prev.cierre_banco, 0);
  else
    v_ef := p_apertura_efectivo; v_ba := coalesce(p_apertura_banco, 0);
  end if;

  insert into public.caja (estado, apertura_efectivo, apertura_banco, registrado_por)
  values ('abierta', v_ef, v_ba, p_registrado_por)
  returning id into v_id;

  perform public._hist('caja', v_id, 'crear',
    'Caja abierta — efectivo '||v_ef||', banco '||v_ba, p_registrado_por);
  return v_id;
end $$;

create or replace function public.cerrar_caja(
  p_caja_id bigint, p_cierre_efectivo numeric default null, p_cierre_banco numeric default null,
  p_usuario text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare v_calc record;
begin
  select * into v_calc from public.saldos_caja(p_caja_id);
  update public.caja set
    estado = 'cerrada',
    fecha_cierre = now(),
    cierre_efectivo = coalesce(p_cierre_efectivo, v_calc.efectivo),
    cierre_banco    = coalesce(p_cierre_banco,    v_calc.banco)
  where id = p_caja_id and estado = 'abierta';
  if not found then raise exception 'CAJA_NO_ABIERTA' using errcode = 'P0001'; end if;
  perform public._hist('caja', p_caja_id, 'editar', 'Caja cerrada', p_usuario);
end $$;

create or replace function public.registrar_movimiento_caja(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_caja bigint; v_id bigint; v_tipo text; v_monto numeric; v_medio text; v_saldos record;
begin
  v_caja := public.caja_abierta_id();
  if v_caja is null then raise exception 'CAJA_CERRADA' using errcode = 'P0001'; end if;
  v_tipo  := p->>'tipo';                    -- 'retiro' | 'ingreso_extra'
  v_monto := (p->>'monto')::numeric;
  v_medio := coalesce(p->>'medio_pago','efectivo');
  if coalesce(v_monto,0) <= 0 then raise exception 'MONTO_INVALIDO' using errcode='P0001'; end if;

  if v_tipo = 'retiro' then
    select * into v_saldos from public.saldos_caja(v_caja);
    if v_medio in ('transferencia','qr') and v_monto > v_saldos.banco then
      raise exception 'SIN_BANCO: disponible %', v_saldos.banco using errcode='P0001';
    elsif v_medio not in ('transferencia','qr') and v_monto > v_saldos.efectivo then
      raise exception 'SIN_EFECTIVO: disponible %', v_saldos.efectivo using errcode='P0001';
    end if;
  end if;

  insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, descripcion, fecha)
  values (v_caja, v_tipo, v_monto, v_medio, p->>'descripcion', now())
  returning id into v_id;

  perform public._hist('caja_movimientos', v_caja, 'crear',
    v_tipo||' de '||v_monto||coalesce(' — '||(p->>'descripcion'), ''), p->>'registrado_por');
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- VENTA  (la función central)
-- ---------------------------------------------------------------------
-- Contrato JSON:
-- {
--   "cliente_id": 12,                 -- puede ser null
--   "usuario_app_id": 3,              -- opcional (vendedor real)
--   "registrado_por": "Caro",
--   "es_fiado": false,
--   "es_mayorista": false,
--   "pedido_id": null,
--   "medio_pago": "efectivo",        -- efectivo|transferencia|qr|mixto|fiado
--   "monto_efectivo": 50000,
--   "monto_transferencia": 0,
--   "subtotal": 50000,
--   "descuento_total": 0,
--   "total": 50000,
--   "created_at": "2026-09-03T14:00:00-03:00",   -- opcional
--   "items": [
--     { "producto_id": 5, "cantidad": 2, "precio_unitario": 15000,
--       "costo_unitario": 9000, "descuento": 0, "subtotal": 30000,
--       "descontar_stock": true }
--   ],
--   "stock_extra": [ { "producto_id": 30, "cantidad": 1 } ],        -- envases helado, stock normal
--   "consumibles_ilimitados": [ { "producto_id": 21, "cantidad": 3 } ]
-- }
create or replace function public.registrar_venta(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_caja bigint;
  v_venta_id bigint;
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
  v_es_fiado boolean := coalesce((p->>'es_fiado')::boolean, false);
  v_medio text := coalesce(p->>'medio_pago', 'efectivo');
  v_ef numeric := coalesce((p->>'monto_efectivo')::numeric, 0);
  v_tr numeric := coalesce((p->>'monto_transferencia')::numeric, 0);
  v_total numeric := coalesce((p->>'total')::numeric, 0);
  r record;
  v_stock numeric;
  v_nombre text;
begin
  v_caja := public.caja_abierta_id();
  if v_caja is null then raise exception 'CAJA_CERRADA' using errcode='P0001'; end if;

  -- 1) Bloquear y validar stock de todos los productos "normales" y "extra",
  --    en orden de id para evitar deadlocks.
  for r in
    select (x->>'producto_id')::bigint as pid, sum((x->>'cantidad')::numeric) as cant
    from jsonb_array_elements(coalesce(nullif(p->'items','null'::jsonb),'[]'::jsonb)) x
    where coalesce((x->>'descontar_stock')::boolean, true)
    group by 1
    union all
    select (x->>'producto_id')::bigint, sum((x->>'cantidad')::numeric)
    from jsonb_array_elements(coalesce(nullif(p->'stock_extra','null'::jsonb),'[]'::jsonb)) x
    group by 1
    order by 1
  loop
    select stock, nombre into v_stock, v_nombre
      from public.productos where id = r.pid for update;
    if v_stock is null then raise exception 'PRODUCTO_INEXISTENTE: %', r.pid using errcode='P0001'; end if;
    if r.cant > v_stock then
      raise exception 'SIN_STOCK: % (hay %, se piden %)', v_nombre, v_stock, r.cant using errcode='P0001';
    end if;
    update public.productos set stock = stock - r.cant where id = r.pid;
  end loop;

  -- 2) Insertar la venta
  insert into public.ventas (
    subtotal, descuento_total, total, medio_pago, es_fiado, registrado_por,
    cliente_id, usuario_app_id, es_mayorista, pedido_id,
    monto_efectivo, monto_transferencia, created_at
  ) values (
    coalesce((p->>'subtotal')::numeric,0), coalesce((p->>'descuento_total')::numeric,0),
    v_total, v_medio, v_es_fiado, p->>'registrado_por',
    (p->>'cliente_id')::bigint, (p->>'usuario_app_id')::bigint,
    coalesce((p->>'es_mayorista')::boolean,false), (p->>'pedido_id')::bigint,
    case when v_es_fiado then 0 else v_ef end,
    case when v_es_fiado then 0 else v_tr end,
    v_created
  ) returning id into v_venta_id;

  -- 3) Items
  insert into public.venta_items (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, descuento, subtotal)
  select v_venta_id, (x->>'producto_id')::bigint, (x->>'cantidad')::numeric,
         (x->>'precio_unitario')::numeric, (x->>'costo_unitario')::numeric,
         coalesce((x->>'descuento')::numeric,0), (x->>'subtotal')::numeric
  from jsonb_array_elements(coalesce(nullif(p->'items','null'::jsonb),'[]'::jsonb)) x;

  -- 4) Consumibles ilimitados (helado, pajitas, servilletas...)
  for r in
    select (x->>'producto_id')::bigint as pid, sum((x->>'cantidad')::numeric) as cant
    from jsonb_array_elements(coalesce(nullif(p->'consumibles_ilimitados','null'::jsonb),'[]'::jsonb)) x
    group by 1 order by 1
  loop
    perform public._consumir_ilimitado(r.pid, r.cant);
  end loop;

  -- 5) Movimientos de caja (lo fiado NO entra hasta que se cobra)
  if not v_es_fiado then
    if v_ef > 0 then
      insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, venta_id, fecha, descripcion)
      values (v_caja, 'venta', v_ef, 'efectivo', v_venta_id, v_created, 'Venta #'||v_venta_id);
    end if;
    if v_tr > 0 then
      insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, venta_id, fecha, descripcion)
      values (v_caja, 'venta', v_tr, 'transferencia', v_venta_id, v_created, 'Venta #'||v_venta_id);
    end if;
  end if;

  -- 6) Si venía de un pedido, marcarlo entregado
  if (p->>'pedido_id') is not null then
    update public.pedidos set estado = 'entregado', venta_id = v_venta_id
    where id = (p->>'pedido_id')::bigint;
  end if;

  perform public._hist('ventas', v_venta_id, 'crear',
    'Venta de '||v_total||' por '||coalesce(p->>'registrado_por','')||
    case when v_es_fiado then ' (fiado)' else '' end, p->>'registrado_por');

  return v_venta_id;
end $$;

-- Anular / eliminar una venta devolviendo el stock y limpiando caja y cobros.
create or replace function public.anular_venta(p_venta_id bigint, p_motivo text default '', p_usuario text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform 1 from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'VENTA_INEXISTENTE' using errcode='P0001'; end if;

  for r in
    select producto_id as pid, sum(cantidad) as cant
    from public.venta_items where venta_id = p_venta_id and producto_id is not null
    group by 1 order by 1
  loop
    update public.productos set stock = stock + r.cant where id = r.pid;
  end loop;

  delete from public.caja_movimientos where venta_id = p_venta_id;
  delete from public.cobros           where venta_id = p_venta_id;
  delete from public.ventas           where id = p_venta_id;  -- cascada: venta_items, venta_repartos

  perform public._hist('ventas', p_venta_id, 'eliminar',
    'Venta anulada'||coalesce(' — '||nullif(p_motivo,''), ''), p_usuario);
end $$;

-- ---------------------------------------------------------------------
-- COBRO de fiado
-- ---------------------------------------------------------------------
-- { "cliente_id": 12, "venta_id": 88, "monto": 20000,
--   "medio_pago": "efectivo", "registrado_por": "Caro", "created_at": "..." }
create or replace function public.registrar_cobro(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_caja bigint;
  v_monto numeric := coalesce((p->>'monto')::numeric,0);
  v_medio text := coalesce(p->>'medio_pago','efectivo');
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
begin
  if v_monto <= 0 then raise exception 'MONTO_INVALIDO' using errcode='P0001'; end if;

  insert into public.cobros (venta_id, cliente_id, monto, medio_pago, registrado_por, created_at)
  values ((p->>'venta_id')::bigint, (p->>'cliente_id')::bigint, v_monto, v_medio,
          p->>'registrado_por', v_created)
  returning id into v_id;

  v_caja := public.caja_abierta_id();
  if v_caja is not null then
    insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, venta_id, fecha, descripcion)
    values (v_caja, 'cobro', v_monto, v_medio, (p->>'venta_id')::bigint, v_created,
            'Cobro de fiado'||coalesce(' venta #'||(p->>'venta_id'), ''));
  end if;

  perform public._hist('cobros', v_id, 'crear',
    'Cobro de '||v_monto||coalesce(' a '||(p->>'cliente_nombre'), ''), p->>'registrado_por');
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- COMPRA a proveedor
-- ---------------------------------------------------------------------
-- { "proveedor_id": 4, "tipo": "mercaderia", "registrado_por": "Caro",
--   "descuento": 0, "total": 120000, "comprobante_url": null,
--   "medio_pago": "efectivo", "monto_efectivo": 120000, "monto_transferencia": 0,
--   "created_at": "...",
--   "items": [ { "producto_id": 5, "cantidad": 10, "costo_unitario": 6000 } ] }
create or replace function public.registrar_compra(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_caja bigint; v_compra_id bigint; v_saldos record;
  v_ef numeric := coalesce((p->>'monto_efectivo')::numeric,0);
  v_tr numeric := coalesce((p->>'monto_transferencia')::numeric,0);
  v_total numeric := coalesce((p->>'total')::numeric,0);
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
  r record;
begin
  v_caja := public.caja_abierta_id();
  if v_caja is null then raise exception 'CAJA_CERRADA' using errcode='P0001'; end if;

  select * into v_saldos from public.saldos_caja(v_caja);
  if v_ef > v_saldos.efectivo then
    raise exception 'SIN_EFECTIVO: disponible %, necesitás %', v_saldos.efectivo, v_ef using errcode='P0001';
  end if;
  if v_tr > v_saldos.banco then
    raise exception 'SIN_BANCO: disponible %, necesitás %', v_saldos.banco, v_tr using errcode='P0001';
  end if;

  insert into public.compras (proveedor_id, tipo, total, descuento, medio_pago,
                              monto_efectivo, monto_transferencia, comprobante_url, registrado_por, created_at)
  values ((p->>'proveedor_id')::bigint, p->>'tipo', v_total,
          coalesce((p->>'descuento')::numeric,0), coalesce(p->>'medio_pago','efectivo'),
          v_ef, v_tr, p->>'comprobante_url', p->>'registrado_por', v_created)
  returning id into v_compra_id;

  -- items (el trigger de 04_triggers.sql llena precio_historial y lotes)
  insert into public.compra_items (compra_id, producto_id, cantidad, costo_unitario)
  select v_compra_id, (x->>'producto_id')::bigint, (x->>'cantidad')::numeric, (x->>'costo_unitario')::numeric
  from jsonb_array_elements(coalesce(nullif(p->'items','null'::jsonb),'[]'::jsonb)) x;

  -- stock + costo_ultimo, con bloqueo y conversión por equivalencia_bolas
  for r in
    select (x->>'producto_id')::bigint as pid,
           sum((x->>'cantidad')::numeric) as cant,
           max((x->>'costo_unitario')::numeric) as costo
    from jsonb_array_elements(coalesce(nullif(p->'items','null'::jsonb),'[]'::jsonb)) x
    group by 1 order by 1
  loop
    update public.productos
      set stock = stock + r.cant * coalesce(equivalencia_bolas, 1),
          costo_ultimo = r.costo
      where id = r.pid;
  end loop;

  if v_ef > 0 then
    insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, compra_id, fecha, descripcion)
    values (v_caja, 'compra', v_ef, 'efectivo', v_compra_id, v_created, 'Compra #'||v_compra_id);
  end if;
  if v_tr > 0 then
    insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, compra_id, fecha, descripcion)
    values (v_caja, 'compra', v_tr, 'transferencia', v_compra_id, v_created, 'Compra #'||v_compra_id);
  end if;

  perform public._hist('compras', v_compra_id, 'crear',
    'Compra por '||v_total, p->>'registrado_por');
  return v_compra_id;
end $$;

-- ---------------------------------------------------------------------
-- PRODUCCIÓN (descuenta insumos según receta)
-- ---------------------------------------------------------------------
create or replace function public.registrar_produccion(
  p_producto_id bigint, p_cantidad numeric, p_usuario text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_stock numeric; v_nombre text; v_det text := '';
begin
  if coalesce(p_cantidad,0) <= 0 then raise exception 'CANTIDAD_INVALIDA' using errcode='P0001'; end if;
  perform 1 from public.productos where id = p_producto_id for update;

  for r in
    select insumo_id as pid, sum(cantidad) as por_unidad
    from public.recetas where producto_terminado_id = p_producto_id
    group by 1 order by 1
  loop
    select stock, nombre into v_stock, v_nombre from public.productos where id = r.pid for update;
    if r.por_unidad * p_cantidad > coalesce(v_stock,0) then
      raise exception 'SIN_INSUMO: % (necesitás %, hay %)',
        v_nombre, r.por_unidad * p_cantidad, coalesce(v_stock,0) using errcode='P0001';
    end if;
    update public.productos set stock = stock - r.por_unidad * p_cantidad where id = r.pid;
    v_det := v_det || v_nombre || ' -' || (r.por_unidad * p_cantidad) || '  ';
  end loop;

  update public.productos set stock = stock + p_cantidad where id = p_producto_id;
  perform public._hist('productos', p_producto_id, 'editar',
    'Producción +'||p_cantidad||coalesce(' (consumió: '||nullif(trim(v_det),'')||')',' (sin receta)'), p_usuario);
end $$;

-- ---------------------------------------------------------------------
-- PÉRDIDA (roturas, vencidos)
-- ---------------------------------------------------------------------
-- { "motivo": "vencidos", "registrado_por": "Caro",
--   "items": [ { "producto_id": 5, "cantidad": 2 } ] }
create or replace function public.registrar_perdida(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_stock numeric; v_nombre text; v_costo numeric;
begin
  for r in
    select (x->>'producto_id')::bigint as pid, sum((x->>'cantidad')::numeric) as cant
    from jsonb_array_elements(coalesce(nullif(p->'items','null'::jsonb),'[]'::jsonb)) x
    group by 1 order by 1
  loop
    select stock, nombre, costo_ultimo into v_stock, v_nombre, v_costo
      from public.productos where id = r.pid for update;
    if r.cant > coalesce(v_stock,0) then
      raise exception 'SIN_STOCK: % (hay %)', v_nombre, coalesce(v_stock,0) using errcode='P0001';
    end if;
    update public.productos set stock = stock - r.cant where id = r.pid;
    insert into public.perdidas (producto_id, cantidad, motivo, costo_unitario, registrado_por)
    values (r.pid, r.cant, p->>'motivo', v_costo, p->>'registrado_por');
    perform public._hist('productos', r.pid, 'editar',
      'Pérdida -'||r.cant||' '||v_nombre||coalesce(' ('||(p->>'motivo')||')',''), p->>'registrado_por');
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- DIVIDIR CUENTA entre varios clientes
-- ---------------------------------------------------------------------
-- { "producto_id": 5, "cantidad": 3, "registrado_por": "Caro",
--   "created_at": "...", "clientes": [12, 15, 19] }
create or replace function public.dividir_cuenta(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_pid bigint := (p->>'producto_id')::bigint;
  v_cant numeric := coalesce((p->>'cantidad')::numeric, 1);
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
  v_precio numeric; v_costo numeric; v_stock numeric; v_nombre text;
  v_total numeric; v_venta_id bigint;
  v_ids bigint[]; v_n int; v_base numeric; v_resto numeric; i int;
begin
  select array_agg(value::text::bigint) into v_ids
  from jsonb_array_elements(coalesce(nullif(p->'clientes','null'::jsonb),'[]'::jsonb));
  v_n := coalesce(array_length(v_ids,1),0);
  if v_n < 2 then raise exception 'MIN_2_CLIENTES' using errcode='P0001'; end if;

  select precio_venta, costo_ultimo, stock, nombre
    into v_precio, v_costo, v_stock, v_nombre
  from public.productos where id = v_pid for update;
  if v_cant > coalesce(v_stock,0) then
    raise exception 'SIN_STOCK: % (hay %)', v_nombre, coalesce(v_stock,0) using errcode='P0001';
  end if;

  v_total := v_precio * v_cant;

  insert into public.ventas (subtotal, descuento_total, total, medio_pago, es_fiado,
                             registrado_por, cliente_id, created_at)
  values (v_total, 0, v_total, 'fiado', true, p->>'registrado_por', null, v_created)
  returning id into v_venta_id;

  insert into public.venta_items (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, descuento, subtotal)
  values (v_venta_id, v_pid, v_cant, v_precio, v_costo, 0, v_total);

  update public.productos set stock = stock - v_cant where id = v_pid;

  v_base := floor(v_total / v_n);
  v_resto := v_total - v_base * v_n;
  for i in 1 .. v_n loop
    insert into public.venta_repartos (venta_id, cliente_id, monto)
    values (v_venta_id, v_ids[i], v_base + case when i = 1 then v_resto else 0 end);
  end loop;

  perform public._hist('ventas', v_venta_id, 'crear',
    'Cuenta dividida: '||v_nombre||' ('||v_total||') entre '||v_n||' clientes', p->>'registrado_por');
  return v_venta_id;
end $$;

-- ---------------------------------------------------------------------
-- Permisos: solo usuarios logueados; nunca el visitante anónimo
-- ---------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'saldos_caja(bigint)','caja_abierta_id()','abrir_caja(numeric,numeric,text)',
    'cerrar_caja(bigint,numeric,numeric,text)','registrar_movimiento_caja(jsonb)',
    'registrar_venta(jsonb)','anular_venta(bigint,text,text)','registrar_cobro(jsonb)',
    'registrar_compra(jsonb)','registrar_produccion(bigint,numeric,text)',
    'registrar_perdida(jsonb)','dividir_cuenta(jsonb)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon;', fn);
    execute format('grant execute on function public.%s to authenticated;', fn);
  end loop;
end $$;

-- Los helpers internos no se exponen a la API
revoke all on function public._hist(text,bigint,text,text,text) from public, anon, authenticated;
revoke all on function public._consumir_ilimitado(bigint,numeric)  from public, anon, authenticated;

commit;
