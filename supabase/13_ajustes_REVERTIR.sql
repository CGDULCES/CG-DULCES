-- Deshace 13_ajustes.sql: devuelve el acceso de escritura a todas las tablas
-- (como estaba antes). Solo usar si algo de la app dejó de funcionar.
begin;

do $$
declare t text;
begin
  foreach t in array array['caja','caja_movimientos','cobros','ventas','venta_items','compras','compra_items','historial']
  loop
    execute format('drop policy if exists app_write on public.%I', t);
    execute format('create policy app_write on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

drop policy if exists historial_agregar on public.historial;

commit;
