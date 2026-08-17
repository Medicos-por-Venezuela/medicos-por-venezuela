// Document propio con un único motivo: declarar el idioma de la página.
//
// Sin `lang`, un lector de pantalla lee el español con las reglas fonéticas de su idioma por
// defecto —normalmente inglés— y el resultado es ininteligible. Es un fallo de nivel A de las
// WCAG (3.1.1) y afectaba a TODAS las páginas del sitio, no solo al home: `pnpm exec axe` lo
// marcaba como "serious" en las siete que se auditaron.
//
// Next no genera este fichero por defecto y el proyecto no lo tenía, así que hasta ahora el HTML
// salía como `<html>` a secas.

import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="es">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
