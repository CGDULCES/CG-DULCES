/* =====================================================================
 * CG DULCES · Inventario: productos, recetas, producción, baldes/paquetes y auditoría de producto.
 * (archivo: js/app/inventario.js)
 * ===================================================================== */

let inventarioVista = "productos"; // "productos" | "insumos"

let buscarInventario = "";

function cambiarBuscarInventario(valor) {
  buscarInventario = valor;
  render();
  refocusInput("buscar-inventario-input");
}

function renderInventario(content) {
  const base = inventarioVista === "insumos"
    ? productos.filter((p) => p.es_insumo)
    : productos.filter((p) => !p.es_insumo);
  const termino = buscarInventario.trim().toLowerCase();
  const lista = base.filter((p) => !termino || p.nombre.toLowerCase().includes(termino));
  const grupos = agruparPorCategoria(lista);

  let html = `
    <div class="flex gap-2 mb-3">
      <button onclick="cambiarVistaInventario('productos')" class="flex-1 rounded-xl py-2 text-[13px] font-semibold ${inventarioVista==='productos' ? 'bg-cg-primary text-cg-onink' : 'bg-cg-card text-cg-muted border border-cg-line/[0.06]'}">Productos</button>
      <button onclick="cambiarVistaInventario('insumos')" class="flex-1 rounded-xl py-2 text-[13px] font-semibold ${inventarioVista==='insumos' ? 'bg-cg-primary text-cg-onink' : 'bg-cg-card text-cg-muted border border-cg-line/[0.06]'}">Insumos</button>
    </div>
    <div class="relative mb-4">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--cg-muted))" stroke-width="2" stroke-linecap="round" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="buscar-inventario-input" type="text" placeholder="Buscar..." value="${CG.escapeHtml(buscarInventario)}" oninput="cambiarBuscarInventario(this.value)" class="w-full bg-cg-card border border-cg-line/[0.06] rounded-xl pl-9 pr-3 py-2.5 text-[13px] outline-none" />
    </div>
  `;

  if (lista.length === 0) html += `<p class="text-[13px] text-cg-muted">No encontré nada con ese nombre.</p>`;

  html += Object.entries(grupos).map(([cat, itemsCat]) => `
    <div class="mb-5">
      ${sectionLabel(CG.escapeHtml(cat))}
      <div class="space-y-3">
        ${itemsCat.map((p) => {
          const color = categoryColors[cat] || cgHex("primary");
          const low = p.stock <= p.stock_minimo;
          const pct = p.stock_minimo > 0 ? Math.min(100, (p.stock / (p.stock_minimo * 3)) * 100) : 100;
          const margen = !p.es_insumo && p.precio_venta > 0 ? Math.round(((p.precio_venta - p.costo_ultimo) / p.precio_venta) * 100) : null;
          return `
          <button onclick="openEditProduct(${p.id})" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-[13px] font-semibold text-cg-ink">${p.favorito ? "⭐ " : ""}${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</p>
                <p class="text-[11px] text-cg-muted">${CG.escapeHtml(cat)} · costo ${fmt(p.costo_ultimo)}${p.es_insumo ? "" : " · venta " + fmt(p.precio_venta)}${margen !== null ? ` · margen ${margen}%` : ""}</p>
              </div>
              <div class="text-right">
                <p class="font-mono-num text-[14px] font-semibold" style="color:${low?'rgb(var(--cg-danger))':'rgb(var(--cg-ink))'}">${p.stock}</p>
                ${low ? `<p class="text-[10px] text-cg-danger font-medium">Reponer pronto</p>` : ""}
              </div>
            </div>
            <div class="relative h-3 w-full rounded-full bg-cg-line/[0.06] overflow-hidden">
              <div class="stock-fill h-full rounded-full" style="width:${pct}%; background:${low ? 'rgb(var(--cg-danger))' : color}"></div>
            </div>
          </button>`;
        }).join("")}
      </div>
    </div>
  `).join("");

  content.innerHTML = html;
}

function cambiarVistaInventario(vista) {
  inventarioVista = vista;
  render();
}

async function auditarProducto(productoId) {
  closeModal();
  const p = productos.find((pr) => pr.id === productoId);

  // Se consulta todo por separado (sin relaciones anidadas), para evitar que una relación
  // rota o bloqueada haga desaparecer datos reales en silencio.
  const [{ data: itemsCompra }, { data: itemsVenta }, { data: perdidasDe }] = await Promise.all([
    sb.from("compra_items").select("cantidad, costo_unitario, compra_id").eq("producto_id", productoId),
    sb.from("venta_items").select("cantidad, venta_id").eq("producto_id", productoId),
    sb.from("perdidas").select("cantidad, motivo, created_at").eq("producto_id", productoId),
  ]);

  const compraIds = [...new Set((itemsCompra || []).map((c) => c.compra_id))];
  const ventaIds = [...new Set((itemsVenta || []).map((v) => v.venta_id))];

  const [{ data: comprasDatos }, { data: ventasDatos }] = await Promise.all([
    compraIds.length ? sb.from("compras").select("id, created_at, proveedor_id").in("id", compraIds) : Promise.resolve({ data: [] }),
    ventaIds.length ? sb.from("ventas").select("id, created_at, es_fiado, cliente_id").in("id", ventaIds) : Promise.resolve({ data: [] }),
  ]);

  const factor = factorConversion(p);
  const movimientos = [];
  (itemsCompra || []).forEach((c) => {
    const compra = (comprasDatos || []).find((cc) => cc.id === c.compra_id);
    if (!compra) return; // la compra fue eliminada; ya no cuenta
    const proveedor = proveedores.find((pr) => pr.id === compra.proveedor_id);
    movimientos.push({ tipo: "compra", fecha: compra.created_at, cantidad: c.cantidad * factor, detalle: proveedor?.nombre || "sin proveedor" });
  });
  (itemsVenta || []).forEach((v) => {
    const venta = (ventasDatos || []).find((vv) => vv.id === v.venta_id);
    if (!venta) return; // la venta fue eliminada; ya no cuenta
    const cliente = clientes.find((c) => c.id === venta.cliente_id);
    movimientos.push({ tipo: "venta", fecha: venta.created_at, cantidad: -v.cantidad, detalle: cliente?.nombre ? `a ${cliente.nombre}` : (venta.es_fiado ? "fiado" : "") });
  });
  (perdidasDe || []).forEach((pe) => {
    movimientos.push({ tipo: "pérdida", fecha: pe.created_at, cantidad: -pe.cantidad, detalle: pe.motivo || "" });
  });

  // Se calcula el acumulado en orden cronológico (necesario para que la cuenta sea correcta)...
  movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  let corrida = 0;
  movimientos.forEach((m) => { corrida += m.cantidad; m.acumulado = corrida; });

  const totalComprado = movimientos.filter((m) => m.tipo === "compra").reduce((s, m) => s + m.cantidad, 0);
  const totalVendido = -movimientos.filter((m) => m.tipo === "venta").reduce((s, m) => s + m.cantidad, 0);
  const totalPerdido = -movimientos.filter((m) => m.tipo === "pérdida").reduce((s, m) => s + m.cantidad, 0);
  const stockEsperado = totalComprado - totalVendido - totalPerdido;
  const diferencia = Number(p.stock) - stockEsperado;

  // ...y ahora se muestra con los movimientos más nuevos arriba
  const filasHtml = [...movimientos].reverse().map((m) => {
    const color = m.tipo === "compra" ? "rgb(var(--cg-success))" : m.tipo === "venta" ? "rgb(var(--cg-danger))" : "rgb(var(--cg-muted))";
    const TIPO_LABEL = { compra: "Compra", venta: "Venta", "pérdida": "Pérdida" };
    return `
      <div class="bg-cg-card rounded-xl p-3 shadow-sm border border-cg-line/[0.04] mb-2">
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-semibold text-cg-ink">${TIPO_LABEL[m.tipo]}${m.detalle ? " · " + CG.escapeHtml(m.detalle) : ""}</span>
          <span class="font-mono-num text-[12px] font-semibold" style="color:${color}">${m.cantidad>0?"+":""}${m.cantidad}</span>
        </div>
        <p class="text-[10px] text-cg-muted">${new Date(m.fecha).toLocaleString("es-PY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Asuncion"})}</p>
        <p class="text-[9px] text-cg-muted mt-0.5">Acumulado esperado en ese momento: ${m.acumulado}</p>
      </div>`;
  }).join("");

  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">Auditoría: ${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</p>
    <p class="text-[11px] text-cg-muted mb-4">Recalculado desde cero: compras − ventas − pérdidas de este producto</p>

    <div class="grid grid-cols-2 gap-2 mb-3">
      <div class="bg-cg-surface rounded-xl p-3">
        <p class="text-[10px] text-cg-muted">Comprado (total)</p>
        <p class="font-mono-num text-[15px] font-semibold text-cg-success">+${totalComprado}</p>
      </div>
      <div class="bg-cg-surface rounded-xl p-3">
        <p class="text-[10px] text-cg-muted">Vendido (total)</p>
        <p class="font-mono-num text-[15px] font-semibold text-cg-danger">−${totalVendido}</p>
      </div>
      <div class="bg-cg-surface rounded-xl p-3">
        <p class="text-[10px] text-cg-muted">Perdido (total)</p>
        <p class="font-mono-num text-[15px] font-semibold text-cg-muted">−${totalPerdido}</p>
      </div>
      <div class="bg-cg-surface rounded-xl p-3">
        <p class="text-[10px] text-cg-muted">Stock esperado</p>
        <p class="font-mono-num text-[15px] font-semibold text-cg-ink">${stockEsperado}</p>
      </div>
    </div>

    <div class="rounded-xl p-3 mb-4 ${diferencia === 0 ? 'bg-cg-success/10' : 'bg-cg-danger/10'}">
      <p class="text-[12px] font-semibold ${diferencia === 0 ? 'text-cg-success' : 'text-cg-danger'}">
        ${diferencia === 0
          ? `✓ Coincide: el stock actual (${p.stock}) es exactamente lo que se esperaba.`
          : `⚠ Hay una diferencia de ${diferencia > 0 ? "+" : ""}${diferencia}. Stock actual: ${p.stock}, esperado: ${stockEsperado}.`}
      </p>
      ${diferencia !== 0 ? `<p class="text-[11px] text-cg-muted mt-1">Si en algún momento editaste el stock a mano desde esta ficha (para corregir un conteo físico), eso también genera diferencia acá — es normal y no es un error. Si nunca lo tocaste a mano, esta diferencia sí merece revisarse.</p>` : ""}
    </div>

    ${sectionLabel(`Movimientos (${movimientos.length}), del más nuevo al más viejo`)}
    <div>${filasHtml || `<p class="text-[13px] text-cg-muted">Sin movimientos registrados todavía.</p>`}</div>
  `);
}

async function openEditProduct(id) {
  const p = productos.find((pr) => pr.id === id);
  const opcionesCategoria = categorias.map((c) => `<option value="${c.id}" ${c.id===p.categoria_id?"selected":""}>${CG.escapeHtml(c.nombre)}</option>`).join("");
  const esBaldeHelado = p.producto_base === "Balde Helado";
  const esCoberturaHelado = p.producto_base === "Cobertura";
  const CONSUMIBLES_ILIMITADOS = ["Servilleta", "Cucharita", "Bolsita de Hielo", "Pajita"];
  const esConsumibleIlimitado = esBaldeHelado || esCoberturaHelado || CONSUMIBLES_ILIMITADOS.includes(p.nombre);
  const etiquetaUnidad = esBaldeHelado ? "bolas" : "usos";
  const etiquetaPaquete = esBaldeHelado ? "balde" : "paquete";
  const tieneReceta = recetas.some((r) => r.producto_terminado_id === p.id);
  let rendimientosHtml = "";
  let hayRendimientoAnterior = false;
  if (esConsumibleIlimitado) {
    const { data: rendimientos } = await sb.from("helado_rendimientos").select("*").eq("producto_id", id).order("created_at", { ascending: false }).limit(5);
    hayRendimientoAnterior = (rendimientos || []).length > 0;
    rendimientosHtml = (rendimientos || []).map((r) => `<p class="text-[11px] text-cg-muted">${new Date(r.created_at).toLocaleDateString("es-PY")} · rindió ${r.bolas} ${etiquetaUnidad}</p>`).join("") || `<p class="text-[11px] text-cg-muted">Todavía no hay ningún ${etiquetaPaquete} terminado.</p>`;
  }
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Editar producto</p>
    <div class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre</label>
        <input id="edit-nombre" type="text" value="${CG.escapeHtml(p.nombre)}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
      </div>
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Categoría</label>
        <select id="edit-categoria" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none">${opcionesCategoria}</select>
      </div>
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Presentación (opcional)</label>
        <input id="edit-presentacion" type="text" value="${CG.escapeHtml(p.presentacion || "")}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
      </div>
      <label class="flex items-center gap-2">
        <input type="checkbox" id="edit-es-insumo" ${p.es_insumo ? "checked" : ""} class="w-4 h-4" />
        <span class="text-[13px] text-cg-ink">Es un insumo (no se vende directo)</span>
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" id="edit-favorito" ${p.favorito ? "checked" : ""} class="w-4 h-4" />
        <span class="text-[13px] text-cg-ink">⭐ Favorito (venta rápida)</span>
      </label>
      <label class="flex items-center gap-2">
        <input type="checkbox" id="edit-usa-pajita" ${p.usa_pajita ? "checked" : ""} class="w-4 h-4" />
        <span class="text-[13px] text-cg-ink">🥤 Ofrecer pajita al vender esto</span>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">${esConsumibleIlimitado ? `${esBaldeHelado ? "Baldes que tenés" : "Paquetes que tenés"} (con el que usás)` : "Stock actual"}</label>
          <input id="edit-stock" type="number" step="any" value="${p.stock}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Stock mínimo</label>
          <input id="edit-minimo" type="number" value="${p.stock_minimo}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Precio de venta</label>
          <input id="edit-precio" type="number" value="${p.precio_venta}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Costo (último)${tieneReceta ? " · automático por receta" : ""}</label>
          <input id="edit-costo" type="number" value="${p.costo_ultimo}" ${tieneReceta ? "disabled" : ""} class="w-full ${tieneReceta ? "bg-cg-disabled text-cg-muted" : "bg-cg-surface"} rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
          ${tieneReceta ? `<p class="text-[11px] text-cg-muted mt-1">Se calcula solo sumando el costo de los insumos de la receta.</p>` : ""}
        </div>
      </div>

    </div>
    <button onclick="saveEditProduct(${p.id})" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3 mt-5">Guardar cambios</button>
    ${esConsumibleIlimitado ? `
    <div class="bg-cg-surface rounded-xl p-3 mt-3">
      <p class="text-[12px] font-semibold text-cg-ink mb-1">${esBaldeHelado ? "Balde en uso" : "Paquete en uso"}</p>
      <p class="text-[13px] text-cg-ink mb-1">${etiquetaUnidad === "bolas" ? "Bolas vendidas de este balde" : "Usos de este paquete"}: <span class="font-mono-num font-semibold">${p.bolas_vendidas_actual || 0}</span></p>
      <p class="text-[11px] text-cg-muted mb-3">Tenés ${p.stock} ${etiquetaPaquete}${Number(p.stock) === 1 ? "" : "s"}. El stock baja recién cuando lo marcás como terminado.</p>
      ${Number(p.bolas_vendidas_actual || 0) > 0
        ? `<button onclick="marcarConsumibleTerminado(${p.id})" class="w-full bg-cg-primary text-cg-onink text-[12px] font-semibold py-2.5 rounded-lg mb-3">Marcar ${etiquetaPaquete} como terminado</button>`
        : `<button onclick="agregarBalde(${p.id})" class="w-full bg-cg-success text-cg-onink text-[12px] font-semibold py-2.5 rounded-lg mb-2">+ Agregar ${etiquetaPaquete}</button>
           ${hayRendimientoAnterior ? `<button onclick="continuarBalde(${p.id})" class="w-full bg-cg-card border border-cg-line/10 text-cg-ink text-[12px] font-semibold py-2.5 rounded-lg mb-3">↩ Continuar el ${etiquetaPaquete} anterior (lo marqué terminado por error)</button>` : `<div class="mb-3"></div>`}`}
      <p class="text-[11px] font-semibold text-cg-muted uppercase tracking-wide mb-1">Últimos rendimientos</p>
      ${rendimientosHtml}
    </div>` : ""}
    ${p.nombre === "Hielo · Bolsa" ? `
    <div class="bg-cg-surface rounded-xl p-3 mt-3">
      <p class="text-[12px] font-semibold text-cg-ink mb-2">Cargar bolsitas con agua</p>
      <p class="text-[11px] text-cg-muted mb-2">Convierte bolsitas vacías en hielo listo para vender.</p>
      <div class="flex items-center gap-2">
        <input id="cargar-hielo-cantidad" type="number" value="1" class="flex-1 bg-cg-card rounded-lg px-3 py-2 text-[14px] outline-none" />
        <button onclick="cargarHielo()" class="bg-cg-primary text-cg-onink text-[12px] font-semibold px-3 py-2 rounded-lg">Cargar</button>
      </div>
    </div>` : ""}
    ${!p.es_insumo && !esConsumibleIlimitado && p.nombre !== "Hielo · Bolsa" && !["Helado · Bola", "Helado · Pote 1/4"].includes(p.nombre) ? `
    <div class="bg-cg-surface rounded-xl p-3 mt-3">
      <p class="text-[12px] font-semibold text-cg-ink mb-2">Receta (por cada 1 unidad producida)</p>
      <div id="receta-lista-${p.id}">${renderRecetaLista(p.id)}</div>
      <button onclick="agregarFilaReceta(${p.id})" class="text-[11px] text-cg-primary font-semibold mt-1 mb-3">+ Agregar insumo a la receta</button>
      ${tieneReceta ? `<p class="text-[12px] text-cg-ink mb-3">Costo por receta: <span class="font-mono-num font-semibold">${fmt(p.costo_ultimo)}</span>${p.precio_venta > 0 ? ` · Margen: <span class="font-mono-num font-semibold">${Math.round(((p.precio_venta - p.costo_ultimo) / p.precio_venta) * 100)}%</span>` : ""}</p>` : ""}

      <p class="text-[12px] font-semibold text-cg-ink mb-2 pt-2 border-t border-cg-line/[0.06]">Registrar producción</p>
      <p class="text-[11px] text-cg-muted mb-2">Descuenta los insumos de la receta y suma al stock del producto.</p>
      <div class="flex items-center gap-2">
        <input id="fabricar-cantidad" type="number" value="1" class="flex-1 bg-cg-card rounded-lg px-3 py-2 text-[14px] outline-none" />
        <button onclick="registrarProduccion(${p.id})" class="bg-cg-primary text-cg-onink text-[12px] font-semibold px-3 py-2 rounded-lg">Producir</button>
      </div>
    </div>` : ""}
    <button onclick="auditarProducto(${p.id})" class="w-full text-cg-primary text-[13px] font-semibold py-3 mt-1 border-t border-cg-line/[0.06]">🔍 Ver todos los movimientos de este producto</button>
    <button onclick="deleteProduct(${p.id})" class="w-full text-cg-danger text-[13px] font-semibold py-3 mt-1">Eliminar producto</button>
  `);
}

function renderRecetaLista(productoTerminadoId) {
  const filas = recetas.filter((r) => r.producto_terminado_id === productoTerminadoId);
  const insumosDisponibles = productos.filter((p) => p.es_insumo);
  if (filas.length === 0) return `<p class="text-[11px] text-cg-muted mb-2">Todavía no cargaste ningún insumo en la receta.</p>`;
  return filas.map((r) => {
    const insumo = productos.find((p) => p.id === r.insumo_id);
    return `
    <div class="flex items-center justify-between bg-cg-card rounded-lg px-2.5 py-2 mb-1.5">
      <span class="text-[12px] text-cg-ink">${CG.escapeHtml(insumo?.nombre || "?")}</span>
      <div class="flex items-center gap-2">
        <span class="font-mono-num text-[12px] text-cg-muted">${r.cantidad}</span>
        <button onclick="quitarFilaReceta(${r.id}, ${productoTerminadoId})" class="text-cg-danger text-[13px] leading-none">×</button>
      </div>
    </div>`;
  }).join("");
}

function agregarFilaReceta(productoTerminadoId) {
  const insumosDisponibles = productos.filter((p) => p.es_insumo);
  if (insumosDisponibles.length === 0) { alert("Primero cargá al menos un insumo en Inventario (marcado como 'Es un insumo')."); return; }
  const opciones = insumosDisponibles.map((p) => `<option value="${p.id}">${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</option>`).join("");
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Agregar insumo a la receta</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Insumo</label>
    <select id="receta-insumo" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none">${opciones}</select>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Cantidad que lleva por cada 1 unidad producida</label>
    <input id="receta-cantidad" type="number" step="any" value="1" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveFilaReceta(${productoTerminadoId})" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Agregar a la receta</button>
  `);
}

async function saveFilaReceta(productoTerminadoId) {
  const insumo_id = Number(document.getElementById("receta-insumo").value);
  const cantidad = Number(document.getElementById("receta-cantidad").value) || 0;
  if (cantidad <= 0) { alert("Poné una cantidad."); return; }
  const { error } = await sb.from("recetas").insert({ producto_terminado_id: productoTerminadoId, insumo_id, cantidad });
  if (error) { alert("No se pudo agregar."); console.error(error); return; }
  await loadAll();
  openEditProduct(productoTerminadoId);
}

async function quitarFilaReceta(recetaId, productoTerminadoId) {
  await sb.from("recetas").delete().eq("id", recetaId);
  await loadAll();
  openEditProduct(productoTerminadoId);
}

async function registrarProduccion(id) {
  if (procesandoAccion) return;
  const cantidad = Number(document.getElementById("fabricar-cantidad").value) || 0;
  if (cantidad <= 0) return;
  const p = productos.find((pr) => pr.id === id);
  const recetaDeEste = recetas.filter((r) => r.producto_terminado_id === id);

  if (recetaDeEste.length === 0) {
    if (!confirm("Este producto no tiene ninguna receta cargada, así que no se va a descontar ningún insumo — solo se va a sumar al stock. ¿Continuar igual?")) return;
  } else {
    // Validar que haya suficiente de cada insumo antes de tocar nada
    for (const r of recetaDeEste) {
      const insumo = productos.find((pr) => pr.id === r.insumo_id);
      const necesario = r.cantidad * cantidad;
      if (insumo && necesario > insumo.stock) {
        alert(`No hay suficiente "${insumo.nombre}" para producir ${cantidad}. Necesitás ${necesario}, hay ${insumo.stock}.`);
        return;
      }
    }
  }

  procesandoAccion = true;
  try {
    try {
      await CG.rpc.registrarProduccion(id, cantidad, ADMIN);
    } catch (e) { alert(e.message); console.error(e); return; }
    closeModal();
    await loadAll();
  } finally {
    procesandoAccion = false;
  }
}

async function accionBalde(id, fn, mensajeOk) {
  if (procesandoAccion) return;
  procesandoAccion = true;
  try {
    try { await fn(); } catch (e) { alert(e.message); console.error(e); return; }
    await loadAll();
    await openEditProduct(id);
    if (mensajeOk) console.info(mensajeOk);
  } finally {
    procesandoAccion = false;
  }
}

async function marcarConsumibleTerminado(id) {
  const p = productos.find((pr) => pr.id === id);
  const usados = Number(p.bolas_vendidas_actual || 0);
  if (usados <= 0) { alert("Este producto todavía no registra usos."); return; }
  const esBalde = p.producto_base === "Balde Helado";
  if (!confirm(`¿Marcar como terminado? Rindió ${usados} ${esBalde ? "bolas" : "usos"} y el stock baja en 1.`)) return;
  await accionBalde(id, () => CG.rpc.terminarConsumible(id, ADMIN));
}

async function agregarBalde(id) {
  await accionBalde(id, () => CG.rpc.agregarConsumible(id, ADMIN));
}

async function continuarBalde(id) {
  if (!confirm("¿Volver a dejar en uso el anterior? Recupera sus bolas ya contadas y suma 1 al stock.")) return;
  await accionBalde(id, () => CG.rpc.continuarConsumible(id, ADMIN));
}

async function cargarHielo() {
  const cantidad = Number(document.getElementById("cargar-hielo-cantidad").value) || 0;
  if (cantidad <= 0) return;
  const bolsita = productos.find((p) => p.nombre === "Bolsita de Hielo");
  const hielo = productos.find((p) => p.nombre === "Hielo · Bolsa");
  if (!bolsita || !hielo) { alert("Falta cargar 'Bolsita de Hielo' o 'Hielo · Bolsa' en productos."); return; }

  const check = await validarConsumoIlimitado(bolsita, cantidad);
  if (!check.ok) { alert(check.mensaje); return; }

  await aplicarConsumoIlimitado(bolsita, cantidad);
  await sb.from("productos").update({ stock: hielo.stock + cantidad }).eq("id", hielo.id);
  await registrarHistorial("productos", hielo.id, "editar", `Se cargaron ${cantidad} bolsitas de hielo con agua`);
  closeModal();
  await loadAll();
}

async function saveEditProduct(id) {
  const nombre = document.getElementById("edit-nombre").value.trim();
  const categoria_id = Number(document.getElementById("edit-categoria").value);
  const presentacion = document.getElementById("edit-presentacion").value.trim() || null;
  const es_insumo = document.getElementById("edit-es-insumo").checked;
  const favorito = document.getElementById("edit-favorito").checked;
  const usa_pajita = document.getElementById("edit-usa-pajita").checked;
  const stock = Number(document.getElementById("edit-stock").value);
  if (stock < 0) { alert("El stock no puede quedar en negativo."); return; }
  const stock_minimo = Number(document.getElementById("edit-minimo").value);
  const precio_venta = Number(document.getElementById("edit-precio").value);
  const costo_ultimo = Number(document.getElementById("edit-costo").value);
  const anterior = productos.find((p) => p.id === id);
  const { error } = await sb.from("productos").update({ nombre, categoria_id, presentacion, es_insumo, favorito, usa_pajita, stock, stock_minimo, precio_venta, costo_ultimo }).eq("id", id);
  if (error) { alert("No se pudo guardar."); console.error(error); return; }
  const cambioStock = anterior && anterior.stock !== stock ? ` (stock ${anterior.stock} → ${stock})` : "";
  await registrarHistorial("productos", id, "editar", `Editado: ${nombre}${cambioStock}`);
  closeModal();
  await loadAll();
}

async function deleteProduct(id) {
  const p = productos.find((pr) => pr.id === id);
  if (p && (p.nombre === "Helado · Bola" || p.nombre === "Helado · Pote 1/4")) {
    alert("Este producto es necesario para que funcione la venta de Helados y no se puede eliminar. Si querés dejar de venderlo, poné el precio en 0 en vez de borrarlo.");
    return;
  }
  if (!confirm("¿Eliminar este producto? Ya no va a aparecer en la app, pero se conserva en el historial de ventas pasadas.")) return;
  const { error } = await sb.from("productos").update({ activo: false }).eq("id", id);
  if (error) { alert("No se pudo eliminar."); console.error(error); return; }
  await registrarHistorial("productos", id, "eliminar", `Producto eliminado: ${p?.nombre || ""}`);
  closeModal();
  await loadAll();
}

function openNewProduct() {
  const opciones = categorias.map((c) => `<option value="${c.id}">${CG.escapeHtml(c.nombre)}</option>`).join("");
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Nuevo producto</p>
    <div class="space-y-3">
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre</label>
        <input id="new-nombre" type="text" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
      </div>
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Categoría</label>
        <select id="new-categoria" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none">${opciones}</select>
      </div>
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Presentación (opcional)</label>
        <input id="new-presentacion" type="text" placeholder="Ej: 1.5 litros" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
      </div>
      <label class="flex items-center gap-2">
        <input type="checkbox" id="new-es-insumo" class="w-4 h-4" />
        <span class="text-[13px] text-cg-ink">Es un insumo (no se vende directo)</span>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Precio venta</label>
          <input id="new-precio" type="number" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Costo</label>
          <input id="new-costo" type="number" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Stock inicial</label>
          <input id="new-stock" type="number" value="0" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
        <div>
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Stock mínimo</label>
          <input id="new-minimo" type="number" value="5" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
      </div>
    </div>
    <button onclick="saveNewProduct()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3 mt-5">Crear producto</button>
  `);
}

async function saveNewProduct() {
  const nombre = document.getElementById("new-nombre").value.trim();
  if (!nombre) { alert("Poné un nombre."); return; }
  const categoria_id = Number(document.getElementById("new-categoria").value);
  const presentacion = document.getElementById("new-presentacion").value.trim() || null;
  const precio_venta = Number(document.getElementById("new-precio").value) || 0;
  const costo_ultimo = Number(document.getElementById("new-costo").value) || 0;
  const stock = Number(document.getElementById("new-stock").value) || 0;
  const stock_minimo = Number(document.getElementById("new-minimo").value) || 0;
  const es_insumo = document.getElementById("new-es-insumo").checked;

  const { data, error } = await sb.from("productos").insert({ nombre, categoria_id, presentacion, es_insumo, precio_venta, costo_ultimo, stock, stock_minimo }).select().single();
  if (error) { alert("No se pudo crear el producto."); console.error(error); return; }
  await registrarHistorial("productos", data.id, "crear", `Producto creado: ${nombre}`);
  closeModal();
  await loadAll();
}
