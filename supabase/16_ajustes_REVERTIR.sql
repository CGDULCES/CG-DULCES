-- Deshace 16_ajustes.sql: vuelve al modelo anterior de baldes (el stock baja al abrir el balde).
begin;

-- El balde en uso deja de contar dentro del stock
update public.productos set stock = greatest(0, stock - 1) where coalesce(bolas_vendidas_actual,0) > 0;
delete from public.configuracion where clave = 'migr_consumibles_16';

create or replace function public._consumir_ilimitado(p_producto_id bigint, p_cantidad numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare v_stock numeric; v_abiertas numeric; v_nombre text; v_pres text;
begin
  if p_producto_id is null or coalesce(p_cantidad,0) = 0 then return; end if;
  select stock, bolas_vendidas_actual, nombre, presentacion
    into v_stock, v_abiertas, v_nombre, v_pres
  from public.productos where id = p_producto_id for update;
  if v_abiertas is null then v_abiertas := 0; end if;
  if v_abiertas = 0 then
    if coalesce(v_stock,0) <= 0 then
      raise exception 'SIN_INSUMO: No hay más "%" disponible. Comprá o reponé el insumo.',
        coalesce(v_pres, v_nombre) using errcode = 'P0001';
    end if;
    update public.productos set stock = v_stock - 1, bolas_vendidas_actual = p_cantidad where id = p_producto_id;
  else
    update public.productos set bolas_vendidas_actual = v_abiertas + p_cantidad where id = p_producto_id;
  end if;
end $$;

drop function if exists public.terminar_consumible(bigint, text);
drop function if exists public.agregar_consumible(bigint, text);
drop function if exists public.continuar_consumible(bigint, text);
drop function if exists public.productos_mas_vendidos(int);

create or replace view public.v_stock_muerto as
  select id, nombre, presentacion, categoria, stock, costo_ultimo,
         (stock * costo_ultimo) as plata_dormida, ultima_venta, dias_sin_vender
  from public.v_producto_rentabilidad
  where stock > 0 and (ultima_venta is null or ultima_venta < now() - interval '60 days')
  order by (stock * costo_ultimo) desc;
commit;
