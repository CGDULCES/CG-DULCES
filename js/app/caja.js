/* =====================================================================
 * CG DULCES · Caja: estado, apertura/cierre, movimientos, cobros agrupados y ventas de contado.
 * (archivo: js/app/caja.js)
 * ===================================================================== */

let ocultarMontos = (() => { try { return localStorage.getItem("cg_ocultar_montos") === "1"; } catch { return false; } })();

const montoCaja = (n) => (ocultarMontos ? "••••••" : fmt(n));

const SVG_OJO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

const SVG_OJO_TACHADO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function toggleOcultarMontos() {
  ocultarMontos = !ocultarMontos;
  try { localStorage.setItem("cg_ocultar_montos", ocultarMontos ? "1" : "0"); } catch {}
  document.querySelectorAll("[data-monto-caja]").forEach((el) => {
    el.textContent = ocultarMontos ? "••••••" : el.dataset.montoCaja;
  });
  const btn = document.getElementById("btn-ojo-caja");
  if (btn) {
    btn.innerHTML = ocultarMontos ? SVG_OJO_TACHADO : SVG_OJO;
    btn.setAttribute("aria-label", ocultarMontos ? "Mostrar montos" : "Ocultar montos");
  }
}

function renderEstadoCaja() {
  const deudaGeneral = deudaTotalClientes();
  let html = "";

  if (!cajaActual) {
    html += `
      <div class="bg-cg-ink rounded-2xl p-4 mb-5">
        <p class="text-cg-onink text-[13px] font-semibold mb-1">Caja cerrada</p>
        <p class="text-cg-onink/60 text-[11px] mb-3">Abrila para poder vender, comprar o cobrar.</p>
        <button onclick="abrirCaja()" class="w-full bg-cg-card text-cg-ink text-[13px] font-semibold rounded-xl py-2.5">Abrir caja</button>
      </div>`;
  } else {
    const { efectivo, banco } = saldosCajaActual();
    html += `
      <div class="bg-cg-ink rounded-2xl p-4 mb-5">
        <div class="flex items-center justify-between mb-3">
          <p class="text-cg-onink/60 text-[11px]">Caja abierta desde ${new Date(cajaActual.fecha_apertura).toLocaleDateString("es-PY")}</p>
          <div class="flex items-center gap-3">
            <button id="btn-ojo-caja" onclick="toggleOcultarMontos()" aria-label="${ocultarMontos ? "Mostrar montos" : "Ocultar montos"}" class="text-cg-onink/70">${ocultarMontos ? SVG_OJO_TACHADO : SVG_OJO}</button>
            <button onclick="openCerrarCaja()" class="text-[11px] text-cg-onink/70 underline">Cerrar caja</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="bg-cg-onink/10 rounded-xl p-3">
            <p class="text-cg-onink/60 text-[10px]">Efectivo</p>
            <p data-monto-caja="${fmt(efectivo)}" class="text-cg-onink font-mono-num text-[16px] font-semibold">${montoCaja(efectivo)}</p>
          </div>
          <div class="bg-cg-onink/10 rounded-xl p-3">
            <p class="text-cg-onink/60 text-[10px]">Cuenta bancaria</p>
            <p data-monto-caja="${fmt(banco)}" class="text-cg-onink font-mono-num text-[16px] font-semibold">${montoCaja(banco)}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="openMovimientoCaja('retiro')" class="bg-cg-onink/10 text-cg-onink text-[12px] font-semibold rounded-xl py-2">− Retiro</button>
          <button onclick="openMovimientoCaja('ingreso_extra')" class="bg-cg-onink/10 text-cg-onink text-[12px] font-semibold rounded-xl py-2">+ Ingreso extra</button>
        </div>
      </div>`;
  }

  if (deudaGeneral > 0) {
    html += `
      <button onclick="irA('clientes')" class="w-full flex items-center justify-between bg-cg-danger/10 border border-cg-danger/25 rounded-xl px-4 py-2.5 mb-5">
        <span class="text-[12px] text-cg-danger font-semibold">Hay ${fmt(deudaGeneral)} en fiado pendiente de cobro</span>
        <span class="text-[12px] text-cg-danger font-semibold">Cobrar ›</span>
      </button>`;
  }

  return html;
}

async function verificarPrimeraVez() {
  const { count } = await sb.from("caja").select("*", { count: "exact", head: true });
  if (count === 0) mostrarCapitalInicial();
}

function mostrarCapitalInicial() {
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">¡Bienvenida a CG Dulces!</p>
    <p class="text-[12px] text-cg-muted mb-4">Antes de arrancar, decime con cuánto capital empezás.</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Efectivo</label>
    <input id="capital-efectivo" type="number" value="0" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Cuenta bancaria</label>
    <input id="capital-banco" type="number" value="0" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="crearCajaInicial()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Empezar</button>
  `);
}

async function crearCajaInicial() {
  const apertura_efectivo = Number(document.getElementById("capital-efectivo").value) || 0;
  const apertura_banco = Number(document.getElementById("capital-banco").value) || 0;
  try {
    await CG.rpc.abrirCaja(apertura_efectivo, apertura_banco, ADMIN);
  } catch (e) { alert(e.message); console.error(e); return; }
  closeModal();
  await loadAll();
}

async function abrirCaja() {
  if (procesandoAccion) return;
  if (cajaActual) return; // ya hay una caja abierta, no abrir otra
  procesandoAccion = true;
  try {
    const { count } = await sb.from("caja").select("*", { count: "exact", head: true });
    if (count === 0) { mostrarCapitalInicial(); return; }
    // apertura null => la funcion repone automaticamente lo que quedo al cerrar la ultima caja
    try {
      await CG.rpc.abrirCaja(null, null, ADMIN);
    } catch (e) { alert(e.message); console.error(e); return; }
    await loadAll();
  } finally {
    procesandoAccion = false;
  }
}

async function calcularSaldosCajaFrescos() {
  if (!cajaActual) return { efectivo: 0, banco: 0 };
  const { data: movsFrescos } = await sb.from("caja_movimientos").select("*").eq("caja_id", cajaActual.id);
  let efectivo = Number(cajaActual.apertura_efectivo || 0);
  let banco = Number(cajaActual.apertura_banco || 0);
  (movsFrescos || []).forEach((m) => {
    const monto = Number(m.monto);
    const esIngreso = m.tipo === "venta" || m.tipo === "cobro" || m.tipo === "ingreso_extra";
    const signo = esIngreso ? 1 : -1;
    if (esMedioBanco(m.medio_pago)) banco += signo * monto;
    else efectivo += signo * monto;
  });
  return { efectivo, banco };
}

async function openCerrarCaja() {
  const { efectivo, banco } = await calcularSaldosCajaFrescos();
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">Cerrar caja</p>
    <p class="text-[12px] text-cg-muted mb-4">Según el sistema: ${fmt(efectivo)} en efectivo, ${fmt(banco)} en banco</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Efectivo contado (opcional)</label>
    <input id="caja-cierre-efectivo" type="number" placeholder="${efectivo}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Banco contado (opcional)</label>
    <input id="caja-cierre-banco" type="number" placeholder="${banco}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveCerrarCaja(${efectivo}, ${banco})" class="w-full bg-cg-danger text-cg-onink font-semibold rounded-xl py-3">Cerrar caja</button>
  `);
}

async function saveCerrarCaja(efectivoCalculado, bancoCalculado) {
  if (procesandoAccion) return;
  procesandoAccion = true;
  try {
  const cajaId = cajaActual.id;
  const valorEfectivo = document.getElementById("caja-cierre-efectivo").value;
  const valorBanco = document.getElementById("caja-cierre-banco").value;
  try {
    await CG.rpc.cerrarCaja(
      cajaId,
      valorEfectivo !== "" ? Number(valorEfectivo) : null,
      valorBanco !== "" ? Number(valorBanco) : null,
      ADMIN
    );
  } catch (e) { alert(e.message); console.error(e); return; }
  closeModal();
  await loadAll();
  await mostrarCierreCompartible(cajaId);
  } finally {
    procesandoAccion = false;
  }
}

// Trae el resumen de una caja (v_cierre_caja) y lo muestra con botón para
// compartirlo por WhatsApp (un "cierre Z" listo para mandar).
async function mostrarCierreCompartible(cajaId) {
  const { data, error } = await sb.from("v_cierre_caja").select("*").eq("caja_id", cajaId).maybeSingle();
  if (error || !data) { console.error(error); return; }
  window.__ultimoCierreTexto = CG.resumenCierre(data);
  const chip = (n) => n == null ? "" : (Math.abs(Number(n)) < 1
    ? `<span class="text-cg-success font-semibold">cuadra</span>`
    : (n > 0 ? `<span class="text-cg-warning font-semibold">sobra ${fmt(n)}</span>` : `<span class="text-cg-danger font-semibold">falta ${fmt(-n)}</span>`));
  const fila = (l, v, extra = "") => `<div class="flex justify-between"><span class="text-cg-muted">${l}</span><span class="font-mono-num">${v}${extra}</span></div>`;
  showModal(`
    <div class="text-center mb-4">
      <p class="font-display text-[18px] font-semibold text-cg-ink">${data.estado === "cerrada" ? "Caja cerrada" : "Resumen de caja"}</p>
      <p class="text-[12px] text-cg-muted mt-1">Cierre #${cajaId}</p>
    </div>
    <div class="bg-cg-surface rounded-xl p-3.5 mb-4 space-y-1.5 text-[13px]">
      ${fila("Ventas efectivo", fmt(data.ventas_efectivo))}
      ${fila("Ventas transf/QR", fmt(data.ventas_banco))}
      ${fila("Cobros de fiado", fmt(Number(data.cobros_efectivo) + Number(data.cobros_banco)))}
      ${fila("Ingresos extra", fmt(data.ingresos_extra))}
      ${fila("Retiros", "−" + fmt(data.retiros))}
      ${fila("Compras", "−" + fmt(data.compras))}
      ${fila("Nº de ventas", data.nro_ventas)}
      <div class="border-t border-cg-line/[0.06] my-1"></div>
      ${fila("Efectivo esperado", fmt(data.esperado_efectivo))}
      ${data.cierre_efectivo != null ? fila("Efectivo contado", fmt(data.cierre_efectivo), " · " + chip(data.diferencia_efectivo)) : ""}
      ${fila("Banco esperado", fmt(data.esperado_banco))}
      ${data.cierre_banco != null ? fila("Banco contado", fmt(data.cierre_banco), " · " + chip(data.diferencia_banco)) : ""}
    </div>
    <button onclick="closeModal()" class="w-full bg-cg-surface text-cg-ink font-semibold rounded-xl py-3">Listo</button>
  `);
}

function openMovimientoCaja(tipo) {
  const titulo = tipo === "retiro" ? "Registrar retiro" : "Registrar ingreso extra";
  showModal(`
    <p class="font-display text-[18px] font-semibold text-cg-ink mb-4">${titulo}</p>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Monto</label>
    <input id="mov-caja-monto" type="number" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">¿De dónde?</label>
    <select id="mov-caja-medio" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none">
      <option value="efectivo">Efectivo</option>
      <option value="transferencia">Cuenta bancaria</option>
    </select>
    <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Motivo</label>
    <input id="mov-caja-descripcion" type="text" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-5 outline-none" />
    <button onclick="saveMovimientoCaja('${tipo}')" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar</button>
  `);
}

async function saveMovimientoCaja(tipo) {
  const monto = Number(document.getElementById("mov-caja-monto").value) || 0;
  if (monto <= 0) return;
  const medio_pago = document.getElementById("mov-caja-medio").value;
  const descripcion = document.getElementById("mov-caja-descripcion").value.trim();

  try {
    await CG.rpc.movimientoCaja({ tipo, monto, medio_pago, descripcion, registrado_por: ADMIN });
  } catch (e) { alert(e.message); console.error(e); return; }
  closeModal();
  await loadAll();
}

async function renderCaja(content) {
  content.innerHTML = renderEstadoCaja() + `
    ${sectionLabel("Movimientos de caja")}
    <p class="text-[13px] text-cg-muted">Cargando todo el historial desde la primera caja...</p>
  `;

  // Traer TODAS las cajas que existieron alguna vez, en orden, con sus movimientos
  // (se guarda en memoria hasta la próxima carga/cambio, para no pedir todo en cada visita)
  if (!window.__cacheCaja) {
    const [rc, rm] = await Promise.all([
      sb.from("caja").select("*").order("fecha_apertura", { ascending: true }),
      selectTodo("caja_movimientos", "*", (q) => q.order("fecha", { ascending: true }).order("id")),
    ]);
    if (rc.data && rm.data) window.__cacheCaja = { cajas: rc.data, movs: rm.data };
    else window.__cacheCaja = { cajas: rc.data || [], movs: rm.data || [], parcial: true };
  }
  const todasLasCajas = window.__cacheCaja.cajas;
  const todosLosMovs = window.__cacheCaja.movs;
  if (window.__cacheCaja.parcial) window.__cacheCaja = null;

  if (!todasLasCajas || todasLasCajas.length === 0) {
    content.innerHTML = renderEstadoCaja() + `
      ${sectionLabel("Movimientos de caja")}
      <p class="text-[13px] text-cg-muted">Todavía no se abrió ninguna caja.</p>
    `;
    return;
  }

  const primeraCaja = todasLasCajas[0];
  let corridaEfectivo = Number(primeraCaja.apertura_efectivo || 0);
  let corridaBanco = Number(primeraCaja.apertura_banco || 0);

  const TIPO_LABEL = { venta: "Venta", cobro: "Cobro", ingreso_extra: "Ingreso extra", retiro: "Retiro", compra: "Compra" };

  // Armamos una sola línea de tiempo: apertura de la primera caja, todos sus movimientos,
  // y por cada caja siguiente marcamos dónde se reabrió (debería coincidir con el cierre anterior).
  const cobrosPorId = Object.fromEntries((cobros || []).map((c) => [c.id, c]));
  window.__cajaGrupos = [];
  let bloques = [];
  bloques.push({ tipo: "apertura", fecha: primeraCaja.fecha_apertura, efectivo: primeraCaja.apertura_efectivo, banco: primeraCaja.apertura_banco });

  todasLasCajas.forEach((caja, i) => {
    const movsDeEstaCaja = (todosLosMovs || []).filter((m) => m.caja_id === caja.id).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    // Los cobros hechos en una misma operación se juntan en UNA fila con el total
    const gruposDeCobro = {};
    movsDeEstaCaja.forEach((m) => {
      if (m.tipo !== "cobro") { bloques.push({ tipo: "mov", data: m }); return; }
      const c = cobrosPorId[m.cobro_id];
      const ms = new Date(m.fecha).getTime();
      let g = c?.grupo ? gruposDeCobro[c.grupo] : null;
      if (!g && !c?.grupo && c) {
        // cobros viejos (sin grupo): mismo cliente y medio, uno detrás del otro (≤ 3 s)
        const prev = bloques[bloques.length - 1];
        if (prev && prev.tipo === "cobro_grupo" && !prev.grupo && prev.cliente_id === c.cliente_id && prev.medio === m.medio_pago && ms - prev.ultimoMs <= 3000) g = prev;
      }
      if (!g) {
        g = { tipo: "cobro_grupo", grupo: c?.grupo || null, cliente_id: c?.cliente_id ?? null, medio: m.medio_pago, movs: [], monto: 0, fecha: m.fecha, ultimoMs: ms, partes: [] };
        bloques.push(g);
        if (c?.grupo) gruposDeCobro[c.grupo] = g;
      }
      g.movs.push(m);
      g.monto += Number(m.monto);
      g.fecha = m.fecha;
      g.ultimoMs = ms;
      g.partes.push({ venta_id: m.venta_id, monto: Number(m.monto), descripcion: m.descripcion });
    });
    if (caja.estado === "cerrada") {
      bloques.push({ tipo: "cierre", fecha: caja.fecha_cierre, efectivo: caja.cierre_efectivo, banco: caja.cierre_banco });
      const siguiente = todasLasCajas[i + 1];
      if (siguiente) {
        bloques.push({ tipo: "reapertura", fecha: siguiente.fecha_apertura, efectivo: siguiente.apertura_efectivo, banco: siguiente.apertura_banco, coincide: Number(caja.cierre_efectivo) === Number(siguiente.apertura_efectivo) && Number(caja.cierre_banco) === Number(siguiente.apertura_banco) });
      }
    }
  });

  // Primero calculamos el saldo en orden cronológico (necesario para que la cuenta sea correcta)...
  const bloquesConSaldo = bloques.map((b) => {
    if (b.tipo === "mov") {
      const m = b.data;
      const monto = Number(m.monto);
      const esIngreso = m.tipo === "venta" || m.tipo === "cobro" || m.tipo === "ingreso_extra";
      const signo = esIngreso ? 1 : -1;
      const esBanco = esMedioBanco(m.medio_pago);
      if (esBanco) corridaBanco += signo * monto; else corridaEfectivo += signo * monto;
      return { ...b, signo, esBanco, saldoEfectivo: corridaEfectivo, saldoBanco: corridaBanco };
    }
    if (b.tipo === "cobro_grupo") {
      const esBanco = esMedioBanco(b.medio);
      if (esBanco) corridaBanco += b.monto; else corridaEfectivo += b.monto;
      return { ...b, esBanco, saldoEfectivo: corridaEfectivo, saldoBanco: corridaBanco };
    }
    return b;
  });

  // ...y ahora mostramos la lista con los movimientos más recientes arriba
  const filasHtml = [...bloquesConSaldo].reverse().map((b) => {
    if (b.tipo === "apertura") {
      return `<div class="bg-cg-ink rounded-xl p-3 text-cg-onink text-[12px]"><strong>Capital inicial</strong> · ${new Date(b.fecha).toLocaleDateString("es-PY")} — Efectivo ${fmt(b.efectivo||0)}, Banco ${fmt(b.banco||0)}</div>`;
    }
    if (b.tipo === "cierre") {
      return `<div class="bg-cg-muted/10 rounded-xl p-3 text-[12px] text-cg-ink"><strong>Cierre de caja</strong> · ${new Date(b.fecha).toLocaleDateString("es-PY")} — quedó Efectivo ${fmt(b.efectivo||0)}, Banco ${fmt(b.banco||0)}</div>`;
    }
    if (b.tipo === "reapertura") {
      return `<div class="${b.coincide ? 'bg-cg-success/10' : 'bg-cg-danger/10'} rounded-xl p-3 text-[12px] text-cg-ink"><strong>${b.coincide ? "✓" : "⚠"} Nueva caja abierta</strong> · ${new Date(b.fecha).toLocaleDateString("es-PY")} — con Efectivo ${fmt(b.efectivo||0)}, Banco ${fmt(b.banco||0)}${!b.coincide ? " (no coincide con el cierre anterior)" : ""}</div>`;
    }
    if (b.tipo === "cobro_grupo") {
      const idx = window.__cajaGrupos.push(b) - 1;
      const cli = clientes.find((c) => c.id === b.cliente_id);
      const nVentas = new Set(b.partes.map((p) => p.venta_id).filter(Boolean)).size;
      const fechaPC = new Date(b.fecha).toLocaleString("es-PY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Asuncion"});
      const filaPC = celdasPC(COLS_CAJA, [
        `<span class="text-[12px] text-cg-muted">${fechaPC}</span>`,
        `<span class="text-[13px] font-semibold text-cg-ink">Cobro · ${b.esBanco ? "Banco" : "Efectivo"}</span>`,
        `<span class="text-[12px] text-cg-ink">${cli ? CG.escapeHtml(cli.nombre) : "Cliente"}${nVentas > 0 ? ` · ${nVentas} venta${nVentas>1?"s":""}` : ""} · <span class="text-cg-primary font-semibold">Ver detalle ›</span></span>`,
        `<span class="font-mono-num text-[13px] font-semibold text-cg-success block text-right">+${fmt(b.monto)}</span>`,
        `<span class="font-mono-num text-[12px] text-cg-muted block text-right">${fmt(b.saldoEfectivo)}</span>`,
        `<span class="font-mono-num text-[12px] text-cg-muted block text-right">${fmt(b.saldoBanco)}</span>`,
      ]);
      return `
      <div class="bg-cg-card rounded-xl shadow-sm border border-cg-line/[0.04] overflow-hidden">
        <button type="button" onclick="openCobroGrupo(${idx})" class="w-full text-left p-3 lg:hidden">
          <div class="flex items-center justify-between">
            <span class="text-[12px] font-semibold text-cg-ink">Cobro${cli ? " · " + CG.escapeHtml(cli.nombre) : ""} · ${b.esBanco ? "Banco" : "Efectivo"}</span>
            <span class="font-mono-num text-[12px] font-semibold text-cg-success">+${fmt(b.monto)}</span>
          </div>
          <p class="text-[10px] text-cg-muted">${new Date(b.fecha).toLocaleString("es-PY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Asuncion"})}${nVentas > 0 ? ` · ${nVentas} venta${nVentas>1?"s":""}` : ""} · <span class="text-cg-primary font-semibold">Ver detalle ›</span></p>
          <p class="text-[9px] text-cg-muted mt-0.5">Saldo después: efectivo ${fmt(b.saldoEfectivo)} · banco ${fmt(b.saldoBanco)}</p>
        </button>
        <div onclick="openCobroGrupo(${idx})" role="button" class="hidden lg:block cursor-pointer hover:bg-cg-surface">${filaPC}</div>
      </div>`;
    }
    const m = b.data;
    const monto = Number(m.monto);
    const esVentaTocable = m.tipo === "venta" && m.venta_id;
    const fechaMovPC = new Date(m.fecha).toLocaleString("es-PY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Asuncion"});
    const filaMovPC = celdasPC(COLS_CAJA, [
      `<span class="text-[12px] text-cg-muted">${fechaMovPC}</span>`,
      `<span class="text-[13px] font-semibold text-cg-ink">${TIPO_LABEL[m.tipo] || m.tipo} · ${b.esBanco ? "Banco" : "Efectivo"}</span>`,
      `<span class="text-[12px] text-cg-ink">${CG.escapeHtml(m.descripcion || "—")}${esVentaTocable ? ` · <span class="text-cg-primary font-semibold">Ver detalle ›</span>` : ""}</span>`,
      `<span class="font-mono-num text-[13px] font-semibold block text-right ${b.signo>0?'text-cg-success':'text-cg-danger'}">${b.signo>0?"+":"−"}${fmt(monto)}</span>`,
      `<span class="font-mono-num text-[12px] text-cg-muted block text-right">${fmt(b.saldoEfectivo)}</span>`,
      `<span class="font-mono-num text-[12px] text-cg-muted block text-right">${fmt(b.saldoBanco)}</span>`,
    ]);
    return `
      <div ${esVentaTocable ? `onclick="abrirVentaDeCaja(${m.venta_id}, ${m.caja_id})" role="button"` : ""} class="bg-cg-card rounded-xl p-3 lg:p-0 shadow-sm border border-cg-line/[0.04] ${esVentaTocable ? "cursor-pointer hover:bg-cg-surface" : ""}">
        <div class="lg:hidden">
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-semibold text-cg-ink">${TIPO_LABEL[m.tipo] || m.tipo} · ${b.esBanco ? "Banco" : "Efectivo"}</span>
          <span class="font-mono-num text-[12px] font-semibold ${b.signo>0?'text-cg-success':'text-cg-danger'}">${b.signo>0?"+":"−"}${fmt(monto)}</span>
        </div>
        <p class="text-[10px] text-cg-muted">${new Date(m.fecha).toLocaleString("es-PY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Asuncion"})}${m.descripcion ? " · " + CG.escapeHtml(m.descripcion) : ""}${esVentaTocable ? ` · <span class="text-cg-primary font-semibold">Ver detalle ›</span>` : ""}</p>
        <p class="text-[9px] text-cg-muted mt-0.5">Saldo después: efectivo ${fmt(b.saldoEfectivo)} · banco ${fmt(b.saldoBanco)}</p>
        </div>
        ${filaMovPC}
      </div>`;
  }).join("");

  content.innerHTML = renderEstadoCaja() + `
    ${sectionLabel(`Movimientos de caja (${todasLasCajas.length} caja${todasLasCajas.length>1?'s':''} en total)`)}
    ${encabezadoPC(COLS_CAJA, ["Fecha", "Tipo", "Detalle", ">Monto", ">Saldo efectivo", ">Saldo banco"])}
    <div class="space-y-2 cg-fila-lista">${filasHtml}</div>
  `;
}

// Tarjeta flotante con el detalle de un cobro de la Caja (como "otra pantalla").
// Si el cobro pagó varias ventas, primero se ve la lista y al tocar una se abre su ticket.
async function openCobroGrupo(idx) {
  const g = window.__cajaGrupos?.[idx];
  if (!g) return;
  window.__cobroGrupoActual = g;
  showModal(`<p class="text-[13px] text-cg-muted py-6 text-center">Cargando detalle...</p>`);

  if (!g.ventasDet) {
    const ids = [...new Set(g.partes.map((p) => p.venta_id).filter(Boolean))];
    const mapa = new Map();
    if (ids.length) {
      const { data, error } = await sb
        .from("ventas")
        .select("id, total, created_at, registrado_por, es_fiado, concepto, clientes(nombre), venta_items(cantidad, precio_unitario, subtotal, productos(nombre, presentacion)), venta_repartos(cliente_id, monto)")
        .in("id", ids);
      if (error) {
        console.error(error);
        showModal(`<p class="text-[13px] text-cg-danger py-4 text-center">No se pudo cargar el detalle.</p><button onclick="closeModal()" class="w-full bg-cg-surface text-cg-ink font-semibold rounded-xl py-3">Cerrar</button>`);
        return;
      }
      (data || []).forEach((v) => mapa.set(v.id, v));
    }
    g.ventasDet = mapa;
  }
  const idsVentas = [...new Set(g.partes.map((p) => p.venta_id).filter(Boolean))];
  if (idsVentas.length === 1) renderTicketCobro(idsVentas[0], false);
  else if (idsVentas.length === 0) renderTicketCobro(null, false);
  else renderResumenCobro();
}

const fmtFechaHora = (f) => new Date(f).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Asuncion" });

const campoTicket = (etiqueta, valor) => `<div><p class="text-[10px] text-cg-muted">${etiqueta}</p><p class="text-[13px] font-semibold text-cg-ink break-words">${valor}</p></div>`;

const SVG_TICKET = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--cg-success))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;

// Botón para anular un cobro hecho por error: las deudas vuelven a pendiente y se revierte la caja.
// Solo si el cobro es de la caja abierta (en cajas ya cerradas se corrige desde el cliente).
function botonAnularCobro(g) {
  const puedeEnCajaAbierta = cajaActual && g.movs.every((m) => m.caja_id === cajaActual.id && m.cobro_id);
  if (!puedeEnCajaAbierta) {
    return `<p class="text-[11px] text-cg-muted mb-2 text-center">Este cobro es de una caja ya cerrada. Para corregirlo, andá al cliente → "Ver pagos" → Anular.</p>`;
  }
  return `<button onclick="anularCobroGrupo()" class="w-full bg-cg-danger/10 text-cg-danger font-semibold rounded-xl py-3 mb-2">Anular este cobro (vuelve a pendiente)</button>`;
}

async function anularCobroGrupo() {
  const g = window.__cobroGrupoActual;
  if (!g || procesandoAccion) return;
  const nVentas = new Set(g.partes.map((p) => p.venta_id).filter(Boolean)).size;
  if (!confirm(`¿Anular este cobro de ${fmt(g.monto)}?\n\n${nVentas > 1 ? "Las " + nVentas + " ventas vuelven" : "La venta vuelve"} a quedar pendiente de cobro y el dinero se descuenta de la caja.`)) return;
  procesandoAccion = true;
  try {
    try {
      for (const m of g.movs) await CG.rpc.anularCobro(m.cobro_id, "cobro anulado desde la caja", ADMIN);
    } catch (e) { alert(e.message); console.error(e); }
    closeModal();
    await loadAll();
  } finally {
    procesandoAccion = false;
  }
}

function pagadoEnCobro(g, ventaId) {
  return g.partes.filter((p) => p.venta_id === ventaId).reduce((s, p) => s + p.monto, 0);
}

// Lista de las ventas que se pagaron en este cobro (cuando son varias)
function renderResumenCobro() {
  const g = window.__cobroGrupoActual;
  const cli = clientes.find((c) => c.id === g.cliente_id);
  const ids = [...new Set(g.partes.map((p) => p.venta_id).filter(Boolean))];
  showModal(`
    <div class="flex items-center justify-between mb-1">
      <p class="font-display text-[18px] font-semibold text-cg-ink">Cobro${cli ? " · " + CG.escapeHtml(cli.nombre) : ""}</p>
      <span class="text-[10px] font-semibold bg-cg-success/15 text-cg-success rounded-full px-2.5 py-1 uppercase">Cobrado</span>
    </div>
    <p class="text-[12px] text-cg-muted mb-3">${fmtFechaHora(g.fecha)} · ${g.esBanco ? "Banco" : "Efectivo"}</p>
    <div class="bg-cg-surface rounded-xl p-3 mb-3 flex items-center justify-between">
      <span class="text-[12px] text-cg-muted">Total cobrado (${ids.length} ventas)</span>
      <span class="font-mono-num text-[16px] font-semibold text-cg-success">${fmt(g.monto)}</span>
    </div>
    <p class="text-[10px] font-semibold uppercase tracking-wide text-cg-muted mb-1.5">Tocá una venta para ver su detalle</p>
    <div class="space-y-1.5 mb-4">
      ${ids.map((vid) => {
        const v = g.ventasDet.get(vid);
        return `
        <button type="button" onclick="renderTicketCobro(${vid}, true)" class="w-full text-left bg-cg-card border border-cg-line/[0.06] rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[12px] font-semibold text-cg-ink">Venta #${vid}${v ? " · " + new Date(v.created_at).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", timeZone: "America/Asuncion" }) : ""}</p>
            <p class="text-[11px] text-cg-muted truncate">${v ? CG.escapeHtml(textoVenta(v)) : "(la venta ya no existe)"}</p>
          </div>
          <span class="font-mono-num text-[12px] font-semibold text-cg-success shrink-0">${fmt(pagadoEnCobro(g, vid))} ›</span>
        </button>`;
      }).join("")}
    </div>
    ${botonAnularCobro(g)}
    <button onclick="closeModal()" class="w-full bg-cg-surface text-cg-ink font-semibold rounded-xl py-3">Cerrar</button>
  `);
}

// Ticket de una venta (como la pantalla de detalle de venta)
function renderTicketCobro(ventaId, conVolver) {
  const g = window.__cobroGrupoActual;
  const cli = clientes.find((c) => c.id === g.cliente_id);
  const v = ventaId ? g.ventasDet?.get(ventaId) : null;
  const pagadoAhora = ventaId ? pagadoEnCobro(g, ventaId) : g.monto;
  const cerrar = `<button onclick="closeModal()" class="w-full bg-cg-surface text-cg-ink font-semibold rounded-xl py-3">Cerrar</button>`;

  // Sin venta asociada (pago a cuenta) o venta que ya no existe
  if (!ventaId || !v) {
    showModal(`
      <p class="font-display text-[18px] font-semibold text-cg-ink mb-1">Cobro${cli ? " · " + CG.escapeHtml(cli.nombre) : ""}</p>
      <p class="text-[12px] text-cg-muted mb-3">${fmtFechaHora(g.fecha)} · ${g.esBanco ? "Banco" : "Efectivo"}</p>
      <div class="bg-cg-surface rounded-xl p-3 mb-4 text-[13px] text-cg-ink">
        ${ventaId ? `La venta #${ventaId} ya no existe.` : "Pago a cuenta de la deuda general del cliente. No está asociado a una venta puntual."}
        <p class="font-mono-num font-semibold text-cg-success mt-1">Cobrado ${fmt(pagadoAhora)}</p>
      </div>${conVolver ? `<button onclick="renderResumenCobro()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3 mb-2">‹ Volver al cobro</button>` : ""}${cerrar}`);
    return;
  }

  const reparto = (v.venta_repartos || []).find((r) => r.cliente_id === g.cliente_id);
  const totalReferencia = reparto ? Number(reparto.monto) : Number(v.total);
  const pagadoTotal = (cobros || []).filter((c) => c.venta_id === ventaId && (!reparto || c.cliente_id === g.cliente_id)).reduce((s, c) => s + Number(c.monto), 0);
  const pendiente = Math.max(0, totalReferencia - pagadoTotal);
  const tipo = v.concepto ? "Deuda manual" : reparto ? "Cuenta compartida" : v.es_fiado ? "Crédito" : "Contado";
  const filas = (v.venta_items || []).length
    ? v.venta_items.map((it) => `
      <tr class="border-t border-cg-line/[0.05]">
        <td class="py-1.5 pr-2 text-[12px] text-cg-ink">${CG.escapeHtml(it.productos?.nombre || "")}${it.productos?.presentacion ? ` <span class="text-cg-muted">· ${CG.escapeHtml(it.productos.presentacion)}</span>` : ""}</td>
        <td class="py-1.5 px-1 text-[12px] text-center">${it.cantidad}</td>
        <td class="py-1.5 px-1 text-[12px] text-right font-mono-num">${fmt(it.precio_unitario)}</td>
        <td class="py-1.5 pl-1 text-[12px] text-right font-mono-num font-semibold">${fmt(it.subtotal)}</td>
      </tr>`).join("")
    : `<tr class="border-t border-cg-line/[0.05]"><td colspan="4" class="py-2 text-[12px] text-cg-ink">📝 ${CG.escapeHtml(v.concepto || "Deuda manual")}</td></tr>`;

  showModal(`
    <div class="flex items-center justify-between gap-2 mb-3">
      <div class="flex items-center gap-2 min-w-0">${SVG_TICKET}<p class="font-display text-[18px] font-semibold text-cg-ink">Venta #${v.id}</p></div>
      <span class="text-[10px] font-semibold rounded-full px-2.5 py-1 uppercase ${pendiente <= 0 ? "bg-cg-success/15 text-cg-success" : "bg-cg-warning/15 text-cg-warning"}">${pendiente <= 0 ? "Cobrada" : "Pago parcial"}</span>
    </div>
    <div class="grid grid-cols-2 gap-x-4 gap-y-3 bg-cg-card border border-cg-line/[0.06] rounded-xl p-3 mb-3">
      ${campoTicket("Fecha", fmtFechaHora(v.created_at))}
      ${campoTicket("Cliente", CG.escapeHtml(cli?.nombre || v.clientes?.nombre || "—"))}
      ${campoTicket("Vendedor", CG.escapeHtml(v.registrado_por || "—"))}
      ${campoTicket("Tipo de venta", tipo)}
      ${campoTicket("Cobrado ahora", `<span class="text-cg-success">${fmt(pagadoAhora)}</span> · ${g.esBanco ? "Banco" : "Efectivo"}`)}
      ${campoTicket("Saldo pendiente", fmt(pendiente))}
    </div>
    <div class="bg-cg-card border border-cg-line/[0.06] rounded-xl px-3 py-1 mb-3">
      <table class="w-full">
        <thead><tr class="text-[10px] text-cg-muted uppercase"><th class="text-left font-semibold py-1.5">Producto</th><th class="font-semibold">Cant.</th><th class="text-right font-semibold">Precio</th><th class="text-right font-semibold">Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="flex items-center justify-between border-t border-cg-line/[0.08] py-2">
        <span class="text-[12px] text-cg-muted">${reparto ? "Su parte de la cuenta" : "Total"}</span>
        <span class="font-mono-num text-[14px] font-semibold text-cg-ink">${fmt(totalReferencia)}</span>
      </div>
    </div>
    ${conVolver ? `<button onclick="renderResumenCobro()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3 mb-2">‹ Volver al cobro</button>` : botonAnularCobro(g)}
    ${cerrar}
  `);
}

async function abrirVentaDeCaja(ventaId, cajaId) {
  showModal(`<p class="text-[13px] text-cg-muted py-6 text-center">Cargando detalle...</p>`);
  const { data: v, error } = await sb
    .from("ventas")
    .select("id, total, created_at, registrado_por, es_fiado, medio_pago, monto_efectivo, monto_transferencia, concepto, clientes(nombre), venta_items(cantidad, precio_unitario, subtotal, productos(nombre, presentacion))")
    .eq("id", ventaId).maybeSingle();
  if (error || !v) {
    if (error) console.error(error);
    showModal(`<p class="text-[13px] text-cg-danger py-4 text-center">${error ? "No se pudo cargar el detalle." : "Esa venta ya no existe."}</p><button onclick="closeModal()" class="w-full bg-cg-surface text-cg-ink font-semibold rounded-xl py-3">Cerrar</button>`);
    return;
  }
  const ef = Number(v.monto_efectivo || 0), tr = Number(v.monto_transferencia || 0);
  const pago = v.es_fiado ? "Fiado" : (ef > 0 && tr > 0) ? `Mixto (${fmt(ef)} efectivo + ${fmt(tr)} transferencia)` : tr > 0 ? "Transferencia / QR" : "Efectivo";
  const filas = (v.venta_items || []).length
    ? v.venta_items.map((it) => `
      <tr class="border-t border-cg-line/[0.05]">
        <td class="py-1.5 pr-2 text-[12px] text-cg-ink">${CG.escapeHtml(it.productos?.nombre || "")}${it.productos?.presentacion ? ` <span class="text-cg-muted">· ${CG.escapeHtml(it.productos.presentacion)}</span>` : ""}</td>
        <td class="py-1.5 px-1 text-[12px] text-center">${it.cantidad}</td>
        <td class="py-1.5 px-1 text-[12px] text-right font-mono-num">${fmt(it.precio_unitario)}</td>
        <td class="py-1.5 pl-1 text-[12px] text-right font-mono-num font-semibold">${fmt(it.subtotal)}</td>
      </tr>`).join("")
    : `<tr class="border-t border-cg-line/[0.05]"><td colspan="4" class="py-2 text-[12px] text-cg-ink">📝 ${CG.escapeHtml(v.concepto || "Sin detalle")}</td></tr>`;
  const puedeAnular = cajaActual && Number(cajaId) === cajaActual.id;

  showModal(`
    <div class="flex items-center justify-between gap-2 mb-3">
      <div class="flex items-center gap-2 min-w-0">${SVG_TICKET}<p class="font-display text-[18px] font-semibold text-cg-ink">Venta #${v.id}</p></div>
      <span class="text-[10px] font-semibold rounded-full px-2.5 py-1 uppercase bg-cg-success/15 text-cg-success">${v.es_fiado ? "Fiado" : "Contado"}</span>
    </div>
    <div class="grid grid-cols-2 gap-x-4 gap-y-3 bg-cg-card border border-cg-line/[0.06] rounded-xl p-3 mb-3">
      ${campoTicket("Fecha", fmtFechaHora(v.created_at))}
      ${campoTicket("Cliente", CG.escapeHtml(v.clientes?.nombre || "Mostrador"))}
      ${campoTicket("Vendedor", CG.escapeHtml(v.registrado_por || "—"))}
      ${campoTicket("Forma de pago", pago)}
    </div>
    <div class="bg-cg-card border border-cg-line/[0.06] rounded-xl px-3 py-1 mb-3">
      <table class="w-full">
        <thead><tr class="text-[10px] text-cg-muted uppercase"><th class="text-left font-semibold py-1.5">Producto</th><th class="font-semibold">Cant.</th><th class="text-right font-semibold">Precio</th><th class="text-right font-semibold">Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="flex items-center justify-between border-t border-cg-line/[0.08] py-2">
        <span class="text-[12px] text-cg-muted">Total</span>
        <span class="font-mono-num text-[14px] font-semibold text-cg-ink">${fmt(v.total)}</span>
      </div>
    </div>
    ${puedeAnular
      ? `<button onclick="anularVentaDesdeCaja(${v.id})" class="w-full bg-cg-danger/10 text-cg-danger font-semibold rounded-xl py-3 mb-2">Eliminar esta venta (devuelve stock y caja)</button>`
      : `<p class="text-[11px] text-cg-muted mb-2 text-center">Esta venta es de una caja ya cerrada, no se puede eliminar desde acá.</p>`}
    <button onclick="closeModal()" class="w-full bg-cg-surface text-cg-ink font-semibold rounded-xl py-3">Cerrar</button>
  `);
}

async function anularVentaDesdeCaja(ventaId) {
  if (procesandoAccion) return;
  if (!confirm("¿Eliminar esta venta? Se devuelve el stock y se descuenta el dinero de la caja. No se puede deshacer.")) return;
  procesandoAccion = true;
  try {
    let huboHelado = false;
    try {
      huboHelado = await CG.rpc.anularVenta(ventaId, "eliminada desde la caja", ADMIN);
    } catch (e) { alert(e.message); console.error(e); return; }
    closeModal();
    if (huboHelado) alert("Listo. Ojo: esta venta tenía Helados armados — el dinero ya se revirtió, pero el consumo de bolas/insumos de Helado no se deshace solo. Si hace falta, ajustalo a mano en Inventario.");
    await loadAll();
  } finally {
    procesandoAccion = false;
  }
}
