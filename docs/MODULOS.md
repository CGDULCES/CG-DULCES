# Módulos de CG Dulces

Cada módulo tiene sus tablas y sus funciones. Una pantalla de un módulo no debe
escribir en tablas de otro: lo hace llamando a la función del módulo dueño.

**Regla de seguridad:** las tablas de dinero (marcadas con 🔒) son de solo lectura
desde el navegador. Todo cambio pasa por funciones atómicas (todo o nada).
El historial solo admite leer y agregar.

| Módulo | Tablas | Funciones (escritura) |
|---|---|---|
| **Ventas** | 🔒 `ventas`, 🔒 `venta_items`, `venta_repartos` | `registrar_venta`, `anular_venta`, `editar_venta`, `cambiar_fecha_venta`, `dividir_cuenta` |
| **Caja** | 🔒 `caja`, 🔒 `caja_movimientos` | `abrir_caja`, `cerrar_caja`, `registrar_movimiento_caja`, `saldos_caja`, `caja_abierta_id` |
| **Clientes y créditos** | `clientes`, 🔒 `cobros` | `registrar_cobro`, `anular_cobro`, `editar_cobro` |
| **Compras** | 🔒 `compras`, 🔒 `compra_items`, `proveedores`, `lotes`, `precio_historial` | `registrar_compra`, `editar_compra`, `eliminar_compra` |
| **Inventario** | `productos`, `categorias`, `promociones`, `perdidas`, `helado_rendimientos` | `registrar_perdida` |
| **Producción / recetas** | `recetas` (y costo automático de `productos`) | `registrar_produccion` (+ triggers de costo) |
| **Sistema** | `usuarios_app`, `configuracion`, `historial`, `backups_log` | — |

Sin uso hoy (heredadas): `fabricacion`, `fabricacion_insumos`, `gastos`, `pedidos`, `pedido_items`.

## Cómo se aísla cada módulo

- **Base:** las escrituras de plata no se pueden hacer "a mano" desde el navegador; solo
  las funciones de arriba (que revisan stock, caja y saldos antes de tocar nada).
- **App:** cada menú se dibuja por separado (`aislar()` en `index.html`). Si uno falla,
  solo ese menú muestra "Esta sección tuvo un problema" y el resto sigue funcionando.
  Cada carga de datos también es independiente (`Promise.allSettled`).

## Archivos SQL

`01_schema` → `02_security` → `03_rpc` → `04_triggers` → `05_views` → `06_storage`
(todo junto en `APLICAR-TODO.sql`). Los `NN_ajustes.sql` son parches ya aplicados.
`13_ajustes.sql` cierra las tablas de plata; `13_ajustes_REVERTIR.sql` lo deshace.

## Pendiente

- Respaldo automático fuera de Supabase (ver `MIGRATION.md`, paso 6): requiere la clave
  secreta de la función. Mientras tanto, la app avisa si pasan 7 días sin copia manual.
- Partir `index.html` en archivos por módulo (Vite), como fase aparte.
