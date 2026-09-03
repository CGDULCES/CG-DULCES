# Roadmap — de dónde venimos y qué falta

## ✅ Fase 1 — Fundaciones (hecho en el repo)

Todo esto está **en archivos**, listo para aplicar (ver `docs/MIGRATION.md`).
No cambia el comportamiento visible de la app todavía.

- **Seguridad:** RLS en todas las tablas, permisos, buckets de Storage,
  guía para cerrar el alta de cuentas y rotar la clave — `supabase/02_security.sql`.
- **Transacciones atómicas** (arreglan condición de carrera y ventas a medias):
  `registrar_venta`, `anular_venta`, `registrar_compra`, `registrar_cobro`,
  `dividir_cuenta`, `registrar_produccion`, `registrar_perdida`,
  `abrir_caja` / `cerrar_caja` / `registrar_movimiento_caja` — `supabase/03_rpc.sql`.
- **Backend de las funciones nuevas:** tablas `pedidos`, `pedido_items`, `lotes`,
  `precio_historial`; columnas `productos.foto_url / precio_mayorista /
  mayorista_min_cant / vida_util_dias`, `ventas.usuario_app_id / es_mayorista /
  pedido_id`, `usuarios_app.pin_hash / rol / auth_uid` — `supabase/01_schema.sql`.
- **Vistas de análisis:** rentabilidad, stock muerto, reposición, historial de
  precios, ventas por hora / por día, vencimientos, cierre de caja —
  `supabase/05_views.sql`.
- **Triggers:** historial de precios + creación de lotes de vencimiento — `04_triggers.sql`.
- **Backup automático:** Edge Function + `backups_log` + cron — `supabase/functions/backup/`.
- **PWA:** `manifest.webmanifest`, `sw.js`, `offline.html`, `js/pwa.js`.
  La app se instala y **abre sin internet** (el cascarón). Barra de "sin conexión".
- **De-CDN:** `package.json`, `tailwind.config.js`, `css/input.css`, `scripts/vendor.mjs`
  + `docs/DE-CDN.md`.
- **Librería compartida** `js/lib/util.js`: `escapeHtml`, `fmt`, `parseMoney`,
  fechas, `toCSV` / `descargarCSV`, WhatsApp (`waLink`, `abrirWhatsApp`),
  `ticketVenta`, `mensajeFiado`, `resumenCierre`, `errorRPC`.
- **Envoltorio** `js/rpc.js` (`CG.rpc.registrarVenta(...)`, etc.).
- **Repo:** `README.md`, `docs/`, `.gitignore`, `.nojekyll`, imágenes fuera del HTML
  (el `index.html` pasó de ~312 KB a ~234 KB).

---

## 🔜 Fase 2 — Integración en la app

Cada punto = un cambio acotado en `index.html` (o su versión modular). Necesita
poder **probar contra una base de verdad** (ver "Qué necesito de vos" abajo).

### A. Robustez (lo primero)
1. **Usar las RPC** en lugar de los bloques sueltos: `confirmSale`,
   `saveNewCompra` / `saveEditCompra` / `deleteCompra`, `saveCobro*`,
   `confirmarDividirCuenta`, `registrarProduccion`, `saveNuevaPerdida`,
   `abrirCaja` / `saveCerrarCaja` / `saveMovimientoCaja`, `deleteVenta*`.
   → elimina la condición de carrera y las ventas a medias.
2. **Escape de HTML**: envolver toda interpolación de datos del usuario
   (nombres de cliente/producto/proveedor, motivos, notas) con `CG.escapeHtml`.
3. **Cola offline**: si una escritura falla por falta de red, se guarda en
   IndexedDB y se reintenta al volver la conexión (con aviso claro).
4. **Escala**: `loadVentas` / `loadCompras` / `loadHistorial` con paginado y
   "cargar más"; los reportes pasan a leer de las vistas (`v_*`) en vez de
   traer 1.000 ventas al navegador.

### B. Funciones nuevas
5. **Comprobante por WhatsApp**: botón en la confirmación de venta y en el
   detalle de venta → `CG.abrirWhatsApp(cliente.telefono, CG.ticketVenta(...))`.
6. **Recordatorio de fiado**: botón en el perfil del cliente →
   `CG.mensajeFiado(...)` con el detalle de deudas.
7. **Cierre de caja compartible**: al cerrar caja y en "Detalle de caja",
   botón "Compartir cierre" → `CG.resumenCierre(fila de v_cierre_caja)`.
8. **Lista de reposición**: nueva pantalla desde `v_reposicion`
   (qué comprar, cuánto, días de cobertura). Botón "Pedir a proveedor" que
   arma el mensaje de WhatsApp, y "Pasar a compra" que precarga el modal de compra.
9. **Export para el contador**: en Reportes, botones CSV de ventas, compras y
   cobros del período + un resumen mensual (ventas, compras, IVA 10 %/5 %).
10. **Vencimientos**: pantalla desde `v_vencimientos` + tarjeta de alerta en el
    Dashboard ("3 productos vencen esta semana"). Al vender/registrar pérdida se
    descuenta del lote más viejo (FEFO) — pequeña extensión a las RPC.
11. **Pedidos / encargos**: pantalla de lista (pendiente / listo / entregado),
    alta con ítems y seña, aviso por WhatsApp al cliente, y "Concretar" que
    llama `registrar_venta` con `pedido_id`.
12. **Rentabilidad y stock muerto**: pantalla desde `v_producto_rentabilidad`
    (ranking por ganancia, margen) y `v_stock_muerto` (plata dormida).
13. **Historial de precios de compra**: en el detalle del producto y en Compras,
    tabla desde `v_precio_historial` con la variación vs. la compra anterior.
14. **Fotos de producto**: subir imagen al bucket `fotos-productos`, guardarla
    en `productos.foto_url`, mostrarla en la grilla de venta e inventario.
15. **Precio mayorista / minorista**: campos en el producto; en el carrito, si la
    cantidad ≥ `mayorista_min_cant` (o el toggle "venta mayorista"), usa
    `precio_mayorista`. La venta guarda `es_mayorista`.
16. **Analítica simple**: en Reportes, dos gráficos — ventas por hora del día y
    por día de la semana — desde `v_ventas_por_hora` / `v_ventas_por_dia_semana`.
17. **Login por vendedor (PIN)**: un usuario Auth por persona, `pin_hash` para
    cambiar de vendedor rápido, y activar las políticas por rol de
    `02_security.sql`. `historial` pasa a registrar el usuario real.

### C. Deuda técnica
18. Partir `index.html` en `js/features/*.js` (dashboard, caja, vender,
    inventario, compras, clientes, pedidos, reportes, config…), sacar el
    `<style>` inline a `css/`, quitar los CDN (`docs/DE-CDN.md`).
19. Un helper único de "toast"/aviso en vez de `alert()` / `confirm()`.
20. Tests de humo de las RPC (script SQL en `supabase/tests/`).

---

## Qué necesito de vos para la Fase 2

Para no tocar la base de producción a ciegas, lo ideal es **una copia de prueba**:

1. En Supabase, **New project** → `cg-dulces-test` (plan free alcanza).
2. Correr ahí los 5 archivos de `supabase/` (MIGRATION.md, pasos 1–5).
3. Cargar 3–4 productos, 1 cliente y abrir caja para tener con qué probar.
4. Pasame: **URL del proyecto de prueba**, su **anon key**, y un
   **usuario/contraseña** de prueba (creado desde Auth → Users).

Con eso puedo desarrollar y verificar cada punto de la Fase 2 y recién
después lo llevás a producción (que es solo cambiar `js/config.js` y publicar).

Si preferís que trabaje directo sobre el proyecto real, decime y lo hacemos con
más cuidado (siempre detrás de la copia de seguridad y en horario de cierre).

También confirmame, cuando puedas, estos detalles del esquema actual
(los deduje del código):

- `clientes` y `proveedores` tienen columna `telefono` (texto). ✔/✖
- `cobros` tiene `medio_pago` y `registrado_por`. ✔/✖
- `caja_movimientos` tiene `venta_id`, `compra_id`, `fecha`. ✔/✖
- `productos.equivalencia_bolas` es numérico y opcional. ✔/✖
- ¿Hay alguna tabla más que use la app y no esté en `supabase/01_schema.sql`?
