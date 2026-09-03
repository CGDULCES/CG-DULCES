/* =====================================================================
 * CG DULCES · Configuración central
 * ---------------------------------------------------------------------
 * Único lugar donde vive la conexión a Supabase.
 *
 * ⚠ La "publishable / anon key" es pública por diseño (va en el navegador).
 *   Lo que la protege es Row Level Security (ver supabase/02_security.sql).
 *   Después de aplicar RLS, ROTÁ esta clave en:
 *     Supabase → Project Settings → API → "anon" key → Roll
 *   y pegá la nueva acá abajo.
 *
 * NUNCA pongas acá la "service_role" key.
 * ===================================================================== */
(function (root) {
  "use strict";

  const CONFIG = {
    SUPABASE_URL: "https://amfcmrvksewtqqadiuii.supabase.co",
    SUPABASE_KEY: "sb_publishable_oVCLDcffzu2l2aQxLzcexg_jbzsDaUi",

    // Dominio del "usuario@...local" que usa el login de la app
    LOGIN_DOMAIN: "cgdulces.local",

    // Zona horaria del negocio
    TZ: "America/Asuncion",

    // Nombre por defecto (se puede sobreescribir desde la tabla configuracion)
    NEGOCIO: "CG Dulces",
  };

  // Cliente Supabase compartido (requiere que supabase-js ya esté cargado)
  let sb = null;
  if (root.supabase && typeof root.supabase.createClient === "function") {
    sb = root.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }

  root.CG_CONFIG = CONFIG;
  root.sbClient = sb;
})(typeof window !== "undefined" ? window : globalThis);
