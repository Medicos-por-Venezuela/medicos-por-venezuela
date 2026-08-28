// Genera la versión de mapa de bits del logotipo, desde el mismo SVG que usa el sitio.
//
// Hace falta porque hay dos sitios donde un SVG no sirve:
//   · El `logo` del `MedicalOrganization` en JSON-LD (`lib/schema.ts`).
//   · La imagen de Open Graph, cuando se implemente: WhatsApp, Facebook y X NO renderizan SVG, y
//     WhatsApp es el canal por el que este público comparte el sitio.
//
// Fondo blanco y no transparente: una previsualización con fondo transparente se ve sobre el color
// que decida cada cliente, y el logotipo es navy — sobre el modo oscuro de WhatsApp desaparecería.
//
// 1000 x 384 es el `viewBox` del original; se genera a 1000 px de ancho, que es de sobra para el
// mínimo de 112 x 112 que pide Google y para cualquier previsualización.
//
// Uso:  node scripts/build-logo-raster.mjs

import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ORIGEN = 'public/brand/logo-navy.svg'
const DESTINO = 'public/img/logo-medicos-por-venezuela.png'
const ANCHO = 1000

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

const info = await sharp(ORIGEN, { density: 300 })
  .resize({ width: ANCHO })
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9 })
  .toFile(DESTINO)

console.log(`${DESTINO}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`)
