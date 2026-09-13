// Genera las versiones de mapa de bits del logotipo, desde los mismos SVG que usa el sitio.
//
// Hace falta porque hay tres sitios donde un SVG no sirve:
//   · El `logo` del `MedicalOrganization` en JSON-LD (`lib/schema.ts`).
//   · La imagen de Open Graph: WhatsApp, Facebook y X NO renderizan SVG, y WhatsApp es el canal
//     por el que este público comparte el sitio.
//   · **El correo.** Gmail (web y móvil), Outlook y Yahoo descartan un `<img>` que apunte a un
//     SVG: el logotipo saldría como imagen rota. Todo correo que mande la API usa el PNG de
//     abajo, no el SVG (ver `src/services/mail_layout.py` en el repo de la API).
//
// Ninguno de los dos se genera con transparencia, y por el mismo motivo en los dos casos: una
// imagen transparente se ve sobre el color que decida quien la muestre. El logotipo navy
// desaparecería sobre el modo oscuro de WhatsApp; el blanco desaparecería sobre el blanco que
// varios clientes de correo ponen detrás. Cada uno se aplana sobre el fondo con el que está
// pensado para verse, así que la imagen se basta sola.
//
// Uso:  node scripts/build-logo-raster.mjs

import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// El navy del banner de los correos. Es el mismo `--h-navy` de `styles/globals.css` y el mismo
// que `mail_layout.NAVY` en la API: el PNG se aplana sobre él para que sus bordes se fundan con
// el fondo de la celda y el banner se lea como una sola pieza.
const NAVY = '#18202b'

const SALIDAS = [
  {
    // JSON-LD y Open Graph: 1000 x 384 es el `viewBox` del original, de sobra para el mínimo de
    // 112 x 112 que pide Google y para cualquier previsualización.
    origen: 'public/brand/logo-navy.svg',
    destino: 'public/img/logo-medicos-por-venezuela.png',
    ancho: 1000,
    fondo: '#ffffff'
  },
  {
    // Banner de los correos. Se muestra a 200 px de ancho; se genera al doble para que no se vea
    // borroso en pantallas de densidad 2x, que es donde se lee casi todo el correo.
    origen: 'public/brand/logo-white.svg',
    destino: 'public/brand/logo-white-email.png',
    ancho: 400,
    fondo: NAVY
  },
  {
    // Cabecera de los correos de la campaña de marketing (Kit). Su franja va en `#14213D`, el azul
    // de las encuestas, y no en el navy del banner de arriba: con aquel PNG se vería un recuadro
    // gris alrededor del logotipo. Se muestra a 130 px de ancho; se genera al doble.
    origen: 'public/brand/logo-white.svg',
    destino: 'public/img/logo-correo-marketing.png',
    ancho: 260,
    fondo: '#14213D'
  }
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

for (const { origen, destino, ancho, fondo } of SALIDAS) {
  const info = await sharp(origen, { density: 300 })
    .resize({ width: ancho })
    .flatten({ background: fondo })
    .png({ compressionLevel: 9 })
    .toFile(destino)

  console.log(`${destino}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`)
}
