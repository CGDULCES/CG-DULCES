-- =====================================================================
-- CG DULCES · Vistas de análisis (solo lectura)
-- =====================================================================
-- Alimentan: Rentabilidad, Stock muerto, Lista de reposición,
-- Historial de precios, Analítica (hora / día), Vencimientos y
-- Cierre de caja. El frontend las consulta con sb.from('v_...').select()
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Rentabilidad por producto (histórico + últimos 30/90 días)
-- ---------------------------------------------------------------------
create or replace view public.v_producto_rentabilidad as
select
  p.id,
  p.nombre,
  p.presentacion,
  cat.nombre                                    as categoria,
  p.stock,
  p.precio_venta,
  p.costo_ultimo,
  case when p.precio_venta > 0
       then round(100.0 * (p.precio_venta - p.costo_ultimo) / p.precio_venta, 1) end as margen_actual_pct,
  coalesce(sum(vi.cantidad), 0)                                              as u_hist,
  coalesce(sum(vi.subtotal), 0)                                             as ingreso_hist,
  coalesce(sum(vi.subtotal - coalesce(vi.costo_unitario,0) * vi.cantidad), 0) as ganancia_hist,
  coalesce(sum(vi.cantidad) filter (where v.created_at >= now() - interval '30 days'), 0)  as u_30d,
  coalesce(sum(vi.subtotal) filter (where v.created_at >= now() - interval '30 days'), 0)  as ingreso_30d,
  coalesce(sum(vi.cantidad) filter (where v.created_at >= now() - interval '90 days'), 0)  as u_90d,
  coalesce(sum(vi.subtotal - coalesce(vi.costo_unitario,0)*vi.cantidad)
           filter (where v.created_at >= now() - interval '90 days'), 0)                   as ganancia_90d,
  max(v.created_at)                                                          as ultima_venta,
  (now()::date - max(v.created_at)::date)                                    as dias_sin_vender
from public.productos p
left join public.categorias  cat on cat.id = p.categoria_id
left join public.venta_items vi  on vi.producto_id = p.id
left join public.ventas      v   on v.id = vi.venta_id
where p.activo and not p.es_insumo
group by p.id, cat.nombre;

-- ---------------------------------------------------------------------
-- Stock muerto: hay stock pero no se vende hace 60+ días
-- ---------------------------------------------------------------------
create or replace view public.v_stock_muerto as
select id, nombre, presentacion, categoria, stock, costo_ultimo,
       (stock * costo_ultimo)          as plata_dormida,
       ultima_venta, dias_sin_vender
from public.v_producto_rentabilidad
where stock > 0
  and (ultima_venta is null or ultima_venta < now() - interval '60 days')
order by plata_dormida desc;

-- ---------------------------------------------------------------------
-- Lista de reposición: qué comprar y cuánto
--   venta_diaria = promedio de los últimos 30 días
--   dias_cobertura = cuánto dura el stock actual a ese ritmo
--   sugerido_comprar = volver a 2x el mínimo + 1 semana de venta
-- ---------------------------------------------------------------------
create or replace view public.v_reposicion as
with venta30 as (
  select vi.producto_id, sum(vi.cantidad) as c
  from public.venta_items vi
  join public.ventas v on v.id = vi.venta_id
  where v.created_at >= now() - interval '30 days'
  group by 1
)
select
  p.id, p.nombre, p.presentacion,
  cat.nombre                                   as categoria,
  prov.nombre                                  as proveedor,
  prov.telefono                                as proveedor_telefono,
  p.stock, p.stock_minimo,
  coalesce(v30.c, 0)                           as vendido_30d,
  round(coalesce(v30.c,0) / 30.0, 2)           as venta_diaria,
  case when coalesce(v30.c,0) > 0
       then round(p.stock / (coalesce(v30.c,0) / 30.0), 1) end as dias_cobertura,
  greatest(
    0,
    ceil( (p.stock_minimo * 2) - p.stock + (coalesce(v30.c,0) / 30.0) * 7 )
  )                                            as sugerido_comprar
from public.productos p
left join public.categorias  cat  on cat.id = p.categoria_id
left join public.proveedores prov on prov.id = p.proveedor_habitual_id
left join venta30 v30 on v30.producto_id = p.id
where p.activo and not p.es_insumo
  and ( p.stock <= p.stock_minimo
        or (coalesce(v30.c,0) > 0 and p.stock / (coalesce(v30.c,0)/30.0) < 7) )
order by dias_cobertura nulls first, p.nombre;

-- ---------------------------------------------------------------------
-- Historial de precios de compra (con variación vs. la compra anterior)
-- ---------------------------------------------------------------------
create or replace view public.v_precio_historial as
select
  ph.id,
  ph.fecha,
  p.nombre                                        as producto,
  p.presentacion,
  prov.nombre                                     as proveedor,
  ph.costo_unitario,
  lag(ph.costo_unitario) over (partition by ph.producto_id order by ph.fecha) as costo_anterior,
  ph.costo_unitario
    - lag(ph.costo_unitario) over (partition by ph.producto_id order by ph.fecha) as variacion,
  case when lag(ph.costo_unitario) over (partition by ph.producto_id order by ph.fecha) > 0
       then round(100.0 * (ph.costo_unitario
            - lag(ph.costo_unitario) over (partition by ph.producto_id order by ph.fecha))
            / lag(ph.costo_unitario) over (partition by ph.producto_id order by ph.fecha), 1)
  end                                             as variacion_pct
from public.precio_historial ph
join public.productos p       on p.id = ph.producto_id
left join public.proveedores prov on prov.id = ph.proveedor_id
order by ph.fecha desc;

-- ---------------------------------------------------------------------
-- Analítica simple: a qué hora y qué día se vende más
-- ---------------------------------------------------------------------
create or replace view public.v_ventas_por_hora as
select
  extract(hour from (v.created_at at time zone 'America/Asuncion'))::int as hora,
  count(*)        as cant_ventas,
  sum(v.total)    as total
from public.ventas v
group by 1 order by 1;

create or replace view public.v_ventas_por_dia_semana as
select
  extract(isodow from (v.created_at at time zone 'America/Asuncion'))::int as dia_num,
  to_char((v.created_at at time zone 'America/Asuncion'), 'TMDay')          as dia,
  count(*)     as cant_ventas,
  sum(v.total) as total
from public.ventas v
group by 1, 2 order by 1;

-- ---------------------------------------------------------------------
-- Vencimientos: lotes con saldo, ordenados por el que vence primero
-- ---------------------------------------------------------------------
create or replace view public.v_vencimientos as
select
  l.id,
  p.nombre                                   as producto,
  p.presentacion,
  l.cantidad_restante,
  l.vencimiento,
  (l.vencimiento - (now() at time zone 'America/Asuncion')::date) as dias_para_vencer,
  l.costo_unitario,
  (l.cantidad_restante * coalesce(l.costo_unitario,0))            as plata_en_riesgo
from public.lotes l
join public.productos p on p.id = l.producto_id
where l.cantidad_restante > 0 and l.vencimiento is not null
order by l.vencimiento;

-- ---------------------------------------------------------------------
-- Cierre de caja: resumen por caja (para el "Cierre Z" compartible)
-- ---------------------------------------------------------------------
create or replace view public.v_cierre_caja as
select
  c.id                as caja_id,
  c.estado,
  c.fecha_apertura,
  c.fecha_cierre,
  c.registrado_por,
  c.apertura_efectivo,
  c.apertura_banco,
  c.cierre_efectivo,
  c.cierre_banco,
  coalesce(sum(m.monto) filter (where m.tipo='venta' and m.medio_pago='efectivo'), 0)      as ventas_efectivo,
  coalesce(sum(m.monto) filter (where m.tipo='venta' and m.medio_pago in ('transferencia','qr')), 0) as ventas_banco,
  coalesce(sum(m.monto) filter (where m.tipo='cobro' and m.medio_pago='efectivo'), 0)      as cobros_efectivo,
  coalesce(sum(m.monto) filter (where m.tipo='cobro' and m.medio_pago in ('transferencia','qr')), 0) as cobros_banco,
  coalesce(sum(m.monto) filter (where m.tipo='ingreso_extra'), 0)                          as ingresos_extra,
  coalesce(sum(m.monto) filter (where m.tipo='retiro'), 0)                                 as retiros,
  coalesce(sum(m.monto) filter (where m.tipo='compra'), 0)                                 as compras,
  count(distinct m.venta_id) filter (where m.tipo='venta')                                 as nro_ventas,
  (select s.efectivo from public.saldos_caja(c.id) s)                                      as esperado_efectivo,
  (select s.banco    from public.saldos_caja(c.id) s)                                      as esperado_banco,
  case when c.cierre_efectivo is not null
       then c.cierre_efectivo - (select s.efectivo from public.saldos_caja(c.id) s) end    as diferencia_efectivo,
  case when c.cierre_banco is not null
       then c.cierre_banco - (select s.banco from public.saldos_caja(c.id) s) end          as diferencia_banco
from public.caja c
left join public.caja_movimientos m on m.caja_id = c.id
group by c.id;

-- Permisos de lectura
do $$
declare v text;
begin
  foreach v in array array[
    'v_producto_rentabilidad','v_stock_muerto','v_reposicion','v_precio_historial',
    'v_ventas_por_hora','v_ventas_por_dia_semana','v_vencimientos','v_cierre_caja'
  ]
  loop
    execute format('revoke all on public.%I from anon;', v);
    execute format('grant select on public.%I to authenticated;', v);
  end loop;
end $$;

commit;
