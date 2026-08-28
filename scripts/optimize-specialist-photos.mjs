// Convierte los retratos de los diez especialistas a lo que se sirve en producción.
//
// Los originales son verticales 9:16 (768 × 1376, salvo uno a 572 × 1024) y pesan entre 63 KB y
// 3,0 MB. La rejilla del home los pinta a 4:5, así que hay que recortar — y ahí está el problema:
// el ENCUADRE NO ES HOMOGÉNEO. Van desde un plano de busto hasta un cuerpo entero. Un recorte fijo,
// o el `attention` de sharp, deja una rejilla en la que unos parecen de cerca y otros de lejos: se
// probó y no vale.
//
// El recorte se calcula por foto a partir de DÓNDE ESTÁ LA CABEZA, medida sobre cada original y
// anotada abajo como fracción del alto (`ht` = coronilla, `hb` = barbilla). Con eso:
//
//   alto del recorte = altoCabeza / PESO_CABEZA   → la cabeza mide lo mismo en las diez
//   borde superior   = coronilla − AIRE × alto    → todas las cabezas arrancan a la misma altura
//
// Son las dos cosas que se notan cuando fallan: si la cabeza no mide igual, unos salen de cerca y
// otros de lejos; si no arrancan a la misma altura, uno queda hundido con un hueco de pared encima
// (le pasó a Jesús Ramírez en la primera versión). Nada de "gravedad norte" ni de heurísticas: dos
// medidas por foto y una regla.
//
// Salida: WebP de 640 × 800 (2× del ancho máximo al que se ve, ~327 px en móvil a una columna).
//
// Los originales NO se versionan: viven en `nueva/especialistas/` como material de origen.
//
// Uso:  node scripts/optimize-specialist-photos.mjs

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ORIGEN = 'nueva/especialistas'
const DESTINO = 'public/img/especialistas'
const ANCHO = 640
const ALTO = 800
const CALIDAD = 72

// Cuánto del alto del recorte ocupa la cabeza, y cuánto aire queda por encima de la coronilla.
// Los dos números salen de igualar las diez contra las que ya venían bien encuadradas de origen.
const PESO_CABEZA = 0.24
const AIRE = 0.09

// `ht`/`hb`: coronilla y barbilla como fracción del alto de la foto. Medidos a ojo sobre cada
// original y afinados revisando la rejilla completa, que es donde se ve si uno desentona.
const FOTOS = [
  { archivo: 'Adarvelys Valor.jpg', slug: 'adarvelys-valor', ht: 0.0949, hb: 0.2589 },
  {
    archivo: 'Alejandro Marcano - Cirugía ortopédica y traumatología deportiva.jpg',
    slug: 'alejandro-marcano',
    ht: 0.1847,
    hb: 0.2606
  },
  {
    archivo: 'ANTONIO BRICENO - Traumatología y Ortopedia.jpg',
    slug: 'antonio-briceno',
    ht: 0.1422,
    hb: 0.2328
  },
  {
    archivo: 'Dr. Jesus Ramírez - Médico internista.png',
    slug: 'jesus-ramirez',
    ht: 0.2154,
    hb: 0.3093
  },
  {
    archivo: 'Johana palacios - Cirujana y patóloga.jpg',
    slug: 'johanna-palacios',
    ht: 0.1247,
    hb: 0.2887
  },
  {
    archivo: 'Lizbeth Villavicencio - Psicología.jpg',
    slug: 'lizbeth-villavicencio',
    ht: 0.0775,
    hb: 0.2451
  },
  {
    archivo: 'Dr. Michael Sicurella  - Médico de Familia_.jpg',
    slug: 'michael-sicurella',
    ht: 0.0628,
    hb: 0.2302
  },
  { archivo: 'Sara Altuna- Internista Oncóloga.jpg', slug: 'sara-altuna', ht: 0.0628, hb: 0.2302 },
  {
    archivo: 'Dra. Sirio Barreto, Neurología.jpg',
    slug: 'sirio-barreto',
    ht: 0.1577,
    hb: 0.2858
  },
  {
    archivo: 'Dra Yanara García Leyva - Especialista en Medicina Familiar y Dermatología.jpg',
    slug: 'yanara-garcia-leyva',
    ht: 0.2508,
    hb: 0.3305
  }
]

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

for (const foto of FOTOS) {
  const entrada = join(ORIGEN, foto.archivo)
  if (!existsSync(entrada)) {
    console.error(`Falta ${entrada}`)
    process.exit(1)
  }
  const { width: iw, height: ih } = await sharp(entrada).metadata()

  const cabeza = foto.hb - foto.ht
  // El recorte no puede ser más ancho que la foto: con 4:5 sobre un 9:16, el tope es ese cociente.
  const proporcion = Math.min(cabeza / PESO_CABEZA, iw / (0.8 * ih), 1)
  const alto = Math.round(proporcion * ih)
  const ancho = Math.round(alto * 0.8)
  const top = Math.max(0, Math.min(Math.round(foto.ht * ih - AIRE * alto), ih - alto))
  const left = Math.max(0, Math.min(Math.round((iw - ancho) / 2), iw - ancho))

  const salida = join(DESTINO, `${foto.slug}.webp`)
  const info = await sharp(entrada)
    .extract({ left, top, width: ancho, height: alto })
    .resize(ANCHO, ALTO)
    .webp({ quality: CALIDAD })
    .toFile(salida)
  console.log(`${salida}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`)
}
