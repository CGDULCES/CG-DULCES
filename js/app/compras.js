/* =====================================================================
 * CG DULCES · Compras y proveedores.
 * (archivo: js/app/compras.js)
 * ===================================================================== */

function renderProveedores(content) {
  content.innerHTML = `
    <button onclick="irA('compras')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver a Compras</button>
    ${sectionLabel("Proveedores")}
    <div class="space-y-2 mb-4">
      ${proveedores.length === 0 ? `<p class="text-[13px] text-cg-muted">Todavía no cargaste proveedores.</p>` :
        proveedores.map((p) => `
        <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
          <span class="text-[13px] font-semibold text-cg-ink">${CG.escapeHtml(p.nombre)}</span>
          <span class="text-[12px] text-cg-muted">${CG.escapeHtml(p.telefono || "")}</span>
        </div>`).join("")}
    </div>
    <button onclick="openNewProveedor()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">+ Nuevo proveedor</button>
  `;
}

function openNewProveedor() {
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Nuevo proveedor</p>
    <div class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre</label>
        <input id="prov-nombre" type="text" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
      </div>
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Teléfono (opcional)</label>
        <input id="prov-telefono" type="text" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
      </div>
    </div>
    <button onclick="saveNewProveedor()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3 mt-5">Guardar</button>
  `);
}

async function saveNewProveedor() {
  const nombre = document.getElementById("prov-nombre").value.trim();
  if (!nombre) { alert("Poné un nombre."); return; }
  const telefono = document.getElementById("prov-telefono").value.trim() || null;
  const { data, error } = await sb.from("proveedores").insert({ nombre, telefono }).select().single();
  if (error) { alert("No se pudo guardar."); console.error(error); return; }
  await registrarHistorial("proveedores", data.id, "crear", `Proveedor creado: ${nombre}`);
  closeModal();
  await loadAll();
  activeTab = "proveedores";
  render();
}

window.__compraItems = [];

function renderCompras(content) {
  content.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      ${sectionLabel("Compras registradas")}
      <button onclick="irA('proveedores')" class="text-[12px] text-cg-primary font-semibold">Proveedores ›</button>
    </div>
    ${compras.length ? encabezadoPC(COLS_COMPRAS, ["Fecha", "Proveedor", "Tipo", "Productos", ">Total"]) : ""}
    <div class="space-y-2 mb-4 cg-fila-lista">
      ${compras.length === 0 ? `<p class="text-[13px] text-cg-muted">Todavía no registraste compras.</p>` :
        compras.map((c) => `
        <button onclick="openEditCompra(${c.id})" class="w-full text-left bg-cg-card rounded-2xl p-4 lg:p-0 shadow-sm border border-cg-line/[0.04] hover:bg-cg-surface">
          <div class="lg:hidden">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[13px] font-semibold text-cg-ink">${CG.escapeHtml(c.proveedores?.nombre || "Sin proveedor")}</span>
            <span class="font-mono-num text-[13px] font-semibold">${fmt(c.total)}</span>
          </div>
          <p class="text-[11px] text-cg-muted">${c.tipo === "insumos" ? "Insumos" : "Mercadería"} · ${new Date(c.created_at).toLocaleDateString("es-PY")}</p>
          <p class="text-[12px] text-cg-ink mt-1">${CG.escapeHtml((c.compra_items||[]).map(it=>`${it.cantidad}× ${it.productos?.nombre||""}`).join(", "))}</p>
          </div>
          ${celdasPC(COLS_COMPRAS, [
            `<span class="text-[12px] text-cg-muted">${new Date(c.created_at).toLocaleDateString("es-PY")}</span>`,
            `<span class="text-[13px] font-semibold text-cg-ink">${CG.escapeHtml(c.proveedores?.nombre || "Sin proveedor")}</span>`,
            `<span class="text-[12px] text-cg-muted">${c.tipo === "insumos" ? "Insumos" : "Mercadería"}</span>`,
            `<span class="text-[12px] text-cg-ink">${CG.escapeHtml((c.compra_items||[]).map(it=>`${it.cantidad}× ${it.productos?.nombre||""}`).join(", "))}</span>`,
            `<span class="font-mono-num text-[13px] font-semibold block text-right">${fmt(c.total)}</span>`,
          ])}
        </button>`).join("")}
    </div>
  `;
}

window.__editingCompraId = null;

window.__originalCompraItems = [];

function openNewCompra() {
  if (!cajaRequerida()) return;
  window.__editingCompraId = null;
  window.__originalCompraItems = [];
  window.__compraTipo = "mercaderia";
  window.__compraFecha = fechaLocalHoy();
  window.__compraDescuento = 0;
  window.__compraProveedorId = proveedores[0]?.id || null;
  const primerProducto = productos.find((p) => !p.es_insumo);
  window.__compraItems = [{ producto_id: primerProducto?.id, cantidad: 1, costo_unitario: 0, total_linea: 0 }];
  renderCompraModal();
}

function openEditCompra(id) {
  const c = compras.find((cc) => cc.id === id);
  if (!c) return;
  window.__editingCompraId = id;
  window.__compraTipo = c.tipo;
  window.__compraFecha = new Date(c.created_at).toISOString().slice(0, 10);
  window.__compraDescuento = Number(c.descuento) || 0;
  window.__compraItems = (c.compra_items || []).map((it) => ({ id: it.id, producto_id: it.producto_id, cantidad: Number(it.cantidad), costo_unitario: Number(it.costo_unitario), total_linea: Number(it.cantidad) * Number(it.costo_unitario) }));
  window.__originalCompraItems = JSON.parse(JSON.stringify(window.__compraItems));
  window.__editingProveedorId = c.proveedor_id;
  window.__compraProveedorId = c.proveedor_id;
  window.__editingTipo = c.tipo;
  window.__medioPagoCompra = c.medio_pago || "efectivo";
  window.__mixtoCompraEfectivoInicial = Number(c.monto_efectivo) || 0;
  window.__mixtoCompraTransferenciaInicial = Number(c.monto_transferencia) || 0;
  renderCompraModal();
}

function cambiarTipoCompra(valor) {
  window.__compraTipo = valor;
  const disponibles = productosPorTipoCompra();
  window.__compraItems = window.__compraItems.map((it) => ({
    ...it,
    producto_id: disponibles.some((p) => p.id === it.producto_id) ? it.producto_id : disponibles[0]?.id,
  }));
  renderCompraModal();
}

function productosPorTipoCompra() {
  return productos.filter((p) => (window.__compraTipo === "insumos" ? p.es_insumo : !p.es_insumo));
}

function renderCompraModal() {
  const editando = !!window.__editingCompraId;
  const medioPagoActual = window.__medioPagoCompra || "efectivo";
  const opcionesProveedor = proveedores.map((p) => `<option value="${p.id}" ${window.__compraProveedorId===p.id ? "selected":""}>${CG.escapeHtml(p.nombre)}</option>`).join("");
  const subtotalCompraVal = subtotalCompra();
  const descuentoCompra = window.__compraDescuento || 0;
  const total = Math.max(0, subtotalCompraVal - descuentoCompra);
  const productosDisponibles = productosPorTipoCompra();

  const filasHtml = window.__compraItems.map((it, i) => {
    const productoSel = productos.find((p) => p.id === it.producto_id);
    const factor = factorConversion(productoSel);
    return `
    <div class="bg-cg-surface rounded-xl p-3 mb-2">
      <select onchange="cambiarItemCompra(${i}, 'producto_id', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] mb-2 outline-none">
        ${productosDisponibles.length === 0 ? `<option value="">No hay productos de este tipo</option>` :
          productosDisponibles.map((p) => `<option value="${p.id}" ${p.id===it.producto_id?"selected":""}>${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</option>`).join("")}
      </select>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[10px] text-cg-muted">Cantidad</label>
          <input type="number" step="any" value="${it.cantidad}" onchange="cambiarItemCompra(${i}, 'cantidad', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] outline-none" />
        </div>
        <div>
          <label class="text-[10px] text-cg-muted">Costo c/u</label>
          <input type="number" step="any" value="${Number.isInteger(it.costo_unitario) ? it.costo_unitario : Number(it.costo_unitario).toFixed(2)}" onchange="cambiarItemCompra(${i}, 'costo_unitario', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] outline-none" />
        </div>
      </div>
      <div class="mt-2">
        <label class="text-[10px] text-cg-muted">Total de la línea — lo que pagaste (ajusta el costo c/u)</label>
        <input type="number" step="any" value="${it.total_linea || ""}" placeholder="Ej: pagaste 20000 por la caja" onchange="cambiarItemCompra(${i}, 'total_linea', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] outline-none" />
      </div>
      <div class="flex items-center justify-between mt-2 pt-2 border-t border-cg-line/[0.06]">
        <span class="text-[11px] text-cg-muted">Subtotal de este producto</span>
        <span class="font-mono-num text-[13px] font-semibold text-cg-ink">${fmt(totalLineaCompra(it))}</span>
      </div>
      ${factor > 1 ? `<p class="text-[10px] text-cg-success mt-1.5">Suma ${it.cantidad * factor} al stock (${factor} por unidad)</p>` : ""}
      ${window.__compraItems.length > 1 ? `<button onclick="quitarItemCompra(${i})" class="text-[11px] text-cg-danger mt-2">Quitar</button>` : ""}
    </div>
  `;
  }).join("");

  showModal(`
    <div class="sticky top-0 z-10 bg-cg-card -mx-5 -mt-5 px-5 pt-5 pb-3 mb-1 flex items-start justify-between gap-3">
      <p class="font-display text-[18px] font-semibold text-cg-ink">${editando ? "Editar compra" : "Nueva compra"}</p>
      <button type="button" onclick="cerrarFormularioCompra()" aria-label="Cerrar el formulario" class="w-8 h-8 rounded-full bg-cg-surface text-cg-ink text-[18px] leading-none font-semibold flex items-center justify-center shrink-0">×</button>
    </div>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Fecha de la compra</label>
    <input id="compra-fecha" type="date" value="${window.__compraFecha}" onchange="window.__compraFecha = this.value" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Proveedor</label>
    <select id="compra-proveedor" onchange="window.__compraProveedorId = Number(this.value)" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none">${opcionesProveedor}</select>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Tipo</label>
    <select id="compra-tipo" onchange="cambiarTipoCompra(this.value)" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-4 outline-none">
      <option value="mercaderia" ${window.__compraTipo==='mercaderia' ? "selected":""}>Mercadería</option>
      <option value="insumos" ${window.__compraTipo==='insumos' ? "selected":""}>Insumos</option>
    </select>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Productos comprados</label>
    <div class="mt-2 mb-2">${filasHtml}</div>
    <button onclick="agregarItemCompra()" class="text-[12px] text-cg-primary font-semibold mb-4">+ Agregar otro producto</button>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Descuento manual (opcional)</label>
    <input id="compra-descuento" type="number" value="${descuentoCompra}" onchange="window.__compraDescuento = Number(this.value) || 0; renderCompraModal();" placeholder="Ej: te hicieron un descuento por compra grande" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-4 outline-none" />

    <div class="flex items-center justify-between mb-1 text-[12px] text-cg-muted">
      <span>Subtotal</span><span class="font-mono-num">${fmt(subtotalCompraVal)}</span>
    </div>
    <div class="flex items-center justify-between mb-4">
      <span class="text-[12px] text-cg-muted">Total</span>
      <span class="font-mono-num text-[18px] font-semibold text-cg-ink">${fmt(total)}</span>
    </div>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Pagaste con</label>
    <div class="grid grid-cols-3 gap-2 mt-1 mb-3">
      <button type="button" onclick="selectPagoCompra('efectivo', this)" class="pago-compra-btn border border-cg-line/10 rounded-xl py-2 text-[12px] font-medium ${medioPagoActual==='efectivo'?'bg-cg-primary text-cg-onink':''}" data-pago="efectivo">Efectivo</button>
      <button type="button" onclick="selectPagoCompra('transferencia', this)" class="pago-compra-btn border border-cg-line/10 rounded-xl py-2 text-[12px] font-medium ${medioPagoActual==='transferencia'?'bg-cg-primary text-cg-onink':''}" data-pago="transferencia">Transf.</button>
      <button type="button" onclick="selectPagoCompra('mixto', this)" class="pago-compra-btn border border-cg-line/10 rounded-xl py-2 text-[12px] font-medium ${medioPagoActual==='mixto'?'bg-cg-primary text-cg-onink':''}" data-pago="mixto">Mixto</button>
    </div>
    <div id="mixto-compra-wrap" class="${medioPagoActual==='mixto'?'':'hidden'} mb-4">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[10px] text-cg-muted">Efectivo</label>
          <input id="mixto-compra-efectivo" type="number" value="${window.__mixtoCompraEfectivoInicial||0}" oninput="actualizarRestoMixtoCompra()" class="w-full bg-cg-surface rounded-lg px-2 py-2 text-[13px] outline-none" />
        </div>
        <div>
          <label class="text-[10px] text-cg-muted">Transferencia</label>
          <input id="mixto-compra-transferencia" type="number" value="${window.__mixtoCompraTransferenciaInicial||0}" oninput="actualizarRestoMixtoCompra()" class="w-full bg-cg-surface rounded-lg px-2 py-2 text-[13px] outline-none" />
        </div>
      </div>
      <p id="mixto-compra-restante" class="text-[11px] text-cg-muted mt-1.5"></p>
    </div>

    <button onclick="${editando ? "saveEditCompra()" : "saveNewCompra()"}" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">${editando ? "Guardar cambios" : "Registrar compra"}</button>
    ${editando ? `<button onclick="deleteCompra()" class="w-full text-cg-danger text-[13px] font-semibold py-3 mt-1">Eliminar esta compra</button>` : ""}
  `, { bloquear: true, conservarScroll: true });
  window.__medioPagoCompra = medioPagoActual;
}

function selectPagoCompra(medio, btn) {
  window.__medioPagoCompra = medio;
  document.querySelectorAll(".pago-compra-btn").forEach((b) => b.classList.remove("bg-cg-primary", "text-cg-onink"));
  btn.classList.add("bg-cg-primary", "text-cg-onink");
  const wrap = document.getElementById("mixto-compra-wrap");
  if (medio === "mixto") { wrap.classList.remove("hidden"); actualizarRestoMixtoCompra(); }
  else wrap.classList.add("hidden");
}

function actualizarRestoMixtoCompra() {
  const total = Math.max(0, subtotalCompra() - (window.__compraDescuento || 0));
  const efectivo = Number(document.getElementById("mixto-compra-efectivo").value) || 0;
  const transferencia = Number(document.getElementById("mixto-compra-transferencia").value) || 0;
  const resto = total - efectivo - transferencia;
  document.getElementById("mixto-compra-restante").textContent =
    resto === 0 ? "✓ Cubre el total exacto" : resto > 0 ? `Falta cubrir ${fmt(resto)}` : `Te pasaste por ${fmt(-resto)}`;
}

// Total de una línea de compra: si la persona cargó "total de la línea"
// (lo que realmente pagó), se usa eso; si no, cantidad × costo c/u.
function totalLineaCompra(it) {
  const t = Number(it.total_linea);
  return Number.isFinite(t) && t > 0 ? t : (Number(it.cantidad) || 0) * (Number(it.costo_unitario) || 0);
}

function subtotalCompra() {
  return window.__compraItems.reduce((s, it) => s + totalLineaCompra(it), 0);
}

function cambiarItemCompra(i, campo, valor) {
  const it = window.__compraItems[i];
  if (campo === "producto_id") { it.producto_id = Number(valor); renderCompraModal(); return; }
  const num = Number(valor) || 0;
  if (campo === "cantidad") {
    it.cantidad = num;
    if (Number(it.total_linea) > 0) it.costo_unitario = it.cantidad > 0 ? Number(it.total_linea) / it.cantidad : 0;
    else it.total_linea = it.cantidad * (Number(it.costo_unitario) || 0);
  } else if (campo === "costo_unitario") {
    it.costo_unitario = num;
    it.total_linea = num * (Number(it.cantidad) || 0);
  } else if (campo === "total_linea") {
    it.total_linea = num;
    it.costo_unitario = Number(it.cantidad) > 0 ? num / Number(it.cantidad) : 0;
  }
  renderCompraModal();
}

function agregarItemCompra() {
  const disponibles = productosPorTipoCompra();
  window.__compraItems.push({ producto_id: disponibles[0]?.id, cantidad: 1, costo_unitario: 0, total_linea: 0 });
  renderCompraModal();
}

function quitarItemCompra(i) {
  window.__compraItems.splice(i, 1);
  renderCompraModal();
}

async function saveNewCompra() {
  if (procesandoAccion) return;
  const proveedor_id = Number(document.getElementById("compra-proveedor").value) || null;
  const tipo = document.getElementById("compra-tipo").value;
  const fecha = document.getElementById("compra-fecha").value;
  const created_at = fechaOAhora(fecha);
  const registrado_por = ADMIN;
  const descuento = window.__compraDescuento || 0;
  const subtotal = subtotalCompra();
  const total = Math.max(0, subtotal - descuento);
  const medio_pago = window.__medioPagoCompra || "efectivo";

  let monto_efectivo = 0, monto_transferencia = 0;
  if (medio_pago === "mixto") {
    monto_efectivo = Number(document.getElementById("mixto-compra-efectivo").value) || 0;
    monto_transferencia = Number(document.getElementById("mixto-compra-transferencia").value) || 0;
    if (monto_efectivo + monto_transferencia !== total) {
      alert("El efectivo y la transferencia tienen que sumar exactamente el total de la compra.");
      return;
    }
  } else if (medio_pago === "efectivo") {
    monto_efectivo = total;
  } else {
    monto_transferencia = total;
  }

  const saldos = saldosCajaActual();
  if (monto_efectivo > saldos.efectivo) {
    alert(`No hay suficiente efectivo en caja. Disponible: ${fmt(saldos.efectivo)}, necesitás ${fmt(monto_efectivo)}.`);
    return;
  }
  if (monto_transferencia > saldos.banco) {
    alert(`No hay suficiente saldo en la cuenta bancaria. Disponible: ${fmt(saldos.banco)}, necesitás ${fmt(monto_transferencia)}.`);
    return;
  }

  procesandoAccion = true;
  try {
  try {
    await CG.rpc.registrarCompra({
      proveedor_id, tipo, registrado_por,
      descuento, total, medio_pago, monto_efectivo, monto_transferencia, created_at,
      items: window.__compraItems.map((it) => ({ producto_id: it.producto_id, cantidad: it.cantidad, costo_unitario: it.costo_unitario })),
    });
  } catch (e) { alert(e.message); console.error(e); return; }

  window.__compraItems = [];
  closeModal();
  await loadAll();
  activeTab = "compras";
  render();
  } finally {
    procesandoAccion = false;
  }
}

async function saveEditCompra() {
  if (procesandoAccion) return;
  procesandoAccion = true;
  try {
  const proveedor_id = Number(document.getElementById("compra-proveedor").value) || null;
  const tipo = document.getElementById("compra-tipo").value;
  const fecha = document.getElementById("compra-fecha").value;
  const created_at = fechaOAhora(fecha);
  const descuento = window.__compraDescuento || 0;
  const subtotal = subtotalCompra();
  const total = Math.max(0, subtotal - descuento);
  const compraId = window.__editingCompraId;

  const medioEdit = window.__medioPagoCompra || "efectivo";
  let nuevoEfectivo = 0, nuevaTransferencia = 0;
  if (medioEdit === "mixto") {
    nuevoEfectivo = Number(document.getElementById("mixto-compra-efectivo")?.value) || 0;
    nuevaTransferencia = Number(document.getElementById("mixto-compra-transferencia")?.value) || 0;
  } else if (medioEdit === "efectivo") {
    nuevoEfectivo = total;
  } else {
    nuevaTransferencia = total;
  }
  try {
    await CG.rpc.editarCompra({
      compra_id: compraId,
      proveedor_id,
      tipo,
      total,
      descuento,
      created_at,
      medio_pago: medioEdit,
      monto_efectivo: nuevoEfectivo,
      monto_transferencia: nuevaTransferencia,
      usuario: ADMIN,
      items: window.__compraItems.map((it) => ({
        id: it.id || null,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        costo_unitario: it.costo_unitario,
      })),
    });
  } catch (e) { alert(e.message); console.error(e); return; }

  window.__editingCompraId = null;
  window.__compraItems = [];
  closeModal();
  await loadAll();
  activeTab = "compras";
  render();
  } finally {
    procesandoAccion = false;
  }
}

async function deleteCompra() {
  if (!confirm("¿Eliminar esta compra? Se va a descontar del stock lo que había sumado, y se devuelve el dinero a la caja.")) return;
  if (procesandoAccion) return;
  procesandoAccion = true;
  try {
  try {
    await CG.rpc.eliminarCompra(window.__editingCompraId, ADMIN);
  } catch (e) { alert(e.message); console.error(e); return; }

  window.__editingCompraId = null;
  window.__compraItems = [];
  closeModal();
  await loadAll();
  activeTab = "compras";
  render();
  } finally {
    procesandoAccion = false;
  }
}

// Cerrar el formulario de compras con la "×": se descarta todo lo que se había cargado
function cerrarFormularioCompra() {
  window.__compraItems = [];
  window.__compraDescuento = 0;
  window.__editingCompraId = null;
  closeModal();
}
