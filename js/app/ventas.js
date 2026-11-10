/* =====================================================================
 * CG DULCES · Ventas: pantalla de vender, carrito, promociones y confirmación de la venta.
 * (archivo: js/app/ventas.js)
 * ===================================================================== */

function promoParaProducto(producto) {
  if (!producto) return null;
  return promociones.find((pr) => pr.categoria_id && pr.categoria_id === producto.categoria_id)
    || promociones.find((pr) => pr.producto_id === producto.id);
}

function cantidadGrupoEnCarrito(promo) {
  return productos
    .filter((p) => promoParaProducto(p)?.id === promo.id)
    .reduce((s, p) => s + (cart[p.id] || 0), 0);
}

// Calcula todas las líneas del carrito aplicando promociones que combinan
// productos de la misma categoría (ej: 2 alfajores de sabores distintos)
// Precio unitario de un producto (el precio de venta).
function precioEfectivo(producto) {
  return Number(producto?.precio_venta || 0);
}

function calcularCarritoPromos() {
  const entradas = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ producto: productos.find((p) => p.id === Number(id)), cantidad: q }));

  const grupos = {};
  entradas.forEach(({ producto, cantidad }) => {
    const promo = promoParaProducto(producto);
    const key = promo ? `promo-${promo.id}` : `solo-${producto.id}`;
    if (!grupos[key]) grupos[key] = { promo, items: [] };
    grupos[key].items.push({ producto, cantidad });
  });

  const lineas = [];
  let subtotalTotal = 0, descuentoTotal = 0;

  Object.values(grupos).forEach((g) => {
    const totalQty = g.items.reduce((s, it) => s + it.cantidad, 0);
    const normalTotal = g.items.reduce((s, it) => s + precioEfectivo(it.producto) * it.cantidad, 0);

    if (g.promo && totalQty >= g.promo.cantidad_requerida) {
      const gruposCompletos = Math.floor(totalQty / g.promo.cantidad_requerida);
      const resto = totalQty % g.promo.cantidad_requerida;
      const precioPromedio = normalTotal / totalQty;
      const promoTotal = gruposCompletos * g.promo.precio_promocional + resto * precioPromedio;
      const descuento = normalTotal - promoTotal;

      g.items.forEach((it) => {
        const parteNormal = precioEfectivo(it.producto) * it.cantidad;
        const parteDescuento = normalTotal > 0 ? descuento * (parteNormal / normalTotal) : 0;
        lineas.push({ producto: it.producto, cantidad: it.cantidad, subtotal: parteNormal - parteDescuento, descuento: parteDescuento });
        subtotalTotal += parteNormal;
        descuentoTotal += parteDescuento;
      });
    } else {
      g.items.forEach((it) => {
        const subtotal = precioEfectivo(it.producto) * it.cantidad;
        lineas.push({ producto: it.producto, cantidad: it.cantidad, subtotal, descuento: 0 });
        subtotalTotal += subtotal;
      });
    }
  });

  return { lineas, subtotalTotal, descuentoTotal, total: subtotalTotal - descuentoTotal };
}

let buscarVender = "";

function cambiarBuscarVender(valor) {
  buscarVender = valor;
  render();
  refocusInput("buscar-vender-input");
}

function renderTarjetaProducto(p, cat) {
  const qty = cart[p.id] || 0;
  const color = categoryColors[cat] || cgHex("primary");
  const promo = promoParaProducto(p);
  const promoActiva = promo && cantidadGrupoEnCarrito(promo) >= promo.cantidad_requerida;
  const pajitas = pajitasCart[p.id] || 0;
  return `
  <div class="bg-cg-card rounded-2xl p-3.5 shadow-sm border border-cg-line/[0.04] flex flex-col gap-2">
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>
      <span class="text-[10px] uppercase tracking-wide text-cg-muted font-semibold truncate">${CG.escapeHtml(p.presentacion || cat)}</span>
    </div>
    <p class="text-[13px] font-semibold text-cg-ink leading-tight">${CG.escapeHtml(p.nombre)}</p>
    <p class="font-mono-num text-[13px] font-semibold text-cg-primary">${fmt(Number(p.precio_venta))}</p>
    ${promo ? `<p class="text-[10px] text-cg-success font-medium">${promoActiva ? "✓ Promo aplicada" : `Promo ${promo.cantidad_requerida}x ${fmt(promo.precio_promocional)}${promo.categoria_id ? " (combinable)" : ""}`}</p>` : ""}
    <div class="flex items-center justify-between mt-1">
      <button onclick="changeQty(${p.id}, -1)" class="w-7 h-7 rounded-full bg-cg-surface flex items-center justify-center" ${qty===0?"disabled style='opacity:.3'":""}>−</button>
      <span class="font-mono-num text-[14px] font-semibold w-6 text-center">${qty}</span>
      <button onclick="changeQty(${p.id}, 1)" class="w-7 h-7 rounded-full bg-cg-primary text-cg-onink flex items-center justify-center" ${qty>=p.stock?"disabled style='opacity:.3'":""}>+</button>
    </div>
    ${p.usa_pajita && qty > 0 ? `
    <div class="border-t border-cg-line/[0.06] pt-2 mt-1">
      <label class="flex items-center gap-1.5 mb-1.5">
        <input type="checkbox" onchange="togglePajita(${p.id}, this.checked, ${qty})" ${pajitas > 0 ? "checked" : ""} class="w-3.5 h-3.5" />
        <span class="text-[11px] text-cg-ink">🥤 Con pajita</span>
      </label>
      ${pajitas > 0 ? `
      <div class="flex items-center justify-center gap-2">
        <button onclick="changePajitaCantidad(${p.id}, -1)" class="w-5 h-5 rounded-full bg-cg-surface flex items-center justify-center text-[11px]">−</button>
        <span class="font-mono-num text-[11px] font-semibold w-4 text-center">${pajitas}</span>
        <button onclick="changePajitaCantidad(${p.id}, 1)" class="w-5 h-5 rounded-full bg-cg-primary text-cg-onink flex items-center justify-center text-[11px]">+</button>
      </div>` : ""}
    </div>` : ""}
  </div>`;
}

function renderVender(content) {
  let html = "";
  html += `
    <div class="relative mb-4">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--cg-muted))" stroke-width="2" stroke-linecap="round" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="buscar-vender-input" type="text" placeholder="Buscar producto..." value="${CG.escapeHtml(buscarVender)}" oninput="cambiarBuscarVender(this.value)" class="w-full bg-cg-card border border-cg-line/[0.06] rounded-xl pl-9 pr-3 py-2.5 text-[13px] outline-none" />
    </div>
    <button onclick="openDividirCuenta()" class="w-full flex items-center justify-center gap-2 bg-cg-card border border-cg-line/[0.06] rounded-xl px-4 py-2.5 mb-4">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--cg-primary))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span class="text-[12px] text-cg-primary font-semibold">Dividir cuenta entre varios clientes</span>
    </button>
  `;

  const termino = buscarVender.trim().toLowerCase();
  const visibles = ventasVisibles().filter((p) => !termino || p.nombre.toLowerCase().includes(termino));

  if (termino) {
    // Modo búsqueda: lista simple sin categorías ni favoritos
    html += `
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        ${visibles.length === 0 ? `<p class="text-[13px] text-cg-muted col-span-2">No encontré productos con ese nombre.</p>` : visibles.map((p) => renderTarjetaProducto(p, p.categorias?.nombre || "")).join("")}
      </div>
    `;
    content.innerHTML = html;
    return;
  }

  const favoritos = ventasVisibles().filter((p) => p.favorito);
  if (favoritos.length > 0) {
    html += `
      <div class="mb-5">
        ${sectionLabel("⭐ Favoritos")}
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          ${favoritos.map((p) => renderTarjetaProducto(p, p.categorias?.nombre || "")).join("")}
        </div>
      </div>
    `;
  }

  const grupos = agruparPorCategoria(visibles);
  html += Object.entries(grupos).map(([cat, lista]) => `
    <div class="mb-5">
      ${sectionLabel(CG.escapeHtml(cat))}
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        ${lista.map((p) => renderTarjetaProducto(p, cat)).join("")}
      </div>
    </div>
  `).join("");

  // Los helados son una parte aparte (helados.js): si esa parte no cargó, la pantalla de vender sigue sin los botones de helado.
  const bola = typeof productoHeladoBola === "function" ? productoHeladoBola() : null;
  const pote = typeof productoHeladoPote === "function" ? productoHeladoPote() : null;
  if (bola || pote) {
    html += `
    <div class="mb-5">
      ${sectionLabel("Helados")}
      <div class="grid grid-cols-2 gap-3 mb-3">
        ${bola ? `
        <button onclick="openHeladoBuilder('bola')" class="bg-cg-card rounded-2xl p-3.5 shadow-sm border border-cg-line/[0.04] text-left">
          <p class="text-[13px] font-semibold text-cg-ink">Helado · Bola</p>
          <p class="font-mono-num text-[13px] text-cg-primary font-semibold mt-1">${fmt(bola.precio_venta)} c/u</p>
          <p class="text-[10px] text-cg-muted mt-1">Tocá para armar</p>
        </button>` : ""}
        ${pote ? `
        <button onclick="openHeladoBuilder('pote14')" class="bg-cg-card rounded-2xl p-3.5 shadow-sm border border-cg-line/[0.04] text-left">
          <p class="text-[13px] font-semibold text-cg-ink">Helado · Pote 1/4</p>
          <p class="font-mono-num text-[13px] text-cg-primary font-semibold mt-1">${fmt(pote.precio_venta)}</p>
          <p class="text-[10px] text-cg-muted mt-1">Tocá para armar</p>
        </button>` : ""}
      </div>
      ${heladoCart.length ? `
      <div class="space-y-2">
        ${heladoCart.map((h) => `
          <div class="bg-cg-card rounded-xl px-3.5 py-2.5 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
            <p class="text-[12px] text-cg-ink flex-1 pr-2">${h.resumen}</p>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-mono-num text-[12px] font-semibold">${fmt(h.total)}</span>
              <button onclick="quitarHeladoCart('${h.id}')" class="text-cg-danger text-[16px] leading-none">×</button>
            </div>
          </div>
        `).join("")}
      </div>` : ""}
    </div>`;
  }

  content.innerHTML = html;
}

function openVerCarrito() {
  renderVerCarritoModal();
}

function renderVerCarritoModal() {
  const calculo = calcularCarritoPromos();
  const totalHelados = heladoCart.reduce((s, h) => s + h.total, 0);
  const total = calculo.total + totalHelados;

  const lineasNormales = calculo.lineas.map((l) => `
    <div class="flex items-center justify-between gap-2 bg-cg-surface rounded-xl p-3 mb-2">
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-semibold text-cg-ink truncate">${CG.escapeHtml(l.producto.nombre)}${l.producto.presentacion ? " · " + CG.escapeHtml(l.producto.presentacion) : ""}</p>
        <p class="text-[11px] text-cg-muted">${l.cantidad} × ${fmt(l.producto.precio_venta)}${l.descuento > 0 ? ` · promo −${fmt(l.descuento)}` : ""}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button onclick="changeQty(${l.producto.id}, -1); renderVerCarritoModal();" class="w-6 h-6 rounded-full bg-cg-card flex items-center justify-center text-[13px]">−</button>
        <span class="font-mono-num text-[13px] font-semibold w-4 text-center">${l.cantidad}</span>
        <button onclick="changeQty(${l.producto.id}, 1); renderVerCarritoModal();" class="w-6 h-6 rounded-full bg-cg-primary text-cg-onink flex items-center justify-center text-[13px]">+</button>
      </div>
    </div>
  `).join("");

  const lineasHelado = heladoCart.map((h) => `
    <div class="flex items-center justify-between gap-2 bg-cg-surface rounded-xl p-3 mb-2">
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-semibold text-cg-ink">🍦 Helado</p>
        <p class="text-[11px] text-cg-muted">${h.resumen}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="font-mono-num text-[13px] font-semibold">${fmt(h.total)}</span>
        <button onclick="quitarHeladoCart('${h.id}'); renderVerCarritoModal();" class="text-cg-danger text-[16px] leading-none">×</button>
      </div>
    </div>
  `).join("");

  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Tu carrito</p>
    ${lineasNormales || lineasHelado ? `${lineasNormales}${lineasHelado}` : `<p class="text-[13px] text-cg-muted mb-4">El carrito está vacío.</p>`}
    <div class="flex items-center justify-between mt-4 mb-5 pt-3 border-t border-cg-line/[0.06]">
      <span class="text-[13px] text-cg-muted">Total</span>
      <span class="font-mono-num text-[20px] font-semibold text-cg-ink">${fmt(total)}</span>
    </div>
    <button onclick="openConfirmSale()" class="w-full bg-cg-success text-cg-onink font-semibold rounded-xl py-3">Cobrar ✓</button>
  `);
}

function renderCartBar() {
  const bar = document.getElementById("cart-bar");
  const items = Object.entries(cart).filter(([, q]) => q > 0);
  const hayHelados = heladoCart.length > 0;
  if (activeTab !== "ventas" || (items.length === 0 && !hayHelados)) { bar.classList.add("screen-hidden"); return; }
  const totalNormal = calcularCarritoPromos().total;
  const totalHelados = heladoCart.reduce((s, h) => s + h.total, 0);
  const total = totalNormal + totalHelados;
  const cantidadItems = items.length + heladoCart.length;
  bar.classList.remove("screen-hidden");
  bar.innerHTML = `
    <div class="flex items-center justify-between">
      <button onclick="openVerCarrito()" class="text-left">
        <p class="text-cg-onink/60 text-[11px] underline">${cantidadItems} producto(s) · Ver carrito</p>
        <p class="text-cg-onink font-mono-num text-[16px] font-semibold">${fmt(total)}</p>
      </button>
      <button onclick="openConfirmSale()" class="bg-cg-success text-cg-onink text-[13px] font-semibold px-4 py-2.5 rounded-xl">
        Confirmar venta ✓
      </button>
    </div>
  `;
}

function changeQty(id, delta) {
  const p = productos.find((pr) => pr.id === id);
  const current = cart[id] || 0;
  cart[id] = Math.max(0, Math.min(p.stock, current + delta));
  if (cart[id] === 0) delete pajitasCart[id];
  render();
}

function togglePajita(id, checked, qty) {
  if (checked) pajitasCart[id] = qty;
  else delete pajitasCart[id];
  render();
}

function changePajitaCantidad(id, delta) {
  const actual = pajitasCart[id] || 0;
  const nueva = Math.max(1, actual + delta);
  pajitasCart[id] = nueva;
  render();
}

function openConfirmSale() {
  if (!cajaRequerida()) return;
  const totalNormal = calcularCarritoPromos().total;
  const totalHelados = heladoCart.reduce((s, h) => s + h.total, 0);
  const total = totalNormal + totalHelados;
  window.__ventaTotal = total;
  window.__ventaFecha = fechaLocalHoy();
  window.__ventaDescuentoManual = 0;
  renderConfirmSaleModal();
  window.__medioPago = "efectivo";
}

function renderConfirmSaleModal() {
  const total = window.__ventaTotal;
  const descuentoManual = window.__ventaDescuentoManual || 0;
  const totalFinal = Math.max(0, total - descuentoManual);
  const opcionesCliente = clientes.map((c) => `<option value="${c.id}" ${window.__clienteRecienCreado===c.id?"selected":""}>${CG.escapeHtml(c.nombre)}</option>`).join("");
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">Confirmar venta</p>
    <p class="text-[13px] text-cg-muted mb-1">Subtotal</p>
    <p class="font-mono-num text-[16px] text-cg-muted mb-3">${fmt(total)}</p>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Descuento manual (opcional)</label>
    <input id="venta-descuento" type="number" value="${descuentoManual}" onchange="window.__ventaDescuentoManual = Number(this.value) || 0; renderConfirmSaleModal();" placeholder="Ej: negociaste un precio especial" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />

    <p class="text-[13px] text-cg-muted mb-1">Total a cobrar</p>
    <p class="font-mono-num text-[22px] font-semibold text-cg-ink mb-4">${fmt(totalFinal)}</p>

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Fecha de la venta</label>
    <input id="venta-fecha" type="date" value="${window.__ventaFecha}" onchange="window.__ventaFecha = this.value" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-4 outline-none" />

    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Cliente</label>
    <select id="venta-cliente" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none">
      <option value="">Elegí un cliente</option>
      ${opcionesCliente}
    </select>
    <button type="button" onclick="mostrarAltaRapidaCliente()" id="btn-alta-rapida" class="text-[12px] text-cg-primary font-semibold mt-1.5 mb-3">+ Nuevo cliente rápido</button>
    <div id="alta-rapida-cliente" class="hidden mb-3">
      <div class="flex gap-2">
        <input id="alta-rapida-nombre" type="text" placeholder="Nombre del cliente" class="flex-1 bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] outline-none" />
        <button type="button" onclick="crearClienteRapido()" class="bg-cg-primary text-cg-onink text-[13px] font-semibold px-3.5 rounded-xl">Agregar</button>
      </div>
    </div>

    <label class="flex items-center gap-2 mb-4">
      <input type="checkbox" id="venta-fiado" onchange="toggleFiado(this.checked)" class="w-4 h-4" />
      <span class="text-[13px] text-cg-ink">Es fiado (queda a cuenta del cliente)</span>
    </label>

    <div id="medio-pago-wrap">
      <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Medio de pago</label>
      <div class="grid grid-cols-4 gap-2 mt-1 mb-3">
        <button type="button" onclick="selectPago('efectivo', this)" class="pago-btn border border-cg-line/10 rounded-xl py-2 text-[11px] font-medium bg-cg-primary text-cg-onink" data-pago="efectivo">Efectivo</button>
        <button type="button" onclick="selectPago('transferencia', this)" class="pago-btn border border-cg-line/10 rounded-xl py-2 text-[11px] font-medium" data-pago="transferencia">Transf.</button>
        <button type="button" onclick="selectPago('qr', this)" class="pago-btn border border-cg-line/10 rounded-xl py-2 text-[11px] font-medium" data-pago="qr">QR</button>
        <button type="button" onclick="selectPago('mixto', this)" class="pago-btn border border-cg-line/10 rounded-xl py-2 text-[11px] font-medium" data-pago="mixto">Mixto</button>
      </div>
      <div id="mixto-wrap" class="hidden mb-4">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-cg-muted">Efectivo</label>
            <input id="mixto-efectivo" type="number" value="0" oninput="actualizarRestoMixto()" class="w-full bg-cg-surface rounded-lg px-2 py-2 text-[13px] outline-none" />
          </div>
          <div>
            <label class="text-[10px] text-cg-muted">Transferencia</label>
            <input id="mixto-transferencia" type="number" value="0" oninput="actualizarRestoMixto()" class="w-full bg-cg-surface rounded-lg px-2 py-2 text-[13px] outline-none" />
          </div>
        </div>
        <p id="mixto-restante" class="text-[11px] text-cg-muted mt-1.5"></p>
      </div>
    </div>

    <button id="btn-confirmar-venta" onclick="confirmSale()" class="w-full bg-cg-success text-cg-onink font-semibold rounded-xl py-3">Registrar venta</button>
  `);
  window.__clienteRecienCreado = null;
}

function mostrarAltaRapidaCliente() {
  document.getElementById("alta-rapida-cliente").classList.remove("hidden");
  document.getElementById("btn-alta-rapida").classList.add("hidden");
}

async function crearClienteRapido() {
  const nombre = document.getElementById("alta-rapida-nombre").value.trim();
  if (!nombre) { alert("Poné un nombre."); return; }
  const { data, error } = await sb.from("clientes").insert({ nombre }).select().single();
  if (error) { alert("No se pudo crear el cliente."); console.error(error); return; }
  await registrarHistorial("clientes", data.id, "crear", `Cliente creado: ${nombre}`);
  clientes.push(data);
  window.__clienteRecienCreado = data.id;
  renderConfirmSaleModal();
}

function toggleFiado(checked) {
  const wrap = document.getElementById("medio-pago-wrap");
  if (checked) wrap.classList.add("screen-hidden");
  else wrap.classList.remove("screen-hidden");
}

function selectPago(medio, btn) {
  window.__medioPago = medio;
  document.querySelectorAll(".pago-btn").forEach((b) => b.classList.remove("bg-cg-primary", "text-cg-onink"));
  btn.classList.add("bg-cg-primary", "text-cg-onink");
  const mixtoWrap = document.getElementById("mixto-wrap");
  if (medio === "mixto") {
    mixtoWrap.classList.remove("hidden");
    actualizarRestoMixto();
  } else {
    mixtoWrap.classList.add("hidden");
  }
}

function actualizarRestoMixto() {
  const efectivo = Number(document.getElementById("mixto-efectivo").value) || 0;
  const transferencia = Number(document.getElementById("mixto-transferencia").value) || 0;
  const resto = window.__ventaTotal - efectivo - transferencia;
  document.getElementById("mixto-restante").textContent =
    resto === 0 ? "✓ Cubre el total exacto" : resto > 0 ? `Falta cubrir ${fmt(resto)}` : `Te pasaste por ${fmt(-resto)}`;
}

async function confirmSale() {
  if (procesandoVenta) return; // evita registrar la misma venta dos veces si se toca el botón rápido
  const items = Object.entries(cart).filter(([, q]) => q > 0);
  if (items.length === 0 && heladoCart.length === 0) return;
  if (!cajaRequerida()) return;

  const registrado_por = ADMIN;
  const es_fiado = document.getElementById("venta-fiado").checked;
  const clienteVal = document.getElementById("venta-cliente").value;
  const cliente_id = clienteVal ? Number(clienteVal) : null;
  if (!cliente_id) { alert("Elegí un cliente (o creá uno rápido) para poder registrar la venta."); return; }
  const medio_pago = es_fiado ? "fiado" : (window.__medioPago || "efectivo");
  const fechaVenta = document.getElementById("venta-fecha").value;
  const created_at = fechaOAhora(fechaVenta);

  procesandoVenta = true;
  const btnConfirmar = document.getElementById("btn-confirmar-venta");
  if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = "Registrando..."; btnConfirmar.classList.add("opacity-60"); }

  try {

  let monto_efectivo = 0, monto_transferencia = 0;

  // Aviso rápido si algo claramente no alcanza (la RPC vuelve a validar esto
  // mismo de forma atómica justo antes de escribir, así que esto es solo
  // para no hacerte esperar el viaje al servidor si ya se ve que no alcanza).
  for (const [id, qty] of items) {
    const p = productos.find((pr) => pr.id === Number(id));
    if (qty > p.stock) { alert(`No hay suficiente stock de "${p.nombre}". Disponible: ${p.stock}.`); return; }
  }

  const consumiblesIlimitados = [];
  const stockExtra = [];

  // Pajitas: uso ilimitado mientras haya un paquete abierto (igual que cucharita/servilleta)
  const totalPajitas = items.reduce((s, [id, qty]) => s + (pajitasCart[Number(id)] || 0), 0);
  if (totalPajitas > 0) {
    const pajita = insumoPorNombre("Pajita");
    const checkPajita = await validarConsumoIlimitado(pajita, totalPajitas);
    if (!checkPajita.ok) { alert(checkPajita.mensaje); return; }
    if (pajita) consumiblesIlimitados.push({ producto_id: pajita.id, cantidad: totalPajitas });
  }

  if (heladoCart.length > 0) {
    const necesarioPorId = {};
    const bolasPorBalde = {};
    const coberturaPorSabor = {};
    const sumarNecesario = (id, cant) => { necesarioPorId[id] = (necesarioPorId[id] || 0) + cant; };
    const cucharita = insumoPorNombre("Cucharita");
    const servilleta = insumoPorNombre("Servilleta");
    const poteIsopor = insumoPorNombre("Pote de Isopor 1/4");
    const vasito = insumoPorNombre("Vasito");
    let cucharitaNecesario = 0, servilletaNecesario = 0;
    heladoCart.forEach((h) => {
      h.bolas.forEach((saborId) => { bolasPorBalde[saborId] = (bolasPorBalde[saborId] || 0) + 1; });
      if (h.tipo === "bola" && h.envaseId) sumarNecesario(h.envaseId, 1);
      if (h.tipo === "pote14" && poteIsopor) sumarNecesario(poteIsopor.id, 1);
      if ((h.tipo === "bola" && vasito && h.envaseId === vasito.id) || h.tipo === "pote14") cucharitaNecesario += 1;
      if (h.servilleta) servilletaNecesario += 1;
      if (h.cobertura && h.coberturaId) coberturaPorSabor[h.coberturaId] = (coberturaPorSabor[h.coberturaId] || 0) + 1;
    });
    // Envase y pote: siguen con stock normal (limitado) — se validan y descuentan igual que un producto más
    for (const [id, necesario] of Object.entries(necesarioPorId)) {
      const p = productos.find((pr) => pr.id === Number(id));
      if (p && necesario > p.stock) { alert(`No hay suficiente stock de "${p.nombre}". Disponible: ${p.stock}, necesitás ${necesario}.`); return; }
      stockExtra.push({ producto_id: Number(id), cantidad: necesario });
    }
    // Baldes, cucharita, servilleta y cobertura (por sabor): uso ilimitado mientras haya un paquete/balde abierto
    const validarIlimitado = async (producto, necesario) => {
      const r = await validarConsumoIlimitado(producto, necesario);
      if (!r.ok) alert(r.mensaje);
      return r.ok;
    };
    for (const saborId of Object.keys(bolasPorBalde)) {
      const cant = bolasPorBalde[saborId];
      if (!(await validarIlimitado(productos.find((pr) => pr.id === Number(saborId)), cant))) return;
      consumiblesIlimitados.push({ producto_id: Number(saborId), cantidad: cant });
    }
    if (!(await validarIlimitado(cucharita, cucharitaNecesario))) return;
    if (cucharita && cucharitaNecesario > 0) consumiblesIlimitados.push({ producto_id: cucharita.id, cantidad: cucharitaNecesario });
    if (!(await validarIlimitado(servilleta, servilletaNecesario))) return;
    if (servilleta && servilletaNecesario > 0) consumiblesIlimitados.push({ producto_id: servilleta.id, cantidad: servilletaNecesario });
    for (const saborId of Object.keys(coberturaPorSabor)) {
      const cant = coberturaPorSabor[saborId];
      if (!(await validarIlimitado(productos.find((pr) => pr.id === Number(saborId)), cant))) return;
      consumiblesIlimitados.push({ producto_id: Number(saborId), cantidad: cant });
    }
  }

  const calculo = calcularCarritoPromos();
  let subtotalTotal = calculo.subtotalTotal, descuentoTotal = calculo.descuentoTotal;
  const lineas = calculo.lineas.map((l) => ({
    producto_id: l.producto.id, cantidad: l.cantidad, precio_unitario: precioEfectivo(l.producto),
    costo_unitario: l.producto.costo_ultimo, descuento: l.descuento, subtotal: l.subtotal,
  }));

  // Líneas de helados armados (no descuentan stock propio: lo suyo va por stockExtra/consumiblesIlimitados)
  heladoCart.forEach((h) => {
    const producto = productos.find((p) => p.id === h.productoId);
    const cantidad = h.tipo === "bola" ? h.bolas.length : 1;
    subtotalTotal += h.total;
    lineas.push({ producto_id: producto.id, cantidad, precio_unitario: producto.precio_venta, costo_unitario: producto.costo_ultimo, descuento: 0, subtotal: h.total, _esHelado: true });
  });

  // Descuento manual: se reparte proporcionalmente entre todas las líneas de la venta
  const descuentoManual = Math.min(window.__ventaDescuentoManual || 0, subtotalTotal - descuentoTotal);
  if (descuentoManual > 0) {
    const baseParaReparto = subtotalTotal - descuentoTotal;
    lineas.forEach((l) => {
      const parte = baseParaReparto > 0 ? (l.subtotal / baseParaReparto) * descuentoManual : 0;
      l.descuento += parte;
      l.subtotal -= parte;
    });
    descuentoTotal += descuentoManual;
  }

  const total = subtotalTotal - descuentoTotal;

  if (!es_fiado) {
    if (medio_pago === "mixto") {
      monto_efectivo = Number(document.getElementById("mixto-efectivo").value) || 0;
      monto_transferencia = Number(document.getElementById("mixto-transferencia").value) || 0;
      if (monto_efectivo + monto_transferencia !== total) {
        alert("El efectivo y la transferencia tienen que sumar exactamente el total de la venta.");
        return;
      }
    } else if (medio_pago === "efectivo") {
      monto_efectivo = total;
    } else {
      monto_transferencia = total;
    }
  }

  let ventaId;
  try {
    ventaId = await CG.rpc.registrarVenta({
      cliente_id, registrado_por, es_fiado, medio_pago,
      monto_efectivo, monto_transferencia,
      subtotal: subtotalTotal, descuento_total: descuentoTotal, total, created_at,
      items: lineas.map((l) => ({
        producto_id: l.producto_id, cantidad: l.cantidad, precio_unitario: l.precio_unitario,
        costo_unitario: l.costo_unitario, descuento: l.descuento, subtotal: l.subtotal,
        descontar_stock: !l._esHelado,
      })),
      stock_extra: stockExtra,
      consumibles_ilimitados: consumiblesIlimitados,
    });
  } catch (e) {
    alert(e.message);
    console.error(e);
    return;
  }

  const clienteObj = clientes.find((c) => c.id === cliente_id) || null;
  const datosVenta = { id: ventaId, created_at, total, descuento_total: descuentoTotal, es_fiado, medio_pago };

  cart = {};
  pajitasCart = {};
  heladoCart = [];
  closeModal();
  activeTab = "dashboard";
  await loadAll();
  mostrarVentaConfirmada(datosVenta, lineas, clienteObj);

  } finally {
    procesandoVenta = false;
    if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = "Registrar venta"; btnConfirmar.classList.remove("opacity-60"); }
  }
}

// Pantalla de éxito tras registrar una venta, con botón para mandar el
// comprobante por WhatsApp (al teléfono del cliente si lo tiene guardado,
// o abriendo el selector de contactos de WhatsApp si no).
function mostrarVentaConfirmada(datosVenta, lineasVenta, clienteObj) {
  const itemsRecibo = lineasVenta.map((l) => {
    const p = productos.find((pr) => pr.id === l.producto_id);
    return { cantidad: l.cantidad, nombre: p?.nombre || "", presentacion: p?.presentacion || "", subtotal: l.subtotal };
  });
  window.__ultimoComprobanteTexto = CG.ticketVenta({
    negocio: "CG Dulces",
    venta: { ...datosVenta, cliente_nombre: clienteObj?.nombre },
    items: itemsRecibo,
    pagado: datosVenta.es_fiado ? 0 : datosVenta.total,
    redondeo: redondeoMensajes(),
  });
  window.__ultimoComprobanteTel = clienteObj?.telefono || "";

  showModal(`
    <div class="text-center mb-5">
      <div class="w-14 h-14 rounded-full bg-cg-success/15 flex items-center justify-center mx-auto mb-3">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--cg-success))" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p class="font-display text-[18px] font-semibold text-cg-ink">¡Venta registrada!</p>
      <p class="font-mono-num text-[22px] font-semibold text-cg-success mt-1">${fmt(datosVenta.total)}</p>
    </div>
    <button onclick="enviarUltimoComprobante()" class="w-full bg-cg-whatsapp text-cg-onink font-semibold rounded-xl py-3 mb-2.5 flex items-center justify-center gap-2">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.16c-.24.68-1.19 1.25-1.95 1.41-.52.11-1.2.2-3.48-.75-2.92-1.21-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.43.75-2.13 1.02-2.42.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.15.11.32.02.51-.09.19-.14.31-.27.48-.14.17-.29.37-.41.5-.14.14-.28.29-.12.57.16.28.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.18-.27.36-.22.61-.13.25.09 1.58.75 1.85.88.27.14.45.2.52.32.06.11.06.66-.18 1.34z"/></svg>
      Enviar comprobante por WhatsApp
    </button>
    <button onclick="closeModal()" class="w-full bg-cg-surface text-cg-ink font-semibold rounded-xl py-3">Listo</button>
  `);
}

function enviarUltimoComprobante() {
  CG.abrirWhatsApp(window.__ultimoComprobanteTel || "", window.__ultimoComprobanteTexto || "");
}
