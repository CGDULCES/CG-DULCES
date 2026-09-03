# Sacar las dependencias de CDN

En producción no conviene depender de `cdn.tailwindcss.com` (es un modo de
desarrollo: pesado, sin purga, y si el CDN cae la app se rompe). Lo mismo, en
menor medida, con `jsdelivr` para supabase-js y chart.js.

## 1. Tailwind → CSS compilado

Necesitás Node instalado (una sola vez).

```bash
npm install
npm run build:css      # genera css/app.css (Tailwind + estilos propios, minificado)
```

Luego, en `index.html`:

```diff
- <script src="https://cdn.tailwindcss.com"></script>
- <style> ...los estilos propios... </style>
+ <link rel="stylesheet" href="css/app.css" />
```

Para trabajar con recarga en vivo mientras editás clases:

```bash
npm run watch:css
```

> **Ojo con las clases dinámicas.** La app arma HTML con *strings*, así que
> Tailwind no siempre "ve" todas las clases. Si al compilar desaparece algún
> estilo, agregá la clase (o un patrón) a `safelist` en `tailwind.config.js` y
> volvé a compilar.

### Sin Node

Tailwind también tiene un binario suelto (standalone CLI), sin Node:
<https://github.com/tailwindlabs/tailwindcss/releases> → descargá
`tailwindcss-windows-x64.exe`, ponelo en la carpeta y:

```bash
./tailwindcss-windows-x64.exe -i ./css/input.css -o ./css/app.css --minify
```

## 2. supabase-js y chart.js → copias locales

```bash
npm run vendor         # baja las libs pineadas a vendor/
```

Luego en `index.html`:

```diff
- <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
- <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
+ <script src="vendor/supabase.js"></script>
+ <script src="vendor/chart.umd.js"></script>
```

`vendor/` está en `.gitignore` (son artefactos). Si preferís versionarlas para
que el deploy no necesite el paso `vendor`, sacá esa línea del `.gitignore`.

## 3. Fuentes de Google

`css/app.css` importa las fuentes desde `fonts.googleapis.com`. El Service Worker
las cachea (stale-while-revalidate), así que tras la primera carga funcionan
offline. Si querés cero dependencias externas, descargá los `.woff2` a
`assets/fonts/` y cambiá el `@import` por `@font-face` locales.

## Resultado

Con los pasos 1 y 2, la app carga **sin ninguna petición a CDNs** salvo (opcional)
las fuentes. Bajás el peso, ganás velocidad y dejás de depender de terceros.
