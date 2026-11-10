/* =====================================================================
 * CG DULCES · Pantalla de inicio (Dashboard) y sus cuentas del día/semana.
 * (archivo: js/app/dashboard.js)
 * ===================================================================== */

function isSameDay(dateStr, ref) {
  return new Date(dateStr).toDateString() === ref.toDateString();
}

// Dinero real de un día puntual: ventas al contado de ese día + cobros de fiado recibidos ese día.
// Lo fiado NO cuenta hasta que se cobra, sin importar cuándo se hizo la venta.
function dineroRealDelDia(fecha) {
  const ventasContado = ventasHistoricas.filter((v) => isSameDay(v.created_at, fecha) && !v.es_fiado);
  let ganancia = ventasContado.reduce((s, v) => s + (v.venta_items || []).reduce((si, it) => si + it.subtotal, 0), 0);
  let gananciaReal = ventasContado.reduce((s, v) => s + (v.venta_items || []).reduce((si, it) => si + (it.subtotal - it.costo_unitario * it.cantidad), 0), 0);

  const cobrosDelDia = cobros.filter((c) => isSameDay(c.created_at, fecha));
  cobrosDelDia.forEach((c) => {
    ganancia += Number(c.monto);
    const venta = ventasHistoricas.find((v) => v.id === c.venta_id);
    if (venta && venta.total > 0) {
      const costoTotal = (venta.venta_items || []).reduce((s, it) => s + it.costo_unitario * it.cantidad, 0);
      const proporcionGanancia = (venta.total - costoTotal) / venta.total;
      gananciaReal += Number(c.monto) * proporcionGanancia;
    } else {
      gananciaReal += Number(c.monto);
    }
  });

  return { ganancia, gananciaReal };
}

function todayStats() {
  return dineroRealDelDia(new Date());
}

function weekTotal() {
  return last7DaysChartData().totals.reduce((s, t) => s + t, 0);
}

function last7DaysChartData() {
  const labels = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const totals = days.map((d) => dineroRealDelDia(d).ganancia);
  const dayLabels = days.map((d) => labels[(d.getDay() + 6) % 7]);
  return { dayLabels, totals };
}

function topProductName() {
  const counts = {};
  ventasHistoricas.forEach((v) => (v.venta_items || []).forEach((it) => {
    const name = it.productos?.nombre || "—";
    counts[name] = (counts[name] || 0) + Number(it.cantidad);
  }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : "—";
}

function renderDashboard(content) {
  const { ganancia, gananciaReal } = todayStats();
  const ventasSemana = weekTotal();
  const lowStock = productos.filter((p) => !p.es_insumo && p.nombre !== "Helado · Bola" && p.nombre !== "Helado · Pote 1/4" && p.stock <= p.stock_minimo);
  const recientes = ventasHistoricas.slice(0, 4);

  content.innerHTML = `
    <div class="space-y-5 cg-dash">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
          <p class="text-[11px] text-cg-muted font-medium mb-1">Ventas de la semana</p>
          <p class="font-mono-num text-[19px] font-semibold text-cg-ink">${fmt(ventasSemana)}</p>
        </div>
        <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
          <p class="text-[11px] text-cg-muted font-medium mb-1">Ganancia de hoy</p>
          <p class="font-mono-num text-[19px] font-semibold text-cg-success">${fmt(ganancia)}</p>
        </div>
        <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
          <p class="text-[11px] text-cg-muted font-medium mb-1">Stock bajo</p>
          <p class="font-mono-num text-[19px] font-semibold text-cg-danger">${lowStock.length} productos</p>
        </div>
        <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
          <p class="text-[11px] text-cg-muted font-medium mb-1">Más vendido</p>
          <p class="text-[13px] font-semibold text-cg-ink leading-tight mt-1.5">${CG.escapeHtml(topProductName())}</p>
        </div>
      </div>

      <div class="bg-cg-success/10 border border-cg-success/25 rounded-xl px-4 py-2.5 flex items-center justify-between">
        <span class="text-[10px] font-semibold text-cg-success uppercase tracking-wide">Ganancia real de hoy (venta − costo)</span>
        <span class="font-mono-num text-[15px] font-bold text-cg-success">${fmt(gananciaReal)}</span>
      </div>

      <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
        ${sectionLabel("Ventas de la semana")}
        <div class="h-[140px]"><canvas id="weekChart"></canvas></div>
      </div>

      ${lowStock.length ? `
      <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
        ${sectionLabel("Necesitan reposición")}
        <div class="space-y-2.5">
          ${lowStock.map((p) => `
            <div class="flex items-center justify-between text-[13px]">
              <span class="text-cg-ink font-medium">${CG.escapeHtml(p.nombre)}${p.presentacion ? " · " + CG.escapeHtml(p.presentacion) : ""}</span>
              <span class="font-mono-num text-cg-danger">${p.stock} u.</span>
            </div>`).join("")}
        </div>
      </div>` : ""}

      <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04]">
        ${sectionLabel("Últimas ventas")}
        <div class="space-y-3">
          ${recientes.length === 0 ? `<p class="text-[13px] text-cg-muted">Todavía no hay ventas registradas.</p>` :
            recientes.map((v) => {
              const pagadoDeEsta = cobros.filter((c) => c.venta_id === v.id).reduce((s, c) => s + Number(c.monto), 0);
              const siguePendiente = v.es_fiado && pagadoDeEsta < Number(v.total);
              return `
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[13px] text-cg-ink truncate">${CG.escapeHtml(textoVenta(v))}</p>
                <p class="text-[11px] text-cg-muted">${new Date(v.created_at).toLocaleTimeString("es-PY",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Asuncion"})} · ${CG.escapeHtml(v.registrado_por || "")}${siguePendiente ? ` · <span class="text-cg-danger font-semibold">Fiado, pendiente</span>` : v.es_fiado ? ` · <span class="text-cg-success font-semibold">Fiado, ya cobrado</span>` : ""}</p>
              </div>
              <span class="font-mono-num text-[13px] font-semibold shrink-0 ${siguePendiente ? "text-cg-muted" : ""}">${fmt(v.total)}</span>
            </div>`;
            }).join("")}
        </div>
        <button onclick="abrirTodasVentas()" class="w-full text-center text-[12px] text-cg-primary font-semibold mt-3 pt-3 border-t border-cg-line/[0.06]">Ver todas las ventas ›</button>
      </div>
    </div>
  `;

  const { dayLabels, totals } = last7DaysChartData();
  const ctx = document.getElementById("weekChart");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels: dayLabels, datasets: [{ data: totals, backgroundColor: cgHex("primary"), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.raw) } } },
      scales: { y: { display: false }, x: { grid: { display: false } } },
    },
  });
}
