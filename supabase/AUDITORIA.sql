-- =====================================================================
-- CG DULCES · AUDITORÍA DE CAJA (solo lectura, no cambia nada)
-- =====================================================================
-- Son 3 consultas. Corré cada una POR SEPARADO en el SQL Editor
-- (borrá el contenido y pegá la siguiente) y mandame screenshot o el
-- texto de cada resultado. Ninguna de las tres modifica datos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PARTE A — Cada caja: lo que el sistema calcula vs. lo que contaste
--           al cerrar. Acá se ve EN QUÉ CAJA (y cuándo) apareció una
--           diferencia por primera vez.
-- ---------------------------------------------------------------------
select
  c.id                                                                   as caja_id,
  c.estado,
  to_char(c.fecha_apertura at time zone 'America/Asuncion', 'DD/MM HH24:MI')  as apertura,
  c.apertura_efectivo,
  c.apertura_banco,
  to_char(c.fecha_cierre at time zone 'America/Asuncion', 'DD/MM HH24:MI')    as cierre,
  round(s.efectivo)                                                      as efectivo_calculado,
  c.cierre_efectivo                                                      as efectivo_contado,
  case when c.cierre_efectivo is not null then round(c.cierre_efectivo - s.efectivo) end as diferencia_efectivo,
  round(s.banco)                                                         as banco_calculado,
  c.cierre_banco                                                         as banco_contado,
  case when c.cierre_banco is not null then round(c.cierre_banco - s.banco) end as diferencia_banco
from public.caja c
cross join lateral public.saldos_caja(c.id) s
order by c.fecha_apertura;


-- ---------------------------------------------------------------------
-- PARTE B — Cosas "raras" en los movimientos (fantasmas, duplicados,
--           cobros que nunca llegaron a sumarse a la caja, cajas que no
--           empalman con el cierre anterior).
-- ---------------------------------------------------------------------
select 'Cobros que nunca sumaron a ninguna caja' as chequeo,
       count(*)::text as cantidad, coalesce(sum(monto),0)::text as monto_total
from public.cobros c
where not exists (select 1 from public.caja_movimientos m where m.cobro_id = c.id)
  and not exists (
    select 1 from public.caja_movimientos m2
    where m2.tipo='cobro' and m2.monto = c.monto
      and coalesce(m2.venta_id,-1) = coalesce(c.venta_id,-1)
  )

union all
select 'Movimientos de "cobro" en caja sin ningún cobro real (fantasma)',
       count(*)::text, coalesce(sum(m.monto),0)::text
from public.caja_movimientos m
where m.tipo='cobro' and m.cobro_id is not null
  and not exists (select 1 from public.cobros c where c.id = m.cobro_id)

union all
select 'Movimientos de "venta" en caja sin ninguna venta real (fantasma)',
       count(*)::text, coalesce(sum(m.monto),0)::text
from public.caja_movimientos m
where m.tipo='venta' and m.venta_id is not null
  and not exists (select 1 from public.ventas v where v.id = m.venta_id)

union all
select 'Movimientos de "compra" en caja sin ninguna compra real (fantasma)',
       count(*)::text, coalesce(sum(m.monto),0)::text
from public.caja_movimientos m
where m.tipo='compra' and m.compra_id is not null
  and not exists (select 1 from public.compras co where co.id = m.compra_id)

union all
select 'Posibles cobros duplicados (mismo cliente, monto y venta, a los pocos segundos)',
       count(*)::text, coalesce(sum(monto),0)::text
from (
  select c1.id, c1.monto
  from public.cobros c1
  join public.cobros c2 on c2.id <> c1.id
    and c2.cliente_id = c1.cliente_id
    and c2.monto = c1.monto
    and coalesce(c2.venta_id,-1) = coalesce(c1.venta_id,-1)
    and abs(extract(epoch from (c2.created_at - c1.created_at))) < 10
  where c1.id < c2.id
) dup

union all
select 'Cajas que abrieron con un monto distinto al cierre de la anterior',
       count(*)::text, ''
from (
  select c.id, c.apertura_efectivo, c.apertura_banco,
         lag(c.cierre_efectivo) over (order by c.fecha_apertura) as cierre_ant_ef,
         lag(c.cierre_banco)    over (order by c.fecha_apertura) as cierre_ant_ba
  from public.caja c
) x
where x.cierre_ant_ef is not null
  and (x.apertura_efectivo <> x.cierre_ant_ef or x.apertura_banco <> x.cierre_ant_ba)

order by 1;


-- ---------------------------------------------------------------------
-- PARTE C — Números de ahora mismo (para comparar con lo que ves en
--           la pestaña "Caja" de la app).
-- ---------------------------------------------------------------------
select
  (select count(*) from public.caja)                                   as cajas_totales,
  (select id from public.caja where estado='abierta'
     order by fecha_apertura desc limit 1)                              as caja_abierta_id,
  round((select efectivo from public.saldos_caja(
     (select id from public.caja where estado='abierta' order by fecha_apertura desc limit 1)
  )))                                                                   as efectivo_caja_actual,
  round((select banco from public.saldos_caja(
     (select id from public.caja where estado='abierta' order by fecha_apertura desc limit 1)
  )))                                                                   as banco_caja_actual;
