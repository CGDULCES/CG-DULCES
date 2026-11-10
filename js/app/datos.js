/* =====================================================================
 * CG DULCES · Carga de datos desde la base (cada carga es independiente: si una falla, las demás siguen).
 * (archivo: js/app/datos.js)
 * ===================================================================== */

async function loadConfiguracion() {
  const { data, error } = await sb.from("configuracion").select("*");
  if (error) { console.error(error); return; }
  window.__config = Object.fromEntries((data || []).map((c) => [c.clave, c.valor]));
  try { aplicarPaleta(window.__config.paleta ? JSON.parse(window.__config.paleta) : null); } catch { aplicarPaleta(null); }
  aplicarMarca();
}

// Unidad para redondear los importes SOLO en los mensajes de WhatsApp (0 = no redondear)
function redondeoMensajes() {
  return Number(window.__config?.redondeo_mensajes || 0) || 0;
}

async function loadAll() {
  // Cada carga se busca por nombre y corre por separado: si una falla (o su archivo no cargó), las demás siguen.
  const cargas = ["loadCategorias", "loadProductos", "loadPromociones", "loadVentas", "loadProveedores", "loadCompras", "loadClientes", "loadVentasClientes", "loadCobros", "loadCaja", "loadHistorial", "loadRepartosClientes", "loadRecetas", "loadConfiguracion"];
  const resultados = await Promise.allSettled(cargas.map(async (nombre) => {
    const f = window[nombre];
    if (typeof f !== "function") throw new Error(nombre + " no está cargada");
    return f();
  }));
  resultados.forEach((r, i) => { if (r.status === "rejected") console.error("Falló", cargas[i], r.reason); });
  window.__ultimaCarga = Date.now();
  window.__cacheCaja = null;
  render();
}

async function loadRecetas() {
  const { data, error } = await sb.from("recetas").select("*");
  if (error) { console.error(error); return; }
  recetas = data;
}

async function loadRepartosClientes() {
  const { data, error } = await selectTodo("venta_repartos", "*", (q) => q.order("id"));
  if (error) { console.error(error); return; }
  repartosClientes = data;
}

async function loadCaja() {
  const { data, error } = await sb.from("caja").select("*").eq("estado", "abierta").order("fecha_apertura", { ascending: false }).limit(1);
  if (error) { console.error(error); return; }
  cajaActual = data && data.length ? data[0] : null;
  if (cajaActual) {
    const { data: movs, error: movError } = await selectTodo("caja_movimientos", "*", (q) => q.eq("caja_id", cajaActual.id).order("fecha", { ascending: false }).order("id"));
    if (!movError) cajaMovimientos = movs;
  } else {
    cajaMovimientos = [];
  }
}

async function loadHistorial() {
  const { data, error } = await sb.from("historial").select("*").order("fecha", { ascending: false }).limit(150);
  if (error) { console.error(error); return; }
  historial = data;
}

async function loadClientes() {
  const { data, error } = await sb.from("clientes").select("*").order("nombre");
  if (error) { console.error(error); return; }
  clientes = data;
}

async function loadVentasClientes() {
  const { data, error } = await selectTodo("ventas", "id, cliente_id, total, es_fiado, created_at", (q) => q.not("cliente_id", "is", null).order("id"));
  if (error) { console.error(error); return; }
  ventasClientes = data;
}

async function loadCobros() {
  const { data, error } = await selectTodo("cobros", "*", (q) => q.order("created_at", { ascending: false }).order("id"));
  if (error) { console.error(error); return; }
  cobros = data;
}

async function loadProveedores() {
  const { data, error } = await sb.from("proveedores").select("*").order("nombre");
  if (error) { console.error(error); return; }
  proveedores = data;
}

async function loadCompras() {
  const { data, error } = await sb
    .from("compras")
    .select("id, proveedor_id, tipo, total, descuento, medio_pago, monto_efectivo, monto_transferencia, comprobante_url, registrado_por, created_at, proveedores(nombre), compra_items(id, producto_id, cantidad, costo_unitario, productos(nombre, presentacion))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) { console.error(error); return; }
  compras = data;
}

async function loadCategorias() {
  const { data, error } = await sb.from("categorias").select("*").order("nombre");
  if (error) { console.error(error); return; }
  categorias = data;
  categorias.forEach((c, i) => (categoryColors[c.nombre] = PALETTE[i % PALETTE.length]));
}

async function loadProductos() {
  const { data, error } = await sb
    .from("productos")
    .select("*, categorias(nombre)")
    .eq("activo", true)
    .order("nombre");
  if (error) { console.error(error); return; }
  productos = data;
}

async function loadPromociones() {
  const { data, error } = await sb.from("promociones").select("*").eq("activo", true);
  if (error) { console.error(error); return; }
  promociones = data;
}

async function loadVentas() {
  const { data, error } = await sb
    .from("ventas")
    .select("id, total, subtotal, descuento_total, medio_pago, es_fiado, registrado_por, created_at, concepto, venta_items(cantidad, precio_unitario, costo_unitario, subtotal, producto_id, productos(nombre, categoria_id))")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) { console.error(error); return; }
  ventasHistoricas = data;
}
