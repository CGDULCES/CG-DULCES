// =====================================================================
// CG DULCES · Edge Function "backup"
// =====================================================================
// Copia de seguridad automática de TODA la base a un archivo JSON en el
// bucket privado "backups". Pensada para correr sola cada día (pg_cron).
//
// Variables de entorno (Supabase → Edge Functions → backup → Secrets):
//   SUPABASE_URL                 (inyectada automáticamente)
//   SUPABASE_SERVICE_ROLE_KEY    (inyectada automáticamente)
//   BACKUP_SECRET                clave que hay que mandar para dispararla
//   BACKUP_RETENTION_DAYS        (opcional, por defecto 30)
//   RESEND_API_KEY + BACKUP_EMAIL (opcional: manda el backup por mail)
//
// Deploy:
//   supabase functions deploy backup --no-verify-jwt
// Programar (SQL editor, ver docs/MIGRATION.md):
//   select cron.schedule('cg-backup-diario','15 5 * * *', $$ ... $$);
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TABLAS = [
  "configuracion", "usuarios_app", "categorias", "proveedores", "clientes",
  "productos", "promociones", "recetas", "caja", "caja_movimientos",
  "ventas", "venta_items", "venta_repartos", "cobros", "compras",
  "compra_items", "perdidas", "helado_rendimientos", "historial",
  "pedidos", "pedido_items", "lotes", "precio_historial",
];

const PAGE = 1000;

Deno.serve(async (req) => {
  // --- Autorización -------------------------------------------------
  const secret = Deno.env.get("BACKUP_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  const given = auth.replace(/^Bearer\s+/i, "") || new URL(req.url).searchParams.get("key") || "";
  if (!secret || given !== secret) {
    return json({ error: "No autorizado" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const started = Date.now();
  const datos: Record<string, unknown[]> = {};
  let filasTotal = 0;

  try {
    for (const t of TABLAS) {
      const filas: unknown[] = [];
      let desde = 0;
      // paginado para tablas grandes (ventas, historial...)
      while (true) {
        const { data, error } = await sb.from(t).select("*").range(desde, desde + PAGE - 1);
        if (error) throw new Error(`${t}: ${error.message}`);
        filas.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
        desde += PAGE;
      }
      datos[t] = filas;
      filasTotal += filas.length;
    }

    const backup = {
      app: "cg-dulces",
      version: 2,
      generado: new Date().toISOString(),
      filas_total: filasTotal,
      datos,
    };
    const cuerpo = new TextEncoder().encode(JSON.stringify(backup, null, 2));

    const ahora = new Date();
    const nombre = `backup-${ahora.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;

    const up = await sb.storage.from("backups").upload(nombre, cuerpo, {
      contentType: "application/json",
      upsert: true,
    });
    if (up.error) throw new Error(`upload: ${up.error.message}`);

    // --- Retención: borrar backups viejos --------------------------
    const dias = Number(Deno.env.get("BACKUP_RETENTION_DAYS") ?? "30");
    const limite = new Date(Date.now() - dias * 864e5);
    const { data: viejos } = await sb.storage.from("backups").list("", { limit: 1000 });
    const aBorrar = (viejos ?? [])
      .filter((f) => f.created_at && new Date(f.created_at) < limite)
      .map((f) => f.name);
    if (aBorrar.length) await sb.storage.from("backups").remove(aBorrar);

    // --- Mail opcional --------------------------------------------
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const mail = Deno.env.get("BACKUP_EMAIL");
    if (resendKey && mail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "CG Dulces <onboarding@resend.dev>",
          to: [mail],
          subject: `Copia de seguridad CG Dulces — ${nombre}`,
          text: `Backup OK.\nFilas: ${filasTotal}\nArchivo: ${nombre}\nTamaño: ${cuerpo.length} bytes`,
          attachments: [{ filename: nombre, content: btoa(String.fromCharCode(...cuerpo)) }],
        }),
      }).catch(() => {});
    }

    await sb.from("backups_log").insert({
      archivo: nombre, bytes: cuerpo.length, filas_total: filasTotal, ok: true,
    });

    return json({ ok: true, archivo: nombre, filas: filasTotal, ms: Date.now() - started });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("backups_log").insert({ archivo: "(fallo)", ok: false, error: msg }).catch(() => {});
    return json({ ok: false, error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
