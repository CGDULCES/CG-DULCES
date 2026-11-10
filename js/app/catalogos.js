/* =====================================================================
 * CG DULCES · Promociones, categorías y pérdidas.
 * (archivo: js/app/catalogos.js)
 * ===================================================================== */

function renderPromociones(content) {
  content.innerHTML = `
    <button onclick="irA('masopciones')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver</button>
    ${sectionLabel("Promociones")}
    <div class="space-y-2 mb-4">
      ${promociones.length === 0 ? `<p class="text-[13px] text-cg-muted">Todavía no hay promociones cargadas.</p>` :
        promociones.map((p) => {
          const destino = p.categoria_id ? categorias.find((c) => c.id === p.categoria_id)?.nombre + " (cualquier producto de la categoría)" : productos.find((pr) => pr.id === p.producto_id)?.nombre || "";
          return `
          <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[13px] font-semibold text-cg-ink">${CG.escapeHtml(p.nombre)}</span>
              <button onclick="deletePromocion(${p.id})" class="text-[11px] text-cg-danger font-semibold">Eliminar</button>
            </div>
            <p class="text-[12px] text-cg-muted">${CG.escapeHtml(destino)}</p>
            <p class="text-[12px] text-cg-ink mt-1">${p.cantidad_requerida}x por ${fmt(p.precio_promocional)}</p>
          </div>`;
        }).join("")}
    </div>
    <button onclick="openNewPromocion()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">+ Nueva promoción</button>
  `;
}

function openNewPromocion() {
  const opcionesCategoria = categorias.map((c) => `<option value="${c.id}">${CG.escapeHtml(c.nombre)}</option>`).join("");
  const opcionesProducto = ventasVisibles().map((p) => `<option value="${p.id}">${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</option>`).join("");
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Nueva promoción</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre</label>
    <input id="promo-nombre" type="text" placeholder="Ej: 2x1 Alfajores" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">¿A qué aplica?</label>
    <select id="promo-tipo" onchange="cambiarTipoPromo(this.value)" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none">
      <option value="categoria">Una categoría entera (combinable entre sabores)</option>
      <option value="producto">Un solo producto</option>
    </select>
    <div id="promo-destino-wrap">
      <select id="promo-categoria" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mb-4 outline-none">${opcionesCategoria}</select>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-5">
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Cantidad</label>
        <input id="promo-cantidad" type="number" value="2" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
      </div>
      <div>
        <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Precio promo</label>
        <input id="promo-precio" type="number" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
      </div>
    </div>
    <button onclick="saveNewPromocion()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Crear promoción</button>
  `);
  window.__promoTipo = "categoria";
}

function cambiarTipoPromo(tipo) {
  window.__promoTipo = tipo;
  const opcionesProducto = ventasVisibles().map((p) => `<option value="${p.id}">${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</option>`).join("");
  const opcionesCategoria = categorias.map((c) => `<option value="${c.id}">${CG.escapeHtml(c.nombre)}</option>`).join("");
  document.getElementById("promo-destino-wrap").innerHTML = tipo === "categoria"
    ? `<select id="promo-categoria" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mb-4 outline-none">${opcionesCategoria}</select>`
    : `<select id="promo-producto" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mb-4 outline-none">${opcionesProducto}</select>`;
}

async function saveNewPromocion() {
  const nombre = document.getElementById("promo-nombre").value.trim();
  if (!nombre) { alert("Poné un nombre."); return; }
  const cantidad_requerida = Number(document.getElementById("promo-cantidad").value) || 2;
  const precio_promocional = Number(document.getElementById("promo-precio").value) || 0;
  const categoria_id = window.__promoTipo === "categoria" ? Number(document.getElementById("promo-categoria").value) : null;
  const producto_id = window.__promoTipo === "producto" ? Number(document.getElementById("promo-producto").value) : null;

  const { error } = await sb.from("promociones").insert({ nombre, categoria_id, producto_id, cantidad_requerida, precio_promocional });
  if (error) { alert("No se pudo crear la promoción."); console.error(error); return; }
  await registrarHistorial("promociones", null, "crear", `Promoción creada: ${nombre}`);
  closeModal();
  await loadAll();
  activeTab = "promociones";
  render();
}

async function deletePromocion(id) {
  if (!confirm("¿Eliminar esta promoción?")) return;
  await sb.from("promociones").delete().eq("id", id);
  await registrarHistorial("promociones", id, "eliminar", `Promoción eliminada`);
  await loadAll();
  activeTab = "promociones";
  render();
}

window.__perdidas = [];

window.__perdidaItems = [];

async function irAPerdidas() {
  const { data } = await sb
    .from("perdidas")
    .select("id, cantidad, motivo, costo_unitario, registrado_por, created_at, productos(nombre, presentacion)")
    .order("created_at", { ascending: false })
    .limit(200);
  window.__perdidas = data || [];
  activeTab = "perdidas";
  render();
}

function renderPerdidas(content) {
  const totalPerdido = window.__perdidas.reduce((s, p) => s + Number(p.cantidad) * Number(p.costo_unitario || 0), 0);
  content.innerHTML = `
    <button onclick="irA('masopciones')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver</button>
    ${sectionLabel("Pérdidas")}
    <div class="bg-cg-danger/10 border border-cg-danger/25 rounded-xl p-4 mb-4">
      <p class="text-[11px] text-cg-muted">Costo total perdido (histórico)</p>
      <p class="font-mono-num text-[18px] font-semibold text-cg-danger">${fmt(totalPerdido)}</p>
    </div>
    <div class="space-y-2 mb-4">
      ${window.__perdidas.length === 0 ? `<p class="text-[13px] text-cg-muted">Todavía no registraste ninguna pérdida.</p>` :
        window.__perdidas.map((p) => `
        <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[13px] font-semibold text-cg-ink">${p.cantidad}× ${CG.escapeHtml(p.productos?.nombre || "")}${p.productos?.presentacion ? " · " + CG.escapeHtml(p.productos.presentacion) : ""}</span>
            <span class="font-mono-num text-[13px] font-semibold text-cg-danger">−${fmt(p.cantidad * (p.costo_unitario||0))}</span>
          </div>
          <p class="text-[11px] text-cg-muted">${new Date(p.created_at).toLocaleDateString("es-PY")}${p.motivo ? " · " + CG.escapeHtml(p.motivo) : ""} · ${CG.escapeHtml(p.registrado_por || "")}</p>
        </div>`).join("")}
    </div>
    <button onclick="openNuevaPerdida()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">+ Registrar pérdida</button>
  `;
}

function openNuevaPerdida() {
  const primero = productos.find((p) => !p.es_insumo) || productos[0];
  window.__perdidaItems = [{ producto_id: primero?.id, cantidad: 1 }];
  window.__perdidaMotivo = "";
  renderNuevaPerdidaModal();
}

function renderNuevaPerdidaModal() {
  const filasHtml = window.__perdidaItems.map((it, i) => `
    <div class="bg-cg-surface rounded-xl p-3 mb-2">
      <select onchange="cambiarItemPerdida(${i}, 'producto_id', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] mb-2 outline-none">
        ${productos.map((p) => `<option value="${p.id}" ${p.id===it.producto_id?"selected":""}>${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}${p.es_insumo ? " (insumo)" : ""}</option>`).join("")}
      </select>
      <label class="text-[10px] text-cg-muted">Cantidad</label>
      <input type="number" value="${it.cantidad}" onchange="cambiarItemPerdida(${i}, 'cantidad', this.value)" class="w-full bg-cg-card rounded-lg px-2 py-2 text-[13px] outline-none" />
      ${window.__perdidaItems.length > 1 ? `<button onclick="quitarItemPerdida(${i})" class="text-[11px] text-cg-danger mt-2">Quitar</button>` : ""}
    </div>
  `).join("");

  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Registrar pérdida</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Productos perdidos</label>
    <div class="mt-2 mb-2">${filasHtml}</div>
    <button onclick="agregarItemPerdida()" class="text-[12px] text-cg-primary font-semibold mb-4">+ Agregar otro producto</button>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Motivo (opcional)</label>
    <input id="perdida-motivo" type="text" value="${window.__perdidaMotivo}" placeholder="Ej: se rompieron, vencieron..." class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />

    <button onclick="saveNuevaPerdida()" class="w-full bg-cg-danger text-cg-onink font-semibold rounded-xl py-3">Registrar y descontar del stock</button>
  `);
}

function cambiarItemPerdida(i, campo, valor) {
  window.__perdidaItems[i][campo] = campo === "producto_id" ? Number(valor) : Number(valor);
  renderNuevaPerdidaModal();
}

function agregarItemPerdida() {
  const primero = productos.find((p) => !p.es_insumo) || productos[0];
  window.__perdidaItems.push({ producto_id: primero?.id, cantidad: 1 });
  renderNuevaPerdidaModal();
}

function quitarItemPerdida(i) {
  window.__perdidaItems.splice(i, 1);
  renderNuevaPerdidaModal();
}

async function saveNuevaPerdida() {
  if (procesandoAccion) return;
  const motivo = document.getElementById("perdida-motivo").value.trim();

  // Validar que ningún producto quede en negativo
  for (const it of window.__perdidaItems) {
    const p = productos.find((pr) => pr.id === it.producto_id);
    if (p && it.cantidad > p.stock) {
      alert(`No hay suficiente stock de "${p.nombre}" para descontar. Disponible: ${p.stock}.`);
      return;
    }
  }

  procesandoAccion = true;
  try {
    try {
      await CG.rpc.registrarPerdida({
        motivo,
        registrado_por: ADMIN,
        items: window.__perdidaItems.map((it) => ({ producto_id: it.producto_id, cantidad: it.cantidad })),
      });
    } catch (e) { alert(e.message); console.error(e); return; }
    window.__perdidaItems = [];
    closeModal();
    await loadAll();
    await irAPerdidas();
  } finally {
    procesandoAccion = false;
  }
}

function renderCategorias(content) {
  content.innerHTML = `
    <button onclick="irA('masopciones')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver</button>
    ${sectionLabel("Categorías")}
    <div class="space-y-2 mb-4">
      ${categorias.length === 0 ? `<p class="text-[13px] text-cg-muted">Todavía no hay categorías.</p>` :
        categorias.map((c) => {
          const cantidadProductos = productos.filter((p) => p.categoria_id === c.id).length;
          return `
          <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
            <div>
              <span class="text-[13px] font-semibold text-cg-ink">${CG.escapeHtml(c.nombre)}</span>
              <p class="text-[11px] text-cg-muted">${cantidadProductos} producto(s)</p>
            </div>
            <div class="flex items-center gap-3">
              <button onclick="openEditCategoria(${c.id})" class="text-[11px] text-cg-primary font-semibold">Editar</button>
              <button onclick="deleteCategoria(${c.id})" class="text-[11px] text-cg-danger font-semibold">Eliminar</button>
            </div>
          </div>`;
        }).join("")}
    </div>
    <button onclick="openNewCategoria()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">+ Nueva categoría</button>
  `;
}

function openNewCategoria() {
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Nueva categoría</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre</label>
    <input id="cat-nombre" type="text" placeholder="Ej: Chocolates" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveNewCategoria()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Crear categoría</button>
  `);
}

async function saveNewCategoria() {
  const nombre = document.getElementById("cat-nombre").value.trim();
  if (!nombre) { alert("Poné un nombre."); return; }
  const { data, error } = await sb.from("categorias").insert({ nombre }).select().single();
  if (error) { alert("No se pudo crear (puede que ya exista una categoría con ese nombre)."); console.error(error); return; }
  await registrarHistorial("categorias", data.id, "crear", `Categoría creada: ${nombre}`);
  closeModal();
  await loadAll();
  activeTab = "categorias";
  render();
}

function openEditCategoria(id) {
  const c = categorias.find((cc) => cc.id === id);
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Editar categoría</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre</label>
    <input id="cat-editar-nombre" type="text" value="${CG.escapeHtml(c.nombre)}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveEditCategoria(${id})" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar</button>
  `);
}

async function saveEditCategoria(id) {
  const nombre = document.getElementById("cat-editar-nombre").value.trim();
  if (!nombre) { alert("Poné un nombre."); return; }
  const { error } = await sb.from("categorias").update({ nombre }).eq("id", id);
  if (error) { alert("No se pudo guardar."); console.error(error); return; }
  await registrarHistorial("categorias", id, "editar", `Categoría renombrada a: ${nombre}`);
  closeModal();
  await loadAll();
  activeTab = "categorias";
  render();
}

async function deleteCategoria(id) {
  const c = categorias.find((cc) => cc.id === id);
  const enUsoProductos = productos.some((p) => p.categoria_id === id);
  const enUsoPromo = promociones.some((pr) => pr.categoria_id === id);
  if (enUsoProductos) {
    alert(`No podés eliminar "${c.nombre}" porque todavía hay productos usándola. Cambiales la categoría primero desde Inventario.`);
    return;
  }
  if (enUsoPromo) {
    alert(`No podés eliminar "${c.nombre}" porque hay una promoción usándola. Eliminá o cambiá esa promoción primero, en "Más → Promociones".`);
    return;
  }
  if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
  const { error } = await sb.from("categorias").delete().eq("id", id);
  if (error) { alert("No se pudo eliminar."); console.error(error); return; }
  await registrarHistorial("categorias", id, "eliminar", `Categoría eliminada: ${c.nombre}`);
  await loadAll();
  activeTab = "categorias";
  render();
}
