# Seguridad — estado y checklist

## Qué estaba mal

| Problema | Riesgo | Arreglo |
|---|---|---|
| `anon key` pública **sin RLS** | Cualquiera con la URL del repo podía leer/borrar toda la base | `supabase/02_security.sql` activa RLS en todas las tablas; sin login no se accede a nada |
| Alta de cuentas abierta | Alguien podía `signUp()` con la clave pública y entrar | Dashboard → Auth → **Enable Signups: OFF** |
| Escrituras no atómicas | Ventas a medias, stock corrupto con 2 dispositivos | `supabase/03_rpc.sql`: cada operación es 1 transacción con `SELECT … FOR UPDATE` |
| `innerHTML` con datos sin escapar | Un nombre de cliente/producto con HTML podía ejecutar código | `CG.escapeHtml` / `CG.el` en `js/lib/util.js` (aplicar en Fase 2) |
| "Quién registró" self-reported | La auditoría no era confiable | Base para login por vendedor (`usuarios_app.pin_hash`, `rol`, `auth_uid`; `historial.auth_uid`) |
| Backup manual | Se olvida → pérdida de datos | Edge Function `backup` programada + `backups_log` |
| `service_role` nunca debe ir al front | — | Solo la usa la Edge Function (server-side) |

## Checklist de aplicación

- [ ] `02_security.sql` corrido — `relrowsecurity = true` en todas las tablas
- [ ] Auth → **Enable Signups: OFF**
- [ ] Auth → **Confirm email: ON**
- [ ] Bucket `backups` **privado**; `comprobantes` privado; `fotos-productos` público
- [ ] `03_rpc.sql` corrido — `select public.caja_abierta_id()` responde
- [ ] Edge Function `backup` desplegada con `BACKUP_SECRET`
- [ ] Cron `cg-backup-diario` activo — `select * from cron.job`
- [ ] **anon key rotada** y `js/config.js` actualizado
- [ ] `service_role` key: confirmá que **no** aparece en ningún archivo del repo
      (`git grep -i service_role` debe dar vacío)

## Contraseñas / PIN de vendedores (Fase 2)

Hoy hay **un solo login compartido**. El plan:

1. Un usuario de Supabase Auth por persona (`caro@cgdulces.local`, etc.).
2. `usuarios_app.auth_uid` enlaza cada uno con `auth.users.id`.
3. `usuarios_app.pin_hash`: PIN corto para cambiar de vendedor sin re-loguear,
   hasheado con `crypt()` (extensión `pgcrypto`), **nunca en texto plano**.
4. Activar las políticas por rol comentadas al final de `02_security.sql`
   (solo la dueña borra ventas, cambia precios, gestiona usuarios).
5. `historial.usuario` deja de venir de un `<select>` y pasa a salir de
   `auth.uid()` → `usuarios_app.nombre`.

## Buenas prácticas que ya quedan en el repo

- `.gitignore` excluye `.env`, `vendor/`, backups locales y `*.bak`.
- La conexión vive en un solo archivo (`js/config.js`) con comentario de
  advertencia sobre qué clave va y qué clave **no**.
- El Service Worker **nunca** cachea llamadas a `supabase.co` (datos siempre frescos).
