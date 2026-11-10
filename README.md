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
index.html              Solo la estructura de la pantalla (unas 150 líneas)
offline.html            Pantalla "sin internet" (PWA)
manifest.webmanifest    Metadatos para instalar como app
sw.js                   Service Worker (abre offline, cachea el cascarón)

assets/                 Logo e íconos
css/sistema.css         Estilos propios (colores, pantalla completa, versión de computadora)
js/
  lib/util.js           Helpers: escape HTML, WhatsApp, CSV, cierre, errores
  rpc.js                Envoltorio de las funciones transaccionales de la base
  pwa.js                Registro del Service Worker + aviso sin-conexión
  app/                  El sistema, dividido por partes (cada archivo es una parte):
    tema.js             Configuración de Tailwind y colores guardados
    estado.js           Conexión a Supabase (URL y clave pública) y listas de datos compartidas
    marca.js            Paleta de colores, nombre y logo
    base.js             Ventanas (modales), tablas de escritorio, historial, consultas
    compartido.js       Cálculos que usan varias partes (stock de baldes, saldos, deudas)
    datos.js            Carga de datos (cada carga es independiente)
    sesion.js           Ingreso y salida
    navegacion.js       Pestañas, dibujo de pantallas y aislamiento de errores
    dashboard.js · caja.js · ventas.js · helados.js · dividir-cuenta.js
    historial-ventas.js · clientes.js · cobros.js · compras.js · inventario.js
    catalogos.js · informes.js · configuracion.js
    inicio.js           Arranque (siempre se carga al final)

pruebas/pantallas.js    Prueba de todas las pantallas y formularios (solo en la computadora local)

supabase/
  01…18_*.sql           Estructura, seguridad, funciones y ajustes (APLICAR-TODO.sql reúne los primeros)
  functions/            Funciones del servidor (cambiar-acceso)

scripts/
  chequeo.js            Chequeo automático del código  →  node scripts/chequeo.js
  servidor-local.js     Servidor para probar en tu computadora  →  node scripts/servidor-local.js
  vendor.mjs            Baja copias locales de las librerías de CDN
docs/                   MODULOS.md · SECURITY.md · MIGRATION.md · DE-CDN.md · ROADMAP.md
```

### Si una parte se rompe
Cada pantalla se dibuja por separado y cada archivo es una parte: si uno falla, el sistema
muestra un aviso solo en esa parte y el resto sigue funcionando. Para revisar el estado general:

```bash
node scripts/chequeo.js                      # revisa el código (sintaxis, botones, nombres repetidos, seguridad)
node scripts/servidor-local.js               # y abrir http://localhost:5173/?prueba=1  → prueba todas las pantallas
```

---

## Puesta en marcha (desarrollo local)

La app es estática. Para probarla en tu computadora (el Service Worker y el login necesitan
`http://localhost`, no `file://`):

```bash
node scripts/servidor-local.js
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
6. **Rotar la anon key** y actualizar `SUPABASE_KEY` en `js/app/estado.js`.

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
