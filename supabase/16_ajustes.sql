-- =====================================================================
-- CG DULCES · Ajuste 16 — Baldes/paquetes, más vendidos y análisis
-- ---------------------------------------------------------------------
-- 1) Baldes y paquetes (helado, cobertura, servilleta, cucharita, hielo, pajita):
--    ANTES el stock bajaba 1 apenas se vendía la primera bola, y volvía a
--    "0" aunque al balde le quedara mucho. AHORA:
--      • stock = cantidad de baldes que tenés (incluido el que está en uso)
--      • vender bolas solo suma al contador del balde en uso (no toca el stock)
--      • no se puede vender si stock = 0
--      • el stock baja 1 recién al "Marcar balde como terminado"
-- 2) Funciones: terminar_consumible, agregar_consumible, continuar_consumible
-- 3) productos_mas_vendidos(): top de productos con totales y promedio 30 días
-- 4) v_stock_muerto: ya no marca como "sin vender" a los baldes (se consumen
--    al vender "Helado · Bola", por eso nunca tienen ventas propias).
-- Para volver atrás: 16_ajustes_REVERTIR.sql
-- =====================================================================

-- 1) Consumo: solo suma al contador; exige que haya al menos 1 balde/paquete
create or replace function public._consumir_ilimitado(p_producto_id bigint, p_cantidad numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare v_stock numeric; v_usadas numeric; v_nombre text; v_pres text;
begin
  if p_producto_id is null or coalesce(p_cantidad,0) = 0 then return; end if;
  select stock, bolas_vendidas_actual, nombre, presentacion
    into v_stock, v_usadas, v_nombre, v_pres
  from public.productos where id = p_producto_id for update;

  if coalesce(v_stock,0) <= 0 then
    raise exception 'SIN_INSUMO: No hay más "%" disponible. Agregá un balde/paquete o comprá el insumo.',
      coalesce(v_pres, v_nombre) using errcode = 'P0001';
  end if;
  update public.productos
     set bolas_vendidas_actual = coalesce(v_usadas,0) + p_cantidad
   where id = p_producto_id;
end $$;

-- Migración UNA SOLA VEZ: el balde que ya estaba en uso ahora cuenta dentro del stock
do $$
begin
  if not exists (select 1 from public.configuracion where clave = 'migr_consumibles_16') then
    update public.productos set stock = stock + 1 where coalesce(bolas_vendidas_actual,0) > 0;
    insert into public.configuracion (clave, valor) values ('migr_consumibles_16', now()::text);
  end if;
end $$;

-- 2) Marcar terminado: guarda el rendimiento, baja el stock y reinicia el contador
create or replace function public.terminar_consumible(p_producto_id bigint, p_usuario text default '')
returns numeric
language plpgsql security definer set search_path = public as $$
declare v_stock numeric; v_usadas numeric; v_nombre text;
begin
  select stock, coalesce(bolas_vendidas_actual,0), coalesce(presentacion, nombre)
    into v_stock, v_usadas, v_nombre
  from public.productos where id = p_producto_id for update;
  if not found then raise exception 'PRODUCTO_INEXISTENTE' using errcode='P0001'; end if;
  if v_usadas <= 0 then raise exception 'SIN_USOS_REGISTRADOS' using errcode='P0001'; end if;

  insert into public.helado_rendimientos (producto_id, bolas) values (p_producto_id, v_usadas);
  update public.productos
     set stock = greatest(0, coalesce(v_stock,0) - 1), bolas_vendidas_actual = 0
   where id = p_producto_id;
  perform public._hist('productos', p_producto_id, 'editar', v_nombre||' terminado — rindió '||v_usadas, p_usuario);
  return v_usadas;
end $$;

-- Agregar un balde/paquete (stock + 1)
create or replace function public.agregar_consumible(p_producto_id bigint, p_usuario text default '')
returns numeric
language plpgsql security definer set search_path = public as $$
declare v_stock numeric; v_nombre text;
begin
  select stock, coalesce(presentacion, nombre) into v_stock, v_nombre
  from public.productos where id = p_producto_id for update;
  if not found then raise exception 'PRODUCTO_INEXISTENTE' using errcode='P0001'; end if;
  update public.productos set stock = coalesce(v_stock,0) + 1 where id = p_producto_id;
  perform public._hist('productos', p_producto_id, 'editar', 'Se agregó 1 '||v_nombre||' (stock '||coalesce(v_stock,0)||' → '||(coalesce(v_stock,0)+1)||')', p_usuario);
  return coalesce(v_stock,0) + 1;
end $$;

-- Deshacer el último "terminado" (por error): vuelve el balde y sus bolas contadas
create or replace function public.continuar_consumible(p_producto_id bigint, p_usuario text default '')
returns numeric
language plpgsql security definer set search_path = public as $$
declare v_stock numeric; v_usadas numeric; v_nombre text; v_rend record;
begin
  select stock, coalesce(bolas_vendidas_actual,0), coalesce(presentacion, nombre)
    into v_stock, v_usadas, v_nombre
  from public.productos where id = p_producto_id for update;
  if not found then raise exception 'PRODUCTO_INEXISTENTE' using errcode='P0001'; end if;
  if v_usadas > 0 then raise exception 'YA_HAY_EN_USO' using errcode='P0001'; end if;

  select * into v_rend from public.helado_rendimientos
   where producto_id = p_producto_id order by created_at desc, id desc limit 1;
  if not found then raise exception 'SIN_ANTERIOR' using errcode='P0001'; end if;

  delete from public.helado_rendimientos where id = v_rend.id;
  update public.productos
     set stock = coalesce(v_stock,0) + 1, bolas_vendidas_actual = v_rend.bolas
   where id = p_producto_id;
  perform public._hist('productos', p_producto_id, 'editar', v_nombre||': se continuó el anterior ('||v_rend.bolas||' ya vendidas)', p_usuario);
  return v_rend.bolas;
end $$;

revoke all on function public.terminar_consumible(bigint, text) from public, anon;
revoke all on function public.agregar_consumible(bigint, text) from public, anon;
revoke all on function public.continuar_consumible(bigint, text) from public, anon;
grant execute on function public.terminar_consumible(bigint, text) to authenticated;
grant execute on function public.agregar_consumible(bigint, text) to authenticated;
grant execute on function public.continuar_consumible(bigint, text) to authenticated;

-- 3) Productos más vendidos --------------------------------------------
create or replace function public.productos_mas_vendidos(p_limite int default 20)
returns table (
  nombre text, presentacion text, categoria text, stock numeric,
  unidades_total numeric, ventas_total bigint,
  unidades_30d numeric, promedio_diario_30d numeric, ultima_venta timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.nombre, p.presentacion, max(cat.nombre) as categoria,
         coalesce(sum(p.stock) filter (where p.activo), 0) as stock,
         coalesce(sum(vi.cantidad), 0) as unidades_total,
         count(distinct vi.venta_id) as ventas_total,
         coalesce(sum(vi.cantidad) filter (where v.created_at >= now() - interval '30 days'), 0) as unidades_30d,
         round(coalesce(sum(vi.cantidad) filter (where v.created_at >= now() - interval '30 days'), 0) / 30.0, 2) as promedio_diario_30d,
         max(v.created_at) as ultima_venta
  from public.productos p
  join public.venta_items vi on vi.producto_id = p.id
  join public.ventas v on v.id = vi.venta_id
  left join public.categorias cat on cat.id = p.categoria_id
  group by p.nombre, p.presentacion
  having bool_or(p.activo)
  order by sum(vi.cantidad) desc, p.nombre
  limit greatest(1, least(coalesce(p_limite, 20), 100));
$$;
revoke all on function public.productos_mas_vendidos(int) from public, anon;
grant execute on function public.productos_mas_vendidos(int) to authenticated;

-- 4) Stock muerto: sin baldes/consumibles (se gastan al vender helados, no se venden solos)
create or replace view public.v_stock_muerto as
  select r.id, r.nombre, r.presentacion, r.categoria, r.stock, r.costo_ultimo,
         (r.stock * r.costo_ultimo) as plata_dormida, r.ultima_venta, r.dias_sin_vender
  from public.v_producto_rentabilidad r
  join public.productos p on p.id = r.id
  where r.stock > 0
    and (r.ultima_venta is null or r.ultima_venta < now() - interval '60 days')
    and p.producto_base is null
    and p.nombre not in ('Servilleta','Cucharita','Bolsita de Hielo','Pajita')
  order by (r.stock * r.costo_ultimo) desc;
