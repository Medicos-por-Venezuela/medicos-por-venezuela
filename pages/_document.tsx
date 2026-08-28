// Document propio por tres motivos: declarar el idioma de la página, colocar los iconos del sitio
// y colocar el snippet de Google Analytics.
//
// IDIOMA. Sin `lang`, un lector de pantalla lee el español con las reglas fonéticas de su idioma
// por defecto —normalmente inglés— y el resultado es ininteligible. Es un fallo de nivel A de las
// WCAG (3.1.1) y afectaba a TODAS las páginas del sitio, no solo al home: `pnpm exec axe` lo
// marcaba como "serious" en las siete que se auditaron.
//
// Next no genera este fichero por defecto y el proyecto no lo tenía, así que hasta ahora el HTML
// salía como `<html>` a secas.
//
// ICONOS. Van aquí, y no en un `<Head>` de página, porque son los mismos en las trece rutas: este
// fichero se renderiza una vez y no se repite en cada navegación del cliente. Lo que sí cambia de
// una página a otra —título, descripción, canónica, Open Graph— vive en `components/Seo.tsx`.
//
// Los ficheros los genera `scripts/build-iconos.mjs` desde los SVG de marca. Se declaran los dos
// formatos a propósito: `favicon.svg` es el que usan los navegadores modernos (escala perfecto),
// pero Google Search NO lee favicons en SVG y sin el `.ico` el resultado de búsqueda sale con el
// globo genérico.
//
// ANALÍTICA. El snippet va aquí, en el HTML, y no con `next/script` desde `_app`, porque lleva su
// propia condición dentro: solo carga `gtag.js` si la página se está sirviendo desde el dominio de
// producción (ver `lib/analytics.ts`). Así, en local o en la previsualización de una rama, el
// navegador NO hace ninguna petición a Google — el guard va antes de crear el <script>, no después
// de haberlo cargado. Con `next/script` habría que decidirlo en el render, y en el render del
// servidor no existe `location`.

import { Head, Html, Main, NextScript } from 'next/document'
import { SNIPPET_GA } from '../lib/analytics'

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        {/* Sin esto, iOS usa una CAPTURA de la página como icono al "Añadir a pantalla de inicio". */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* El mismo navy de la barra fija (`--h-navy`): en Android la barra del navegador se pinta
            de este color y la pantalla no se parte en dos tonos al hacer scroll arriba del todo. */}
        <meta name="theme-color" content="#18202b" />

        {/* `dangerouslySetInnerHTML` es la forma de poner un script inline en `_document`; el
            contenido es una constante del propio repo, no entra nada del usuario. */}
        <script dangerouslySetInnerHTML={{ __html: SNIPPET_GA }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
