-- =====================================================================
-- CG DULCES · AJUSTES 08 (correr una vez)
-- =====================================================================
-- 1) Corrige registrar_cobro para que cada cobro guarde el id del
--    movimiento de caja que generó (cobro_id) -- antes no quedaba
--    enlazado, y por eso "Editar pago" no podía corregir el monto en caja.
-- 2) Nueva funcion anular_cobro(): borra un pago ya registrado y revierte
--    su movimiento de caja, dejando la deuda otra vez como pendiente.
--
-- Es seguro re-ejecutarlo. No borra ni cambia cobros existentes.
-- COMO USARLO: SQL Editor -> New query -> pegar todo -> Run -> "Success".
-- =====================================================================

begin;

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
    insert into public.caja_movimientos (caja_id, tipo, monto, medio_pago, venta_id, cobro_id, fecha, descripcion)
    values (v_caja, 'cobro', v_monto, v_medio, (p->>'venta_id')::bigint, v_id, v_created,
            'Cobro de fiado'||coalesce(' venta #'||(p->>'venta_id'), ''));
  end if;

  perform public._hist('cobros', v_id, 'crear',
    'Cobro de '||v_monto||coalesce(' a '||(p->>'cliente_nombre'), ''), p->>'registrado_por');
  return v_id;
end $$;

create or replace function public.anular_cobro(p_cobro_id bigint, p_motivo text default '', p_usuario text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_cobro record; v_mov_id bigint;
begin
  select * into v_cobro from public.cobros where id = p_cobro_id for update;
  if not found then raise exception 'COBRO_INEXISTENTE' using errcode='P0001'; end if;

  select id into v_mov_id from public.caja_movimientos where cobro_id = p_cobro_id limit 1;

  if v_mov_id is null then
    -- Compatibilidad con cobros hechos antes de guardar cobro_id: mejor
    -- candidato = mismo tipo, mismo monto, misma venta (o ambos sin venta),
    -- la fecha más cercana a la del cobro.
    select id into v_mov_id from public.caja_movimientos
    where tipo = 'cobro' and monto = v_cobro.monto
      and coalesce(venta_id, -1) = coalesce(v_cobro.venta_id, -1)
    order by abs(extract(epoch from (fecha - v_cobro.created_at)))
    limit 1;
  end if;

  if v_mov_id is not null then
    delete from public.caja_movimientos where id = v_mov_id;
  end if;

  delete from public.cobros where id = p_cobro_id;

  perform public._hist('cobros', p_cobro_id, 'eliminar',
    'Pago anulado ('||v_cobro.monto||')'||coalesce(' — '||nullif(p_motivo,''),'')||
    case when v_mov_id is null then ' [no se encontró el movimiento de caja para revertir, revisar saldo]' else '' end,
    p_usuario);

  return v_mov_id is not null;
end $$;


revoke all on function public.anular_cobro(bigint,text,text) from public, anon;
grant execute on function public.anular_cobro(bigint,text,text) to authenticated;

commit;
