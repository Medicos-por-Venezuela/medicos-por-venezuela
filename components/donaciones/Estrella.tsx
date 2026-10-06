// La estrella de la marca, usada como adorno de fondo (`.deco d1`…`d5`) en cuatro secciones.
//
// La plantilla la define UNA vez como `<symbol>` dentro de un `<svg width="0" height="0">` al
// principio del body y luego la instancia con `<use href="#e">`. Se mantiene ese montaje —es lo
// que evita repetir el trazo cinco veces— con el id renombrado: `#e` es un identificador global
// del documento y una sola letra en una página que comparte el DOM con el resto de la aplicación
// es pedir una colisión.
//
// `aria-hidden` en todas: son manchas de color detrás del texto, no contenido.

import { cls } from './clases'

const ID = 'donaciones-estrella'

/** El `<symbol>`. Va una sola vez, en la raíz de la página. */
export function DefinicionEstrella() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id={ID} viewBox="195 140 105 95">
        <path
          fill="currentColor"
          d="M250.55,150l8.7,26.75a3.66,3.66,0,0,0,3.48,2.53h28.13a3.67,3.67,0,0,1,2.16,6.63l-22.76,16.54a3.67,3.67,0,0,0-1.33,4.1l8.69,26.75a3.67,3.67,0,0,1-5.64,4.1l-22.76-16.54a3.68,3.68,0,0,0-4.31,0l-22.75,16.54a3.66,3.66,0,0,1-5.64-4.1l8.69-26.75a3.67,3.67,0,0,0-1.33-4.1l-22.76-16.54a3.66,3.66,0,0,1,2.15-6.63H231.4a3.67,3.67,0,0,0,3.49-2.53L243.58,150A3.66,3.66,0,0,1,250.55,150Z"
        />
      </symbol>
    </svg>
  )
}

type Props = {
  /** Cuál de las cinco posiciones del diseño: `d1` a `d5`. */
  posicion: 'd1' | 'd2' | 'd3' | 'd4' | 'd5'
}

/** Un adorno. Tamaño, posición y opacidad los pone la clase de la plantilla. */
export default function Estrella({ posicion }: Props) {
  return (
    <svg className={cls('deco', posicion)} aria-hidden="true">
      <use href={`#${ID}`} />
    </svg>
  )
}
