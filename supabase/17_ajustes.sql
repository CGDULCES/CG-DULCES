-- Ajuste 17 — Stock muerto: "no se vende hace 30+ días" (antes 60). Ya aplicado.
create or replace view public.v_stock_muerto as
  select r.id, r.nombre, r.presentacion, r.categoria, r.stock, r.costo_ultimo,
         (r.stock * r.costo_ultimo) as plata_dormida, r.ultima_venta, r.dias_sin_vender
  from public.v_producto_rentabilidad r
  join public.productos p on p.id = r.id
  where r.stock > 0
    and (r.ultima_venta is null or r.ultima_venta < now() - interval '30 days')
    and p.producto_base is null
    and p.nombre not in ('Servilleta','Cucharita','Bolsita de Hielo','Pajita')
  order by (r.stock * r.costo_ultimo) desc;
