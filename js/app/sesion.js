/* =====================================================================
 * CG DULCES · Ingreso y salida (login).
 * (archivo: js/app/sesion.js)
 * ===================================================================== */

async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (data.session) showApp(); else showLogin();
}

function showLogin() {
  document.getElementById("login-screen").classList.remove("screen-hidden");
  document.getElementById("app-screen").classList.add("screen-hidden");
}

function showApp() {
  document.getElementById("login-screen").classList.add("screen-hidden");
  document.getElementById("app-screen").classList.remove("screen-hidden");
  loadAll().then(() => { if (typeof verificarPrimeraVez === "function") return verificarPrimeraVez(); });
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const usuario = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const errorMsg = document.getElementById("login-error");
  errorMsg.classList.add("hidden");
  const email = `${usuario}@cgdulces.local`;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { errorMsg.classList.remove("hidden"); return; }
  showApp();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  showLogin();
});
