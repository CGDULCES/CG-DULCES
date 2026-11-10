/* =====================================================================
 * CG DULCES · Prueba de todas las pantallas (solo se corre en la computadora local)
 * ---------------------------------------------------------------------
 * Cómo correrla:   node scripts/servidor-local.js   y abrir   http://localhost:5173/?prueba=1
 * - Usa datos de EJEMPLO en memoria (no toca la base de datos real).
 * - Dibuja cada pantalla y cada formulario con nombres "maliciosos" (comillas, <img onerror>)
 *   y comprueba que nada se ejecuta ni se rompe.
 * - Rompe a propósito una parte del sistema y comprueba que las demás siguen funcionando.
 * ===================================================================== */
(async function () {
  const resultados = [];
  const anotar = (nombre, bien, detalle) => resultados.push({ nombre, bien: !!bien, detalle: detalle || "" });
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  document.getElementById("login-screen").classList.add("screen-hidden");
  document.getElementById("app-screen").classList.remove("screen-hidden");
  window.alert = () => {}; window.confirm = () => true;

  // ---- datos de ejemplo (con nombres peligrosos a propósito) ----
  const MAL = `Ñandú "<img src=x onerror=window.__xss=1>" & 'ok'`;
  const hoy = new Date(); const hace = (m) => new Date(hoy.getTime() - m * 60000).toISOString();
  categorias = [{ id: 1, nombre: MAL }, { id: 2, nombre: "Bebidas" }];
  categorias.forEach((c, i) => (categoryColors[c.nombre] = PALETTE[i]));
  productos = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, nombre: i === 0 ? MAL : "Prod " + i, presentacion: i === 1 ? MAL : null, categoria_id: (i % 2) + 1, categorias: { nombre: categorias[i % 2].nombre }, stock: i === 2 ? 1 : 20, stock_minimo: 5, precio_venta: 2000, costo_ultimo: 900, es_insumo: false, favorito: i < 3, usa_pajita: false, activo: true, bolas_vendidas_actual: 0, producto_base: null }));
  clientes = [{ id: 1, nombre: MAL, telefono: MAL }, { id: 2, nombre: "Ana", telefono: null }];
  const mkV = (id, min, fiado, cli) => ({ id, total: 4000, subtotal: 4000, descuento_total: 0, medio_pago: fiado ? "fiado" : "efectivo", es_fiado: fiado, registrado_por: MAL, created_at: hace(min), cliente_id: cli || null, concepto: id === 3 ? MAL : null, clientes: cli ? { nombre: MAL } : null, venta_repartos: [], venta_items: id === 3 ? [] : [{ cantidad: 2, precio_unitario: 2000, costo_unitario: 900, subtotal: 4000, producto_id: 1, productos: { nombre: MAL, categoria_id: 1, presentacion: MAL } }] });
  const ventas = [mkV(1, 10, false), mkV(2, 50, true, 1), mkV(3, 60, true, 1)];
  ventasHistoricas = ventas; window.__todasVentas = ventas;
  ventasClientes = ventas.filter((v) => v.cliente_id).map((v) => ({ id: v.id, cliente_id: v.cliente_id, total: v.total, es_fiado: v.es_fiado, created_at: v.created_at }));
  cobros = [{ id: 1, venta_id: 2, cliente_id: 1, monto: 1000, medio_pago: "efectivo", created_at: hace(30), grupo: "g" }]; repartosClientes = [];
  proveedores = [{ id: 1, nombre: MAL, telefono: MAL }];
  compras = [{ id: 1, proveedor_id: 1, tipo: "mercaderia", total: 1, descuento: 0, medio_pago: "efectivo", created_at: hace(100), proveedores: { nombre: MAL }, compra_items: [{ id: 1, producto_id: 1, cantidad: 1, costo_unitario: 1, productos: { nombre: MAL, presentacion: MAL } }] }];
  cajaActual = { id: 1, estado: "abierta", apertura_efectivo: 1000, apertura_banco: 0, fecha_apertura: hace(900) }; cajaMovimientos = [];
  const mk = (id, tipo, monto, desc, vid, cid) => ({ id, caja_id: 1, tipo, monto, medio_pago: "efectivo", venta_id: vid || null, cobro_id: cid || null, fecha: hace(id * 5), descripcion: desc });
  window.__cacheCaja = { cajas: [cajaActual], movs: [mk(1, "venta", 4000, MAL, 1), mk(2, "retiro", 100, MAL), mk(3, "cobro", 1000, MAL, 2, 1)] };
  historial = [{ id: 1, tabla: "ventas", accion: "crear", fecha: hace(5), detalle: MAL, usuario: MAL }];
  promociones = [{ id: 1, nombre: MAL, categoria_id: 1, producto_id: null, cantidad_requerida: 2, precio_promocional: 100, activo: true }]; recetas = []; window.__config = { nombre_negocio: MAL };
  window.__perdidas = [{ id: 1, cantidad: 1, motivo: MAL, registrado_por: MAL, created_at: hace(3), productos: { nombre: MAL, presentacion: MAL } }];
  window.__clienteDetalleId = 1; window.__clienteDetalleVentas = ventas.filter((v) => v.cliente_id === 1); window.__clienteDetalleCobros = cobros; window.__clienteDetalleRepartos = []; window.__clienteSeleccionadas = new Set(); window.__clienteSeleccionadasRepartos = new Set();
  window.__masVendidos = [{ nombre: MAL, presentacion: MAL, unidades_total: 5, unidades_30d: 1, promedio_diario_30d: 0.03 }];
  window.__analisis = { rent: [{ nombre: MAL, ganancia_90d: 1, margen_actual_pct: 5 }], muerto: [{ nombre: MAL, plata_dormida: 1, dias_sin_vender: 40 }], hora: [], dia: [], actualizado: new Date() };
  const consultaVacia = () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }), single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }) }), order: () => ({ limit: async () => ({ data: [] }) }), in: async () => ({ data: [], error: null }), then(r) { r({ data: [{ clave: "nombre_negocio", valor: MAL }], error: null }); } }) });
  sb.from = consultaVacia;
  loadAll = async () => { render(); };

  const malos = () => document.querySelectorAll('img[src="x"]').length;
  const limpio = () => malos() === 0 && !window.__xss;

  // ---- 1) todas las pantallas ----
  const pantallas = ["dashboard", "ventas", "inventario", "clientes", "cliente-detalle", "compras", "caja", "todas-ventas", "categorias", "promociones", "proveedores", "auditoria", "masvendidos", "analisis", "masopciones", "perdidas", "configuracion", "reportes"];
  for (const t of pantallas) {
    try {
      window.__xss = 0; activeTab = t; render(); await esperar(250);
      const c = document.getElementById("content");
      anotar("Pantalla " + t, limpio() && !c.innerText.includes("tuvo un problema") && c.innerText.length > 20, limpio() ? "" : "mostró código sin proteger");
    } catch (e) { anotar("Pantalla " + t, false, e.message); }
  }

  // ---- 2) formularios ----
  const probar = async (nombre, fn) => {
    try { window.__xss = 0; await fn(); const abierto = !document.getElementById("modal-overlay").classList.contains("screen-hidden"); anotar("Formulario " + nombre, limpio() && abierto, abierto ? (limpio() ? "" : "mostró código sin proteger") : "no se abrió"); closeModal(); }
    catch (e) { anotar("Formulario " + nombre, false, e.message); }
  };
  await probar("editar producto", () => openEditProduct(1));
  await probar("nuevo producto", async () => openNewProduct());
  await probar("nueva compra", async () => openNewCompra());
  await probar("editar compra", async () => openEditCompra(1));
  await probar("agregar deuda", async () => openAgregarDeuda(1));
  await probar("dividir cuenta", async () => openDividirCuenta());
  await probar("pagos de una venta", async () => { window.__pagosVentaActual = cobros; renderPagosDeVentaModal(); });
  await probar("confirmar venta", async () => { window.__ventaTotal = 1000; renderConfirmSaleModal(); });
  await probar("cobrar seleccionadas", async () => { window.__clienteSeleccionadas = new Set([2, 3]); openCobroSeleccionadas(); });
  await probar("venta de caja", async () => { sb.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ventas[0] }) }) }) }); await abrirVentaDeCaja(1, 1); sb.from = consultaVacia; });
  await probar("armar helado", async () => {
    productos.push({ id: 90, nombre: "Balde Helado", presentacion: MAL, producto_base: "Balde Helado", categoria_id: 1, stock: 2, bolas_vendidas_actual: 3, activo: true, es_insumo: false, precio_venta: 0, costo_ultimo: 1, stock_minimo: 0 }, { id: 91, nombre: "Helado · Bola", presentacion: null, categoria_id: 1, stock: 0, precio_venta: 1500, costo_ultimo: 0, activo: true, es_insumo: false, equivalencia_bolas: 1, stock_minimo: 0 });
    openHeladoBuilder("bola");
  });
  await probar("editar balde", async () => openEditProduct(90));

  // ---- 3) el nombre con comillas se conserva al editar ----
  await openEditProduct(1);
  anotar("El formulario de editar conserva un nombre con comillas", document.getElementById("edit-nombre")?.value === MAL);
  closeModal();

  // ---- 4) aislamiento: si una parte falla, las demás siguen ----
  const guardada = window.renderCaja; window.renderCaja = undefined;
  activeTab = "caja"; render(); await esperar(200);
  anotar("Si Caja no carga, solo Caja avisa del problema", document.getElementById("content").innerText.includes("tuvo un problema"));
  activeTab = "clientes"; render(); await esperar(200);
  anotar("Con Caja rota, Clientes sigue funcionando", !document.getElementById("content").innerText.includes("tuvo un problema"));
  window.renderCaja = guardada;
  const guardadaH = window.productoHeladoBola; window.productoHeladoBola = undefined;
  activeTab = "ventas"; render(); await esperar(200);
  anotar("Con Helados roto, Ventas sigue funcionando (sin los botones de helado)", !document.getElementById("content").innerText.includes("tuvo un problema"));
  window.productoHeladoBola = guardadaH;

  // ---- informe ----
  const bien = resultados.filter((r) => r.bien).length;
  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff;color:#111;overflow:auto;padding:20px;font:14px/1.5 system-ui,sans-serif";
  panel.innerHTML = `<h2 style="margin:0 0 8px">Prueba de pantallas: ${bien} de ${resultados.length} bien</h2>` +
    resultados.map((r) => `<div style="color:${r.bien ? "#117a3a" : "#c00"}">${r.bien ? "✓" : "✗"} ${r.nombre}${r.detalle ? " — " + r.detalle : ""}</div>`).join("");
  document.body.appendChild(panel);
  window.__resultadoPruebas = { total: resultados.length, bien, fallas: resultados.filter((r) => !r.bien) };
  console.log("PRUEBA DE PANTALLAS:", bien + "/" + resultados.length, resultados.filter((r) => !r.bien));
})();
