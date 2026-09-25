import { Head, Html, Main, NextScript } from 'next/document'
import { SNIPPET_GA, SNIPPET_META } from '../lib/analytics'

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link
          rel="preload"
          href="/brand/nunito-sans-variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

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
        <script dangerouslySetInnerHTML={{ __html: SNIPPET_META }} />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=936164072301259&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
