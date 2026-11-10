/* CG DULCES · Tema: configuración de Tailwind y colores guardados (se carga antes de dibujar nada). */
// Colores del sistema: cada uno es una variable CSS (--cg-*) que se puede cambiar desde Configuración > Colores.
tailwind.config = { theme: { extend: { colors: { cg: {
  primary: "rgb(var(--cg-primary) / <alpha-value>)", ink: "rgb(var(--cg-ink) / <alpha-value>)",
  muted: "rgb(var(--cg-muted) / <alpha-value>)", surface: "rgb(var(--cg-surface) / <alpha-value>)",
  success: "rgb(var(--cg-success) / <alpha-value>)", danger: "rgb(var(--cg-danger) / <alpha-value>)",
  warning: "rgb(var(--cg-warning) / <alpha-value>)", whatsapp: "rgb(var(--cg-whatsapp) / <alpha-value>)",
  disabled: "rgb(var(--cg-disabled) / <alpha-value>)", card: "rgb(var(--cg-card) / <alpha-value>)",
  onink: "rgb(var(--cg-onink) / <alpha-value>)", line: "rgb(var(--cg-line) / <alpha-value>)",
} } } } };
// Aplica los colores guardados antes de dibujar nada (así no parpadea con los colores de fábrica)
try {
  const p = JSON.parse(localStorage.getItem("cg_paleta") || "{}");
  for (const k in p) if (/^#[0-9a-f]{6}$/i.test(p[k]) && k.indexOf("cat") !== 0) {
    const n = parseInt(p[k].slice(1), 16);
    document.documentElement.style.setProperty("--cg-" + k, ((n >> 16) & 255) + " " + ((n >> 8) & 255) + " " + (n & 255));
  }
} catch (e) {}
