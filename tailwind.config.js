/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./offline.html",
    "./js/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        marca: {
          DEFAULT: "#6B2D5C",
          tinta: "#241C2E",
          fondo: "#F7F3FA",
          lila: "#EDE7F3",
          verde: "#2F9E7A",
          rojo: "#D64545",
          gris: "#8a7d94",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "serif"],
        "mono-num": ["IBM Plex Mono", "monospace"],
      },
    },
  },
  // La app arma HTML con strings, así que muchas clases son "dinámicas".
  // Si al compilar desaparece alguna, agregala acá:
  safelist: [
    "flex", "hidden", "grid", "screen-hidden",
    { pattern: /(bg|text|border)-\[#[0-9A-Fa-f]{3,8}\]/ },
    { pattern: /grid-cols-(1|2|3|4)/, variants: ["md", "lg"] },
    { pattern: /(opacity)-(30|60)/ },
  ],
  plugins: [],
};
