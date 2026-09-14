/* =====================================================================
 * CG DULCES · Librería compartida (js/lib/util.js)
 * ---------------------------------------------------------------------
 * Se carga ANTES del script principal. Deja todo colgado de window.CG
 * y también exporta como módulo ES.
 *
 *   CG.escapeHtml(txt)          -> string seguro para innerHTML
 *   CG.fmt(n)                   -> "Gs. 12.000"
 *   CG.parseMoney("12.000")     -> 12000
 *   CG.hoyLocal()               -> "2026-09-03" (zona Asunción)
 *   CG.fechaHora(iso)           -> "03/09 14:32"
 *   CG.toCSV(rows)              -> string CSV (rows = array de objetos)
 *   CG.descargarCSV(nombre, rows)
 *   CG.descargarJSON(nombre, obj)
 *   CG.telPY("0981...")         -> "595981..."  (para wa.me)
 *   CG.waLink(tel, mensaje)     -> "https://wa.me/595...?text=..."
 *   CG.abrirWhatsApp(tel, msg)  -> abre la pestaña
 *   CG.ticketVenta({negocio, venta, items, pagado})   -> texto del comprobante
 *   CG.mensajeFiado({negocio, cliente, deuda, ventas})-> texto recordatorio
 *   CG.resumenCierre(cierreRow) -> texto "Cierre Z"
 *   CG.errorRPC(error)          -> mensaje lindo en español para el usuario
 * ===================================================================== */
(function (root) {
  "use strict";

  const TZ = "America/Asuncion";

  // ---- Texto / seguridad --------------------------------------------
  function escapeHtml(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  // Para usar como tag:  el`<p>${nombreCliente}</p>`  -> escapa las interpolaciones
  function el(strings, ...vals) {
    return strings.reduce((out, s, i) =>
      out + s + (i < vals.length ? escapeHtml(vals[i]) : ""), "");
  }

  // ---- Dinero ------------------------------------------------------
  const fmt = (n) => `Gs. ${Math.round(Number(n) || 0).toLocaleString("es-PY")}`;
  const fmtN = (n) => `${Math.round(Number(n) || 0).toLocaleString("es-PY")}`;
  function parseMoney(str) {
    if (typeof str === "number") return str;
    if (!str) return 0;
    const limpio = String(str).replace(/[^\d,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    return Math.round(Number(limpio) || 0);
  }

  // ---- Fechas ----------------------------------------------------
  function hoyLocal() {
    const d = new Date();
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
    return `${p.year}-${p.month}-${p.day}`;
  }
  function fechaHora(iso) {
    return new Date(iso).toLocaleString("es-PY", {
      timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    });
  }
  function fechaCorta(iso) {
    return new Date(iso).toLocaleDateString("es-PY", { timeZone: TZ });
  }

  // ---- CSV / descargas ------------------------------------------
  function toCSV(rows) {
    if (!rows || !rows.length) return "";
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const esc = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    return [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\r\n");
  }
  function _descargar(nombre, contenido, tipo) {
    const blob = new Blob(["﻿" + contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const descargarCSV = (nombre, rows) =>
    _descargar(nombre.endsWith(".csv") ? nombre : nombre + ".csv", toCSV(rows), "text/csv;charset=utf-8");
  const descargarJSON = (nombre, obj) =>
    _descargar(nombre.endsWith(".json") ? nombre : nombre + ".json", JSON.stringify(obj, null, 2), "application/json");

  // ---- WhatsApp -------------------------------------------------
  // Normaliza números paraguayos a formato internacional sin "+"
  function telPY(tel) {
    if (!tel) return "";
    let s = String(tel).replace(/[^\d]/g, "");
    if (s.startsWith("595")) return s;
    if (s.startsWith("0")) return "595" + s.slice(1);
    if (s.length === 9 && s.startsWith("9")) return "595" + s;      // 9xx sin 0
    return s;
  }
  function waLink(tel, mensaje) {
    const t = telPY(tel);
    const txt = encodeURIComponent(mensaje || "");
    return t ? `https://wa.me/${t}?text=${txt}` : `https://wa.me/?text=${txt}`;
  }
  function abrirWhatsApp(tel, mensaje) {
    window.open(waLink(tel, mensaje), "_blank", "noopener");
  }

  // Redondea hacia arriba a la unidad indicada (500 -> 3.333 pasa a 3.500).
  // unidad <= 0 => sin redondear (solo quita decimales). SOLO para mostrar en mensajes.
  function redondearArriba(n, unidad) {
    const u = Number(unidad) || 0;
    return u > 0 ? Math.ceil(Number(n) / u) * u : Math.round(Number(n));
  }

  // ---- Textos de negocio --------------------------------------
  // `redondeo` (opcional): unidad para redondear los importes SOLO en el texto
  // del mensaje. No cambia nada en el sistema.
  function ticketVenta({ negocio = "CG Dulces", venta, items, pagado, redondeo = 0 }) {
    const rr = (n) => redondearArriba(n, redondeo);
    const L = [];
    L.push(`*${negocio}*`);
    L.push(`Comprobante de venta #${venta.id}`);
    L.push(fechaHora(venta.created_at));
    if (venta.cliente_nombre) L.push(`Cliente: ${venta.cliente_nombre}`);
    L.push("--------------------------------");
    let sumaItems = 0;
    for (const it of items) {
      const nom = it.nombre + (it.presentacion ? ` ${it.presentacion}` : "");
      const sub = rr(it.subtotal);
      sumaItems += sub;
      L.push(`${it.cantidad} x ${nom}`);
      L.push(`     ${fmt(sub)}`);
    }
    L.push("--------------------------------");
    const desc = venta.descuento_total > 0 ? rr(venta.descuento_total) : 0;
    if (desc > 0) L.push(`Descuento: -${fmt(desc)}`);
    // El total del mensaje = suma de lo que se muestra (asi siempre cierra).
    const totalMsg = redondeo > 0 ? Math.max(0, sumaItems - desc) : Number(venta.total);
    L.push(`*TOTAL: ${fmt(totalMsg)}*`);
    if (venta.es_fiado) {
      const p = rr(pagado || 0);
      L.push(`Fiado — pagado ${fmt(p)}, debe ${fmt(Math.max(0, totalMsg - p))}`);
    } else {
      L.push(`Pago: ${venta.medio_pago}`);
    }
    L.push("");
    L.push("¡Gracias por tu compra! 🍬");
    return L.join("\n");
  }

  function mensajeFiado({ negocio = "CG Dulces", cliente, deuda, ventas = [], redondeo = 0 }) {
    const rr = (n) => redondearArriba(n, redondeo);
    const lineas = ventas.map((v) => ({ created_at: v.created_at, monto: rr(v.pendiente) }));
    const deudaMsg = redondeo > 0 && lineas.length
      ? lineas.reduce((s, x) => s + x.monto, 0)
      : rr(deuda);
    const L = [];
    L.push(`Hola ${cliente.nombre}, ¿cómo estás? 🙂`);
    L.push(`Te escribo de *${negocio}*.`);
    L.push(`Te paso que tenés un saldo pendiente de *${fmt(deudaMsg)}*.`);
    if (lineas.length) {
      L.push("");
      L.push("Detalle:");
      for (const v of lineas) L.push(`• ${fechaCorta(v.created_at)} — ${fmt(v.monto)}`);
    }
    L.push("");
    L.push("Cualquier cosa me avisás. ¡Gracias! 🍬");
    return L.join("\n");
  }

  function resumenCierre(c) {
    const dif = (n) => (n == null ? "—" : (n === 0 ? "OK" : (n > 0 ? `sobra ${fmt(n)}` : `falta ${fmt(-n)}`)));
    return [
      `*CG Dulces — Cierre de caja*`,
      `Caja #${c.caja_id}`,
      `Abrió: ${fechaHora(c.fecha_apertura)}`,
      c.fecha_cierre ? `Cerró: ${fechaHora(c.fecha_cierre)}` : `(todavía abierta)`,
      `--------------------------------`,
      `Ventas efectivo:     ${fmt(c.ventas_efectivo)}`,
      `Ventas transf/QR:    ${fmt(c.ventas_banco)}`,
      `Cobros de fiado:     ${fmt(Number(c.cobros_efectivo) + Number(c.cobros_banco))}`,
      `Ingresos extra:      ${fmt(c.ingresos_extra)}`,
      `Retiros:            -${fmt(c.retiros)}`,
      `Compras:            -${fmt(c.compras)}`,
      `Nº de ventas:        ${c.nro_ventas}`,
      `--------------------------------`,
      `Efectivo esperado:   ${fmt(c.esperado_efectivo)}`,
      `Banco esperado:      ${fmt(c.esperado_banco)}`,
      c.cierre_efectivo != null ? `Efectivo contado:    ${fmt(c.cierre_efectivo)}  (${dif(c.diferencia_efectivo)})` : ``,
      c.cierre_banco != null ? `Banco contado:       ${fmt(c.cierre_banco)}  (${dif(c.diferencia_banco)})` : ``,
    ].filter(Boolean).join("\n");
  }

  // ---- Errores de las RPC -------------------------------------
  const ERRORES = {
    CAJA_CERRADA: "Primero abrí la caja.",
    CAJA_YA_ABIERTA: "Ya hay una caja abierta.",
    CAJA_NO_ABIERTA: "No hay ninguna caja abierta para cerrar.",
    MIN_2_CLIENTES: "Elegí al menos 2 clientes para dividir la cuenta.",
    MONTOS_NO_COINCIDEN: "Los importes por cliente no coinciden con la cantidad de clientes elegidos.",
    MONTO_INVALIDO: "El monto no es válido.",
    CANTIDAD_INVALIDA: "La cantidad no es válida.",
    VENTA_INEXISTENTE: "Esa venta ya no existe.",
    COBRO_INEXISTENTE: "Ese pago ya no existe (puede que ya lo hayan anulado).",
    PRODUCTO_INEXISTENTE: "Uno de los productos ya no existe.",
  };
  function errorRPC(error) {
    if (!error) return "";
    const msg = error.message || String(error);
    // Los errores propios vienen como "CODIGO: detalle"
    const code = msg.split(":")[0].trim();
    if (ERRORES[code]) return ERRORES[code];
    if (code === "SIN_STOCK") return "No hay stock suficiente: " + msg.replace(/^SIN_STOCK:\s*/, "");
    if (code === "SIN_INSUMO") return msg.replace(/^SIN_INSUMO:\s*/, "");
    if (code === "SIN_EFECTIVO") return "No hay suficiente efectivo en caja.";
    if (code === "SIN_BANCO") return "No hay suficiente saldo en la cuenta bancaria.";
    return "No se pudo completar la operación. " + msg;
  }

  const CG = {
    TZ, escapeHtml, el, fmt, fmtN, parseMoney, redondearArriba,
    hoyLocal, fechaHora, fechaCorta,
    toCSV, descargarCSV, descargarJSON,
    telPY, waLink, abrirWhatsApp,
    ticketVenta, mensajeFiado, resumenCierre, errorRPC,
  };

  root.CG = CG;
  if (typeof module !== "undefined" && module.exports) module.exports = CG;
})(typeof window !== "undefined" ? window : globalThis);
