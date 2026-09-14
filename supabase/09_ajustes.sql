-- =====================================================================
-- CG DULCES · AJUSTES 09 (correr una vez)
-- =====================================================================
-- 1) anular_venta(): ahora no le suma stock de mas a "Helado - Bola" /
--    "Helado - Pote 1/4" (son productos virtuales, nunca se les
--    descuenta stock propio al vender). Antes de esto la funcion no
--    se usaba desde la app todavia, asi que no afecto datos reales.
-- 2) Nueva funcion editar_cobro(): corrige un pago (monto/forma de pago)
--    Y ajusta su movimiento de caja al mismo tiempo, con el mismo
--    "buscador" de respaldo que anular_cobro para pagos viejos sin el
--    enlace directo. Reemplaza el "Editar" de Clientes -> Ver pagos,
--    que antes podia corregir el pago pero dejar la caja con el monto
--    viejo si el pago era de antes del enlace directo (08_ajustes.sql).
--
-- Es seguro re-ejecutarlo. No borra ni cambia cobros/ventas existentes.
-- COMO USARLO: SQL Editor -> New query -> pegar todo -> Run -> "Success".
-- =====================================================================

begin;

-- Devuelve true si la venta tenía Helados armados (su consumo de bolas /
-- insumos NO se deshace solo -- igual que antes, hay que ajustarlo a mano).
-- (drop porque cambia el tipo de retorno: antes "void", ahora "boolean")
drop function if exists public.anular_venta(bigint, text, text);
create or replace function public.anular_venta(p_venta_id bigint, p_motivo text default '', p_usuario text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare r record; v_hubo_helado boolean := false;
begin
  perform 1 from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'VENTA_INEXISTENTE' using errcode='P0001'; end if;

  for r in
    select vi.producto_id as pid, sum(vi.cantidad) as cant, max(p.nombre) as nombre
    from public.venta_items vi
    join public.productos p on p.id = vi.producto_id
    where vi.venta_id = p_venta_id and vi.producto_id is not null
    group by vi.producto_id order by 1
  loop
    -- "Helado · Bola" / "Helado · Pote 1/4" son productos virtuales: nunca
    -- se les descontó stock propio al vender (ver registrar_venta /
    -- descontar_stock=false), así que tampoco hay que sumarles al anular.
    if r.nombre in ('Helado · Bola', 'Helado · Pote 1/4') then
      v_hubo_helado := true;
    else
      update public.productos set stock = stock + r.cant where id = r.pid;
    end if;
  end loop;

  delete from public.caja_movimientos where venta_id = p_venta_id;
  delete from public.cobros           where venta_id = p_venta_id;
  delete from public.ventas           where id = p_venta_id;  -- cascada: venta_items, venta_repartos

  perform public._hist('ventas', p_venta_id, 'eliminar',
    'Venta anulada'||coalesce(' — '||nullif(p_motivo,''), ''), p_usuario);

  return v_hubo_helado;
end $$;

create or replace function public.editar_cobro(
  p_cobro_id bigint, p_monto numeric, p_medio_pago text, p_usuario text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_cobro record; v_mov_id bigint;
begin
  if coalesce(p_monto, 0) <= 0 then raise exception 'MONTO_INVALIDO' using errcode='P0001'; end if;
  select * into v_cobro from public.cobros where id = p_cobro_id for update;
  if not found then raise exception 'COBRO_INEXISTENTE' using errcode='P0001'; end if;

  select id into v_mov_id from public.caja_movimientos where cobro_id = p_cobro_id limit 1;
  if v_mov_id is null then
    select id into v_mov_id from public.caja_movimientos
    where tipo = 'cobro' and monto = v_cobro.monto
      and coalesce(venta_id, -1) = coalesce(v_cobro.venta_id, -1)
    order by abs(extract(epoch from (fecha - v_cobro.created_at)))
    limit 1;
  end if;

  update public.cobros set monto = p_monto, medio_pago = p_medio_pago where id = p_cobro_id;

  if v_mov_id is not null then
    update public.caja_movimientos
      set monto = p_monto, medio_pago = p_medio_pago, cobro_id = p_cobro_id
      where id = v_mov_id;
  end if;

  perform public._hist('cobros', p_cobro_id, 'editar',
    'Pago corregido a '||p_monto||' ('||p_medio_pago||')'||
    case when v_mov_id is null then ' [no se encontró el movimiento de caja para ajustar, revisar saldo]' else '' end,
    p_usuario);

  return v_mov_id is not null;
end $$;


revoke all on function public.editar_cobro(bigint,numeric,text,text) from public, anon;
grant execute on function public.editar_cobro(bigint,numeric,text,text) to authenticated;

commit;
