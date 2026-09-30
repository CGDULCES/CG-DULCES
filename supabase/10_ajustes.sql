-- =====================================================================
-- CG DULCES · Ajuste 10 — Costo automático para productos con receta
-- ---------------------------------------------------------------------
-- Antes, el costo de un producto con receta (por ej. un postre) había
-- que escribirlo a mano, y no se actualizaba solo aunque cambiaras la
-- receta o subiera el precio de un insumo. Esto hace que el costo (y el
-- margen que se ve en la app) se calcule solo, sumando lo que cuesta
-- cada insumo de la receta, cada vez que:
--   • agregás o quitás un insumo de una receta,
--   • o cambia el costo de un insumo que se usa en alguna receta.
-- No toca nada de productos que NO tienen receta cargada (esos siguen
-- funcionando exactamente igual que antes, costo a mano).
-- =====================================================================

begin;

create or replace function public._recalcular_costo_producto(p_producto_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare v_costo numeric;
begin
  select coalesce(sum(r.cantidad * i.costo_ultimo), 0)
    into v_costo
  from public.recetas r
  join public.productos i on i.id = r.insumo_id
  where r.producto_terminado_id = p_producto_id;

  if exists (select 1 from public.recetas where producto_terminado_id = p_producto_id) then
    update public.productos set costo_ultimo = v_costo where id = p_producto_id;
  end if;
end $$;

create or replace function public._trg_recetas_recalc()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    perform public._recalcular_costo_producto(old.producto_terminado_id);
    return old;
  else
    perform public._recalcular_costo_producto(new.producto_terminado_id);
    if TG_OP = 'UPDATE' and old.producto_terminado_id is distinct from new.producto_terminado_id then
      perform public._recalcular_costo_producto(old.producto_terminado_id);
    end if;
    return new;
  end if;
end $$;

drop trigger if exists trg_recetas_recalc on public.recetas;
create trigger trg_recetas_recalc
  after insert or update or delete on public.recetas
  for each row execute function public._trg_recetas_recalc();

create or replace function public._trg_productos_costo_insumo_recalc()
returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.es_insumo and new.costo_ultimo is distinct from old.costo_ultimo then
    for r in select distinct producto_terminado_id as pid from public.recetas where insumo_id = new.id loop
      perform public._recalcular_costo_producto(r.pid);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_productos_costo_insumo_recalc on public.productos;
create trigger trg_productos_costo_insumo_recalc
  after update on public.productos
  for each row execute function public._trg_productos_costo_insumo_recalc();

-- Los helpers internos no se exponen a la API
revoke all on function public._recalcular_costo_producto(bigint) from public, anon, authenticated;
revoke all on function public._trg_recetas_recalc() from public, anon, authenticated;
revoke all on function public._trg_productos_costo_insumo_recalc() from public, anon, authenticated;

-- Recalcula ahora mismo el costo de todos los productos que ya tienen
-- una receta cargada, para que arranquen con el número correcto.
do $$
declare r record;
begin
  for r in select distinct producto_terminado_id as pid from public.recetas loop
    perform public._recalcular_costo_producto(r.pid);
  end loop;
end $$;

commit;
