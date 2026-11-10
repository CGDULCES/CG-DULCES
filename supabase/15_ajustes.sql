-- =====================================================================
-- CG DULCES · Ajuste 15 — Deudas manuales y cobros agrupados
-- ---------------------------------------------------------------------
-- 1) "Agregar deuda": una deuda a un cliente por algo que NO está en el
--    inventario (ej. comida tuya). Se guarda como una venta fiada sin
--    productos, con un texto (concepto). Se cobra igual que cualquier
--    fiado y entra a la caja como cobro, con el concepto en el detalle.
-- 2) Cobros agrupados: cada operación de cobro lleva un "grupo" para que
--    la caja pueda mostrar UN solo total por cobro (y desplegar el detalle).
-- Cambios solo aditivos (columnas nuevas opcionales + funciones).
-- Para volver atrás: 15_ajustes_REVERTIR.sql
-- =====================================================================

alter table public.ventas add column if not exists concepto text;
alter table public.cobros add column if not exists grupo uuid;
create index if not exists cobros_grupo_idx on public.cobros (grupo) where grupo is not null;

-- Registrar una deuda manual ------------------------------------------
create or replace function public.registrar_deuda_manual(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_monto numeric := coalesce((p->>'monto')::numeric, 0);
  v_concepto text := nullif(btrim(coalesce(p->>'concepto','')), '');
  v_cliente bigint := (p->>'cliente_id')::bigint;
  v_fecha timestamptz := coalesce((p->>'created_at')::timestamptz, now());
begin
  if v_concepto is null then raise exception 'CONCEPTO_VACIO' using errcode='P0001'; end if;
  if v_monto <= 0 then raise exception 'MONTO_INVALIDO' using errcode='P0001'; end if;
  perform 1 from public.clientes where id = v_cliente;
  if not found then raise exception 'CLIENTE_INEXISTENTE' using errcode='P0001'; end if;

  insert into public.ventas (subtotal, descuento_total, total, medio_pago, es_fiado,
                             registrado_por, cliente_id, created_at, concepto, es_mayorista)
  values (v_monto, 0, v_monto, 'fiado', true, p->>'registrado_por', v_cliente, v_fecha, v_concepto, false)
  returning id into v_id;

  perform public._hist('ventas', v_id, 'crear',
    'Deuda manual: '||v_concepto||' ('||v_monto||')', p->>'registrado_por');
  return v_id;
end $$;
revoke all on function public.registrar_deuda_manual(jsonb) from public, anon;
grant execute on function public.registrar_deuda_manual(jsonb) to authenticated;

-- Editar una deuda manual (concepto, monto, fecha) ---------------------
create or replace function public.editar_deuda_manual(p_venta_id bigint, p_concepto text, p_monto numeric, p_fecha timestamptz, p_usuario text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_pagado numeric; v_concepto text := nullif(btrim(coalesce(p_concepto,'')), '');
begin
  perform 1 from public.ventas where id = p_venta_id and concepto is not null for update;
  if not found then raise exception 'NO_ES_DEUDA_MANUAL' using errcode='P0001'; end if;
  if v_concepto is null then raise exception 'CONCEPTO_VACIO' using errcode='P0001'; end if;
  if coalesce(p_monto,0) <= 0 then raise exception 'MONTO_INVALIDO' using errcode='P0001'; end if;
  select coalesce(sum(monto),0) into v_pagado from public.cobros where venta_id = p_venta_id;
  if p_monto < v_pagado then raise exception 'MONTO_MENOR_AL_PAGADO' using errcode='P0001'; end if;

  update public.ventas
     set concepto = v_concepto, subtotal = p_monto, total = p_monto, created_at = coalesce(p_fecha, created_at)
   where id = p_venta_id;
  perform public._hist('ventas', p_venta_id, 'editar', 'Deuda manual editada: '||v_concepto||' ('||p_monto||')', p_usuario);
  return true;
end $$;
revoke all on function public.editar_deuda_manual(bigint, text, numeric, timestamptz, text) from public, anon;
grant execute on function public.editar_deuda_manual(bigint, text, numeric, timestamptz, text) to authenticated;

-- registrar_cobro: ahora guarda el "grupo" y, si la venta es una deuda
-- manual, pone el concepto en el detalle del movimiento de caja ---------
create or replace function public.registrar_cobro(p jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_caja bigint; v_concepto text;
  v_monto numeric := coalesce((p->>'monto')::numeric,0);
  v_medio text := coalesce(p->>'medio_pago','efectivo');
  v_created timestamptz := coalesce((p->>'created_at')::timestamptz, now());
  v_grupo uuid := nullif(p->>'grupo','')::uuid;
begin
  if v_monto <= 0 then raise exception 'MONTO_INVALIDO' using errcode='P0001'; end if;

  insert into public.cobros (venta_id, cliente_id, monto, medio_pago, registrado_por, created_at, grupo)
  values ((p->>'venta_id')::bigint, (p->>'cliente_id')::bigint, v_monto, v_medio,
          p->>'registrado_por', v_created, v_grupo)
  returning id into v_id;

  select concepto into v_concepto from public.ventas where id = (p->>'venta_id')::bigint;

  v_caja := public.caja_abierta_id();
  if v_caja is not null then
    insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, venta_id, cobro_id, fecha, descripcion)
    values (v_caja, 'cobro', v_monto, v_medio, (p->>'venta_id')::bigint, v_id, v_created,
            case when v_concepto is not null then 'Cobro de deuda: '||v_concepto
                 else 'Cobro de fiado'||coalesce(' venta #'||(p->>'venta_id'), '') end);
  end if;

  perform public._hist('cobros', v_id, 'crear',
    'Cobro de '||v_monto||coalesce(' a '||(p->>'cliente_nombre'), ''), p->>'registrado_por');
  return v_id;
end $$;
