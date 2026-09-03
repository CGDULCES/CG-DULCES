# CG Dulces · Panel del negocio

Aplicación web (una sola página) para gestionar un negocio de dulces en Paraguay:
ventas y caja, inventario e insumos, compras a proveedores, clientes y **fiado**,
recetas/producción, promociones, pérdidas, reportes y auditoría.

- **Frontend:** HTML + [Tailwind](https://tailwindcss.com) + [Chart.js](https://www.chartjs.org/), sin framework.
- **Backend:** [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage + Edge Functions).
- **Moneda / zona:** Guaraníes (`Gs.`), `America/Asuncion`.

---

## Estructura del repo

```
index.html              App principal (UI + lógica actual)
offline.html            Pantalla "sin internet" (PWA)
manifest.webmanifest    Metadatos para instalar como app
sw.js                   Service Worker (abre offline, cachea el cascarón)

assets/                 Logo e íconos (antes iban en base64 dentro del HTML)
css/
  input.css             Fuente de Tailwind (se compila a app.css)
  app.css               CSS servido a producción (generado)
js/
  config.js             Conexión a Supabase (único lugar con la URL/clave)
  lib/util.js           Helpers: escape HTML, WhatsApp, CSV, cierre, errores
  rpc.js                Envoltorio de las funciones transaccionales
  pwa.js                Registro del Service Worker + aviso sin-conexión

supabase/
  01_schema.sql         Tablas e índices (incluye tablas nuevas)
  02_security.sql       Row Level Security + permisos + Storage
  03_rpc.sql            Funciones transaccionales (venta, compra, cobro…)
  04_triggers.sql       Historial de precios + lotes de vencimiento
  05_views.sql          Vistas de análisis (rentabilidad, reposición…)
  functions/backup/     Edge Function de copia de seguridad automática

scripts/vendor.mjs      Baja copias locales de las librerías de CDN
docs/                   MIGRATION.md · SECURITY.md · DE-CDN.md · ROADMAP.md
```

---

## Puesta en marcha (desarrollo local)

La app es estática. Cualquier servidor sirve, pero el **Service Worker** y el
login necesitan `http://localhost` o HTTPS (no `file://`).

```bash
# Opción con Node
npx serve -l 5173 .

# Opción con Python
python -m http.server 5173
```

Abrí `http://localhost:5173`.

---

## Puesta al día del backend (IMPORTANTE)

La base **ya existe y está en uso**. Los scripts de `supabase/` están escritos
para aplicarse *encima* de lo actual sin romper nada (usan `if not exists`),
pero hay que hacerlo en orden y con copia previa.

👉 Seguí **[docs/MIGRATION.md](docs/MIGRATION.md)** paso a paso.

Resumen:

1. Sacar copia (botón de la app o Dashboard → Database → Backups).
2. SQL Editor de Supabase → correr, en este orden:
   `01_schema.sql` → `02_security.sql` → `03_rpc.sql` → `04_triggers.sql` → `05_views.sql`.
3. Dashboard → Authentication → Providers → Email: **desactivar "Enable signups"**,
   activar "Confirm email".
4. Crear los buckets de Storage (`02_security.sql` los crea; verificá).
5. Deploy de la Edge Function `backup` y programarla (MIGRATION.md).
6. **Rotar la anon key** y actualizar `js/config.js`.

---

## Estado del trabajo

Este repo está en una migración por fases (ver **[docs/ROADMAP.md](docs/ROADMAP.md)**):

| Área | Estado |
|---|---|
| Seguridad (RLS) | SQL listo — falta aplicarlo |
| Transacciones atómicas / condición de carrera | RPC listas — falta que el frontend las use |
| Backup automático | Edge Function lista — falta deploy |
| PWA / offline | Instalable y abre offline ✔ · cola de escritura offline → Fase 2 |
| De-CDN (Tailwind) | Build configurado — falta correr `npm run build:css` |
| Repo / esquema documentado | ✔ |
| WhatsApp, cierre compartible, reposición, analítica, pedidos, vencimientos, fotos, mayorista, rentabilidad, historial de precios, export contador | Backend + helpers listos — UI en Fase 2 |

---

## Despliegue (producción)

Hosting estático: GitHub Pages, Netlify o Vercel apuntando a este repo.
El archivo `.nojekyll` ya está para que GitHub Pages sirva la carpeta `js/`.

Antes de publicar, idealmente:

```bash
npm install
npm run build:css     # genera css/app.css con Tailwind (ver docs/DE-CDN.md)
npm run vendor        # baja supabase-js y chart.js a vendor/
```
