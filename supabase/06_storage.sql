-- =====================================================================
-- CG DULCES · Storage (buckets de archivos)
-- =====================================================================
-- Necesario para: comprobantes de compra (foto del ticket), fotos de
-- producto, y las copias de seguridad automáticas.
--
-- Se corre APARTE de APLICAR-TODO.sql porque toca el esquema "storage"
-- y, si tu proyecto tiene alguna restricción, no queremos que frene la
-- parte importante (RLS + funciones).
--
-- CÓMO USARLO: SQL Editor -> New query -> pegar todo -> Run.
-- Es seguro re-ejecutarlo.
-- =====================================================================

-- --- Buckets --------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('comprobantes',   'comprobantes',   false),  -- privado
  ('fotos-productos','fotos-productos',true),    -- público: se ven en la grilla de venta
  ('backups',        'backups',        false)    -- privado: solo lo toca la Edge Function
on conflict (id) do nothing;

-- --- Políticas de acceso a los archivos ---------------------------
do $$
begin
  -- comprobantes: subir/ver/borrar solo con sesión iniciada
  begin
    drop policy if exists "cg_comprobantes_rw" on storage.objects;
    create policy "cg_comprobantes_rw" on storage.objects
      for all to authenticated
      using (bucket_id = 'comprobantes') with check (bucket_id = 'comprobantes');
  exception when others then raise notice 'comprobantes policy: %', sqlerrm; end;

  -- fotos de producto: suben usuarios logueados, las ve cualquiera
  begin
    drop policy if exists "cg_fotos_rw" on storage.objects;
    create policy "cg_fotos_rw" on storage.objects
      for all to authenticated
      using (bucket_id = 'fotos-productos') with check (bucket_id = 'fotos-productos');
  exception when others then raise notice 'fotos rw policy: %', sqlerrm; end;

  begin
    drop policy if exists "cg_fotos_public_read" on storage.objects;
    create policy "cg_fotos_public_read" on storage.objects
      for select to anon
      using (bucket_id = 'fotos-productos');
  exception when others then raise notice 'fotos read policy: %', sqlerrm; end;

  -- backups: sin políticas para anon/authenticated => solo service_role.
end $$;
