-- =====================================================================
-- CG DULCES · Ajuste 13 — Tablas de plata solo por funciones
-- ---------------------------------------------------------------------
-- Antes, cualquier usuario con sesión podía leer, modificar y BORRAR
-- directo las tablas de dinero. Ahora:
--   • Las tablas de plata (caja, caja_movimientos, cobros, ventas,
--     venta_items, compras, compra_items) quedan de solo lectura desde
--     el navegador. Todo cambio pasa por las funciones atómicas.
--   • Se eliminan las políticas duplicadas.
--   • El historial queda como estaba (se puede borrar); las ventas
--     cargadas por error se siguen eliminando desde la app con "Eliminar
--     venta" (función anular_venta, que devuelve stock y dinero a la caja).
-- Para volver atrás: 13_ajustes_REVERTIR.sql
-- =====================================================================

begin;

-- Cambiar la fecha de una cuenta compartida (única escritura directa que quedaba)
create or replace function public.cambiar_fecha_venta(p_venta_id bigint, p_fecha timestamptz, p_usuario text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.ventas set created_at = p_fecha where id = p_venta_id;
  if not found then raise exception 'VENTA_INEXISTENTE' using errcode='P0001'; end if;
  perform public._hist('ventas', p_venta_id, 'editar', 'Fecha de cuenta compartida corregida', p_usuario);
  return true;
end $$;
revoke all on function public.cambiar_fecha_venta(bigint, timestamptz, text) from public, anon;
grant execute on function public.cambiar_fecha_venta(bigint, timestamptz, text) to authenticated;

-- 1) Quitar la política duplicada "Acceso autenticado X" donde ya existe app_write
do $$
declare t text;
begin
  for t in
    select p.tablename from pg_policies p
    where p.schemaname = 'public' and p.policyname = 'Acceso autenticado ' || p.tablename
      and exists (select 1 from pg_policies q where q.schemaname='public' and q.tablename=p.tablename and q.policyname='app_write')
  loop
    execute format('drop policy %I on public.%I', 'Acceso autenticado ' || t, t);
  end loop;
end $$;

-- 2) Tablas de plata: solo lectura directa (las funciones atómicas escriben por ellas)
do $$
declare t text;
begin
  foreach t in array array['caja','caja_movimientos','cobros','ventas','venta_items','compras','compra_items']
  loop
    execute format('drop policy if exists app_write on public.%I', t);
  end loop;
end $$;

commit;
