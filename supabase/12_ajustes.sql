-- =====================================================================
-- CG DULCES · Ajuste 12 — Editar venta, editar compra y eliminar compra
--                         como funciones atómicas (todo o nada)
-- ---------------------------------------------------------------------
-- Antes la app hacía estos cambios paso a paso desde el navegador:
-- si se cortaba a la mitad quedaban stock, items y caja descuadrados.
-- Ahora cada operación es UNA transacción con bloqueo de filas.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- EDITAR VENTA
-- { "venta_id": 10, "cliente_id": null|5, "created_at": "...", "usuario": "Guada",
--   "items": [ { "id": 77|null, "producto_id": 3, "cantidad": 2,
--                "precio_unitario": 5000, "descuento": 0, "costo_unitario": 2000 } ] }
-- ---------------------------------------------------------------------
create or replace function public.editar_venta(p jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint := (p->>'venta_id')::bigint;
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
  v_items jsonb := coalesce(nullif(p->'items','null'::jsonb),'[]'::jsonb);
  v_venta record; r record; v_stock numeric; v_nombre text;
  v_sub numeric; v_desc numeric; v_total numeric;
  v_ratio numeric; v_ef numeric; v_tr numeric; v_ant numeric; v_caja bigint;
begin
  select * into v_venta from public.ventas where id = v_id for update;
  if not found then raise exception 'VENTA_INEXISTENTE' using errcode='P0001'; end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'VENTA_SIN_ITEMS' using errcode='P0001'; end if;

  -- Ajuste neto de stock por producto (+ = ahora se vende más)
  for r in
    with nuevos as (
      select (x->>'producto_id')::bigint as pid, sum((x->>'cantidad')::numeric) as cant
      from jsonb_array_elements(v_items) x group by 1),
    orig as (
      select producto_id as pid, sum(cantidad) as cant from public.venta_items where venta_id = v_id group by 1)
    select coalesce(n.pid, o.pid) as pid, coalesce(n.cant,0) - coalesce(o.cant,0) as delta
    from nuevos n full join orig o on o.pid = n.pid
    order by 1
  loop
    select stock, nombre into v_stock, v_nombre from public.productos where id = r.pid for update;
    continue when v_nombre in ('Helado · Bola','Helado · Pote 1/4');
    if r.delta > 0 and v_stock - r.delta < 0 then
      raise exception 'SIN_STOCK: % (hay %)', v_nombre, v_stock using errcode='P0001';
    end if;
    update public.productos set stock = stock - r.delta where id = r.pid;
  end loop;

  -- Items quitados
  delete from public.venta_items
  where venta_id = v_id
    and id not in (select (x->>'id')::bigint from jsonb_array_elements(v_items) x where x->>'id' is not null);

  -- Items que ya existían
  update public.venta_items vi set
    producto_id = (x->>'producto_id')::bigint,
    cantidad = (x->>'cantidad')::numeric,
    precio_unitario = (x->>'precio_unitario')::numeric,
    descuento = coalesce((x->>'descuento')::numeric,0),
    subtotal = (x->>'cantidad')::numeric * (x->>'precio_unitario')::numeric - coalesce((x->>'descuento')::numeric,0)
  from jsonb_array_elements(v_items) x
  where x->>'id' is not null and vi.id = (x->>'id')::bigint and vi.venta_id = v_id;

  -- Items nuevos
  insert into public.venta_items (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, descuento, subtotal)
  select v_id, (x->>'producto_id')::bigint, (x->>'cantidad')::numeric, (x->>'precio_unitario')::numeric,
         coalesce((x->>'costo_unitario')::numeric,0), coalesce((x->>'descuento')::numeric,0),
         (x->>'cantidad')::numeric * (x->>'precio_unitario')::numeric - coalesce((x->>'descuento')::numeric,0)
  from jsonb_array_elements(v_items) x
  where x->>'id' is null;

  select coalesce(sum((x->>'cantidad')::numeric * (x->>'precio_unitario')::numeric),0),
         coalesce(sum(coalesce((x->>'descuento')::numeric,0)),0)
    into v_sub, v_desc
  from jsonb_array_elements(v_items) x;
  v_total := v_sub - v_desc;

  update public.ventas set cliente_id = (p->>'cliente_id')::bigint, subtotal = v_sub,
         descuento_total = v_desc, total = v_total, created_at = v_created
  where id = v_id;

  -- Si no era fiada, el movimiento de caja pasa al nuevo total (mismo reparto efectivo/transferencia)
  if not coalesce(v_venta.es_fiado, false) then
    v_ant := coalesce(v_venta.monto_efectivo,0) + coalesce(v_venta.monto_transferencia,0);
    v_ratio := case when v_ant > 0 then coalesce(v_venta.monto_efectivo,0) / v_ant else 1 end;
    v_ef := round(v_total * v_ratio);
    v_tr := v_total - v_ef;
    delete from public.caja_movimientos where venta_id = v_id and cobro_id is null;
    v_caja := public.caja_abierta_id();
    if (v_ef > 0 or v_tr > 0) and v_caja is null then raise exception 'CAJA_CERRADA' using errcode='P0001'; end if;
    if v_ef > 0 then
      insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, venta_id, fecha, descripcion)
      values (v_caja, 'venta', v_ef, 'efectivo', v_id, v_created, 'Venta #'||v_id||' (editada)');
    end if;
    if v_tr > 0 then
      insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, venta_id, fecha, descripcion)
      values (v_caja, 'venta', v_tr, 'transferencia', v_id, v_created, 'Venta #'||v_id||' (editada)');
    end if;
    update public.ventas set monto_efectivo = v_ef, monto_transferencia = v_tr where id = v_id;
  end if;

  perform public._hist('ventas', v_id, 'editar', 'Venta editada, nuevo total '||v_total, p->>'usuario');
  return true;
end $$;

-- ---------------------------------------------------------------------
-- EDITAR COMPRA
-- { "compra_id": 4, "proveedor_id": 2, "tipo": "productos", "total": 100000, "descuento": 0,
--   "created_at": "...", "medio_pago": "efectivo", "monto_efectivo": 100000,
--   "monto_transferencia": 0, "usuario": "Guada",
--   "items": [ { "id": 9|null, "producto_id": 3, "cantidad": 10, "costo_unitario": 1000 } ] }
-- ---------------------------------------------------------------------
create or replace function public.editar_compra(p jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint := (p->>'compra_id')::bigint;
  v_ef numeric := coalesce((p->>'monto_efectivo')::numeric,0);
  v_tr numeric := coalesce((p->>'monto_transferencia')::numeric,0);
  v_total numeric := coalesce((p->>'total')::numeric,0);
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
  v_items jsonb := coalesce(nullif(p->'items','null'::jsonb),'[]'::jsonb);
  r record; v_stock numeric; v_nombre text; v_f numeric; v_caja bigint;
begin
  perform 1 from public.compras where id = v_id for update;
  if not found then raise exception 'COMPRA_INEXISTENTE' using errcode='P0001'; end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'COMPRA_SIN_ITEMS' using errcode='P0001'; end if;

  -- Ajuste neto de stock por producto (+ = ahora entra más), con conversión por equivalencia
  for r in
    with nuevos as (
      select (x->>'producto_id')::bigint as pid, sum((x->>'cantidad')::numeric) as cant
      from jsonb_array_elements(v_items) x group by 1),
    orig as (
      select producto_id as pid, sum(cantidad) as cant from public.compra_items where compra_id = v_id group by 1)
    select coalesce(n.pid, o.pid) as pid, coalesce(n.cant,0) - coalesce(o.cant,0) as delta
    from nuevos n full join orig o on o.pid = n.pid
    order by 1
  loop
    select stock, nombre, coalesce(equivalencia_bolas,1) into v_stock, v_nombre, v_f
      from public.productos where id = r.pid for update;
    if r.delta < 0 and v_stock + r.delta * v_f < 0 then
      raise exception 'SIN_STOCK: % (hay %)', v_nombre, v_stock using errcode='P0001';
    end if;
    update public.productos set stock = stock + r.delta * v_f where id = r.pid;
  end loop;

  -- Costo último de cada producto que sigue en la compra
  for r in
    select (x->>'producto_id')::bigint as pid, max((x->>'costo_unitario')::numeric) as costo
    from jsonb_array_elements(v_items) x group by 1 order by 1
  loop
    update public.productos set costo_ultimo = r.costo where id = r.pid;
  end loop;

  delete from public.compra_items
  where compra_id = v_id
    and id not in (select (x->>'id')::bigint from jsonb_array_elements(v_items) x where x->>'id' is not null);

  update public.compra_items ci set
    producto_id = (x->>'producto_id')::bigint,
    cantidad = (x->>'cantidad')::numeric,
    costo_unitario = (x->>'costo_unitario')::numeric
  from jsonb_array_elements(v_items) x
  where x->>'id' is not null and ci.id = (x->>'id')::bigint and ci.compra_id = v_id;

  insert into public.compra_items (compra_id, producto_id, cantidad, costo_unitario)
  select v_id, (x->>'producto_id')::bigint, (x->>'cantidad')::numeric, (x->>'costo_unitario')::numeric
  from jsonb_array_elements(v_items) x
  where x->>'id' is null;

  update public.compras set proveedor_id = (p->>'proveedor_id')::bigint, tipo = p->>'tipo',
         total = v_total, descuento = coalesce((p->>'descuento')::numeric,0), created_at = v_created,
         medio_pago = coalesce(p->>'medio_pago','efectivo'), monto_efectivo = v_ef, monto_transferencia = v_tr
  where id = v_id;

  delete from public.caja_movimientos where compra_id = v_id;
  v_caja := public.caja_abierta_id();
  if (v_ef > 0 or v_tr > 0) and v_caja is null then raise exception 'CAJA_CERRADA' using errcode='P0001'; end if;
  if v_ef > 0 then
    insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, compra_id, fecha, descripcion)
    values (v_caja, 'compra', v_ef, 'efectivo', v_id, v_created, 'Compra #'||v_id||' (editada)');
  end if;
  if v_tr > 0 then
    insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, compra_id, fecha, descripcion)
    values (v_caja, 'compra', v_tr, 'transferencia', v_id, v_created, 'Compra #'||v_id||' (editada)');
  end if;

  perform public._hist('compras', v_id, 'editar', 'Compra editada, nuevo total '||v_total, p->>'usuario');
  return true;
end $$;

-- ---------------------------------------------------------------------
-- ELIMINAR COMPRA (descuenta del stock lo que había sumado y devuelve el dinero a la caja)
-- ---------------------------------------------------------------------
create or replace function public.eliminar_compra(p_compra_id bigint, p_usuario text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform 1 from public.compras where id = p_compra_id for update;
  if not found then raise exception 'COMPRA_INEXISTENTE' using errcode='P0001'; end if;

  for r in
    select producto_id as pid, sum(cantidad) as cant from public.compra_items
    where compra_id = p_compra_id group by 1 order by 1
  loop
    update public.productos set stock = stock - r.cant * coalesce(equivalencia_bolas,1) where id = r.pid;
  end loop;

  delete from public.caja_movimientos where compra_id = p_compra_id;
  delete from public.compras where id = p_compra_id;

  perform public._hist('compras', p_compra_id, 'eliminar', 'Compra eliminada', p_usuario);
  return true;
end $$;

-- Solo usuarios con sesión iniciada (nunca anónimos)
revoke all on function public.editar_venta(jsonb) from public, anon;
revoke all on function public.editar_compra(jsonb) from public, anon;
revoke all on function public.eliminar_compra(bigint, text) from public, anon;
grant execute on function public.editar_venta(jsonb) to authenticated;
grant execute on function public.editar_compra(jsonb) to authenticated;
grant execute on function public.eliminar_compra(bigint, text) to authenticated;

commit;
