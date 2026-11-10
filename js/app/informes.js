/* =====================================================================
 * CG DULCES · Menú Más, productos más vendidos, análisis, reportes y auditoría.
 * (archivo: js/app/informes.js)
 * ===================================================================== */

function renderMasOpciones(content) {
  content.innerHTML = `
    <button onclick="irA('dashboard')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver al Dashboard</button>
    ${sectionLabel("Más opciones")}
    <div class="space-y-3">
      <button onclick="abrirMasVendidos()" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
        <span class="text-[14px] font-semibold text-cg-ink">Productos más vendidos</span><span class="text-cg-muted">›</span>
      </button>
      <button onclick="abrirAnalisis()" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
        <span class="text-[14px] font-semibold text-cg-ink">Análisis del negocio</span><span class="text-cg-muted">›</span>
      </button>
      <button onclick="abrirReportes()" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
        <span class="text-[14px] font-semibold text-cg-ink">Reportes</span><span class="text-cg-muted">›</span>
      </button>
      <button onclick="irAPerdidas()" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
        <span class="text-[14px] font-semibold text-cg-ink">Pérdidas (roturas, vencidos)</span><span class="text-cg-muted">›</span>
      </button>
      <button onclick="irA('promociones')" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
        <span class="text-[14px] font-semibold text-cg-ink">Promociones</span><span class="text-cg-muted">›</span>
      </button>
      <button onclick="irA('categorias')" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
        <span class="text-[14px] font-semibold text-cg-ink">Categorías</span><span class="text-cg-muted">›</span>
      </button>
      <button onclick="irA('auditoria')" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
        <span class="text-[14px] font-semibold text-cg-ink">Auditoría</span><span class="text-cg-muted">›</span>
      </button>
      <button onclick="irA('configuracion')" class="w-full text-left bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] flex items-center justify-between">
        <span class="text-[14px] font-semibold text-cg-ink">Configuración</span><span class="text-cg-muted">›</span>
      </button>
    </div>
  `;
}

window.__masVendidos = null;

async function abrirMasVendidos() {
  activeTab = "masvendidos";
  window.__masVendidos = null;
  render();
  const { data, error } = await sb.rpc("productos_mas_vendidos", { p_limite: 20 });
  if (error) console.error(error);
  window.__masVendidos = error ? [] : (data || []);
  window.__masVendidosError = !!error;
  if (activeTab === "masvendidos") render();
}

function renderMasVendidos(content) {
  const volver = `<button onclick="irA('masopciones')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver</button>`;
  const lista = window.__masVendidos;
  if (lista === null) { content.innerHTML = `${volver}${sectionLabel("Productos más vendidos")}<p class="text-[13px] text-cg-muted">Cargando...</p>`; return; }
  if (window.__masVendidosError) { content.innerHTML = `${volver}${sectionLabel("Productos más vendidos")}<p class="text-[13px] text-cg-danger">No se pudo cargar. Probá de nuevo.</p>`; return; }
  if (lista.length === 0) { content.innerHTML = `${volver}${sectionLabel("Productos más vendidos")}<p class="text-[13px] text-cg-muted">Todavía no hay ventas registradas.</p>`; return; }

  const num = (n) => Number(n).toLocaleString("es-PY", { maximumFractionDigits: 2 });
  content.innerHTML = `
    ${volver}
    ${sectionLabel("Los 20 productos más vendidos")}
    <div class="space-y-2">
      ${lista.map((p, i) => `
        <div class="bg-cg-card rounded-2xl p-3.5 shadow-sm border border-cg-line/[0.04]">
          <div class="flex items-center gap-3">
            <span class="w-8 h-8 rounded-full bg-cg-primary text-cg-onink flex items-center justify-center text-[13px] font-semibold shrink-0">${i + 1}</span>
            <div class="min-w-0 flex-1">
              <p class="text-[13px] font-semibold text-cg-ink leading-tight">${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</p>
              <p class="text-[11px] text-cg-muted mt-1">Últimos 30 días: <strong class="text-cg-ink">${num(p.unidades_30d)}</strong></p>
              <p class="text-[11px] text-cg-muted">Promedio por día: <strong class="text-cg-ink">${num(p.promedio_diario_30d)}</strong></p>
            </div>
            <div class="text-right shrink-0">
              <p class="font-mono-num text-[20px] font-semibold text-cg-primary leading-none">${num(p.unidades_total)}</p>
              <p class="text-[10px] text-cg-muted mt-1">Vendidos</p>
            </div>
          </div>
        </div>`).join("")}
    </div>
  `;
}

window.__analisis = null;

let analisisChartHora = null, analisisChartDia = null;

// Se consulta la base cada vez que se abre y se actualiza sola cada 30 segundos mientras estás en esta pantalla.
async function cargarAnalisis() {
  const [rent, muerto, hora, dia] = await Promise.all([
    sb.from("v_producto_rentabilidad").select("*").order("ganancia_90d", { ascending: false }).limit(10),
    sb.from("v_stock_muerto").select("*").limit(15),
    sb.from("v_ventas_por_hora").select("*"),
    sb.from("v_ventas_por_dia_semana").select("*"),
  ]);
  window.__analisis = { rent: rent.data || [], muerto: muerto.data || [], hora: hora.data || [], dia: dia.data || [], actualizado: new Date() };
  if (activeTab === "analisis") render();
}

async function abrirAnalisis() {
  activeTab = "analisis";
  window.__analisis = null;
  render();
  await cargarAnalisis();
  clearInterval(window.__analisisTimer);
  window.__analisisTimer = setInterval(() => {
    if (activeTab !== "analisis") { clearInterval(window.__analisisTimer); return; }
    cargarAnalisis();
  }, 30000);
}

function renderAnalisis(content) {
  const a = window.__analisis;
  if (!a) { content.innerHTML = `<button onclick="irA('masopciones')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver</button>${sectionLabel("Análisis del negocio")}<p class="text-[13px] text-cg-muted">Cargando...</p>`; return; }

  const filaRent = (r) => `
    <div class="flex items-center justify-between text-[12px] py-1">
      <span class="text-cg-ink truncate pr-2">${CG.escapeHtml(r.nombre)}</span>
      <span class="font-mono-num shrink-0">${fmt(r.ganancia_90d)} <span class="text-cg-muted">(${r.margen_actual_pct ?? "–"}%)</span></span>
    </div>`;
  const filaMuerto = (r) => `
    <div class="flex items-center justify-between text-[12px] py-1">
      <span class="text-cg-ink truncate pr-2">${CG.escapeHtml(r.nombre)}</span>
      <span class="font-mono-num shrink-0 text-cg-danger">${fmt(r.plata_dormida)} <span class="text-cg-muted">${r.dias_sin_vender ?? "—"}d</span></span>
    </div>`;
  content.innerHTML = `
    <button onclick="irA('masopciones')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver</button>
    ${sectionLabel("Análisis del negocio")}
    <div class="flex items-center justify-between mb-3 -mt-1">
      <span class="text-[11px] text-cg-muted">En vivo · actualizado a las ${a.actualizado ? a.actualizado.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Asuncion" }) : "—"}</span>
      <button onclick="cargarAnalisis()" class="text-[11px] text-cg-primary font-semibold">Actualizar ahora</button>
    </div>

    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      ${sectionLabel("Ganancia por producto (últimos 90 días)")}
      ${a.rent.length ? a.rent.map(filaRent).join("") : `<p class="text-[12px] text-cg-muted">Sin datos todavía.</p>`}
    </div>

    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      ${sectionLabel("Stock muerto (no se vende hace 30+ días)")}
      ${a.muerto.length ? a.muerto.map(filaMuerto).join("") : `<p class="text-[12px] text-cg-success">✓ Nada dormido.</p>`}
    </div>

    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      ${sectionLabel("¿A qué hora vendés más?")}
      <div class="h-[140px]"><canvas id="analisisHora"></canvas></div>
    </div>
    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
      ${sectionLabel("¿Qué día vendés más?")}
      <div class="h-[140px]"><canvas id="analisisDia"></canvas></div>
    </div>
  `;

  const optsBar = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) } } }, scales: { y: { display: false }, x: { grid: { display: false } } } };
  const horas = Array.from({ length: 24 }, (_, h) => a.hora.find((x) => x.hora === h)?.total || 0);
  if (analisisChartHora) analisisChartHora.destroy();
  analisisChartHora = new Chart(document.getElementById("analisisHora"), {
    type: "bar",
    data: { labels: Array.from({ length: 24 }, (_, h) => `${h}`), datasets: [{ data: horas, backgroundColor: cgHex("primary"), borderRadius: 4 }] },
    options: optsBar,
  });
  const nomDias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const dias = nomDias.map((_, i) => a.dia.find((x) => x.dia_num === i + 1)?.total || 0);
  if (analisisChartDia) analisisChartDia.destroy();
  analisisChartDia = new Chart(document.getElementById("analisisDia"), {
    type: "bar",
    data: { labels: nomDias, datasets: [{ data: dias, backgroundColor: cgHex("success"), borderRadius: 6 }] },
    options: optsBar,
  });
}

window.__reportesVentas = [];

window.__reportesPeriodo = "mes";

let reportesChartInstance = null;

async function abrirReportes() {
  const { data } = await selectTodo("ventas", "id, total, created_at, venta_items(cantidad, subtotal, costo_unitario, productos(nombre, categoria_id))", (q) => q.order("created_at", { ascending: false }).order("id"));
  window.__reportesVentas = data || [];
  activeTab = "reportes";
  render();
}

function cambiarPeriodoReportes(periodo) {
  window.__reportesPeriodo = periodo;
  render();
}

// Calcula ventas/ganancia/categorías en base a dinero REAL: ventas al contado + cobros de fiado
// recibidos en el período (sin importar cuándo se hizo la venta original). Misma regla que el Dashboard.
function statsCashBasis(ventasR, desde, hasta) {
  const enRango = (fecha) => { const f = new Date(fecha); return f >= desde && f < hasta; };

  const ventasContado = ventasR.filter((v) => !v.es_fiado && enRango(v.created_at));
  const cobrosEnRango = cobros.filter((c) => enRango(c.created_at));

  let totalVentas = ventasContado.reduce((s, v) => s + Number(v.total), 0);
  let totalGanancia = ventasContado.reduce((s, v) => s + (v.venta_items || []).reduce((si, it) => si + (it.subtotal - it.costo_unitario * it.cantidad), 0), 0);

  const porCategoria = {};
  ventasContado.forEach((v) => (v.venta_items || []).forEach((it) => {
    const cat = categorias.find((c) => c.id === it.productos?.categoria_id)?.nombre || "Sin categoría";
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(it.subtotal);
  }));

  cobrosEnRango.forEach((c) => {
    const monto = Number(c.monto);
    totalVentas += monto;
    const venta = ventasR.find((v) => v.id === c.venta_id);
    if (venta && venta.total > 0) {
      const costoTotal = (venta.venta_items || []).reduce((s, it) => s + it.costo_unitario * it.cantidad, 0);
      const ratioGanancia = (venta.total - costoTotal) / venta.total;
      totalGanancia += monto * ratioGanancia;
      (venta.venta_items || []).forEach((it) => {
        const cat = categorias.find((cc) => cc.id === it.productos?.categoria_id)?.nombre || "Sin categoría";
        const parte = (Number(it.subtotal) / venta.total) * monto;
        porCategoria[cat] = (porCategoria[cat] || 0) + parte;
      });
    } else {
      totalGanancia += monto; // venta vieja fuera del rango cargado: se cuenta entero, sin descomponer por categoría
    }
  });

  return { totalVentas, totalGanancia, porCategoria };
}

function renderReportes(content) {
  const ventasR = window.__reportesVentas;
  const ahora = new Date();
  let desde;
  if (window.__reportesPeriodo === "semana") { desde = new Date(); desde.setDate(desde.getDate() - 7); }
  else if (window.__reportesPeriodo === "mes") { desde = new Date(); desde.setMonth(desde.getMonth() - 1); }
  else desde = new Date(2000, 0, 1);
  const hastaAhora = new Date(ahora.getTime() + 1000); // incluye este instante

  const { totalVentas, totalGanancia, porCategoria } = statsCashBasis(ventasR, desde, hastaAhora);
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);

  // Por mes (últimos 6), también en dinero real
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    meses.push(d);
  }
  const totalesPorMes = meses.map((m) => {
    const inicioMes = new Date(m.getFullYear(), m.getMonth(), 1);
    const finMes = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    return statsCashBasis(ventasR, inicioMes, finMes).totalVentas;
  });
  const labelsMeses = meses.map((m) => m.toLocaleDateString("es-PY", { month: "short" }));

  content.innerHTML = `
    <button onclick="irA('masopciones')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver</button>
    ${sectionLabel("Reportes")}
    <p class="text-[11px] text-cg-muted mb-3">Solo cuenta dinero que ya entró (ventas al contado + fiados ya cobrados)</p>

    <div class="flex gap-2 mb-4">
      <button onclick="cambiarPeriodoReportes('semana')" class="flex-1 rounded-xl py-2 text-[12px] font-semibold ${window.__reportesPeriodo==='semana' ? 'bg-cg-primary text-cg-onink' : 'bg-cg-card text-cg-muted border border-cg-line/[0.06]'}">Semana</button>
      <button onclick="cambiarPeriodoReportes('mes')" class="flex-1 rounded-xl py-2 text-[12px] font-semibold ${window.__reportesPeriodo==='mes' ? 'bg-cg-primary text-cg-onink' : 'bg-cg-card text-cg-muted border border-cg-line/[0.06]'}">Último mes</button>
      <button onclick="cambiarPeriodoReportes('todo')" class="flex-1 rounded-xl py-2 text-[12px] font-semibold ${window.__reportesPeriodo==='todo' ? 'bg-cg-primary text-cg-onink' : 'bg-cg-card text-cg-muted border border-cg-line/[0.06]'}">Todo</button>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
        <p class="text-[11px] text-cg-muted font-medium mb-1">Dinero real del período</p>
        <p class="font-mono-num text-[17px] font-semibold text-cg-ink">${fmt(totalVentas)}</p>
      </div>
      <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
        <p class="text-[11px] text-cg-muted font-medium mb-1">Ganancia real del período</p>
        <p class="font-mono-num text-[17px] font-semibold text-cg-success">${fmt(totalGanancia)}</p>
      </div>
    </div>

    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      ${sectionLabel("Dinero real por mes (últimos 6)")}
      <div class="h-[140px]"><canvas id="reportesChart"></canvas></div>
    </div>

    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
      ${sectionLabel("Por categoría (período elegido)")}
      <div class="space-y-2">
        ${categoriasOrdenadas.length === 0 ? `<p class="text-[13px] text-cg-muted">Sin dinero real en este período.</p>` :
          categoriasOrdenadas.map(([cat, monto]) => `
          <div class="flex items-center justify-between text-[13px]">
            <span class="text-cg-ink">${cat}</span>
            <span class="font-mono-num font-semibold">${fmt(monto)}</span>
          </div>`).join("")}
      </div>
    </div>
  `;

  const ctx = document.getElementById("reportesChart");
  if (reportesChartInstance) reportesChartInstance.destroy();
  reportesChartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels: labelsMeses, datasets: [{ data: totalesPorMes, backgroundColor: cgHex("primary"), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) } } },
      scales: { y: { display: false }, x: { grid: { display: false } } },
    },
  });
}

const ICONO_ACCION = { crear: "🟢", editar: "🟡", eliminar: "🔴" };

const NOMBRE_TABLA = {
  productos: "Producto", ventas: "Venta", compras: "Compra", proveedores: "Proveedor",
  clientes: "Cliente", cobros: "Cobro", caja: "Caja", caja_movimientos: "Movimiento de caja",
};

function renderAuditoria(content) {
  content.innerHTML = `
    <button onclick="irA('dashboard')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver al Dashboard</button>
    ${sectionLabel("Auditoría · Todos los movimientos del sistema")}
    <div class="space-y-2">
      ${historial.length === 0 ? `<p class="text-[13px] text-cg-muted">Todavía no hay movimientos registrados.</p>` :
        historial.map((h) => `
        <div class="bg-cg-card rounded-2xl p-3.5 shadow-sm border border-cg-line/[0.04]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[12px] font-semibold text-cg-ink">${ICONO_ACCION[h.accion] || "•"} ${NOMBRE_TABLA[h.tabla] || h.tabla}</span>
            <span class="text-[10px] text-cg-muted">${new Date(h.fecha).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Asuncion" })}</span>
          </div>
          <p class="text-[13px] text-cg-ink">${CG.escapeHtml(h.detalle || "")}</p>
          <p class="text-[11px] text-cg-muted mt-0.5">${CG.escapeHtml(h.usuario || "")}</p>
        </div>`).join("")}
    </div>
  `;
}
