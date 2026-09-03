# Migración a v2 — paso a paso

> Tiempo estimado: 30–45 min. No hace falta apagar la app: los cambios de
> base son aditivos. El frontend sigue funcionando igual hasta la Fase 2.

## 0. Antes de empezar

- [ ] Entrá a la app y tocá **Más → Configuración → Descargar copia de seguridad**.
- [ ] Además: Supabase Dashboard → **Database → Backups** → asegurate de que haya
      un backup reciente (o creá uno con *Point in time* si tu plan lo permite).
- [ ] Tené a mano el proyecto en el **SQL Editor** de Supabase.

---

## 1. Esquema (`supabase/01_schema.sql`)

1. SQL Editor → *New query* → pegá **todo** `01_schema.sql` → **Run**.
2. Debe terminar sin error. Crea las tablas nuevas (`pedidos`, `pedido_items`,
   `lotes`, `precio_historial`, `backups_log`) y agrega columnas nuevas a
   `productos`, `usuarios_app`, `ventas`, `historial`, `clientes`, `categorias`.
3. Verificación:
   ```sql
   select table_name from information_schema.tables
   where table_schema='public' order by 1;
   -- deben aparecer las nuevas
   select column_name from information_schema.columns
   where table_name='productos' and column_name in
     ('foto_url','precio_mayorista','mayorista_min_cant','vida_util_dias');
   ```

> Si alguna columna YA existía con otro tipo, el script no la toca (`add column
> if not exists`). Revisá que el tipo sea compatible; si no, avisá antes de seguir.

---

## 2. Seguridad (`supabase/02_security.sql`)  ⚠ el más importante

1. Pegá y **Run** `02_security.sql`.
2. Esto **activa Row Level Security en todas las tablas** y quita el acceso al
   rol anónimo. A partir de acá, **solo funciona con sesión iniciada**.
3. Verificación:
   ```sql
   select relname, relrowsecurity
   from pg_class where relnamespace = 'public'::regnamespace and relkind='r'
   order by 1;
   -- relrowsecurity debe ser true en todas
   ```
4. Probá la app: cerrá sesión y volvé a entrar. Todo debe seguir igual.
   Si algo deja de cargar, es que faltaba una tabla en la lista de políticas
   (ver el bloque `do $$ ... foreach t in array[...]` y agregala).

### 2b. Endurecer Auth (en el Dashboard, no por SQL)

- **Authentication → Providers → Email**
  - `Enable Signups` → **OFF**  ← evita que alguien se cree cuenta con la clave pública
  - `Confirm email` → **ON**
- **Authentication → Rate limits** → dejá los valores por defecto (o bajalos).

### 2c. Storage

`02_security.sql` intenta crear los buckets `comprobantes`, `fotos-productos`
(público) y `backups` (privado). Verificá en **Storage** que existan y que
`backups` NO sea público.

---

## 3. Funciones transaccionales (`supabase/03_rpc.sql`)

1. Pegá y **Run** `03_rpc.sql`.
2. Verificación rápida (no escribe nada real si no hay caja abierta):
   ```sql
   select public.caja_abierta_id();               -- id o null
   select * from public.saldos_caja( (select public.caja_abierta_id()) );
   ```
3. Prueba de humo de una venta (⚠ crea una venta de verdad; borrala después):
   ```sql
   -- necesita una caja abierta y un producto con stock. Ajustá los ids.
   select public.registrar_venta('{
     "cliente_id": null, "registrado_por": "PRUEBA", "es_fiado": false,
     "medio_pago": "efectivo", "monto_efectivo": 1000, "monto_transferencia": 0,
     "subtotal": 1000, "descuento_total": 0, "total": 1000,
     "items": [ { "producto_id": REEMPLAZAR, "cantidad": 1, "precio_unitario": 1000,
                  "costo_unitario": 500, "descuento": 0, "subtotal": 1000 } ]
   }'::jsonb);
   -- luego:  select public.anular_venta( <id_devuelto>, 'prueba', 'PRUEBA' );
   ```

---

## 4. Triggers (`supabase/04_triggers.sql`)

1. Pegá y **Run**.
2. A partir de ahora, **cada línea de compra** (por la app vieja o por la RPC)
   deja registro en `precio_historial`, y si el producto tiene
   `vida_util_dias`, se crea un `lote` con vencimiento.

---

## 5. Vistas de análisis (`supabase/05_views.sql`)

1. Pegá y **Run**.
2. Verificación:
   ```sql
   select * from public.v_reposicion limit 5;
   select * from public.v_producto_rentabilidad order by ganancia_90d desc limit 5;
   select * from public.v_ventas_por_hora;
   ```

---

## 6. Edge Function de backup

Requiere el [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase login
supabase link --project-ref amfcmrvksewtqqadiuii
supabase functions deploy backup --no-verify-jwt
```

Secrets de la función (Dashboard → Edge Functions → backup → *Secrets*, o CLI):

```bash
supabase secrets set BACKUP_SECRET="poné-una-clave-larga-al-azar"
supabase secrets set BACKUP_RETENTION_DAYS="30"
# opcional, para recibir el backup por mail:
supabase secrets set RESEND_API_KEY="re_xxx"
supabase secrets set BACKUP_EMAIL="tucorreo@gmail.com"
```

Probar a mano:

```bash
curl -i "https://amfcmrvksewtqqadiuii.functions.supabase.co/backup?key=LA_CLAVE"
```

Programar todos los días 05:15 (SQL Editor):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cg-backup-diario',
  '15 5 * * *',
  $$
  select net.http_get(
    url    := 'https://amfcmrvksewtqqadiuii.functions.supabase.co/backup',
    headers:= jsonb_build_object('Authorization', 'Bearer ' || 'LA_CLAVE')
  );
  $$
);
-- ver:      select * from cron.job;
-- borrar:   select cron.unschedule('cg-backup-diario');
```

Verificar: `select * from public.backups_log order by created_at desc;`

---

## 7. Rotar la clave pública

1. Dashboard → **Project Settings → API**.
2. En la `anon` / `publishable` key → **Roll / Regenerate**.
3. Copiá la nueva a `js/config.js` (`SUPABASE_KEY`) y publicá el repo.
4. La clave vieja queda muerta. Como ya hay RLS, aunque alguien la tuviera
   guardada, no puede hacer nada sin login.

---

## 8. Rollback

- **Vistas / triggers / RPC:** `drop view ...` / `drop function ...` /
  `drop trigger trg_compra_item_ai on public.compra_items;` — no afectan datos.
- **RLS:** para volver atrás (NO recomendado):
  ```sql
  do $$ declare t text; begin
    foreach t in array array['productos','ventas', /* ...todas... */ ] loop
      execute format('alter table public.%I disable row level security;', t);
    end loop; end $$;
  ```
- **Columnas/tablas nuevas:** se pueden dejar; no molestan al frontend viejo.
- Si algo sale muy mal: **Database → Backups → Restore** al punto previo.
