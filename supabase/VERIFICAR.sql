-- =====================================================================
-- CG DULCES · VERIFICAR que todo quedó bien
-- =====================================================================
-- Corré esto DESPUÉS de APLICAR-TODO.sql.
-- Copiá la tabla que devuelve y mandásela a Claude.
-- Todo lo que diga "OK" está bien. Si algo dice "FALTA", avisá.
-- =====================================================================
with
tablas_esperadas(t) as (values
  ('configuracion'),('usuarios_app'),('categorias'),('proveedores'),('clientes'),
  ('productos'),('promociones'),('recetas'),('caja'),('caja_movimientos'),('ventas'),
  ('venta_items'),('venta_repartos'),('cobros'),('compras'),('compra_items'),
  ('perdidas'),('helado_rendimientos'),('historial'),('pedidos'),('pedido_items'),
  ('lotes'),('precio_historial'),('backups_log')
),
funcs_esperadas(f) as (values
  ('registrar_venta'),('anular_venta'),('registrar_compra'),('registrar_cobro'),
  ('dividir_cuenta'),('registrar_produccion'),('registrar_perdida'),
  ('abrir_caja'),('cerrar_caja'),('registrar_movimiento_caja'),('saldos_caja'),('caja_abierta_id')
),
vistas_esperadas(v) as (values
  ('v_producto_rentabilidad'),('v_stock_muerto'),('v_reposicion'),('v_precio_historial'),
  ('v_ventas_por_hora'),('v_ventas_por_dia_semana'),('v_vencimientos'),('v_cierre_caja')
)
select '1. Tablas' as chequeo,
       case when count(*) filter (where c.table_name is null) = 0 then 'OK'
            else 'FALTA: ' || string_agg(te.t, ', ') filter (where c.table_name is null) end as resultado,
       count(*) filter (where c.table_name is not null) || ' de ' || count(*) || ' presentes' as detalle
from tablas_esperadas te
left join information_schema.tables c
  on c.table_schema='public' and c.table_name=te.t

union all
select '2. Columnas nuevas en productos',
       case when count(*)=4 then 'OK' else 'FALTA alguna' end,
       string_agg(column_name, ', ')
from information_schema.columns
where table_schema='public' and table_name='productos'
  and column_name in ('foto_url','precio_mayorista','mayorista_min_cant','vida_util_dias')

union all
select '3. RLS activado (seguridad)',
       case when count(*) filter (where not relrowsecurity) = 0 then 'OK'
            else 'FALTA en: ' || string_agg(relname, ', ') filter (where not relrowsecurity) end,
       count(*) filter (where relrowsecurity) || ' de ' || count(*) || ' tablas protegidas'
from pg_class
where relnamespace='public'::regnamespace and relkind='r'
  and relname in (select t from tablas_esperadas)

union all
select '4. Funciones transaccionales',
       case when count(*) filter (where p.proname is null)=0 then 'OK'
            else 'FALTA: ' || string_agg(fe.f, ', ') filter (where p.proname is null) end,
       count(*) filter (where p.proname is not null) || ' de ' || count(*) || ' creadas'
from funcs_esperadas fe
left join pg_proc p on p.proname=fe.f and p.pronamespace='public'::regnamespace

union all
select '5. Vistas de análisis',
       case when count(*) filter (where v.viewname is null)=0 then 'OK'
            else 'FALTA: ' || string_agg(ve.v, ', ') filter (where v.viewname is null) end,
       count(*) filter (where v.viewname is not null) || ' de ' || count(*) || ' creadas'
from vistas_esperadas ve
left join pg_views v on v.schemaname='public' and v.viewname=ve.v

union all
select '6. Trigger de precios/lotes',
       case when exists (select 1 from pg_trigger where tgname='trg_compra_item_ai') then 'OK' else 'FALTA' end,
       'trg_compra_item_ai'

union all
select '7. Acceso anónimo bloqueado',
       case when not exists (
         select 1 from information_schema.role_table_grants
         where grantee='anon' and table_schema='public'
           and table_name in (select t from tablas_esperadas)
       ) then 'OK' else 'REVISAR: anon todavía tiene permisos' end,
       'el visitante sin login no debe poder tocar nada'

order by chequeo;
