// Genera en PNG los íconos del correo de la campaña de marketing, desde los mismos SVG del diseño.
//
// El diseño (`MPV_correo_psicologos_3.html`, material del equipo que no se versiona) pinta los
// íconos como SVG en línea, y un correo no puede: Gmail, Outlook y Yahoo descartan el SVG (ver
// `build-logo-raster.mjs`). Así que cada uno se rasteriza aquí, con el trazo, el tamaño y los
// colores exactos del diseño, y el correo los enlaza desde `/img/`.
//
// Dos familias, como en el diseño:
//   · Con recuadro (`.feat-rows .ic`): cuadrado de 36 px, radio 10, fondo `--accent-soft`, y el
//     ícono de 18 px en `--accent`. Van dentro de una `.card` (fondo `--card-alt-bg`).
//   · Sueltos (`.feats svg`): ícono de 20 px en `--ink-soft`. Van dentro de `.trust` (fondo
//     `--card-bg`).
//
// Y cada ícono sale en dos versiones:
//   · Aplanada (`icono-*.png`): sin transparencia, como el logotipo. El PNG trae pintados el fondo
//     de su bloque y el recuadro, así que dentro de ese bloque se ve idéntico incluso en Outlook,
//     que no redondea esquinas. Fuera de él (sobre blanco, p. ej.) se ve como un cuadro oscuro.
//   · Sin fondo (`icono-*-sin-fondo.png`): solo el trazo, sobre transparencia, para ponerlo sobre
//     cualquier fondo. El recuadro, si se quiere, lo pinta el HTML: una celda de 36 px con
//     `background-color` y `border-radius`. Ojo con los sueltos sobre blanco: su gris es claro.
//
// Corazón, escudo y persona (del correo de médicos generales, `MPV_correo_medicos_generales_*.html`)
// salen solo sin fondo: son sueltos en `--ink-soft` y llegaron cuando los correos ya iban en claro.
//
// Son archivos distintos, no una sustitución: `/img/**` se cachea una semana, y el proxy de
// imágenes de Gmail guarda su propia copia, así que cambiar el contenido bajo la misma URL seguiría
// mostrando el viejo. Y un correo ya enviado no debe cambiar de aspecto.
//
// Más resolución que la de pantalla, para que no se vean borrosos en pantallas 2x. Las aplanadas,
// al doble de su tamaño (72 y 40 px); las sin fondo, a 72 px, que sirven igual a 18, 20 o 36. En el
// correo se usan con su tamaño real, p. ej.
// `<img src="https://medicosporvenezuela.org/img/icono-buscar.png" width="36" height="36" alt="">`.
//
// Uso:  node scripts/build-iconos-correo.mjs

import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// La paleta del diseño del correo (sus variables CSS).
const ACCENT = '#5B93FF' // --accent
const ACCENT_SOFT = '#1B2A47' // --accent-soft
const INK_SOFT = '#9FB0CB' // --ink-soft
const CARD_BG = '#121B2E' // --card-bg (fondo de `.trust`)
const CARD_ALT_BG = '#101A2C' // --card-alt-bg (fondo de `.card`)

const ESCALA = 2

// Los trazos, copiados tal cual del diseño (viewBox 0 0 24 24, stroke-width 2, extremos redondos).
const TRAZOS = {
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  usuarios:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
    '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  candado:
    '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.2-2.4"/>',
  mensaje:
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21' +
    'l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1' +
    ' 8 8v.5z"/>',
  check:
    '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  corazon:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1' +
    'a5.5 5.5 0 0 0 0-7.8z"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'
}

function icono(trazos, { x, y, lado, color }) {
  return (
    `<svg x="${x}" y="${y}" width="${lado}" height="${lado}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `${trazos}</svg>`
  )
}

// Recuadro de 36 px con el ícono de 18 px centrado, sobre el fondo de la tarjeta.
function conRecuadro(trazos) {
  const lado = 36
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado * ESCALA}" height="${lado * ESCALA}" ` +
    `viewBox="0 0 ${lado} ${lado}">` +
    `<rect width="${lado}" height="${lado}" fill="${CARD_ALT_BG}"/>` +
    `<rect width="${lado}" height="${lado}" rx="10" fill="${ACCENT_SOFT}"/>` +
    icono(trazos, { x: 9, y: 9, lado: 18, color: ACCENT }) +
    '</svg>'
  )
}

// Ícono de 20 px, sin recuadro, sobre el fondo del bloque de confianza.
function suelto(trazos) {
  const lado = 20
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado * ESCALA}" height="${lado * ESCALA}" ` +
    `viewBox="0 0 ${lado} ${lado}">` +
    `<rect width="${lado}" height="${lado}" fill="${CARD_BG}"/>` +
    icono(trazos, { x: 0, y: 0, lado, color: INK_SOFT }) +
    '</svg>'
  )
}

// Solo el trazo, a lienzo completo y con transparencia alrededor.
function sinFondo(trazos, color) {
  const lado = 72
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round">${trazos}</svg>`
  )
}

const SALIDAS = [
  { destino: 'public/img/icono-buscar.png', svg: conRecuadro(TRAZOS.buscar), fondo: CARD_ALT_BG },
  {
    destino: 'public/img/icono-usuarios.png',
    svg: conRecuadro(TRAZOS.usuarios),
    fondo: CARD_ALT_BG
  },
  { destino: 'public/img/icono-candado-abierto.png', svg: suelto(TRAZOS.candado), fondo: CARD_BG },
  { destino: 'public/img/icono-mensaje.png', svg: suelto(TRAZOS.mensaje), fondo: CARD_BG },
  { destino: 'public/img/icono-check.png', svg: suelto(TRAZOS.check), fondo: CARD_BG },
  { destino: 'public/img/icono-buscar-sin-fondo.png', svg: sinFondo(TRAZOS.buscar, ACCENT) },
  { destino: 'public/img/icono-usuarios-sin-fondo.png', svg: sinFondo(TRAZOS.usuarios, ACCENT) },
  {
    destino: 'public/img/icono-candado-abierto-sin-fondo.png',
    svg: sinFondo(TRAZOS.candado, INK_SOFT)
  },
  { destino: 'public/img/icono-mensaje-sin-fondo.png', svg: sinFondo(TRAZOS.mensaje, INK_SOFT) },
  { destino: 'public/img/icono-check-sin-fondo.png', svg: sinFondo(TRAZOS.check, INK_SOFT) },
  { destino: 'public/img/icono-corazon-sin-fondo.png', svg: sinFondo(TRAZOS.corazon, INK_SOFT) },
  { destino: 'public/img/icono-escudo-sin-fondo.png', svg: sinFondo(TRAZOS.escudo, INK_SOFT) },
  { destino: 'public/img/icono-persona-sin-fondo.png', svg: sinFondo(TRAZOS.persona, INK_SOFT) }
]

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

for (const { destino, svg, fondo } of SALIDAS) {
  let imagen = sharp(Buffer.from(svg))
  if (fondo) imagen = imagen.flatten({ background: fondo })
  const info = await imagen.png({ compressionLevel: 9 }).toFile(destino)

  console.log(`${destino}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`)
}
