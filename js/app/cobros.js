/* =====================================================================
 * CG DULCES · Cobros y deudas: deudas manuales, pagos, cobros parciales y cuentas compartidas.
 * (archivo: js/app/cobros.js)
 * ===================================================================== */

window.__editVentaId = null;

window.__editVentaItems = [];

window.__editVentaOriginalItems = [];

function openAgregarDeuda(clienteId) {
  const c = clientes.find((cc) => cc.id === clienteId);
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">Agregar deuda</p>
    <p class="text-[12px] text-cg-muted mb-4">${CG.escapeHtml(c?.nombre || "")} · para algo que no está en el inventario</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">¿Qué le vendiste?</label>
    <input id="deuda-concepto" type="text" maxlength="120" placeholder="Ej: Porción de torta" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Monto a cobrar</label>
    <input id="deuda-monto" type="number" inputmode="numeric" min="1" placeholder="0" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Fecha</label>
    <input id="deuda-fecha" type="date" value="${fechaLocalHoy()}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveAgregarDeuda(${clienteId})" class="w-full bg-cg-success text-cg-onink font-semibold rounded-xl py-3">Guardar deuda</button>
  `);
}

async function saveAgregarDeuda(clienteId) {
  if (procesandoAccion) return;
  const concepto = document.getElementById("deuda-concepto").value.trim();
  const monto = Number(document.getElementById("deuda-monto").value) || 0;
  const fecha = document.getElementById("deuda-fecha").value;
  if (!concepto) { alert("Escribí qué le vendiste."); return; }
  if (monto <= 0) { alert("Poné el monto a cobrar."); return; }
  procesandoAccion = true;
  try {
    try {
      await CG.rpc.registrarDeudaManual({ cliente_id: clienteId, concepto, monto, created_at: fechaOAhora(fecha), registrado_por: ADMIN });
    } catch (e) { alert(e.message); console.error(e); return; }
    closeModal();
    await loadAll();
    await abrirClienteDetalle(clienteId);
  } finally {
    procesandoAccion = false;
  }
}

function openEditDeuda(venta) {
  window.__editDeudaId = venta.id;
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Editar deuda</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">¿Qué le vendiste?</label>
    <input id="editdeuda-concepto" type="text" maxlength="120" value="${CG.escapeHtml(venta.concepto || "")}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Monto</label>
    <input id="editdeuda-monto" type="number" inputmode="numeric" min="1" value="${Number(venta.total)}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Fecha</label>
    <input id="editdeuda-fecha" type="date" value="${new Date(venta.created_at).toLocaleDateString("en-CA", { timeZone: "America/Asuncion" })}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveEditDeuda()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar cambios</button>
  `);
}

async function saveEditDeuda() {
  if (procesandoAccion) return;
  const concepto = document.getElementById("editdeuda-concepto").value.trim();
  const monto = Number(document.getElementById("editdeuda-monto").value) || 0;
  const fecha = document.getElementById("editdeuda-fecha").value;
  if (!concepto) { alert("Escribí qué le vendiste."); return; }
  if (monto <= 0) { alert("Poné el monto."); return; }
  procesandoAccion = true;
  try {
    try {
      await CG.rpc.editarDeudaManual(window.__editDeudaId, concepto, monto, fechaOAhora(fecha), ADMIN);
    } catch (e) { alert(e.message); console.error(e); return; }
    closeModal();
    await loadAll();
    if (window.__clienteDetalleId) await abrirClienteDetalle(window.__clienteDetalleId);
  } finally {
    procesandoAccion = false;
  }
}

async function openPagosDeVenta(ventaId, clienteIdFiltro) {
  let query = sb.from("cobros").select("*").eq("venta_id", ventaId);
  if (clienteIdFiltro) query = query.eq("cliente_id", clienteIdFiltro);
  const { data: pagos } = await query.order("created_at", { ascending: false });
  window.__pagosVentaActual = pagos || [];
  window.__pagosVentaId = ventaId;
  window.__pagosClienteFiltro = clienteIdFiltro;
  renderPagosDeVentaModal();
}

function renderPagosDeVentaModal() {
  const pagos = window.__pagosVentaActual;
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Pagos registrados</p>
    <div class="space-y-2 mb-2">
      ${pagos.length === 0 ? `<p class="text-[13px] text-cg-muted">No hay pagos para esta venta.</p>` :
        pagos.map((p) => `
        <div class="bg-cg-surface rounded-xl p-3 flex items-center justify-between">
          <div>
            <p class="text-[13px] font-semibold text-cg-ink">${fmt(p.monto)} · ${p.medio_pago === "transferencia" ? "Transferencia" : p.medio_pago === "qr" ? "QR" : "Efectivo"}</p>
            <p class="text-[11px] text-cg-muted">${new Date(p.created_at).toLocaleString("es-PY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Asuncion"})}</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <button onclick="openEditCobroIndividual(${p.id})" class="text-[11px] text-cg-primary font-semibold">Editar</button>
            <button onclick="anularPagoIndividual(${p.id})" class="text-[11px] text-cg-danger font-semibold">Anular</button>
          </div>
        </div>`).join("")}
    </div>
  `);
}

function openEditCobroIndividual(cobroId) {
  const pago = window.__pagosVentaActual.find((p) => p.id === cobroId);
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Editar pago</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Monto</label>
    <input id="editcobro-monto" type="number" value="${pago.monto}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Forma de pago</label>
    <select id="editcobro-medio" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none">
      <option value="efectivo" ${pago.medio_pago==='efectivo'?'selected':''}>Efectivo</option>
      <option value="transferencia" ${pago.medio_pago==='transferencia'?'selected':''}>Transferencia</option>
      <option value="qr" ${pago.medio_pago==='qr'?'selected':''}>QR</option>
    </select>
    <button onclick="saveEditCobroIndividual(${cobroId})" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar</button>
  `);
}

async function saveEditCobroIndividual(cobroId) {
  const monto = Number(document.getElementById("editcobro-monto").value) || 0;
  const medio_pago = document.getElementById("editcobro-medio").value;
  if (monto <= 0) { alert("Poné un monto válido."); return; }
  let ajustadoEnCaja = true;
  try {
    ajustadoEnCaja = await CG.rpc.editarCobro(cobroId, monto, medio_pago, ADMIN);
  } catch (e) { alert(e.message); console.error(e); return; }
  closeModal();
  await loadAll();
  if (window.__clienteDetalleId) await abrirClienteDetalle(window.__clienteDetalleId);
  if (!ajustadoEnCaja) {
    alert("El pago se corrigió, pero no encontré el movimiento de caja de ese pago para ajustarlo solo (puede pasar con pagos viejos). Revisá el saldo de caja y, si hace falta, ajustalo a mano.");
  }
}

// Anula (borra) un pago ya registrado: la venta/parte que cubría vuelve a
// quedar pendiente, y se revierte el dinero de la caja.
async function anularPagoIndividual(cobroId) {
  if (procesandoAccion) return;
  if (!confirm("¿Anular este pago? La venta vuelve a quedar pendiente de cobro y se revierte de la caja.")) return;
  procesandoAccion = true;
  try {
    let revertidoEnCaja = true;
    try {
      revertidoEnCaja = await CG.rpc.anularCobro(cobroId, "anulado desde la app", ADMIN);
    } catch (e) { alert(e.message); console.error(e); return; }
    closeModal();
    await loadAll();
    if (window.__clienteDetalleId) await abrirClienteDetalle(window.__clienteDetalleId);
    if (!revertidoEnCaja) {
      alert("El pago se anuló y la deuda volvió a quedar pendiente, pero no encontré el movimiento de caja de ese pago para revertirlo solo (puede pasar con pagos viejos). Revisá el saldo de caja y, si hace falta, ajustalo a mano con un retiro.");
    }
  } finally {
    procesandoAccion = false;
  }
}

// Suma pendiente de todo lo seleccionado (ventas fiadas directas + partes de cuentas compartidas)
function totalCobroSeleccionado() {
  const ventas = window.__clienteDetalleVentas || [];
  const repartos = window.__clienteDetalleRepartos || [];
  let t = 0;
  window.__clienteSeleccionadas.forEach((id) => {
    const v = ventas.find((vv) => vv.id === id);
    if (v) t += Math.max(0, v.total - pagadoDeVenta(id));
  });
  window.__clienteSeleccionadasRepartos.forEach((vid) => {
    const r = repartos.find((rr) => rr.venta_id === vid);
    if (r) t += Math.max(0, r.monto - pagadoDeReparto(vid));
  });
  return t;
}

function toggleSeleccionVenta(ventaId, checked) {
  if (checked) window.__clienteSeleccionadas.add(ventaId);
  else window.__clienteSeleccionadas.delete(ventaId);
  render();
}

function toggleSeleccionReparto(ventaId, checked) {
  if (checked) window.__clienteSeleccionadasRepartos.add(ventaId);
  else window.__clienteSeleccionadasRepartos.delete(ventaId);
  render();
}

function ventasPendientesDe(ventas) {
  return ventas.filter((v) => v.es_fiado && Math.max(0, v.total - pagadoDeVenta(v.id)) > 0).map((v) => v.id);
}

function repartosPendientesDe(repartos) {
  return repartos.filter((r) => Math.max(0, r.monto - pagadoDeReparto(r.venta_id)) > 0).map((r) => r.venta_id);
}

function todasLasPendientesSeleccionadas() {
  const pv = ventasPendientesDe(window.__clienteDetalleVentas || []);
  const pr = repartosPendientesDe(window.__clienteDetalleRepartos || []);
  if (pv.length + pr.length === 0) return false;
  return pv.every((id) => window.__clienteSeleccionadas.has(id))
      && pr.every((id) => window.__clienteSeleccionadasRepartos.has(id));
}

function toggleSeleccionarTodasDeudas() {
  const pv = ventasPendientesDe(window.__clienteDetalleVentas || []);
  const pr = repartosPendientesDe(window.__clienteDetalleRepartos || []);
  if (todasLasPendientesSeleccionadas()) {
    pv.forEach((id) => window.__clienteSeleccionadas.delete(id));
    pr.forEach((id) => window.__clienteSeleccionadasRepartos.delete(id));
  } else {
    pv.forEach((id) => window.__clienteSeleccionadas.add(id));
    pr.forEach((id) => window.__clienteSeleccionadasRepartos.add(id));
  }
  render();
}

function openCobroVenta(ventaId) {
  if (!cajaRequerida()) return;
  const v = window.__clienteDetalleVentas.find((vv) => vv.id === ventaId);
  const pendiente = v.total - pagadoDeVenta(ventaId);
  window.__cobroVentaPendiente = pendiente;
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">Cobrar esta venta</p>
    <p class="text-[12px] text-cg-muted mb-4">Pendiente ${fmt(pendiente)}</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Monto que paga ahora</label>
    <input id="cobroventa-monto" type="number" value="${pendiente}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-1 outline-none" />
    <p class="text-[11px] text-cg-muted mb-4">Si paga de más, la diferencia va a la caja como ingreso extra (redondeo).</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Forma de pago</label>
    <select id="cobroventa-medio" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none">
      <option value="efectivo">Efectivo</option>
      <option value="transferencia">Transferencia</option>
      <option value="qr">QR</option>
    </select>
    <button onclick="saveCobroVenta(${ventaId})" class="w-full bg-cg-success text-cg-onink font-semibold rounded-xl py-3">Registrar cobro</button>
  `);
}

window.__editRepartoVentaId = null;

window.__editRepartoSeleccion = new Set();

window.__editRepartoOriginal = [];

async function openEditReparto(ventaId) {
  const { data: repartos } = await sb.from("venta_repartos").select("id, cliente_id, monto, clientes(nombre)").eq("venta_id", ventaId);
  window.__editRepartoVentaId = ventaId;
  window.__editRepartoOriginal = repartos || [];
  window.__editRepartoSeleccion = new Set((repartos || []).map((r) => r.cliente_id));
  renderEditRepartoModal();
}

function renderEditRepartoModal() {
  const original = window.__editRepartoOriginal;
  const total = original.reduce((s, r) => s + Number(r.monto), 0); // el total de la cuenta no cambia, solo cómo se reparte
  const seleccion = [...window.__editRepartoSeleccion];
  const porPersona = seleccion.length > 0 ? total / seleccion.length : 0;

  // Cobros ya hechos por cada persona (para no perderlos de vista al recalcular)
  const pagadoPorCliente = {};
  original.forEach((r) => {
    pagadoPorCliente[r.cliente_id] = cobros.filter((c) => c.venta_id === window.__editRepartoVentaId && c.cliente_id === r.cliente_id).reduce((s, c) => s + Number(c.monto), 0);
  });

  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">Editar división</p>
    <p class="text-[12px] text-cg-muted mb-4">Total de la cuenta: ${fmt(total)} · se reparte en partes iguales entre quienes tildes</p>

    <div class="space-y-1.5 mb-4 max-h-[220px] overflow-y-auto">
      ${clientes.map((c) => {
        const yaPago = pagadoPorCliente[c.id] > 0;
        return `
        <label class="flex items-center gap-2 bg-cg-surface rounded-lg px-3 py-2">
          <input type="checkbox" onchange="toggleClienteEditReparto(${c.id}, this.checked)" ${window.__editRepartoSeleccion.has(c.id)?"checked":""} class="w-4 h-4" />
          <span class="text-[13px] text-cg-ink flex-1">${CG.escapeHtml(c.nombre)}${yaPago ? ` <span class="text-[10px] text-cg-success">(ya pagó ${fmt(pagadoPorCliente[c.id])})</span>` : ""}</span>
        </label>`;
      }).join("")}
    </div>
    <div class="flex gap-2 mb-4">
      <input id="editreparto-nuevo-cliente" type="text" placeholder="Nombre de cliente nuevo" class="flex-1 bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] outline-none" />
      <button type="button" onclick="crearClienteEditReparto()" class="bg-cg-primary text-cg-onink text-[13px] font-semibold px-3.5 rounded-xl">+</button>
    </div>

    <div class="bg-cg-surface rounded-xl p-3 mb-5">
      <div class="flex items-center justify-between text-[13px]">
        <span class="text-cg-muted">Entre ${seleccion.length} persona(s)</span>
        <span class="font-mono-num font-semibold text-cg-primary">${fmt(porPersona)} c/u</span>
      </div>
    </div>

    <button onclick="saveEditReparto()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar nueva división</button>
  `);
}

function toggleClienteEditReparto(id, checked) {
  if (checked) window.__editRepartoSeleccion.add(id);
  else window.__editRepartoSeleccion.delete(id);
  renderEditRepartoModal();
}

async function crearClienteEditReparto() {
  const nombre = document.getElementById("editreparto-nuevo-cliente").value.trim();
  if (!nombre) return;
  const { data, error } = await sb.from("clientes").insert({ nombre }).select().single();
  if (error) { alert("No se pudo crear el cliente."); console.error(error); return; }
  await registrarHistorial("clientes", data.id, "crear", `Cliente creado: ${nombre}`);
  clientes.push(data);
  window.__editRepartoSeleccion.add(data.id);
  renderEditRepartoModal();
}

async function saveEditReparto() {
  if (procesandoAccion) return;
  const ventaId = window.__editRepartoVentaId;
  const original = window.__editRepartoOriginal;
  const seleccion = [...window.__editRepartoSeleccion];
  if (seleccion.length < 2) { alert("Tiene que haber al menos 2 personas en una cuenta dividida."); return; }
  procesandoAccion = true;
  try {

  const total = original.reduce((s, r) => s + Number(r.monto), 0);
  const porPersonaBase = Math.floor(total / seleccion.length);
  const resto = total - porPersonaBase * seleccion.length;

  // Bloquear si se intenta sacar a alguien que ya pagó su parte (para no perder plata de vista)
  for (const r of original) {
    const yaNoEsta = !seleccion.includes(r.cliente_id);
    if (yaNoEsta) {
      const pagado = cobros.filter((c) => c.venta_id === ventaId && c.cliente_id === r.cliente_id).reduce((s, c) => s + Number(c.monto), 0);
      if (pagado > 0) {
        alert(`No podés sacar a ${r.clientes?.nombre || "esa persona"} porque ya pagó ${fmt(pagado)} de su parte. Si fue un error, primero avisame para ver cómo revertirlo.`);
        return;
      }
    }
  }

  // Actualizar / crear / borrar filas de reparto según quién quedó
  for (let i = 0; i < seleccion.length; i++) {
    const clienteId = seleccion[i];
    const monto = porPersonaBase + (i === 0 ? resto : 0);
    const existente = original.find((r) => r.cliente_id === clienteId);
    if (existente) {
      await sb.from("venta_repartos").update({ monto }).eq("id", existente.id);
    } else {
      await sb.from("venta_repartos").insert({ venta_id: ventaId, cliente_id: clienteId, monto });
    }
  }
  for (const r of original) {
    if (!seleccion.includes(r.cliente_id)) {
      await sb.from("venta_repartos").delete().eq("id", r.id);
    }
  }

  const nombres = seleccion.map((id) => clientes.find((c) => c.id === id)?.nombre).join(", ");
  await registrarHistorial("ventas", ventaId, "editar", `División de cuenta compartida actualizada: ahora entre ${nombres}`);
  closeModal();
  await loadAll();
  if (window.__clienteDetalleId) await abrirClienteDetalle(window.__clienteDetalleId);
  else if (activeTab === "todas-ventas") await abrirTodasVentas();
  } finally {
    procesandoAccion = false;
  }
}

function openCobroReparto(ventaId, pendiente) {
  if (!cajaRequerida()) return;
  window.__cobroVentaPendiente = pendiente;
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">Cobrar su parte de la cuenta</p>
    <p class="text-[12px] text-cg-muted mb-4">Pendiente ${fmt(pendiente)}</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Monto que paga ahora</label>
    <input id="cobroventa-monto" type="number" value="${pendiente}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-1 outline-none" />
    <p class="text-[11px] text-cg-muted mb-4">Si paga de más, la diferencia va a la caja como ingreso extra (redondeo).</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Forma de pago</label>
    <select id="cobroventa-medio" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none">
      <option value="efectivo">Efectivo</option>
      <option value="transferencia">Transferencia</option>
      <option value="qr">QR</option>
    </select>
    <button onclick="saveCobroVenta(${ventaId})" class="w-full bg-cg-success text-cg-onink font-semibold rounded-xl py-3">Registrar cobro</button>
  `);
}

async function saveCobroVenta(ventaId) {
  if (procesandoAccion) return;
  const monto = Number(document.getElementById("cobroventa-monto").value) || 0;
  if (monto <= 0) return;
  const medio_pago = document.getElementById("cobroventa-medio").value;
  const clienteId = window.__clienteDetalleId;
  const cliente = clientes.find((c) => c.id === clienteId);
  procesandoAccion = true;
  try {
    try {
      await cobrarConSobrante({ cliente_id: clienteId, venta_id: ventaId, montoPagado: monto, pendiente: window.__cobroVentaPendiente, medio_pago, cliente_nombre: cliente?.nombre });
    } catch (e) { alert(e.message); console.error(e); return; }
    closeModal();
    await loadAll();
    await abrirClienteDetalle(clienteId);
  } finally {
    procesandoAccion = false;
  }
}

// Deudas elegidas (ventas fiadas + partes de cuentas compartidas), de la más vieja a la más nueva
function deudasSeleccionadas() {
  const ventas = window.__clienteDetalleVentas || [];
  const repartos = window.__clienteDetalleRepartos || [];
  const lista = [];
  window.__clienteSeleccionadas.forEach((ventaId) => {
    const v = ventas.find((vv) => vv.id === ventaId);
    if (!v) return;
    const pendiente = Math.max(0, Number(v.total) - pagadoDeVenta(ventaId));
    if (pendiente > 0) lista.push({ venta_id: ventaId, pendiente, fecha: v.created_at, etiqueta: textoVenta(v) });
  });
  window.__clienteSeleccionadasRepartos.forEach((ventaId) => {
    const r = repartos.find((rr) => rr.venta_id === ventaId);
    if (!r) return;
    const pendiente = Math.max(0, Number(r.monto) - pagadoDeReparto(ventaId));
    if (pendiente > 0) lista.push({ venta_id: ventaId, pendiente, fecha: r.created_at, etiqueta: "Parte de: " + textoVenta(r.ventas || {}) });
  });
  return lista.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

// Reparte un monto entre las deudas elegidas:
//  1) si el monto alcanza para todas, las salda y lo que sobra es redondeo;
//  2) si hay una deuda (o 2 o 3 juntas) que suman EXACTO el monto, paga esas completas;
//  3) si no, paga completas las más viejas y la última queda con pago parcial
//     (queda pendiente solo lo que falta).
function repartirCobro(deudas, monto) {
  const suma = deudas.reduce((s, d) => s + d.pendiente, 0);
  const completa = (d) => ({ ...d, cobra: d.pendiente, completa: true });
  if (monto >= suma) return { pagos: deudas.map(completa), sobrante: monto - suma, modo: "todo" };

  const n = deudas.length;
  let exacto = null;
  for (let i = 0; i < n && !exacto; i++) if (deudas[i].pendiente === monto) exacto = [i];
  for (let i = 0; i < n && !exacto; i++)
    for (let j = i + 1; j < n && !exacto; j++) if (deudas[i].pendiente + deudas[j].pendiente === monto) exacto = [i, j];
  if (!exacto && n <= 40) {
    for (let i = 0; i < n && !exacto; i++)
      for (let j = i + 1; j < n && !exacto; j++)
        for (let k = j + 1; k < n && !exacto; k++) if (deudas[i].pendiente + deudas[j].pendiente + deudas[k].pendiente === monto) exacto = [i, j, k];
  }
  if (exacto) return { pagos: exacto.map((i) => completa(deudas[i])), sobrante: 0, modo: "exacto" };

  let restante = monto;
  const pagos = [];
  for (const d of deudas) {
    if (restante <= 0) break;
    const cobra = Math.min(d.pendiente, restante);
    pagos.push({ ...d, cobra, completa: cobra === d.pendiente });
    restante -= cobra;
  }
  return { pagos, sobrante: 0, modo: "parcial" };
}

function openCobroSeleccionadas() {
  if (!cajaRequerida()) return;
  const deudas = deudasSeleccionadas();
  const suma = deudas.reduce((s, d) => s + d.pendiente, 0);
  window.__cobroSelSuma = suma;
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">Cobrar deudas seleccionadas</p>
    <p class="text-[12px] text-cg-muted mb-4">${deudas.length} deuda(s) · Total pendiente: ${fmt(suma)}</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Monto a cobrar</label>
    <input id="cobrosel-monto" type="number" inputmode="numeric" min="1" value="${suma}" oninput="pintarPlanCobroSel()" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
    <div class="flex gap-2 mt-2 mb-3">
      <button type="button" onclick="setMontoCobroSel(${suma})" class="text-[11px] text-cg-primary font-semibold bg-cg-surface rounded-lg px-2.5 py-1.5">Todo</button>
      <button type="button" onclick="setMontoCobroSel(${Math.round(suma / 2)})" class="text-[11px] text-cg-primary font-semibold bg-cg-surface rounded-lg px-2.5 py-1.5">La mitad</button>
    </div>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Forma de pago</label>
    <select id="cobrosel-medio" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none">
      <option value="efectivo">Efectivo</option>
      <option value="transferencia">Transferencia</option>
      <option value="qr">QR</option>
    </select>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Redondear el total a</label>
    <select id="cobrosel-redondeo" onchange="aplicarRedondeoCobroSel()" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none">
      <option value="0">Sin redondear</option>
      <option value="100">A los 100 (hacia arriba)</option>
      <option value="500">A los 500 (hacia arriba)</option>
      <option value="1000">A los 1.000 (hacia arriba)</option>
    </select>
    <div id="cobrosel-plan" class="bg-cg-surface rounded-xl p-3 mb-4 max-h-[200px] overflow-y-auto text-[12px]"></div>
    <button onclick="saveCobroSeleccionadas()" class="w-full bg-cg-success text-cg-onink font-semibold rounded-xl py-3">Confirmar cobro</button>
  `);
  pintarPlanCobroSel();
}

function setMontoCobroSel(monto) {
  document.getElementById("cobrosel-monto").value = monto;
  document.getElementById("cobrosel-redondeo").value = "0";
  pintarPlanCobroSel();
}

function aplicarRedondeoCobroSel() {
  const red = Number(document.getElementById("cobrosel-redondeo").value || 0);
  if (red > 0) document.getElementById("cobrosel-monto").value = Math.ceil(window.__cobroSelSuma / red) * red;
  else document.getElementById("cobrosel-monto").value = window.__cobroSelSuma;
  pintarPlanCobroSel();
}

// Muestra qué se va a cobrar con el monto escrito, antes de confirmar
function pintarPlanCobroSel() {
  const el = document.getElementById("cobrosel-plan");
  if (!el) return;
  const monto = Number(document.getElementById("cobrosel-monto").value) || 0;
  if (monto <= 0) { el.innerHTML = `<span class="text-cg-muted">Escribí el monto a cobrar.</span>`; return; }
  const deudas = deudasSeleccionadas();
  const plan = repartirCobro(deudas, monto);
  const fechaCorta = (f) => new Date(f).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", timeZone: "America/Asuncion" });
  const filas = plan.pagos.map((p) => `
    <div class="flex items-start justify-between gap-2 py-1 border-t border-cg-line/[0.05] first:border-t-0">
      <span class="min-w-0 text-cg-ink"><span class="${p.completa ? "text-cg-success" : "text-cg-warning"} font-semibold">${p.completa ? "✓ Se salda" : "◐ Pago parcial"}</span> · ${fechaCorta(p.fecha)} · ${CG.escapeHtml(p.etiqueta)}${p.completa ? "" : `<br><span class="text-cg-muted">paga ${fmt(p.cobra)} · queda pendiente ${fmt(p.pendiente - p.cobra)}</span>`}</span>
      <span class="font-mono-num font-semibold shrink-0">${fmt(p.cobra)}</span>
    </div>`).join("");
  const sinTocar = deudas.length - plan.pagos.length;
  const titulo = plan.modo === "exacto" ? "Encontré deudas que suman justo ese monto" : plan.modo === "parcial" ? "Se paga de la más vieja a la más nueva" : "Se saldan todas las deudas elegidas";
  el.innerHTML = `
    <p class="text-[11px] font-semibold text-cg-primary mb-1">${titulo}</p>
    ${filas}
    ${sinTocar > 0 ? `<p class="text-cg-muted pt-1 border-t border-cg-line/[0.05]">${sinTocar} deuda(s) quedan pendientes sin tocar.</p>` : ""}
    ${plan.sobrante > 0 ? `<p class="text-cg-muted pt-1 border-t border-cg-line/[0.05]">${fmt(plan.sobrante)} van a la caja como ingreso extra (redondeo).</p>` : ""}`;
}

async function saveCobroSeleccionadas() {
  if (procesandoAccion) return;
  const monto = Number(document.getElementById("cobrosel-monto")?.value) || 0;
  if (monto <= 0) { alert("Escribí el monto a cobrar."); return; }
  procesandoAccion = true;
  try {
    const medio_pago = document.getElementById("cobrosel-medio").value;
    const registrado_por = ADMIN;
    const clienteId = window.__clienteDetalleId;
    const cliente = clientes.find((c) => c.id === clienteId);

    const deudas = deudasSeleccionadas();
    if (deudas.length === 0) { closeModal(); return; }
    const plan = repartirCobro(deudas, monto);

    try {
      const grupo = nuevoGrupoId();
      for (const p of plan.pagos) {
        await CG.rpc.registrarCobro({ cliente_id: clienteId, venta_id: p.venta_id, monto: p.cobra, medio_pago, registrado_por, cliente_nombre: cliente?.nombre, grupo });
      }
      if (plan.sobrante > 0) {
        await CG.rpc.movimientoCaja({
          tipo: "ingreso_extra", monto: plan.sobrante, medio_pago, registrado_por,
          descripcion: `Redondeo de cobro (${plan.pagos.length} deudas)${cliente?.nombre ? " — " + cliente.nombre : ""}`,
        });
      }
    } catch (e) { alert(e.message); console.error(e); }
    closeModal();
    await loadAll();
    await abrirClienteDetalle(clienteId);
  } finally {
    procesandoAccion = false;
  }
}

// Registra un cobro y, si el cliente paga MÁS que lo que debe (redondeo:
// debe 3.333, paga 3.500), salda la deuda exacta y carga la diferencia
// (167) como "ingreso extra" en la caja, sin dejar saldos raros.
async function cobrarConSobrante({ cliente_id, venta_id, montoPagado, pendiente, medio_pago, cliente_nombre }) {
  const registrado_por = ADMIN;
  const cobroReal = (pendiente != null && montoPagado > pendiente) ? pendiente : montoPagado;
  const sobrante = (pendiente != null) ? Math.max(0, montoPagado - pendiente) : 0;
  if (cobroReal > 0) {
    await CG.rpc.registrarCobro({ cliente_id, venta_id, monto: cobroReal, medio_pago, registrado_por, cliente_nombre, grupo: nuevoGrupoId() });
  }
  if (sobrante > 0) {
    try {
      await CG.rpc.movimientoCaja({
        tipo: "ingreso_extra", monto: sobrante, medio_pago, registrado_por,
        descripcion: `Redondeo de cobro${venta_id ? " venta #" + venta_id : ""}${cliente_nombre ? " — " + cliente_nombre : ""}`,
      });
    } catch (e) {
      console.error(e);
      alert(`El cobro se registró, pero la diferencia de redondeo (${fmt(sobrante)}) no se pudo cargar a la caja: ${e.message}`);
    }
  }
  return { cobroReal, sobrante };
}
