-- =====================================================================
-- CG DULCES · Ajuste 18 — Limpieza de seguridad y rendimiento (auditoría)
-- ---------------------------------------------------------------------
-- 1) Las vistas de reportes corrían con los permisos de su creador
--    ("security definer"). Ahora corren con los permisos de quien consulta
--    (security_invoker), así respetan las reglas de acceso de las tablas.
-- 2) Se borran dos vistas de funciones que ya no existen en la app
--    (v_reposicion y v_vencimientos).
-- 3) Políticas duplicadas: en las tablas donde "app_write" (todo) ya cubre
--    la lectura, se quita "app_read" (leer dos veces la misma regla).
--    Las tablas de plata siguen solo con "app_read" (solo lectura).
-- 4) Índice duplicado en caja_movimientos.
-- =====================================================================

drop view if exists public.v_reposicion;
drop view if exists public.v_vencimientos;

alter view public.v_cierre_caja            set (security_invoker = on);
alter view public.v_precio_historial       set (security_invoker = on);
alter view public.v_producto_rentabilidad  set (security_invoker = on);
alter view public.v_stock_muerto           set (security_invoker = on);
alter view public.v_ventas_por_dia_semana  set (security_invoker = on);
alter view public.v_ventas_por_hora        set (security_invoker = on);

do $$
declare t text;
begin
  for t in
    select p.tablename from pg_policies p
    where p.schemaname = 'public' and p.policyname = 'app_read'
      and exists (select 1 from pg_policies q where q.schemaname='public' and q.tablename=p.tablename and q.policyname='app_write')
  loop
    execute format('drop policy app_read on public.%I', t);
  end loop;
end $$;

drop index if exists public.idx_cajamov_venta;
