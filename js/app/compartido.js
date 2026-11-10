/* =====================================================================
 * CG DULCES · Cálculos compartidos que usan varias partes del sistema
 * (stock de baldes/paquetes, saldos de caja, deudas de clientes, listas de productos).
 * Están acá, aparte, para que una falla en una pantalla no arrastre a las demás.
 * (archivo: js/app/compartido.js)
 * ===================================================================== */

function ventasVisibles() {
  return productos.filter((p) => !p.es_insumo && p.categorias?.nombre !== HELADOS_OCULTO);
}

function agruparPorCategoria(lista) {
  const grupos = {};
  lista.forEach((p) => {
    const cat = p.categorias?.nombre || "Sin categoría";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(p);
  });
  return grupos;
}

// Busca un insumo por su nombre (lo usan Ventas y Helados).
function insumoPorNombre(nombre) {
  return productos.find((p) => p.nombre === nombre && p.es_insumo);
}

function factorConversion(p) {
  return p?.equivalencia_bolas || 1;
}

// Baldes y paquetes: el stock es la cantidad que tenés (incluido el que está en uso).
// Vender solo suma al contador de usos; el stock baja recién al "Marcar como terminado".
// Sin stock no se puede vender.
async function validarConsumoIlimitado(producto, necesario) {
  if (!producto || necesario === 0) return { ok: true };
  const { data: fresco } = await sb.from("productos").select("stock").eq("id", producto.id).single();
  const stockActual = Number(fresco?.stock ?? producto.stock);
  if (stockActual <= 0) {
    return { ok: false, mensaje: `No hay "${producto.presentacion || producto.nombre}" en stock. Agregá uno desde Inventario (tocá el producto → "Agregar") o registrá la compra antes de vender.` };
  }
  return { ok: true };
}

async function aplicarConsumoIlimitado(producto, cantidadNecesaria) {
  if (!producto || cantidadNecesaria === 0) return;
  const { data: fresco, error: errorLectura } = await sb.from("productos").select("bolas_vendidas_actual").eq("id", producto.id).single();
  if (errorLectura) { console.error("No se pudo leer el estado actual de", producto.nombre, errorLectura); return; }
  const actual = Number(fresco?.bolas_vendidas_actual || 0);
  const resultado = await sb.from("productos").update({ bolas_vendidas_actual: actual + cantidadNecesaria }).eq("id", producto.id);
  if (resultado.error) console.error("No se pudo actualizar el consumo de", producto.nombre, resultado.error);
}

function saldosCajaActual() {
  if (!cajaActual) return { efectivo: 0, banco: 0 };
  let efectivo = Number(cajaActual.apertura_efectivo || 0);
  let banco = Number(cajaActual.apertura_banco || 0);
  cajaMovimientos.forEach((m) => {
    const monto = Number(m.monto);
    const esIngreso = m.tipo === "venta" || m.tipo === "cobro" || m.tipo === "ingreso_extra";
    const signo = esIngreso ? 1 : -1; // retiro y compra restan
    if (esMedioBanco(m.medio_pago)) banco += signo * monto;
    else efectivo += signo * monto;
  });
  return { efectivo, banco };
}

function deudaCliente(clienteId) {
  const ventasFiado = ventasClientes.filter((v) => v.cliente_id === clienteId && v.es_fiado);
  const deudaDirecta = ventasFiado.reduce((s, v) => {
    const pagadoVenta = cobros.filter((c) => c.venta_id === v.id).reduce((ss, c) => ss + Number(c.monto), 0);
    return s + Math.max(0, Number(v.total) - pagadoVenta);
  }, 0);
  const deudaCompartida = repartosClientes.filter((r) => r.cliente_id === clienteId).reduce((s, r) => {
    const pagado = cobros.filter((c) => c.venta_id === r.venta_id && c.cliente_id === clienteId).reduce((ss, c) => ss + Number(c.monto), 0);
    return s + Math.max(0, Number(r.monto) - pagado);
  }, 0);
  return deudaDirecta + deudaCompartida;
}

function totalCompradoCliente(clienteId) {
  const directo = ventasClientes.filter((v) => v.cliente_id === clienteId).reduce((s, v) => s + Number(v.total), 0);
  const compartido = repartosClientes.filter((r) => r.cliente_id === clienteId).reduce((s, r) => s + Number(r.monto), 0);
  return directo + compartido;
}

function deudaTotalClientes() {
  return clientes.reduce((s, c) => s + deudaCliente(c.id), 0);
}

function pagadoDeVenta(ventaId) {
  return window.__clienteDetalleCobros.filter((c) => c.venta_id === ventaId).reduce((s, c) => s + Number(c.monto), 0);
}

function pagadoDeReparto(ventaId) {
  const clienteId = window.__clienteDetalleId;
  return window.__clienteDetalleCobros.filter((c) => c.venta_id === ventaId && c.cliente_id === clienteId).reduce((s, c) => s + Number(c.monto), 0);
}
