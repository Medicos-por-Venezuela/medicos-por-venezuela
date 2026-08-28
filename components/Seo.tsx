// Las etiquetas `<head>` que cambian de una página a otra: título, descripción, canónica y las
// tarjetas de Open Graph y X/Twitter. Las que NO cambian nunca —iconos, manifiesto, `theme-color`—
// viven en `pages/_document.tsx`, que se renderiza una sola vez.
//
// POR QUÉ EXISTE. Hasta ahora cada página ponía su `<title>` a mano y nada más. El resultado, en
// una auditoría del 2026-08-28 sobre el dominio de producción: 24/100 en Open Graph. Sin
// `og:image`, al compartir el enlace por WhatsApp —el canal por el que este público lo comparte—
// salía un rectángulo gris. Sin `canonical`, `medicosporvenezuela.org` y `www.` y `?utm_source=…`
// eran tres páginas distintas para Google.
//
// Un componente y no trece copias del mismo bloque: era exactamente así como el sitio acabó con
// trece títulos y cero descripciones.
//
// LO QUE NO ESTÁ, y por qué:
//   · `twitter:site` — la organización publica en Instagram (`MARCA.instagram`), no en X. Poner
//     una cuenta que no existe atribuiría el contenido a un tercero.
//   · `keywords` — Google la ignora desde 2009.
//   · `article:*` — no hay artículos todavía; la sección de Blog del home enlaza fuera.

import Head from 'next/head'
import { SITIO } from '../lib/schema'

// 1200x630, generada por `scripts/build-iconos.mjs` desde los SVG de marca.
const IMAGEN = '/og-image.png'
const IMAGEN_ALT =
  'Médicos por Venezuela: la medicina venezolana no tiene fronteras. Orientación médica gratuita ' +
  'por especialistas verificados.'

type Props = {
  /** El `<title>` completo, tal cual. 50-60 caracteres: por encima, X y Google lo cortan. */
  titulo: string
  /** 120-160 caracteres. Por debajo de 110 se desaprovecha el espacio del resultado de búsqueda. */
  descripcion: string
  /**
   * Ruta absoluta desde la raíz (`/`, `/quienes-somos`), SIN query. De aquí salen la canónica y
   * `og:url`. Que no lleve query es el punto: `/registro-paciente?especialidad=psicologia` y
   * `/registro-paciente` son la misma página, y la canónica es la que lo declara.
   */
  ruta: string
  /** Páginas privadas o de tránsito (login, panel, callback): fuera del índice. */
  noindex?: boolean
}

export default function Seo({ titulo, descripcion, ruta, noindex = false }: Props) {
  const url = `${SITIO}${ruta}`
  const imagen = `${SITIO}${IMAGEN}`

  return (
    <Head>
      <title>{titulo}</title>
      <meta name="description" content={descripcion} />

      {/* En las privadas no se declara canónica: sería pedirle a Google que indexe la que
          precisamente se le está diciendo que no indexe. */}
      {noindex ? <meta name="robots" content="noindex" /> : <link rel="canonical" href={url} />}

      {/* Open Graph — Facebook, WhatsApp, LinkedIn, Telegram. */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Médicos por Venezuela" />
      <meta property="og:locale" content="es_VE" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={titulo} />
      <meta property="og:description" content={descripcion} />
      <meta property="og:image" content={imagen} />
      {/* Las medidas van declaradas para que el cliente reserve el hueco antes de descargar la
          imagen; sin ellas, la primera vez que se comparte el enlace la tarjeta sale sin foto. */}
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={IMAGEN_ALT} />

      {/* X/Twitter. `summary_large_image` es la tarjeta grande; sin esta etiqueta, X degrada el
          enlace a una línea de texto aunque la imagen exista. */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={titulo} />
      <meta name="twitter:description" content={descripcion} />
      <meta name="twitter:image" content={imagen} />
      <meta name="twitter:image:alt" content={IMAGEN_ALT} />
    </Head>
  )
}
