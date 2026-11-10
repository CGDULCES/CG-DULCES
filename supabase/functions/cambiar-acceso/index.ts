// Cambia el usuario y la contraseña de acceso de la persona que tiene la sesión iniciada.
// Hace falta una función en el servidor porque el correo interno (usuario@cgdulces.local)
// no puede recibir mensajes de confirmación, y Supabase exige confirmar los cambios de correo
// cuando se hacen desde el navegador. Esta función confirma el cambio por su cuenta, pero SOLO
// para quien la llama con una sesión válida, y solo sobre su propia cuenta.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "METODO" });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "SIN_SESION" });
    const token = authHeader.slice(7);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error: eu } = await admin.auth.getUser(token);
    if (eu || !data?.user) return json(401, { error: "SIN_SESION" });

    const body = await req.json().catch(() => ({}));
    const usuario = String(body.usuario ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!usuario || !password) return json(400, { error: "FALTAN_CAMPOS" });
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return json(400, { error: "USUARIO_INVALIDO" });
    if (password.length < 6 || password.length > 72) return json(400, { error: "PASSWORD_INVALIDA" });

    const { error } = await admin.auth.admin.updateUserById(data.user.id, {
      email: `${usuario}@cgdulces.local`,
      password,
      email_confirm: true,
    });
    if (error) {
      const yaExiste = /already|registered|exists/i.test(error.message);
      return json(yaExiste ? 409 : 500, { error: yaExiste ? "USUARIO_EXISTE" : "ERROR_AUTH" });
    }
    return json(200, { ok: true, usuario });
  } catch (_e) {
    return json(500, { error: "ERROR" });
  }
});
