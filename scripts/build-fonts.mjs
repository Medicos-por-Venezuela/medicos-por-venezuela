// Genera las woff2 de marca desde las fuentes variables del material de origen.
//
// `nueva/material/Fuentes/` trae Nunito Sans como **fuente variable** con cuatro ejes:
//   wght 200..1000 · wdth 75..125 · opsz 6..12 · YTLC 440..540
// Solo nos interesa `wght`: el diseño usa 400/600/700/800/900. Los otros tres se fijan en su
// valor por defecto (`wdth=100`, `opsz=12`, `YTLC=500`), lo que recorta mucho el archivo sin
// cambiar nada de lo que se ve. Una sola woff2 con el eje `wght` vivo sustituye a las cuatro
// estáticas que pedía el plan, y pesa menos que dos de ellas.
//
// Antes de esto solo existía la estática Bold (700). Como era la única cara de la familia, el
// emparejador CSS la usaba para TODOS los pesos: medido, los pesos 300 a 900 renderizaban el
// mismo ancho exacto (606,44 px) y el home no tenía jerarquía tipográfica.
//
// El subset es el rango "latin" de Google Fonts + las flechas que usa el copy (→ en los CTA).
// Sin él sobran 1100 glifos de alfabetos que este sitio no escribe.
//
// Requiere `uv` (ya se usa en el backend). Uso:  node scripts/build-fonts.mjs

import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync, copyFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ORIGEN = 'nueva/material/Fuentes'
const DESTINO = 'public/brand'

// Rango "latin" de Google Fonts, más U+2190-2193 (el copy usa "→" en los botones) y U+2013.
const UNICODES = [
  'U+0000-00FF',
  'U+0131',
  'U+0152-0153',
  'U+02BB-02BC',
  'U+02C6',
  'U+02DA',
  'U+02DC',
  'U+0304',
  'U+0308',
  'U+0329',
  'U+2000-206F',
  'U+2074',
  'U+20AC',
  'U+2122',
  'U+2190-2193',
  'U+2212',
  'U+2215',
  'U+FEFF',
  'U+FFFD'
].join(',')

// wght se deja como RANGO (200:1000): es lo que mantiene la fuente variable.
const EJES = ['wght=200:1000', 'wdth=100', 'opsz=12', 'YTLC=500']

const CARAS = [
  {
    entrada: 'NunitoSans-VariableFont_YTLC,opsz,wdth,wght.ttf',
    salida: 'nunito-sans-variable.woff2'
  },
  {
    entrada: 'NunitoSans-Italic-VariableFont_YTLC,opsz,wdth,wght.ttf',
    salida: 'nunito-sans-variable-italic.woff2'
  }
]

// `fonttools[woff]` arrastra brotli, que es lo que comprime el woff2; sin ese extra el paso de
// subset falla con "Compression requires the brotli extension".
const uvx = (mod, args) =>
  execFileSync('uvx', ['--from', 'fonttools[woff]', 'fonttools', mod, ...args], { stdio: 'pipe' })

mkdirSync(DESTINO, { recursive: true })

for (const cara of CARAS) {
  const origen = join(ORIGEN, cara.entrada)
  const parcial = join(DESTINO, `.tmp-${cara.salida}.ttf`)
  const destino = join(DESTINO, cara.salida)

  // 1) Fijar los ejes que no usamos, conservando wght como rango.
  uvx('varLib.instancer', [origen, ...EJES, '-o', parcial])
  // 2) Subset a latin + flechas, y a woff2.
  uvx('subset', [
    parcial,
    `--unicodes=${UNICODES}`,
    '--flavor=woff2',
    '--no-hinting',
    '--desubroutinize',
    `--output-file=${destino}`
  ])
  rmSync(parcial)

  console.log(`${destino}  ${Math.round(statSync(destino).size / 1024)} KB`)
}

// La OFL exige que la licencia acompañe a la fuente. `nueva/` es material de referencia y no se
// versiona, así que la copia que viaja con el sitio vive junto a las woff2.
copyFileSync(join(ORIGEN, 'OFL.txt'), join(DESTINO, 'OFL.txt'))
console.log(`${join(DESTINO, 'OFL.txt')}  (licencia, obligatoria)`)
