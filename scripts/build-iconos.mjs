// Genera los iconos del sitio y la imagen de Open Graph, desde los MISMOS SVG de marca que usa la
// web. Nada de esto se dibuja a mano: si `public/brand/` cambia, se vuelve a correr el script y
// todo queda alineado.
//
// POR QUÉ HACE FALTA. Hasta el 2026-08-28 `public/` no tenía un solo icono: ni `favicon.ico`, ni
// PNG, ni `apple-touch-icon`, ni manifiesto. Consecuencias reales, no cosméticas:
//   · Google Search NO muestra favicons en SVG; sin `.ico` o `.png` el resultado sale con el globo
//     genérico. (`build-logo-raster.mjs` ya dejó anotado el mismo problema para Open Graph.)
//   · iOS, al "Añadir a pantalla de inicio", hace una CAPTURA de la página si no hay
//     `apple-touch-icon`. Un pantallazo del hero como icono de app.
//   · WhatsApp —el canal por el que este público comparte el sitio— no renderiza SVG: la
//     previsualización al compartir necesita un PNG de verdad.
//
// QUÉ GENERA
//   favicon.svg            marca reducida sobre navy, para navegadores modernos
//   favicon-16x16.png      pestaña
//   favicon-32x32.png      pestaña en pantallas densas y resultados de Google
//   favicon.ico            16+32+48 en un solo fichero (lo que Google pide de verdad)
//   apple-touch-icon.png   180x180, iOS
//   icon-192.png           manifiesto (Android)
//   icon-512.png           manifiesto (splash de Android)
//   icon-maskable-512.png  manifiesto, `purpose: maskable` (Android recorta el icono a su forma)
//   og-image.png           1200x630, la previsualización al compartir
//
// EL ICONO va sobre fondo navy sólido, no transparente. El isotipo de marca es navy: sobre la
// pestaña en modo oscuro de cualquier navegador desaparecería. Con el fondo, se ve en los dos.
//
// LOS ICONOS los rasteriza sharp (viene con Next, mismo truco de resolución que
// `build-logo-raster.mjs`). La imagen de Open Graph la pinta Chromium vía Playwright —ya es
// dependencia del proyecto por los E2E— porque lleva TEXTO con la tipografía de marca, y la fuente
// variable en woff2 no la carga el renderizador de SVG de sharp.
//
// Uso:  node scripts/build-iconos.mjs

import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const NAVY = '#18202b'
// El azul de marca (#0066fe) como texto sobre navy da 3,38:1. Esta es la variante aclarada que ya
// usa el sitio para ese caso (`--h-blue-claro` en globals.css): misma decisión, mismo valor.
const AZUL = '#3d8bff'
const BLANCO = '#fef9f8'
const SITIO = 'medicosporvenezuela.org'

function resolverSharp() {
  const require = createRequire(import.meta.url)
  try {
    return require('sharp')
  } catch {
    const store = 'node_modules/.pnpm'
    if (!existsSync(store)) return null
    const dir = readdirSync(store).find((d) => d.startsWith('sharp@'))
    if (!dir) return null
    return require(join(process.cwd(), store, dir, 'node_modules/sharp'))
  }
}

const sharp = resolverSharp()
if (!sharp) {
  console.error('No se encontró sharp. Viene con Next; prueba `pnpm install`.')
  process.exit(1)
}

const navegador = await chromium.launch()
const pagina = await navegador.newPage()

// ─── Los dos dibujos del icono ──────────────────────────────────────────────────────────────────
// El isotipo son SIETE estrellas. A 16 px cada una queda por debajo de 4 px y se funden en una
// mancha (comprobado rasterizando). Reducir el dibujo al bajar de tamaño es lo normal en cualquier
// marca compuesta, y aquí la reducción evidente es la estrella central —la mayor del isotipo, la
// que ancla la composición—. La pestaña lleva UNA estrella; iOS y el manifiesto, las siete.
const ISO = readFileSync('public/brand/iso-white.svg', 'utf8')
const TRAZADOS = (ISO.match(/<path[^>]*\/>/g) || []).map((t) => t.replace(/ class="cls-1"/g, ''))
if (!TRAZADOS.length) {
  console.error('No se pudieron extraer los trazados de iso-white.svg')
  process.exit(1)
}

const LIENZO = 512

function lienzo(contenido, radio = 96) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LIENZO} ${LIENZO}">
  <rect width="${LIENZO}" height="${LIENZO}"${radio ? ` rx="${radio}"` : ''} fill="${NAVY}"/>
  ${contenido}
</svg>
`
}

function grupo(escala, x, y, trazados) {
  const t = `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${escala.toFixed(5)})`
  return `<g transform="${t}" fill="${BLANCO}">\n    ${trazados.join('\n    ')}\n  </g>`
}

// La marca completa. El `viewBox` del original es 469 x 383.76: ocupa el 75 % del lienzo y se
// centra, para que respire y no toque los bordes redondeados.
const escalaCompleta = (LIENZO * 0.75) / 469
const marcaCompleta = lienzo(
  grupo(
    escalaCompleta,
    (LIENZO - 469 * escalaCompleta) / 2,
    (LIENZO - 383.76 * escalaCompleta) / 2,
    TRAZADOS
  )
)

// La caja de la estrella central se MIDE, no se estima: el trazado viene del SVG de marca y una
// caja a ojo dejaría el icono descentrado en cuanto el original cambie. Chromium ya está abierto
// para la imagen de Open Graph, así que se le pregunta con `getBBox()`.
const CENTRAL = TRAZADOS[TRAZADOS.length - 1]
const caja = await pagina.evaluate(
  (d) => {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    svg.appendChild(path)
    document.body.appendChild(svg)
    const { x, y, width, height } = path.getBBox()
    return { x, y, width, height }
  },
  CENTRAL.match(/ d="([^"]+)"/)[1]
)

const escalaCentro = (LIENZO * 0.56) / Math.max(caja.width, caja.height)
const marcaReducida = lienzo(
  grupo(
    escalaCentro,
    LIENZO / 2 - (caja.x + caja.width / 2) * escalaCentro,
    LIENZO / 2 - (caja.y + caja.height / 2) * escalaCentro,
    [CENTRAL]
  )
)

// El `favicon.svg` lo pintan los navegadores en la PESTAÑA, o sea a 16-20 px: le toca la reducida.
writeFileSync('public/favicon.svg', marcaReducida)

// Sin esquinas redondeadas donde el sistema ya las pone él: iOS recorta el `apple-touch-icon`, y
// un icono ya redondeado se vería doblemente recortado.
const cuadrado = marcaCompleta.replace(' rx="96"', '')

// La variante `maskable` de Android: el sistema recorta el icono a la forma que use el lanzador
// (círculo, "squircle", gota…) y solo garantiza el 80 % central. La marca al 75 % roza ese límite,
// así que aquí baja al 52 % —y sin redondeo, que lo pone el propio recorte—.
const escalaMaskable = (LIENZO * 0.52) / 469
const maskable = lienzo(
  grupo(
    escalaMaskable,
    (LIENZO - 469 * escalaMaskable) / 2,
    (LIENZO - 383.76 * escalaMaskable) / 2,
    TRAZADOS
  ),
  0
)

function rasterizar(svg, tamano) {
  return sharp(Buffer.from(svg), { density: 384 }).resize(tamano, tamano).png({
    compressionLevel: 9
  })
}

const iconos = [
  [marcaReducida, 16, 'public/favicon-16x16.png'],
  [marcaReducida, 32, 'public/favicon-32x32.png'],
  [cuadrado, 180, 'public/apple-touch-icon.png'],
  [marcaCompleta, 192, 'public/icon-192.png'],
  [marcaCompleta, 512, 'public/icon-512.png'],
  [maskable, 512, 'public/icon-maskable-512.png']
]

for (const [svg, tamano, destino] of iconos) {
  const info = await rasterizar(svg, tamano).toFile(destino)
  console.log(`${destino}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`)
}

// ─── favicon.ico ────────────────────────────────────────────────────────────────────────────────
// sharp no escribe ICO, pero el formato admite entradas codificadas en PNG desde Windows Vista y
// todo lo que hoy lee un `.ico` lo soporta. El contenedor son 6 bytes de cabecera + 16 por entrada,
// así que se arma a mano en vez de meter una dependencia por esto.
//
// Cada medida lleva el dibujo que aguanta: reducida en 16 y 32, completa en 48.
async function construirIco(medidas) {
  const imagenes = await Promise.all(medidas.map(([t, svg]) => rasterizar(svg, t).toBuffer()))

  const cabecera = Buffer.alloc(6)
  cabecera.writeUInt16LE(0, 0) // reservado
  cabecera.writeUInt16LE(1, 2) // 1 = icono
  cabecera.writeUInt16LE(medidas.length, 4)

  let desplazamiento = 6 + 16 * medidas.length
  const entradas = medidas.map(([t], i) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(t >= 256 ? 0 : t, 0) // ancho (0 significa 256)
    e.writeUInt8(t >= 256 ? 0 : t, 1) // alto
    e.writeUInt8(0, 2) // paleta: ninguna
    e.writeUInt8(0, 3) // reservado
    e.writeUInt16LE(1, 4) // planos
    e.writeUInt16LE(32, 6) // bits por píxel
    e.writeUInt32LE(imagenes[i].length, 8)
    e.writeUInt32LE(desplazamiento, 12)
    desplazamiento += imagenes[i].length
    return e
  })

  return Buffer.concat([cabecera, ...entradas, ...imagenes])
}

const ico = await construirIco([
  [16, marcaReducida],
  [32, marcaReducida],
  [48, marcaCompleta]
])
writeFileSync('public/favicon.ico', ico)
console.log(`public/favicon.ico  16+32+48  ${(ico.length / 1024).toFixed(1)} KB`)

// ─── og-image.png ───────────────────────────────────────────────────────────────────────────────
// 1200 x 630 es la medida que piden Facebook, WhatsApp, X y LinkedIn; por debajo de 600 px de ancho
// varios degradan la tarjeta a la miniatura pequeña.
//
// El TEXTO es el titular del hero, palabra por palabra: quien llega desde un enlace compartido
// tiene que reconocer la página que abre. Copy aprobado, no una frase escrita para la imagen.
//
// La fuente va incrustada en base64 en el propio HTML. Con `setContent` no hay un origen desde el
// que resolver `/brand/...`, y una ruta `file://` la bloquea Chromium entre ficheros locales: en
// los dos casos saldría la tipografía por defecto, un fallo silencioso que solo se ve mirando el
// PNG.
const FUENTE = readFileSync('public/brand/nunito-sans-variable.woff2').toString('base64')
const WORDMARK = readFileSync('public/brand/logo-white.svg', 'utf8')

const tarjeta = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Nunito Sans';
    src: url(data:font/woff2;base64,${FUENTE}) format('woff2');
    font-weight: 200 1000;
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column;
    justify-content: space-between; padding: 76px 80px;
    background: ${NAVY};
    /* Un halo azul muy tenue arriba a la derecha: la misma idea de profundidad del hero, sin
       depender de una foto que a este tamaño no se leería. */
    background-image: radial-gradient(900px 520px at 88% -12%, rgba(0, 102, 254, 0.42), transparent 70%);
    font-family: 'Nunito Sans', system-ui, sans-serif;
    color: ${BLANCO};
  }
  .marca svg { width: 300px; height: auto; display: block; }
  h1 { font-size: 62px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; max-width: 19ch; }
  h1 em { font-style: normal; color: ${AZUL}; }
  p { margin-top: 22px; font-size: 27px; line-height: 1.4; font-weight: 400;
      color: rgba(255, 255, 255, 0.8); max-width: 44ch; }
  .pie { display: flex; align-items: center; gap: 14px; font-size: 25px; font-weight: 700;
         color: rgba(255, 255, 255, 0.62); }
  .punto { width: 12px; height: 12px; border-radius: 50%; background: ${AZUL}; }
</style>
<div class="marca">${WORDMARK}</div>
<div>
  <h1>La medicina venezolana <em>no tiene fronteras.</em></h1>
  <p>Orientación médica gratuita, por especialistas verificados, para pacientes y médicos en Venezuela.</p>
</div>
<div class="pie"><span class="punto"></span>${SITIO}</div>
`

await pagina.setViewportSize({ width: 1200, height: 630 })
await pagina.setContent(tarjeta, { waitUntil: 'load' })
await pagina.evaluate(() => document.fonts.ready)
await pagina.screenshot({ path: 'public/og-image.png' })
await navegador.close()

// Los clientes de mensajería tienen tope de peso —WhatsApp descarta las previsualizaciones
// grandes—, así que se recomprime: la captura de Chromium sale sin optimizar.
const TMP = 'public/og-image.png.tmp'
const og = await sharp('public/og-image.png')
  .png({ compressionLevel: 9, palette: true })
  .toFile(TMP)
writeFileSync('public/og-image.png', readFileSync(TMP))
unlinkSync(TMP)
console.log(`public/og-image.png  ${og.width}x${og.height}  ${(og.size / 1024).toFixed(1)} KB`)
