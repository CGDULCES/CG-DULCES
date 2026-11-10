/* =====================================================================
 * CG DULCES · Clientes: lista, perfil con su historial y deuda.
 * (archivo: js/app/clientes.js)
 * ===================================================================== */

let buscarClientes = "";

function cambiarBuscarClientes(valor) {
  buscarClientes = valor;
  render();
  refocusInput("buscar-clientes-input");
}

function renderClientes(content) {
  const termino = buscarClientes.trim().toLowerCase();
  const ordenados = [...clientes]
    .filter((c) => !termino || c.nombre.toLowerCase().includes(termino))
    .sort((a, b) => totalCompradoCliente(b.id) - totalCompradoCliente(a.id));
  content.innerHTML = `
    ${sectionLabel("Clientes (ordenados por cuánto compraron)")}
    <div class="relative mb-4">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--cg-muted))" stroke-width="2" stroke-linecap="round" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="buscar-clientes-input" type="text" placeholder="Buscar cliente..." value="${CG.escapeHtml(buscarClientes)}" oninput="cambiarBuscarClientes(this.value)" class="w-full bg-cg-card border border-cg-line/[0.06] rounded-xl pl-9 pr-3 py-2.5 text-[13px] outline-none" />
    </div>
    <div class="space-y-2 mb-4">
      ${ordenados.length === 0 ? `<p class="text-[13px] text-cg-muted">${termino ? "No encontré clientes con ese nombre." : "Todavía no cargaste clientes."}</p>` :
        ordenados.map((c) => {
          const deuda = deudaCliente(c.id);
          const comprado = totalCompradoCliente(c.id);
          return `
          <button onclick="abrirClienteDetalle(${c.id})" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[13px] font-semibold text-cg-ink">${CG.escapeHtml(c.nombre)}</span>
              <span class="font-mono-num text-[12px] text-cg-muted">total ${fmt(comprado)}</span>
            </div>
            <span class="text-[12px] ${deuda > 0 ? 'text-cg-danger font-semibold' : 'text-cg-muted'}">${deuda > 0 ? `Debe ${fmt(deuda)}` : "Sin deuda"}</span>
          </button>`;
        }).join("")}
    </div>
  `;
}

window.__clienteDetalleId = null;

window.__clienteDetalleVentas = [];

window.__clienteDetalleCobros = [];

window.__clienteSeleccionadas = new Set();          // ids de ventas fiadas directas

window.__clienteSeleccionadasRepartos = new Set();  // venta_id de cuentas compartidas

async function abrirClienteDetalle(clienteId) {
  window.__clienteDetalleId = clienteId;
  window.__clienteSeleccionadas = new Set();
  window.__clienteSeleccionadasRepartos = new Set();
  const [{ data: ventasCliente }, { data: cobrosCliente }, { data: repartosCliente }] = await Promise.all([
    sb.from("ventas").select("id, total, es_fiado, medio_pago, created_at, concepto, venta_items(cantidad, productos(nombre))").eq("cliente_id", clienteId).order("created_at", { ascending: false }),
    sb.from("cobros").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false }),
    sb.from("venta_repartos").select("id, venta_id, monto, created_at, ventas(created_at, venta_items(cantidad, productos(nombre)))").eq("cliente_id", clienteId).order("created_at", { ascending: false }),
  ]);
  window.__clienteDetalleVentas = ventasCliente || [];
  window.__clienteDetalleCobros = cobrosCliente || [];
  window.__clienteDetalleRepartos = repartosCliente || [];
  activeTab = "cliente-detalle";
  render();
}

function renderClienteDetalle(content) {
  const cliente = clientes.find((c) => c.id === window.__clienteDetalleId);
  if (!cliente) { content.innerHTML = ""; return; }
  const ventas = window.__clienteDetalleVentas;
  const repartos = window.__clienteDetalleRepartos;
  const deudaDirecta = ventas.filter((v) => v.es_fiado).reduce((s, v) => s + Math.max(0, Number(v.total) - pagadoDeVenta(v.id)), 0);
  const deudaCompartida = repartos.reduce((s, r) => s + Math.max(0, Number(r.monto) - pagadoDeReparto(r.venta_id)), 0);
  const deudaTotal = deudaDirecta + deudaCompartida;
  const pagosSinVenta = window.__clienteDetalleCobros.filter((c) => !c.venta_id).reduce((s, c) => s + Number(c.monto), 0);

  content.innerHTML = `
    <button onclick="irA('clientes')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver a Clientes</button>
    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      <div class="flex items-center justify-between">
        <p class="font-display text-[18px] font-semibold text-cg-ink">${CG.escapeHtml(cliente.nombre)}</p>
        <div class="flex items-center gap-3">
          <button onclick="openAgregarDeuda(${cliente.id})" class="text-[11px] text-cg-success font-semibold">Agregar deuda</button>
          <button onclick="openEditCliente(${cliente.id})" class="text-[11px] text-cg-primary font-semibold">Editar</button>
          <button onclick="deleteCliente(${cliente.id})" class="text-[11px] text-cg-danger font-semibold">Eliminar</button>
        </div>
      </div>
      ${cliente.telefono ? `<p class="text-[12px] text-cg-muted mt-0.5">📱 ${CG.escapeHtml(cliente.telefono)}</p>` : ""}
      <p class="text-[13px] mt-1 ${deudaTotal > 0 ? 'text-cg-danger font-semibold' : 'text-cg-success font-semibold'}">${deudaTotal > 0 ? `Debe en total ${fmt(deudaTotal)}` : "Sin deuda pendiente"}</p>
      ${pagosSinVenta > 0 ? `<p class="text-[11px] text-cg-muted mt-1">Aparte, hay ${fmt(pagosSinVenta)} en pagos viejos sin venta asociada (no están descontados de este total)</p>` : ""}
    </div>

    <div class="flex items-center justify-between mb-2">
      ${sectionLabel("Historial de compras")}
      ${(ventas.some((v) => v.es_fiado && Math.max(0, v.total - pagadoDeVenta(v.id)) > 0)
         || repartos.some((r) => Math.max(0, r.monto - pagadoDeReparto(r.venta_id)) > 0)) ? `
      <button onclick="toggleSeleccionarTodasDeudas()" class="text-[11px] text-cg-primary font-semibold mb-2">
        ${todasLasPendientesSeleccionadas() ? "Deseleccionar todas" : "Seleccionar todas las deudas"}
      </button>` : ""}
    </div>
    <div class="space-y-2 mb-4 cg-fila-lista">
      ${ventas.length === 0 ? `<p class="text-[13px] text-cg-muted">Todavía no tiene compras registradas.</p>` :
        ventas.map((v) => {
          const pagado = pagadoDeVenta(v.id);
          const pendiente = v.es_fiado ? Math.max(0, v.total - pagado) : 0;
          const fechaHora = new Date(v.created_at).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Asuncion" });
          const itemsTexto = CG.escapeHtml(textoVenta(v));
          const seleccionable = v.es_fiado && pendiente > 0;
          return `
          <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
            <div class="flex items-start gap-2.5">
              ${seleccionable ? `<input type="checkbox" onchange="toggleSeleccionVenta(${v.id}, this.checked)" ${window.__clienteSeleccionadas.has(v.id) ? "checked" : ""} class="w-4 h-4 mt-0.5 shrink-0" />` : `<span class="w-4 shrink-0"></span>`}
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] text-cg-muted">${fechaHora}</span>
                  <span class="font-mono-num text-[13px] font-semibold">${fmt(v.total)}</span>
                </div>
                <p class="text-[13px] text-cg-ink mt-0.5">${itemsTexto}</p>
                <div class="flex items-center justify-between mt-1.5">
                  ${!v.es_fiado
                    ? `<span class="text-[11px] text-cg-muted">Pagado al contado (${v.medio_pago})</span>`
                    : pendiente <= 0
                      ? `<span class="text-[11px] text-cg-success font-semibold">✓ Pagado</span>`
                      : `<span class="text-[11px] text-cg-danger font-semibold">Pendiente ${fmt(pendiente)}</span>`}
                  <div class="flex items-center gap-3">
                    ${pagado > 0 ? `<button onclick="openPagosDeVenta(${v.id}, null)" class="text-[11px] text-cg-primary font-semibold">Ver pagos</button>` : ""}
                    ${seleccionable ? `<button onclick="openCobroVenta(${v.id})" class="text-[11px] text-cg-primary font-semibold">Cobrar esta</button>` : ""}
                    <button onclick="openEditVenta(${v.id})" class="text-[11px] text-cg-primary font-semibold">Editar</button>
                    <button onclick="deleteVenta(${v.id})" class="text-[11px] text-cg-danger font-semibold">Eliminar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>`;
        }).join("")}
    </div>

    ${repartos.length > 0 ? `
    ${sectionLabel("Cuentas compartidas")}
    <div class="space-y-2 mb-4 cg-fila-lista">
      ${repartos.map((r) => {
        const pagado = pagadoDeReparto(r.venta_id);
        const pendiente = Math.max(0, r.monto - pagado);
        const fechaHora = new Date(r.created_at).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Asuncion" });
        const itemsTexto = CG.escapeHtml(textoVenta(r.ventas || {}));
        return `
        <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
          <div class="flex items-start gap-2.5">
            ${pendiente > 0 ? `<input type="checkbox" onchange="toggleSeleccionReparto(${r.venta_id}, this.checked)" ${window.__clienteSeleccionadasRepartos.has(r.venta_id) ? "checked" : ""} class="w-4 h-4 mt-0.5 shrink-0" />` : `<span class="w-4 shrink-0"></span>`}
            <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] text-cg-muted">${fechaHora}</span>
            <span class="font-mono-num text-[13px] font-semibold">${fmt(r.monto)}</span>
          </div>
          <p class="text-[13px] text-cg-ink mt-0.5">Parte de: ${itemsTexto}</p>
          <div class="flex items-center justify-between mt-1.5">
            ${pendiente <= 0
              ? `<span class="text-[11px] text-cg-success font-semibold">✓ Pagado</span>`
              : `<span class="text-[11px] text-cg-danger font-semibold">Pendiente ${fmt(pendiente)}</span>`}
            <div class="flex items-center gap-3">
              ${pagadoDeReparto(r.venta_id) > 0 ? `<button onclick="openPagosDeVenta(${r.venta_id}, ${window.__clienteDetalleId})" class="text-[11px] text-cg-primary font-semibold">Ver pagos</button>` : ""}
              <button onclick="openEditFechaReparto(${r.venta_id})" class="text-[11px] text-cg-primary font-semibold">Editar fecha</button>
              <button onclick="openEditReparto(${r.venta_id})" class="text-[11px] text-cg-primary font-semibold">Editar división</button>
              ${pendiente > 0 ? `<button onclick="openCobroReparto(${r.venta_id}, ${pendiente})" class="text-[11px] text-cg-primary font-semibold">Cobrar esta</button>` : ""}
              <button onclick="deleteRepartoCompartido(${r.venta_id})" class="text-[11px] text-cg-danger font-semibold">Eliminar</button>
            </div>
          </div>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>` : ""}
  `;

  const nSel = window.__clienteSeleccionadas.size + window.__clienteSeleccionadasRepartos.size;
  if (nSel > 0) {
    const totalSeleccion = totalCobroSeleccionado();
    content.innerHTML += `
      <div class="bg-cg-ink rounded-2xl px-4 py-3 flex items-center justify-between sticky bottom-0">
        <div>
          <p class="text-cg-onink/60 text-[11px]">${nSel} deuda(s) elegida(s)</p>
          <p class="text-cg-onink font-mono-num text-[15px] font-semibold">${fmt(totalSeleccion)}</p>
        </div>
        <button onclick="openCobroSeleccionadas()" class="bg-cg-success text-cg-onink text-[12px] font-semibold px-3.5 py-2.5 rounded-xl">Cobrar seleccionadas</button>
      </div>
    `;
  }
}

function openEditFechaReparto(ventaId) {
  const reparto = window.__clienteDetalleRepartos.find((r) => r.venta_id === ventaId);
  const fechaActual = reparto?.ventas?.created_at ? new Date(reparto.ventas.created_at).toISOString().slice(0, 10) : fechaLocalHoy();
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Editar fecha de esta cuenta compartida</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Fecha</label>
    <input id="editreparto-fecha" type="date" value="${fechaActual}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveEditFechaReparto(${ventaId})" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar</button>
  `);
}

async function saveEditFechaReparto(ventaId) {
  const fecha = document.getElementById("editreparto-fecha").value;
  const created_at = fechaOAhora(fecha);
  try {
    await CG.rpc.cambiarFechaVenta(ventaId, created_at, ADMIN);
  } catch (e) { alert(e.message); console.error(e); return; }
  closeModal();
  await loadAll();
  if (window.__clienteDetalleId) await abrirClienteDetalle(window.__clienteDetalleId);
}

function openEditCliente(id) {
  const c = clientes.find((cc) => cc.id === id);
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Editar cliente</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre</label>
    <input id="edit-cliente-nombre" type="text" value="${CG.escapeHtml(c.nombre)}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Teléfono / WhatsApp (opcional)</label>
    <input id="edit-cliente-telefono" type="tel" inputmode="numeric" value="${CG.escapeHtml(c.telefono || "")}" placeholder="Ej: 0981 123 456" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveEditCliente(${id})" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar cambios</button>
  `);
}

async function saveEditCliente(id) {
  const nombre = document.getElementById("edit-cliente-nombre").value.trim();
  if (!nombre) { alert("Poné un nombre."); return; }
  const telefono = document.getElementById("edit-cliente-telefono").value.trim() || null;
  const { error } = await sb.from("clientes").update({ nombre, telefono }).eq("id", id);
  if (error) { alert("No se pudo guardar."); console.error(error); return; }
  await registrarHistorial("clientes", id, "editar", `Cliente editado: ${nombre}`);
  closeModal();
  await loadAll();
  await abrirClienteDetalle(id);
}

async function deleteCliente(id) {
  const c = clientes.find((cc) => cc.id === id);
  if (!confirm(`¿Eliminar a ${c?.nombre}? Esto no se puede deshacer.`)) return;
  const { error } = await sb.from("clientes").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar: este cliente ya tiene ventas o cobros registrados en su historial. Si te equivocaste en el nombre, mejor usá 'Editar'.");
    console.error(error);
    return;
  }
  await registrarHistorial("clientes", id, "eliminar", `Cliente eliminado: ${c?.nombre || ""}`);
  await loadAll();
  activeTab = "clientes";
  render();
}

function openNewCliente() {
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Nuevo cliente</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre</label>
    <input id="cliente-nombre" type="text" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Teléfono / WhatsApp (opcional)</label>
    <input id="cliente-telefono" type="tel" inputmode="numeric" placeholder="Ej: 0981 123 456" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
    <button onclick="saveNewCliente()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3 mt-5">Guardar</button>
  `);
}

async function saveNewCliente() {
  const nombre = document.getElementById("cliente-nombre").value.trim();
  if (!nombre) { alert("Poné un nombre."); return; }
  const telefono = document.getElementById("cliente-telefono").value.trim() || null;
  const { data, error } = await sb.from("clientes").insert({ nombre, telefono }).select().single();
  if (error) { alert("No se pudo guardar."); console.error(error); return; }
  await registrarHistorial("clientes", data.id, "crear", `Cliente creado: ${nombre}`);
  closeModal();
  await loadAll();
  activeTab = "clientes";
  render();
}
