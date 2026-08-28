// Convierte los cuatro iconos de la banda de Valores desde el material de origen a lo que se
// sirve en producción.
//
// Los originales son PNG de 500 × 500 con canal alfa y relleno plano `#0066ff` (a un punto del
// `#0066fe` de la paleta; la diferencia no es perceptible). En pantalla se ven a 48 px, así que se
// generan a 96 px para 2×: de 5–14 KB por icono se baja a ~1 KB.
//
// OJO CON LOS NOMBRES DE ORIGEN: vienen con los nombres de los valores del PROTOTIPO (Calidad,
// Credibilidad, Autonomía, Gratuidad), que NO son los del copy aprobado (Verificados, Autónomos,
// Gratuitos, Confidenciales), y encima algún dibujo no cuadra con su propio nombre de archivo
// —`Gratis.png` son cinco estrellas y `Autonomía.png` es un médico—. El mapa de abajo es el único
// que respeta los tres nombres de archivo que sí coinciden; el cuarto sale por descarte.
// ⚠️ `Credibilidad.png` (un pulgar arriba) queda en "Confidenciales", que es lo que peor encaja:
// la confidencialidad se dibuja normalmente con un candado. Anotado en tasks/home-refresh/todo.md.
//
// Uso:  node scripts/optimize-value-icons.mjs

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ORIGEN = 'nueva/iconos-valores'
const DESTINO = 'public/img/valores'
const LADO = 96

// origen -> nombre del valor en el copy (ver copy.ts, export VALORES)
const MAPA = {
  'seguro-Calidad.png': 'verificados',
  'Autonomía.png': 'autonomos',
  'Gratis.png': 'gratuitos',
  'Credibilidad.png': 'confidenciales'
}

// sharp llega como dependencia transitiva de Next y con pnpm no queda izada a `node_modules/`.
// Misma resolución que en optimize-hero-image.mjs.
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

if (!existsSync(ORIGEN)) {
  console.error(`No existe ${ORIGEN}/. Es material de origen y no se versiona; pídeselo al equipo.`)
  process.exit(1)
}

mkdirSync(DESTINO, { recursive: true })

for (const [archivo, valor] of Object.entries(MAPA)) {
  const entrada = join(ORIGEN, archivo)
  if (!existsSync(entrada)) {
    console.error(`Falta ${entrada}`)
    process.exit(1)
  }
  const salida = join(DESTINO, `${valor}.webp`)
  // `fit: contain` con fondo transparente: los cuatro originales ya son cuadrados, pero así el
  // día que llegue uno que no lo sea no se deforma.
  const info = await sharp(entrada)
    .resize(LADO, LADO, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(salida)
  console.log(`${salida}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`)
}
