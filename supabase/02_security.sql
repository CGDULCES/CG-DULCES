-- =====================================================================
-- CG DULCES · Seguridad (Row Level Security + permisos)
-- =====================================================================
-- QUÉ ARREGLA ESTO:
--   Hoy la "publishable key" está en el HTML público. Sin RLS, cualquiera
--   con esa clave puede LEER y BORRAR toda la base (ventas, deudas de
--   clientes, etc.). Este archivo:
--     1. Activa RLS en TODAS las tablas.
--     2. Quita todo permiso al rol "anon" (visitante sin login).
--     3. Deja acceso completo SOLO a usuarios autenticados (los que
--        entraron con usuario/contraseña).
--
-- Modelo actual: un único login compartido para el negocio.
--   -> "authenticated = todo, anon = nada" es suficiente y CIERRA el agujero.
--
-- Modelo futuro (Fase 2, un login por vendedor): al final de este archivo
--   quedan, comentadas, las políticas por rol (solo la dueña borra ventas,
--   cambia precios, gestiona usuarios). Se activan cuando cada vendedor
--   tenga su propio usuario en Supabase Auth.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Activar RLS en todas las tablas del esquema public
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'configuracion','usuarios_app','categorias','proveedores','clientes',
    'productos','promociones','recetas','caja','caja_movimientos','ventas',
    'venta_items','venta_repartos','cobros','compras','compra_items',
    'perdidas','helado_rendimientos','historial','pedidos','pedido_items',
    'lotes','precio_historial','backups_log'
  ]
  loop
    -- ENABLE: aplica RLS a los roles de la API (anon / authenticated).
    -- NO usamos FORCE a propósito: así el dueño de la tabla (rol postgres del
    -- editor SQL y la service_role) sigue viendo todo para inspeccionar y hacer
    -- backups. La app entra como "authenticated", que SÍ pasa por las políticas.
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Quitar acceso directo a los roles de API salvo por políticas
--    (RLS ya lo hace, pero revocamos GRANTs por las dudas)
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant all on all tables    in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- Para tablas/funciones futuras
alter default privileges in schema public grant all on tables    to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public revoke all on tables    from anon;

-- ---------------------------------------------------------------------
-- 3. Políticas: acceso total para usuarios autenticados
--    (se recrean de forma idempotente)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'configuracion','usuarios_app','categorias','proveedores','clientes',
    'productos','promociones','recetas','caja','caja_movimientos','ventas',
    'venta_items','venta_repartos','cobros','compras','compra_items',
    'perdidas','helado_rendimientos','historial','pedidos','pedido_items',
    'lotes','precio_historial'
  ]
  loop
    execute format('drop policy if exists "app_read"  on public.%I;', t);
    execute format('drop policy if exists "app_write" on public.%I;', t);
    execute format($f$
      create policy "app_read" on public.%I
        for select to authenticated using (true);
    $f$, t);
    execute format($f$
      create policy "app_write" on public.%I
        for all to authenticated using (true) with check (true);
    $f$, t);
  end loop;
end $$;

-- backups_log: la app solo lo lee; lo escribe la Edge Function con service_role
drop policy if exists "backups_read" on public.backups_log;
create policy "backups_read" on public.backups_log
  for select to authenticated using (true);

commit;

-- =====================================================================
-- 4. STORAGE  ->  se configura aparte, en  supabase/06_storage.sql
--    (buckets de comprobantes, fotos de producto y backups).
--    Se dejó fuera de este archivo para que, si algo de Storage falla,
--    NO frene la parte importante (RLS). Correlo después, cuando llegue
--    la Fase 2, o junto con la Edge Function de backup.
--
-- 5. Endurecer Auth  ->  esto NO es SQL, se hace en el panel web:
--    Authentication → Sign In / Providers → Email:
--       • "Allow new users to sign up" (o "Enable Signups")  ->  APAGADO
--       • "Confirm email"                                    ->  ENCENDIDO
--    Project Settings → API:
--       • Rotá la clave "anon / publishable" DESPUÉS de aplicar RLS
--         y pegá la nueva en  js/config.js.
--       • La clave "service_role" NUNCA va en el frontend.
-- =====================================================================

-- =====================================================================
-- 6. (FUTURO · Fase 2) Políticas por rol — dejar COMENTADO por ahora
-- =====================================================================
-- Requisitos previos:
--   • Un usuario de Supabase Auth por vendedor.
--   • usuarios_app.auth_uid enlazado con auth.users.id.
--   • Helper para saber el rol del que está logueado:
--
-- create or replace function public.rol_actual() returns text
-- language sql stable security definer set search_path = public as $$
--   select coalesce(
--     (select rol from public.usuarios_app where auth_uid = auth.uid() and activo limit 1),
--     'vendedor')
-- $$;
--
-- Ejemplo: solo la dueña puede BORRAR ventas y cambiar precios de productos
--
-- drop policy if exists "app_write" on public.ventas;
-- create policy "ventas_insert" on public.ventas
--   for insert to authenticated with check (true);
-- create policy "ventas_update" on public.ventas
--   for update to authenticated using (true) with check (true);
-- create policy "ventas_delete_solo_duena" on public.ventas
--   for delete to authenticated using (public.rol_actual() = 'duena');
-- create policy "ventas_select" on public.ventas
--   for select to authenticated using (true);
--
-- (Repetir el patrón para compras, productos.precio_*, usuarios_app, etc.)
-- =====================================================================
