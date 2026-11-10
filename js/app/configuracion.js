/* =====================================================================
 * CG DULCES · Configuración: nombre, logo, seguridad, copia de seguridad y colores.
 * (archivo: js/app/configuracion.js)
 * ===================================================================== */

async function renderConfiguracion(content) {
  const { data: config } = await sb.from("configuracion").select("*");
  const cfg = Object.fromEntries((config || []).map((c) => [c.clave, c.valor]));
  const nombreNegocio = cfg.nombre_negocio || "CG Dulces";
  const logo = (cfg.logo_negocio && cfg.logo_negocio.startsWith("data:image/")) ? cfg.logo_negocio : "assets/logo-mark.png";
  let personalizada = {};
  try { personalizada = cfg.paleta ? JSON.parse(cfg.paleta) : {}; } catch {}
  window.__paletaEdit = { ...PALETA_DEFECTO, ...personalizada };
  window.__logoPendiente = null; // el logo solo cambia cuando tocás Guardar

  const filaColor = ([clave, nombre, donde]) => `
    <div class="flex items-center gap-3 py-2 border-t border-cg-line/[0.06] first:border-t-0">
      <input type="color" id="color-${clave}" value="${window.__paletaEdit[clave]}" oninput="cambiarColorPaleta('${clave}', this.value)" class="w-11 h-11 rounded-lg border border-cg-line/10 bg-transparent p-0.5 shrink-0 cursor-pointer" aria-label="${nombre}" />
      <div class="min-w-0 flex-1">
        <p class="text-[13px] font-semibold text-cg-ink leading-tight">${nombre}</p>
        ${donde ? `<p class="text-[11px] text-cg-muted leading-tight">${donde}</p>` : ""}
      </div>
      <span id="color-hex-${clave}" class="font-mono-num text-[11px] text-cg-muted shrink-0">${window.__paletaEdit[clave].toUpperCase()}</span>
    </div>`;

  content.innerHTML = `
    <button onclick="irA('masopciones')" class="text-[12px] text-cg-primary font-medium mb-3">‹ Volver</button>
    ${sectionLabel("Configuración")}

    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      <div class="flex items-end gap-3 mb-3">
        <div class="flex-1 min-w-0">
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Nombre del negocio</label>
          <input id="config-nombre" type="text" value="${CG.escapeHtml(nombreNegocio)}" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 outline-none" />
        </div>
        <div class="shrink-0 text-center">
          <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted block">Logo</label>
          <label class="mt-1 w-[46px] h-[46px] rounded-xl bg-cg-surface flex items-center justify-center overflow-hidden cursor-pointer">
            <img id="config-logo-preview" src="${logo}" alt="Logo" class="w-full h-full object-contain" />
            <input type="file" accept="image/*" class="hidden" onchange="cambiarLogoNegocio(this.files[0])" />
          </label>
        </div>
      </div>
      <p id="config-logo-aviso" class="text-[11px] text-cg-muted mb-1">Tocá el logo para elegir otra imagen. Se cambia recién cuando tocás <strong>Guardar</strong>.</p>
      <button type="button" onclick="usarLogoOriginal()" class="text-[11px] text-cg-primary font-semibold mb-3">Volver al logo original</button>
      <button onclick="guardarConfiguracion()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3">Guardar</button>
    </div>

    ${sectionLabel("Seguridad")}
    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      <p class="text-[12px] text-cg-muted mb-3">Para cambiar cómo entrás a la app tenés que completar <strong>los dos campos</strong>. Si falta uno, no se cambia nada.</p>
      <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Usuario nuevo</label>
      <input id="config-usuario-nuevo" type="text" autocomplete="off" autocapitalize="none" placeholder="Ej: guada" oninput="revisarCamposAcceso()" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-3 outline-none" />
      <label class="text-[11px] font-semibold uppercase tracking-wide text-cg-muted">Contraseña nueva</label>
      <input id="config-password-nueva" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" oninput="revisarCamposAcceso()" class="w-full bg-cg-surface rounded-xl px-3 py-2.5 text-[14px] mt-1 mb-2 outline-none" />
      <label class="flex items-center gap-2 mb-3 text-[12px] text-cg-muted"><input type="checkbox" onchange="document.getElementById('config-password-nueva').type = this.checked ? 'text' : 'password'" class="w-4 h-4" /> Mostrar la contraseña (para revisar que la escribiste bien)</label>
      <button id="btn-cambiar-acceso" onclick="cambiarAcceso()" disabled class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3 opacity-40">Cambiar usuario y contraseña</button>
      <p id="config-acceso-aviso" class="text-[11px] text-cg-muted mt-2">Completá usuario y contraseña para poder cambiar.</p>
    </div>

    ${sectionLabel("Copia de seguridad")}
    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      <p class="text-[11px] text-cg-muted mb-3">Descarga un archivo con todos tus datos (productos, ventas, compras, clientes, etc.) por si alguna vez necesitás recuperar algo. Guardalo en tu celular o compu de vez en cuando.</p>
      <button id="btn-backup" onclick="descargarBackup()" class="w-full bg-cg-ink text-cg-onink font-semibold rounded-xl py-3">Descargar copia de seguridad</button>
    </div>

    ${sectionLabel("Colores")}
    <div class="bg-cg-card rounded-2xl p-4 shadow-sm border border-cg-line/[0.04] mb-4">
      <p class="text-[12px] text-cg-muted mb-2">Tocá un color para cambiarlo: la app lo muestra al instante. Cuando te guste, tocá <strong>Guardar colores</strong> para que se aplique en todos tus dispositivos.</p>
      <div>${PALETA_ETIQUETAS.map(filaColor).join("")}</div>
      <button onclick="guardarPaleta()" class="w-full bg-cg-primary text-cg-onink font-semibold rounded-xl py-3 mt-3">Guardar colores</button>
      <button onclick="restaurarPaleta()" class="w-full bg-cg-surface text-cg-ink font-semibold rounded-xl py-3 mt-2">Volver a los colores originales</button>
    </div>
  `;
}

async function descargarBackup() {
  const btn = document.getElementById("btn-backup");
  btn.textContent = "Preparando...";
  btn.disabled = true;
  try {
    const tablas = ["productos", "categorias", "clientes", "proveedores", "promociones", "ventas", "venta_items", "cobros", "compras", "compra_items", "caja", "caja_movimientos", "historial", "usuarios_app", "venta_repartos", "helado_rendimientos", "perdidas", "recetas", "configuracion"];
    const backup = { fecha: new Date().toISOString(), datos: {} };
    for (const t of tablas) {
      const { data, error } = await selectTodo(t, "*", (q) => q.order(t === "configuracion" ? "clave" : "id"));
      if (error) throw new Error(`No se pudo leer ${t}`);
      backup.datos[t] = data || [];
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-cgdulces-${fechaLocalHoy()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("No se pudo generar la copia. Probá de nuevo.");
    console.error(e);
  } finally {
    btn.textContent = "Descargar copia de seguridad";
    btn.disabled = false;
  }
}

// ---- Colores ----
function cambiarColorPaleta(clave, valor) {
  window.__paletaEdit[clave] = valor;
  const etiqueta = document.getElementById(`color-hex-${clave}`);
  if (etiqueta) etiqueta.textContent = valor.toUpperCase();
  aplicarPaleta(window.__paletaEdit); // se ve al instante (todavía sin guardar)
}

async function guardarPaleta() {
  const cambios = {};
  Object.keys(PALETA_DEFECTO).forEach((k) => { if ((window.__paletaEdit[k] || "").toUpperCase() !== PALETA_DEFECTO[k].toUpperCase()) cambios[k] = window.__paletaEdit[k]; });
  const { error } = await sb.from("configuracion").upsert([{ clave: "paleta", valor: JSON.stringify(cambios) }]);
  if (error) { alert("No se pudieron guardar los colores."); console.error(error); return; }
  await registrarHistorial("configuracion", null, "editar", "Colores del sistema actualizados");
  await loadConfiguracion();
  alert("Colores guardados. Se van a ver en todos tus dispositivos.");
}

async function restaurarPaleta() {
  if (!confirm("¿Volver a los colores originales?")) return;
  const { error } = await sb.from("configuracion").upsert([{ clave: "paleta", valor: "{}" }]);
  if (error) { alert("No se pudo restaurar."); console.error(error); return; }
  await loadConfiguracion();
  render();
}

// ---- Logo y nombre ----
// Elegir una imagen solo la muestra de prueba; se guarda recién con el botón Guardar.
async function cambiarLogoNegocio(archivo) {
  if (!archivo) return;
  if (!archivo.type.startsWith("image/")) { alert("Elegí una imagen."); return; }
  try {
    const url = await new Promise((ok, mal) => {
      const lector = new FileReader();
      lector.onerror = () => mal(new Error("lectura"));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => mal(new Error("imagen"));
        img.onload = () => {
          const max = 256, k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL("image/png"));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
    window.__logoPendiente = url;
    const prev = document.getElementById("config-logo-preview"); if (prev) prev.src = url;
    const av = document.getElementById("config-logo-aviso"); if (av) av.innerHTML = "Logo nuevo elegido. Tocá <strong>Guardar</strong> para aplicarlo.";
  } catch (e) { alert("No se pudo leer la imagen. Probá con otra."); console.error(e); }
}

function usarLogoOriginal() {
  window.__logoPendiente = "ORIGINAL";
  const prev = document.getElementById("config-logo-preview"); if (prev) prev.src = "assets/logo-mark.png";
  const av = document.getElementById("config-logo-aviso"); if (av) av.innerHTML = "Se va a usar el logo original. Tocá <strong>Guardar</strong> para aplicarlo.";
}

async function guardarConfiguracion() {
  const valor = document.getElementById("config-nombre").value.trim();
  if (!valor) { alert("Poné el nombre del negocio."); return; }
  const { error } = await sb.from("configuracion").upsert([{ clave: "nombre_negocio", valor }]);
  if (error) { alert("No se pudo guardar."); console.error(error); return; }
  let detalle = `Nombre del negocio: ${valor}`;
  const pend = window.__logoPendiente;
  if (pend) {
    const r = pend === "ORIGINAL"
      ? await sb.from("configuracion").delete().eq("clave", "logo_negocio")
      : await sb.from("configuracion").upsert([{ clave: "logo_negocio", valor: pend }]);
    if (r.error) { alert("El nombre se guardó, pero no se pudo cambiar el logo."); console.error(r.error); }
    else { detalle += pend === "ORIGINAL" ? " · logo original" : " · logo nuevo"; window.__logoPendiente = null; }
  }
  await registrarHistorial("configuracion", null, "editar", detalle);
  await loadConfiguracion();
  alert("Guardado.");
}

// ---- Seguridad: usuario y contraseña (los dos campos son obligatorios) ----
function revisarCamposAcceso() {
  const u = document.getElementById("config-usuario-nuevo")?.value.trim() || "";
  const p = document.getElementById("config-password-nueva")?.value || "";
  const btn = document.getElementById("btn-cambiar-acceso");
  const aviso = document.getElementById("config-acceso-aviso");
  const listo = u.length > 0 && p.length > 0;
  if (btn) { btn.disabled = !listo; btn.classList.toggle("opacity-40", !listo); }
  if (aviso) aviso.textContent = listo ? "Listo para cambiar." : (u || p) ? "Falta completar el otro campo." : "Completá usuario y contraseña para poder cambiar.";
}

async function cambiarAcceso() {
  const usuario = document.getElementById("config-usuario-nuevo").value.trim().toLowerCase();
  const pass = document.getElementById("config-password-nueva").value;
  if (!usuario || !pass) { alert("Tenés que completar los 2 campos: usuario nuevo y contraseña nueva."); return; }
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) { alert("El usuario tiene que tener entre 3 y 30 letras o números, sin espacios ni acentos (podés usar . _ -)."); return; }
  if (pass.length < 6) { alert("La contraseña tiene que tener al menos 6 caracteres."); return; }
  if (!confirm(`Desde ahora vas a entrar con el usuario "${usuario}" y la contraseña que escribiste. Anotala bien: al terminar se cierra la sesión y tenés que entrar con los datos nuevos. ¿Cambiar?`)) return;
  const btn = document.getElementById("btn-cambiar-acceso");
  if (btn) { btn.disabled = true; btn.textContent = "Cambiando..."; }
  try {
    const { data, error } = await sb.functions.invoke("cambiar-acceso", { body: { usuario, password: pass } });
    let codigo = data?.error;
    if (error && !codigo) { try { codigo = (await error.context.json()).error; } catch { codigo = "ERROR"; } }
    if (codigo || !data?.ok) {
      const textos = {
        USUARIO_EXISTE: "Ese usuario ya existe. Elegí otro.",
        USUARIO_INVALIDO: "El usuario no es válido (3 a 30 letras o números, sin espacios ni acentos).",
        PASSWORD_INVALIDA: "La contraseña no es válida (mínimo 6 caracteres).",
        SIN_SESION: "Se venció la sesión. Salí, volvé a entrar y probá de nuevo.",
      };
      alert((textos[codigo] || "No se pudo cambiar el acceso.") + " No se cambió nada.");
      console.error("cambiar-acceso:", codigo, error);
      return;
    }
    await registrarHistorial("configuracion", null, "editar", "Usuario y contraseña de acceso cambiados");
    alert(`Listo. Desde ahora entrás con el usuario "${usuario}" y la contraseña nueva. Se va a cerrar la sesión para que entres con los datos nuevos.`);
    await sb.auth.signOut();
    showLogin();
    const campoUsuario = document.getElementById("login-email"); if (campoUsuario) campoUsuario.value = usuario;
  } finally {
    if (btn) { btn.textContent = "Cambiar usuario y contraseña"; }
    revisarCamposAcceso();
  }
}
