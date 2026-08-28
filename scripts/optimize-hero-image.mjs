// Convierte la foto del hero desde el material de origen a lo que se sirve en producción.
//
// El original (`nueva/oriana.jpg`) pesa 5,0 MB y mide 3117 × 4675 px: es una foto de cámara sin
// tocar. El hueco del hero mide 480 × 560 CSS px, así que se genera a 2× (960 × 1120) para que se
// vea nítida en pantallas retina y se recorta con gravedad `north` — la doctora está en el tercio
// superior y por abajo solo hay suelo.
//
// Medido sobre el original al elegir el formato:
//   WebP q82 48 KB · WebP q70 32 KB · WebP q60 29 KB · AVIF q45 22 KB · JPEG q78 61 KB
// Se usa WebP q70: soportado por todo navegador vigente y ~99,4 % más ligero que el original.
//
// El original NO se versiona en `public/`: se queda en `nueva/` como material de origen.
//
// Uso:  node scripts/optimize-hero-image.mjs

import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ORIGEN = 'nueva/oriana.jpg'
const DESTINO = 'public/img/hero-interconsulta.webp'
const ANCHO = 960
const ALTO = 1120
const CALIDAD = 70

// sharp llega como dependencia transitiva de Next (lo usa para optimizar imágenes), no está
// declarada en este package.json y con pnpm no queda izada a `node_modules/`. Declararla como
// devDependency sería más limpio, pero añadir dependencias requiere aprobación (ver Límites del
// spec), y este script se ejecuta una sola vez para generar el asset.
function resolverSharp() {
  const require = createRequire(import.meta.url)
  try {
    return require('sharp')
  } catch {
    // Buscar en el store de pnpm sin fijar la versión en la ruta.
    const store = 'node_modules/.pnpm'
    if (!existsSync(store)) return null
    const dir = readdirSync(store).find((d) => d.startsWith('sharp@'))
    if (!dir) return null
    return require(join(process.cwd(), store, dir, 'node_modules/sharp'))
  }
}

const sharp = resolverSharp()
if (!sharp) {
  console.error(
    'No se encontró sharp. Viene con Next; prueba `pnpm install`, o instálalo temporalmente\n' +
      'con `pnpm add -D sharp` (y recuerda quitarlo si no se aprueba como dependencia).'
  )
  process.exit(1)
}

if (!existsSync(ORIGEN)) {
  console.error(`No existe ${ORIGEN}. Es material de origen y no se versiona; pídeselo al equipo.`)
  process.exit(1)
}

const info = await sharp(ORIGEN)
  .resize(ANCHO, ALTO, { fit: 'cover', position: 'north' })
  .webp({ quality: CALIDAD })
  .toFile(DESTINO)

console.log(`${DESTINO}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`)
