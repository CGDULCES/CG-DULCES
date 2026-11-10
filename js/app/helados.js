/* =====================================================================
 * CG DULCES · Armado de helados (vasito, cucurucho, pote) a partir de los baldes.
 * (archivo: js/app/helados.js)
 * ===================================================================== */

function baldesHelado() {
  return productos.filter((p) => p.producto_base === "Balde Helado");
}

function coberturasHelado() {
  return productos.filter((p) => p.producto_base === "Cobertura");
}

function productoHeladoBola() {
  return productos.find((p) => p.nombre === "Helado · Bola");
}

function productoHeladoPote() {
  return productos.find((p) => p.nombre === "Helado · Pote 1/4");
}

window.__heladoBuilder = null; // estado temporal mientras se arma un helado

function openHeladoBuilder(tipo) {
  const baldes = baldesHelado();
  if (baldes.length === 0) { alert("Primero cargá al menos un sabor de balde de helado en Inventario."); return; }
  const primerConStock = baldes.find((b) => Number(b.stock) > 0);
  if (!primerConStock) { alert("No hay ningún balde de helado en stock. Agregá uno desde Inventario (tocá el sabor → \"Agregar balde\") o registrá la compra."); return; }
  const cantidadFija = tipo === "pote14" ? Math.round(productoHeladoPote()?.equivalencia_bolas || 4) : 1;
  window.__heladoBuilder = {
    tipo,
    bolas: Array(cantidadFija).fill(primerConStock.id),
    envaseId: tipo === "bola" ? insumoPorNombre("Vasito")?.id : null,
    cobertura: false,
    coberturaId: coberturasHelado()[0]?.id,
    servilleta: false,
  };
  renderHeladoBuilderModal();
}

function renderHeladoBuilderModal() {
  const st = window.__heladoBuilder;
  const baldes = baldesHelado();
  const producto = st.tipo === "bola" ? productoHeladoBola() : productoHeladoPote();
  const opcionesSabor = baldes.map((b) => `<option value="${b.id}">${CG.escapeHtml(b.presentacion || b.nombre)}</option>`).join("");
  const vasito = insumoPorNombre("Vasito");
  const cucurucho = insumoPorNombre("Cucurucho");

  const bolasHtml = st.bolas.map((saborId, i) => `
    <div class="flex items-center justify-between gap-2 mb-2">
      <span class="text-[12px] text-cg-muted w-16">Bola ${i + 1}</span>
      <select onchange="cambiarSaborBola(${i}, this.value)" class="flex-1 bg-cg-surface rounded-lg px-2 py-2 text-[13px] outline-none">
        ${baldes.map((b) => `<option value="${b.id}" ${b.id===saborId?"selected":""} ${Number(b.stock) <= 0 ? "disabled" : ""}>${CG.escapeHtml(b.presentacion || b.nombre)}${Number(b.stock) <= 0 ? " (sin stock)" : ""}</option>`).join("")}
      </select>
    </div>
  `).join("");

  const total = st.tipo === "bola" ? (producto?.precio_venta || 0) * st.bolas.length : (producto?.precio_venta || 0);

  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">${st.tipo === "bola" ? "Armar Vasito / Cucurucho" : "Armar Pote 1/4"}</p>

    ${st.tipo === "bola" ? `
    <div class="flex items-center justify-between mb-4">
      <span class="text-[12px] font-semibold uppercase tracking-wide text-cg-muted">Cantidad de bolas</span>
      <div class="flex items-center gap-3">
        <button onclick="cambiarCantidadBolas(-1)" class="w-8 h-8 rounded-full bg-cg-surface flex items-center justify-center">−</button>
        <span class="font-mono-num text-[16px] font-semibold w-6 text-center">${st.bolas.length}</span>
        <button onclick="cambiarCantidadBolas(1)" class="w-8 h-8 rounded-full bg-cg-primary text-cg-onink flex items-center justify-center">+</button>
      </div>
    </div>` : `<p class="text-[12px] text-cg-muted mb-3">Este pote lleva ${st.bolas.length} bolas fijas.</p>`}

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Sabor de cada bola</label>
    <div class="mt-2 mb-4">${bolasHtml}</div>

    ${st.tipo === "bola" ? `
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Envase</label>
    <div class="grid grid-cols-2 gap-2 mt-1 mb-4">
      ${vasito ? `<button type="button" onclick="elegirEnvase(${vasito.id}, this)" class="envase-btn border border-cg-line/10 rounded-xl py-2 text-[13px] font-medium ${st.envaseId===vasito.id?"bg-cg-primary text-cg-onink":""}">Vasito</button>` : ""}
      ${cucurucho ? `<button type="button" onclick="elegirEnvase(${cucurucho.id}, this)" class="envase-btn border border-cg-line/10 rounded-xl py-2 text-[13px] font-medium ${st.envaseId===cucurucho.id?"bg-cg-primary text-cg-onink":""}">Cucurucho</button>` : ""}
    </div>` : ""}

    <label class="flex items-center gap-2 mb-2">
      <input type="checkbox" id="cobertura-check" ${st.cobertura ? "checked" : ""} onchange="toggleCobertura(this.checked)" class="w-4 h-4" />
      <span class="text-[13px] text-cg-ink">Con cobertura (sin costo extra)</span>
    </label>
    ${st.cobertura ? `
    <select id="cobertura-sabor" onchange="cambiarSaborCobertura(this.value)" class="w-full bg-cg-surface rounded-lg px-3 py-2 text-[13px] mb-3 outline-none">
      ${coberturasHelado().map((c) => `<option value="${c.id}" ${c.id===st.coberturaId?"selected":""}>${CG.escapeHtml(c.presentacion || c.nombre)}</option>`).join("")}
    </select>` : ""}
    <label class="flex items-center gap-2 mb-5">
      <input type="checkbox" id="servilleta-check" ${st.servilleta ? "checked" : ""} onchange="toggleServilleta(this.checked)" class="w-4 h-4" />
      <span class="text-[13px] text-cg-ink">Servilleta (sin costo extra)</span>
    </label>

    <div class="flex items-center justify-between mb-4">
      <span class="text-[12px] text-cg-muted">Total</span>
      <span class="font-mono-num text-[18px] font-semibold text-cg-ink">${fmt(total)}</span>
    </div>

    <button onclick="agregarHeladoAlCarrito()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Agregar al carrito</button>
  `);
}

function cambiarCantidadBolas(delta) {
  const st = window.__heladoBuilder;
  const nueva = Math.max(1, st.bolas.length + delta);
  if (delta > 0) st.bolas.push(baldesHelado()[0]?.id);
  else st.bolas = st.bolas.slice(0, nueva);
  renderHeladoBuilderModal();
}

function cambiarSaborBola(index, value) {
  window.__heladoBuilder.bolas[index] = Number(value);
}

function elegirEnvase(id, btn) {
  window.__heladoBuilder.envaseId = id;
  document.querySelectorAll(".envase-btn").forEach((b) => b.classList.remove("bg-cg-primary", "text-cg-onink"));
  btn.classList.add("bg-cg-primary", "text-cg-onink");
}

function toggleCobertura(checked) {
  window.__heladoBuilder.cobertura = checked;
  renderHeladoBuilderModal();
}

function cambiarSaborCobertura(id) {
  window.__heladoBuilder.coberturaId = Number(id);
}

function toggleServilleta(checked) {
  window.__heladoBuilder.servilleta = checked;
}

function agregarHeladoAlCarrito() {
  const st = window.__heladoBuilder;
  if (st.tipo === "bola" && !st.envaseId) { alert("Elegí un envase (vasito o cucurucho)."); return; }

  const producto = st.tipo === "bola" ? productoHeladoBola() : productoHeladoPote();
  const total = st.tipo === "bola" ? producto.precio_venta * st.bolas.length : producto.precio_venta;
  const nombresSabor = st.bolas.map((id) => {
    const b = productos.find((p) => p.id === id);
    return b?.presentacion || b?.nombre || "?";
  });
  const envaseNombre = st.envaseId ? productos.find((p) => p.id === st.envaseId)?.nombre : "Pote 1/4";
  const coberturaNombre = st.cobertura ? (productos.find((p) => p.id === st.coberturaId)?.presentacion || "cobertura") : "";
  const resumen = `${envaseNombre} · ${st.bolas.length} bola(s): ${nombresSabor.join(", ")}${st.cobertura ? ` · con cobertura ${coberturaNombre}` : ""}${st.servilleta ? " · con servilleta" : ""}`;

  heladoCart.push({
    id: `h${Date.now()}`,
    tipo: st.tipo,
    productoId: producto.id,
    bolas: [...st.bolas],
    envaseId: st.envaseId,
    cobertura: st.cobertura,
    coberturaId: st.cobertura ? st.coberturaId : null,
    servilleta: st.servilleta,
    total,
    resumen,
  });

  window.__heladoBuilder = null;
  closeModal();
  render();
}

function quitarHeladoCart(id) {
  heladoCart = heladoCart.filter((h) => h.id !== id);
  render();
}
