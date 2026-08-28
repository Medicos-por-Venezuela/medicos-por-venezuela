// Document propio por dos motivos: declarar el idioma de la página y colocar el snippet de
// Google Analytics.
//
// IDIOMA. Sin `lang`, un lector de pantalla lee el español con las reglas fonéticas de su idioma
// por defecto —normalmente inglés— y el resultado es ininteligible. Es un fallo de nivel A de las
// WCAG (3.1.1) y afectaba a TODAS las páginas del sitio, no solo al home: `pnpm exec axe` lo
// marcaba como "serious" en las siete que se auditaron.
//
// Next no genera este fichero por defecto y el proyecto no lo tenía, así que hasta ahora el HTML
// salía como `<html>` a secas.
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
