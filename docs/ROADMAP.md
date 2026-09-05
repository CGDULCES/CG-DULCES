# Roadmap — estado

## ✅ Fase 1 — Fundaciones (aplicado en producción)

- **Seguridad:** RLS en las 24 tablas, alta de cuentas cerrada, acceso anónimo
  bloqueado — `supabase/02_security.sql`. (Rotar la anon key sigue pendiente,
  opcional: `docs/SECURITY.md`.)
- **Transacciones atómicas** en la base — `supabase/03_rpc.sql`.
- **Vistas de análisis** — `supabase/05_views.sql`.
- **Triggers** de historial de precios + lotes de vencimiento — `supabase/04_triggers.sql`.
- **PWA:** instalable, abre sin internet — `manifest.webmanifest`, `sw.js`, `js/pwa.js`.
- **Repo:** documentado, imágenes fuera del HTML, `js/lib/util.js` + `js/rpc.js`.
- Backup automático (Edge Function) — **lista, falta deploy** (`docs/MIGRATION.md` paso 6).

## ✅ Fase 2 — Integración en la app (aplicado en producción)

- **Robustez:** `confirmSale`, compras, cobros, pérdidas, producción, dividir
  cuenta, abrir/cerrar caja y movimientos ahora usan las funciones
  transaccionales (`CG.rpc.*`). Se acabó la condición de carrera de stock y las
  operaciones a medias. `ventas.usuario_app_id` e `historial.auth_uid` se
  completan de verdad.
  - Cambio de comportamiento: los cobros generales de fiado ahora también
    entran a la caja (antes no; era una inconsistencia).
- **Comprobante de venta por WhatsApp** — pantalla de éxito tras la venta.
- **Recordatorio de fiado por WhatsApp** + campo de teléfono en clientes.
- **Cierre de caja compartible** (tipo "Cierre Z") + "compartir resumen del día"
  desde Detalle de caja.
- **Lista de reposición** (Más opciones) — qué comprar y cuánto, agrupado por
  proveedor, con "Pedir por WhatsApp".
- **Pedidos / encargos** (Más opciones) — alta con ítems (producto o texto
  libre), seña, estados, aviso por WhatsApp, "concretar" → venta fiada.
- **Análisis del negocio** (Más opciones) — ganancia y margen por producto (90d),
  stock muerto, vencimientos próximos, y gráficos de ventas por hora y por día.
- **Precio mayorista** — se aplica solo en el carrito al llegar al mínimo;
  la venta guarda `es_mayorista`.
- **Foto de producto** — se sube desde Editar producto y se ve en la grilla de
  venta (necesita `supabase/06_storage.sql`).
- **Proveedor habitual** y **vida útil (días)** por producto — alimentan
  reposición y vencimientos.

## 🔜 Lo que queda (menor)

- Correr `supabase/06_storage.sql` para habilitar la subida de fotos y los
  comprobantes de compra.
- Deploy de la Edge Function de backup (`docs/MIGRATION.md` paso 6).
- Rotar la anon key (`docs/SECURITY.md`) — opcional, RLS ya protege.
- Editar/eliminar una compra sigue con el código viejo (funciona, pero no es
  transaccional). `saveEditCompra` / `deleteCompra`.
- Historial de precios de compra: se guarda solo (trigger) y se puede consultar
  en la vista `v_precio_historial`; falta una pantalla que lo muestre.
- Cola de escritura offline (seguir vendiendo sin señal y sincronizar después).
- Login por vendedor con PIN (`docs/SECURITY.md`, sección Fase 2).
- Sacar Tailwind del CDN (`docs/DE-CDN.md`).
- Export CSV para el contador (los datos ya están; falta el botón en Reportes).

## Proyecto de prueba

`cg-dulces-test` en Supabase (mismo esquema). Se usa para probar cada cambio
antes de que llegue a producción.
