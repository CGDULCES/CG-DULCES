-- Deshace 15_ajustes.sql (vuelve registrar_cobro a su versión anterior).
-- ATENCIÓN: borra las deudas manuales que ya existan (ventas con concepto) y sus cobros.
begin;
delete from public.caja_movimientos where venta_id in (select id from public.ventas where concepto is not null);
delete from public.cobros where venta_id in (select id from public.ventas where concepto is not null);
delete from public.ventas where concepto is not null;

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
  values ((p->>'venta_id')::bigint, (p->>'cliente_id')::bigint, v_monto, v_medio, p->>'registrado_por', v_created)
  returning id into v_id;
  v_caja := public.caja_abierta_id();
  if v_caja is not null then
    insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, venta_id, cobro_id, fecha, descripcion)
    values (v_caja, 'cobro', v_monto, v_medio, (p->>'venta_id')::bigint, v_id, v_created,
            'Cobro de fiado'||coalesce(' venta #'||(p->>'venta_id'), ''));
  end if;
  perform public._hist('cobros', v_id, 'crear',
    'Cobro de '||v_monto||coalesce(' a '||(p->>'cliente_nombre'), ''), p->>'registrado_por');
  return v_id;
end $$;

drop function if exists public.registrar_deuda_manual(jsonb);
drop function if exists public.editar_deuda_manual(bigint, text, numeric, timestamptz, text);
drop index if exists public.cobros_grupo_idx;
alter table public.cobros drop column if exists grupo;
alter table public.ventas drop column if exists concepto;
commit;
