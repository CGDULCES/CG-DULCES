/* =====================================================================
 * CG DULCES · Dividir una cuenta entre varios clientes.
 * (archivo: js/app/dividir-cuenta.js)
 * ===================================================================== */

window.__divCuentaSeleccion = new Set();

function openDividirCuenta() {
  if (!cajaRequerida()) return;
  window.__divCuentaSeleccion = new Set();
  window.__divCuentaItems = [{ producto_id: ventasVisibles()[0]?.id, cantidad: 1 }];
  window.__divCuentaFecha = fechaLocalHoy();
  window.__divCuentaRedondeo = 0;
  renderDividirCuentaModal();
}

function divCuentaPartes() {
  const productos_ = ventasVisibles();
  const totalReal = window.__divCuentaItems.reduce((s, it) => {
    const p = productos_.find((pr) => pr.id === it.producto_id);
    return s + (p ? p.precio_venta * it.cantidad : 0);
  }, 0);
  const n = window.__divCuentaSeleccion.size;
  const red = window.__divCuentaRedondeo || 0;
  const porPersonaReal = n > 0 ? totalReal / n : 0;
  const porPersona = (red > 0 && n > 0) ? Math.ceil(porPersonaReal / red) * red : porPersonaReal;
  const totalCobrar = (red > 0 && n > 0) ? porPersona * n : totalReal;
  return { totalReal, n, red, porPersona, totalCobrar };
}

// Solo recalcula el cuadro de totales (sin redibujar el modal → no se pierde el scroll)
function actualizarResumenDivCuenta() {
  const el = document.getElementById("div-resumen");
  if (!el) return;
  const { totalReal, n, red, porPersona, totalCobrar } = divCuentaPartes();
  el.innerHTML = `
      <div class="flex items-center justify-between text-[13px] mb-1">
        <span class="text-cg-muted">Precio real</span>
        <span class="font-mono-num font-semibold">${fmt(totalReal)}</span>
      </div>
      <div class="flex items-center justify-between text-[13px]">
        <span class="text-cg-muted">Entre ${n} persona(s)</span>
        <span class="font-mono-num font-semibold text-cg-primary">${fmt(porPersona)} c/u</span>
      </div>
      ${red > 0 ? `<div class="flex items-center justify-between text-[12px] mt-1 pt-1 border-t border-cg-line/[0.06]">
        <span class="text-cg-muted">Total a cobrar (redondeado)</span>
        <span class="font-mono-num font-semibold text-cg-success">${fmt(totalCobrar)}${totalCobrar>totalReal ? ` (+${fmt(totalCobrar-totalReal)})` : ""}</span>
      </div>` : ""}`;
}

function renderDividirCuentaModal() {
  const productos_ = ventasVisibles();
  const { totalReal, n: cantidadSeleccionados, red, porPersona, totalCobrar } = divCuentaPartes();
  const total = totalReal;
  // Guardar posición de scroll para restaurarla después de redibujar
  const caja = document.getElementById("modal-box");
  const lista0 = document.getElementById("div-lista-clientes");
  const scrollCaja = caja ? caja.scrollTop : 0;
  const scrollLista = lista0 ? lista0.scrollTop : 0;

  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Dividir cuenta</p>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Fecha</label>
    <input id="div-fecha" type="date" value="${window.__divCuentaFecha}" onchange="window.__divCuentaFecha = this.value" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Productos</label>
    <div class="space-y-2 mt-1 mb-2">
      ${window.__divCuentaItems.map((it, i) => `
      <div class="flex items-center gap-2">
        <select onchange="cambiarProductoDivCuenta(${i}, this.value)" class="flex-1 min-w-0 bg-cg-surface rounded-xl px-3 py-2.5 text-[13px] outline-none">
          ${productos_.map((p) => `<option value="${p.id}" ${p.id===it.producto_id?"selected":""}>${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</option>`).join("")}
        </select>
        <input type="number" min="1" value="${it.cantidad}" onchange="cambiarCantidadDivCuenta(${i}, this.value)" aria-label="Cantidad" class="w-16 bg-cg-surface rounded-xl px-2 py-2.5 text-[14px] text-center outline-none" />
        ${window.__divCuentaItems.length > 1 ? `<button type="button" onclick="quitarItemDivCuenta(${i})" aria-label="Quitar producto" class="text-cg-danger text-[18px] leading-none px-1">×</button>` : ""}
      </div>`).join("")}
    </div>
    <button type="button" onclick="agregarItemDivCuenta()" class="text-[12px] text-cg-primary font-semibold mb-4">+ Agregar otro producto</button>
    <br />

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">¿Entre quiénes se reparte?</label>
    <div id="div-lista-clientes" class="space-y-1.5 mt-2 mb-4 max-h-[180px] overflow-y-auto">
      ${clientes.map((c) => `
        <label class="flex items-center gap-2 bg-cg-surface rounded-lg px-3 py-2">
          <input type="checkbox" onchange="toggleClienteDivCuenta(${c.id}, this.checked)" ${window.__divCuentaSeleccion.has(c.id)?"checked":""} class="w-4 h-4" />
          <span class="text-[13px] text-cg-ink">${CG.escapeHtml(c.nombre)}</span>
        </label>`).join("")}
    </div>
    <div class="flex gap-2 mb-4">
      <input id="div-nuevo-cliente" type="text" placeholder="Nombre de cliente nuevo" class="flex-1 bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] outline-none" />
      <button type="button" onclick="crearClienteDivCuenta()" class="bg-cg-primary text-cg-onink text-[13px] font-semibold px-3.5 rounded-xl">+</button>
    </div>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Redondear la parte de cada uno</label>
    <select id="div-redondeo" onchange="window.__divCuentaRedondeo = Number(this.value); actualizarResumenDivCuenta();" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-4 outline-none">
      <option value="0" ${red===0?"selected":""}>Sin redondear (parte exacta)</option>
      <option value="100" ${red===100?"selected":""}>A los 100 más cercanos (hacia arriba)</option>
      <option value="500" ${red===500?"selected":""}>A los 500 más cercanos (hacia arriba)</option>
      <option value="1000" ${red===1000?"selected":""}>A los 1.000 más cercanos (hacia arriba)</option>
    </select>

    <div id="div-resumen" class="bg-cg-surface rounded-xl p-3 mb-5">
      <div class="flex items-center justify-between text-[13px] mb-1">
        <span class="text-cg-muted">Precio real</span>
        <span class="font-mono-num font-semibold">${fmt(total)}</span>
      </div>
      <div class="flex items-center justify-between text-[13px]">
        <span class="text-cg-muted">Entre ${cantidadSeleccionados} persona(s)</span>
        <span class="font-mono-num font-semibold text-cg-primary">${fmt(porPersona)} c/u</span>
      </div>
      ${red > 0 ? `<div class="flex items-center justify-between text-[12px] mt-1 pt-1 border-t border-cg-line/[0.06]">
        <span class="text-cg-muted">Total a cobrar (redondeado)</span>
        <span class="font-mono-num font-semibold text-cg-success">${fmt(totalCobrar)}${totalCobrar>total ? ` (+${fmt(totalCobrar-total)})` : ""}</span>
      </div>` : ""}
    </div>

    <button onclick="confirmarDividirCuenta()" class="w-full bg-cg-success text-cg-onink font-semibold rounded-xl py-3">Registrar y dividir</button>
  `);
  const caja1 = document.getElementById("modal-box");
  const lista1 = document.getElementById("div-lista-clientes");
  if (caja1) caja1.scrollTop = scrollCaja;
  if (lista1) lista1.scrollTop = scrollLista;
}

function cambiarProductoDivCuenta(i, id) {
  window.__divCuentaItems[i].producto_id = Number(id);
  actualizarResumenDivCuenta();
}

function cambiarCantidadDivCuenta(i, valor) {
  window.__divCuentaItems[i].cantidad = Math.max(1, Number(valor) || 1);
  actualizarResumenDivCuenta();
}

function agregarItemDivCuenta() {
  window.__divCuentaItems.push({ producto_id: ventasVisibles()[0]?.id, cantidad: 1 });
  renderDividirCuentaModal();
}

function quitarItemDivCuenta(i) {
  window.__divCuentaItems.splice(i, 1);
  renderDividirCuentaModal();
}

function toggleClienteDivCuenta(id, checked) {
  if (checked) window.__divCuentaSeleccion.add(id);
  else window.__divCuentaSeleccion.delete(id);
  actualizarResumenDivCuenta();
}

async function crearClienteDivCuenta() {
  const nombre = document.getElementById("div-nuevo-cliente").value.trim();
  if (!nombre) return;
  const { data, error } = await sb.from("clientes").insert({ nombre }).select().single();
  if (error) { alert("No se pudo crear el cliente."); console.error(error); return; }
  await registrarHistorial("clientes", data.id, "crear", `Cliente creado: ${nombre}`);
  clientes.push(data);
  window.__divCuentaSeleccion.add(data.id);
  renderDividirCuentaModal();
}

async function confirmarDividirCuenta() {
  if (procesandoAccion) return;
  const items = window.__divCuentaItems.filter((it) => it.producto_id);
  const seleccion = [...window.__divCuentaSeleccion];
  if (items.length === 0) return;
  const porProducto = {};
  items.forEach((it) => { porProducto[it.producto_id] = (porProducto[it.producto_id] || 0) + it.cantidad; });
  for (const [pid, cant] of Object.entries(porProducto)) {
    const p = productos.find((pr) => pr.id === Number(pid));
    if (!p) return;
    if (cant > p.stock) { alert(`No hay suficiente stock de "${p.nombre}". Disponible: ${p.stock}.`); return; }
  }
  if (seleccion.length < 2) { alert("Elegí al menos 2 clientes para dividir la cuenta."); return; }
  procesandoAccion = true;

  try {
  const red = window.__divCuentaRedondeo || 0;
  let montos = null;
  if (red > 0) {
    const { totalReal } = divCuentaPartes();
    const porPersona = Math.ceil(totalReal / seleccion.length / red) * red;
    montos = seleccion.map(() => porPersona);
  }
  try {
    await CG.rpc.dividirCuenta({
      items: items.map((it) => ({ producto_id: it.producto_id, cantidad: it.cantidad })),
      registrado_por: ADMIN,
      created_at: fechaOAhora(window.__divCuentaFecha),
      clientes: seleccion,
      ...(montos ? { montos } : {}),
    });
  } catch (e) { alert(e.message); console.error(e); return; }

  closeModal();
  activeTab = "dashboard";
  await loadAll();
  } finally {
    procesandoAccion = false;
  }
}
