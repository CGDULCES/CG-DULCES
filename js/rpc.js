/* =====================================================================
 * CG DULCES · Envoltorio de las funciones transaccionales
 * ---------------------------------------------------------------------
 * Cada método llama a una RPC de supabase/03_rpc.sql y, si falla,
 * lanza un Error con un mensaje ya traducido (CG.errorRPC).
 *
 * Uso (Fase 2, reemplazando los bloques sueltos de index.html):
 *
 *   try {
 *     const ventaId = await CG.rpc.registrarVenta({
 *       cliente_id, registrado_por, es_fiado, medio_pago,
 *       monto_efectivo, monto_transferencia,
 *       subtotal, descuento_total, total,
 *       items: [ { producto_id, cantidad, precio_unitario,
 *                  costo_unitario, descuento, subtotal } ],
 *       stock_extra: [ { producto_id, cantidad } ],
 *       consumibles_ilimitados: [ { producto_id, cantidad } ],
 *     });
 *   } catch (e) { alert(e.message); }
 * ===================================================================== */
(function (root) {
  "use strict";
  const sb = root.sbClient;
  const traducir = (root.CG && root.CG.errorRPC) || ((e) => (e && e.message) || "Error");

  async function call(fn, args) {
    if (!sb) throw new Error("Sin conexión a la base.");
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(traducir(error));
    return data;
  }

  const rpc = {
    // Caja
    abrirCaja: (efectivo, banco, registrado_por) =>
      call("abrir_caja", { p_apertura_efectivo: efectivo ?? null, p_apertura_banco: banco ?? null, p_registrado_por: registrado_por || "" }),
    cerrarCaja: (cajaId, efectivo, banco, usuario) =>
      call("cerrar_caja", { p_caja_id: cajaId, p_cierre_efectivo: efectivo ?? null, p_cierre_banco: banco ?? null, p_usuario: usuario || "" }),
    movimientoCaja: (payload) => call("registrar_movimiento_caja", { p: payload }),
    saldosCaja: (cajaId) => call("saldos_caja", { p_caja_id: cajaId }),

    // Ventas / cobros
    registrarVenta: (payload) => call("registrar_venta", { p: payload }),
    anularVenta: (ventaId, motivo, usuario) =>
      call("anular_venta", { p_venta_id: ventaId, p_motivo: motivo || "", p_usuario: usuario || "" }),
    registrarCobro: (payload) => call("registrar_cobro", { p: payload }),
    dividirCuenta: (payload) => call("dividir_cuenta", { p: payload }),

    // Compras / stock
    registrarCompra: (payload) => call("registrar_compra", { p: payload }),
    registrarProduccion: (productoId, cantidad, usuario) =>
      call("registrar_produccion", { p_producto_id: productoId, p_cantidad: cantidad, p_usuario: usuario || "" }),
    registrarPerdida: (payload) => call("registrar_perdida", { p: payload }),
  };

  root.CG = root.CG || {};
  root.CG.rpc = rpc;
})(typeof window !== "undefined" ? window : globalThis);
