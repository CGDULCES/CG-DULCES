-- =====================================================================
-- CG DULCES · Triggers
-- =====================================================================
-- 1. Cada línea de compra deja registro en precio_historial
--    (para ver la evolución del costo por proveedor).
-- 2. Si el producto tiene vida_util_dias, se crea un lote con su
--    fecha de vencimiento estimada (para el módulo de Vencimientos).
--
-- Funcionan tanto si la compra entra por la RPC registrar_compra()
-- como si se sigue insertando desde el frontend viejo.
-- =====================================================================

begin;

create or replace function public._compra_item_after_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prov_id bigint;
  v_vida int;
  v_venc date;
begin
  select c.proveedor_id into v_prov_id from public.compras c where c.id = new.compra_id;

  insert into public.precio_historial (producto_id, proveedor_id, compra_id, costo_unitario, fecha)
  values (new.producto_id, v_prov_id, new.compra_id, new.costo_unitario, now());

  select vida_util_dias into v_vida from public.productos where id = new.producto_id;
  if v_vida is not null and v_vida > 0 then
    v_venc := (now() at time zone 'America/Asuncion')::date + v_vida;
    insert into public.lotes (producto_id, compra_id, cantidad, cantidad_restante, vencimiento, costo_unitario)
    values (new.producto_id, new.compra_id, new.cantidad, new.cantidad, v_venc, new.costo_unitario);
  end if;

  return new;
end $$;

drop trigger if exists trg_compra_item_ai on public.compra_items;
create trigger trg_compra_item_ai
  after insert on public.compra_items
  for each row execute function public._compra_item_after_insert();

revoke all on function public._compra_item_after_insert() from public, anon, authenticated;

commit;
