/* =====================================================================
 * CG DULCES · Historial de ventas: ver todas, editar y eliminar ventas y cuentas compartidas.
 * (archivo: js/app/historial-ventas.js)
 * ===================================================================== */

const PRODUCTOS_HELADO_SIN_STOCK_DIRECTO = ["Helado · Bola", "Helado · Pote 1/4"];

async function deleteVenta(ventaId) {
  if (!confirm("¿Eliminar esta venta? Se deshace todo lo que generó: cobros, movimientos de caja y stock. No se puede deshacer.")) return;
  await deleteVentaSinConfirmar(ventaId);
}

async function deleteVentaSinConfirmar(ventaId) {
  if (procesandoAccion) return;
  procesandoAccion = true;
  try {
    let huboHelado = false;
    try {
      huboHelado = await CG.rpc.anularVenta(ventaId, "carga duplicada u error", ADMIN);
    } catch (e) { alert(e.message); console.error(e); return; }

    if (huboHelado) {
      alert("Listo. Ojo: esta venta tenía Helados armados — el dinero y la deuda ya se revirtieron, pero el consumo de bolas/insumos de Helado no se deshace solo. Si hace falta, ajustalo a mano en Inventario.");
    }

    await loadAll();
    if (window.__clienteDetalleId) await abrirClienteDetalle(window.__clienteDetalleId);
  } finally {
    procesandoAccion = false;
  }
}

async function deleteRepartoCompartido(ventaId) {
  if (!confirm("Esta cuenta está repartida entre varios clientes. Si la eliminás, se borra para TODOS los que la comparten, no solo para este cliente. ¿Continuar?")) return;
  await deleteVentaSinConfirmar(ventaId);
}

async function openEditVenta(ventaId) {
  const { data: venta } = await sb
    .from("ventas")
    .select("id, cliente_id, es_fiado, medio_pago, monto_efectivo, monto_transferencia, created_at, concepto, total, venta_items(id, producto_id, cantidad, precio_unitario, costo_unitario, descuento, productos(nombre))")
    .eq("id", ventaId).single();
  if (!venta) return;
  if (venta.concepto) { openEditDeuda(venta); return; }

  const tieneHelado = (venta.venta_items || []).some((it) => PRODUCTOS_HELADO_SIN_STOCK_DIRECTO.includes(it.productos?.nombre));
  if (tieneHelado) {
    alert("Esta venta incluye un Helado armado y no se puede editar de forma segura. Si necesitás corregirla, eliminala y cargala de nuevo.");
    return;
  }

  window.__editVentaId = ventaId;
  window.__editVentaClienteId = venta.cliente_id;
  window.__editVentaFecha = new Date(venta.created_at).toISOString().slice(0, 10);
  window.__editVentaItems = (venta.venta_items || []).map((it) => ({ id: it.id, producto_id: it.producto_id, cantidad: it.cantidad, precio_unitario: it.precio_unitario, costo_unitario: it.costo_unitario, descuento: it.descuento || 0 }));
  window.__editVentaOriginalItems = JSON.parse(JSON.stringify(window.__editVentaItems));
  renderEditVentaModal();
}

function renderEditVentaModal() {
  const opcionesCliente = clientes.map((c) => `<option value="${c.id}" ${c.id===window.__editVentaClienteId?"selected":""}>${CG.escapeHtml(c.nombre)}</option>`).join("");
  const productosVender = ventasVisibles();
  const total = window.__editVentaItems.reduce((s, it) => s + it.cantidad * it.precio_unitario - it.descuento, 0);

  const filasHtml = window.__editVentaItems.map((it, i) => `
    <div class="bg-cg-surface rounded-xl p-3 mb-2">
      <select onchange="cambiarItemEditVenta(${i}, 'producto_id', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] mb-2 outline-none">
        ${productosVender.map((p) => `<option value="${p.id}" ${p.id===it.producto_id?"selected":""}>${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</option>`).join("")}
      </select>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[10px] text-cg-muted">Cantidad</label>
          <input type="number" value="${it.cantidad}" onchange="cambiarItemEditVenta(${i}, 'cantidad', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] outline-none" />
        </div>
        <div>
          <label class="text-[10px] text-cg-muted">Precio c/u</label>
          <input type="number" value="${it.precio_unitario}" onchange="cambiarItemEditVenta(${i}, 'precio_unitario', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] outline-none" />
        </div>
      </div>
      ${window.__editVentaItems.length > 1 ? `<button onclick="quitarItemEditVenta(${i})" class="text-[11px] text-cg-danger mt-2">Quitar</button>` : ""}
    </div>
  `).join("");

  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Editar venta</p>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Fecha</label>
    <input id="editventa-fecha" type="date" value="${window.__editVentaFecha}" onchange="window.__editVentaFecha = this.value" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Cliente</label>
    <select id="editventa-cliente" onchange="window.__editVentaClienteId = Number(this.value)" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none">${opcionesCliente}</select>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Productos</label>
    <div class="mt-2 mb-2">${filasHtml}</div>
    <button onclick="agregarItemEditVenta()" class="text-[12px] text-cg-primary font-semibold mb-4">+ Agregar otro producto</button>

    <div class="flex items-center justify-between mb-4">
      <span class="text-[12px] text-cg-muted">Total</span>
      <span class="font-mono-num text-[18px] font-semibold text-cg-ink">${fmt(total)}</span>
    </div>

    <button onclick="saveEditVenta()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar cambios</button>
  `);
}

function cambiarItemEditVenta(i, campo, valor) {
  window.__editVentaItems[i][campo] = Number(valor);
  renderEditVentaModal();
}

function agregarItemEditVenta() {
  const primero = ventasVisibles()[0];
  window.__editVentaItems.push({ producto_id: primero?.id, cantidad: 1, precio_unitario: primero?.precio_venta || 0, costo_unitario: primero?.costo_ultimo || 0, descuento: 0 });
  renderEditVentaModal();
}

function quitarItemEditVenta(i) {
  window.__editVentaItems.splice(i, 1);
  renderEditVentaModal();
}

async function saveEditVenta() {
  if (procesandoAccion) return;
  procesandoAccion = true;
  try {
  const ventaId = window.__editVentaId;
  const cliente_id = window.__editVentaClienteId;
  const created_at = fechaOAhora(window.__editVentaFecha);

  try {
    await CG.rpc.editarVenta({
      venta_id: ventaId,
      cliente_id: cliente_id || null,
      created_at,
      usuario: ADMIN,
      items: window.__editVentaItems.map((it) => ({
        id: it.id || null,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        descuento: it.descuento || 0,
        costo_unitario: it.costo_unitario || 0,
      })),
    });
  } catch (e) { alert(e.message); console.error(e); return; }
  closeModal();
  await loadAll();
  if (window.__clienteDetalleId) await abrirClienteDetalle(window.__clienteDetalleId);
  else if (activeTab === "todas-ventas") await abrirTodasVentas();
  } finally {
    procesandoAccion = false;
  }
}

window.__todasVentas = [];

let buscarTodasVentas = "";

async function abrirTodasVentas() {
  const { data } = await sb
    .from("ventas")
    .select("id, total, es_fiado, medio_pago, registrado_por, created_at, concepto, clientes(nombre), venta_items(cantidad, productos(nombre)), venta_repartos(id, cliente_id, monto, clientes(nombre))")
    .order("created_at", { ascending: false })
    .limit(500);
  window.__todasVentas = data || [];
  buscarTodasVentas = "";
  activeTab = "todas-ventas";
  render();
}

function cambiarBuscarTodasVentas(valor) {
  buscarTodasVentas = valor;
  render();
  refocusInput("buscar-todasventas-input");
}

function renderTodasVentas(content) {
  const termino = buscarTodasVentas.trim().toLowerCase();
  const filtradas = window.__todasVentas.filter((v) => {
    if (!termino) return true;
    const clienteNombre = v.clientes?.nombre?.toLowerCase() || "";
    const participantesTexto = (v.venta_repartos || []).map((r) => r.clientes?.nombre?.toLowerCase() || "").join(" ");
    const itemsTexto = (v.venta_items || []).map((it) => it.productos?.nombre?.toLowerCase() || "").join(" ") + " " + (v.concepto || "").toLowerCase();
    return clienteNombre.includes(termino) || participantesTexto.includes(termino) || itemsTexto.includes(termino);
  });

  content.innerHTML = `
    <button onclick="irA('dashboard')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver al Dashboard</button>
    ${sectionLabel(`Todas las ventas (${filtradas.length})`)}
    <div class="relative mb-4">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--cg-muted))" stroke-width="2" stroke-linecap="round" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="buscar-todasventas-input" type="text" placeholder="Buscar por cliente o producto..." value="${CG.escapeHtml(buscarTodasVentas)}" oninput="cambiarBuscarTodasVentas(this.value)" class="w-full bg-cg-card border border-cg-line/[0.06] rounded-xl pl-9 pr-3 py-2.5 text-[13px] outline-none" />
    </div>
    ${filtradas.length ? encabezadoPC(COLS_VENTAS, ["Fecha", "Cliente", "Productos", "Estado", ">Total", ">Acciones"]) : ""}
    <div class="space-y-2 cg-fila-lista">
      ${filtradas.length === 0 ? `<p class="text-[13px] text-cg-muted">No encontré ventas con ese criterio.</p>` :
        filtradas.map((v) => {
          const fechaHora = new Date(v.created_at).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Asuncion" });
          const itemsTexto = CG.escapeHtml(textoVenta(v));
          const esDividida = (v.venta_repartos || []).length > 0;
          const participantes = esDividida ? v.venta_repartos.map((r) => r.clientes?.nombre || "").join(", ") : "";
          const pagadoDeEsta = cobros.filter((c) => c.venta_id === v.id).reduce((s, c) => s + Number(c.monto), 0);
          const estadoTexto = !v.es_fiado ? v.medio_pago : (pagadoDeEsta < Number(v.total) ? "Fiado, pendiente" : "Fiado, cobrado");
          const accionesHtml = `${esDividida
            ? `<button onclick="openEditReparto(${v.id})" class="text-[11px] text-cg-primary font-semibold">Editar división</button>`
            : `<button onclick="openEditVenta(${v.id})" class="text-[11px] text-cg-primary font-semibold">Editar</button>`}
            <button onclick="deleteVentaDesdeTodas(${v.id})" class="text-[11px] text-cg-danger font-semibold">Eliminar</button>`;
          const filaVentaPC = celdasPC(COLS_VENTAS, [
            `<span class="text-[12px] text-cg-muted">${fechaHora}</span>`,
            `<span class="text-[13px] font-semibold text-cg-ink">${CG.escapeHtml(v.clientes?.nombre || "Mostrador")}</span>`,
            `<span class="text-[12px] text-cg-ink">${itemsTexto}${esDividida ? `<br><span class="text-cg-primary">👥 Dividida entre: ${CG.escapeHtml(participantes)}</span>` : ""}</span>`,
            `<span class="text-[11px] ${v.es_fiado && pagadoDeEsta < Number(v.total) ? "text-cg-danger font-semibold" : "text-cg-muted"}">${estadoTexto} · ${CG.escapeHtml(v.registrado_por || "")}</span>`,
            `<span class="font-mono-num text-[13px] font-semibold block text-right">${fmt(v.total)}</span>`,
            `<span class="flex items-center justify-end gap-3">${accionesHtml}</span>`,
          ]);
          return `
          <div class="bg-cg-card rounded-2xl p-4 lg:p-0 shadow-sm border border-cg-line/[0.04]">
            <div class="lg:hidden">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] text-cg-muted">${fechaHora}${v.clientes?.nombre ? " · " + CG.escapeHtml(v.clientes.nombre) : ""}</span>
              <span class="font-mono-num text-[13px] font-semibold">${fmt(v.total)}</span>
            </div>
            <p class="text-[13px] text-cg-ink">${itemsTexto}</p>
            ${esDividida ? `<p class="text-[11px] text-cg-primary mt-1">👥 Dividida entre: ${participantes}</p>` : ""}
            <div class="flex items-center justify-between mt-1.5">
              <span class="text-[11px] ${v.es_fiado && pagadoDeEsta < Number(v.total) ? 'text-cg-danger font-semibold' : 'text-cg-muted'}">${estadoTexto} · ${CG.escapeHtml(v.registrado_por || "")}</span>
              <div class="flex items-center gap-3">
                ${esDividida
                  ? `<button onclick="openEditReparto(${v.id})" class="text-[11px] text-cg-primary font-semibold">Editar división</button>`
                  : `<button onclick="openEditVenta(${v.id})" class="text-[11px] text-cg-primary font-semibold">Editar</button>`}
                <button onclick="deleteVentaDesdeTodas(${v.id})" class="text-[11px] text-cg-danger font-semibold">Eliminar</button>
              </div>
            </div>
            </div>
            ${filaVentaPC}
          </div>`;
        }).join("")}
    </div>
  `;
}

async function deleteVentaDesdeTodas(ventaId) {
  await deleteVenta(ventaId);
  await abrirTodasVentas();
}
