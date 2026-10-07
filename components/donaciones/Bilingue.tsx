// Un texto en los dos idiomas de la página, a la manera de la plantilla.
//
// El DOM lleva SIEMPRE las dos versiones y el CSS esconde la que no toca:
//
//     .donaciones[data-lang='es'] [lang='en'] { display: none !important }
//
// Puede parecer un derroche (se descargan los dos idiomas), y lo es: unos pocos kilobytes. A
// cambio resuelve de golpe las dos cosas que más fácil se rompen aquí:
//
//   · HIDRATACIÓN. No existe un "texto inicial" que el servidor y el cliente puedan calcular
//     distinto, porque el servidor manda los dos. El idioma solo decide un atributo del
//     contenedor (`data-lang`).
//   · ACCESIBILIDAD. Cada trozo va marcado con su `lang`, que es lo que necesita un lector de
//     pantalla para pronunciarlo bien, y es lo que ya hacía el original.
//
// Y de paso cambiar de idioma no vuelve a pintar ni un nodo de texto: cambia una clase CSS.
//
// `ReactNode` y no `string` porque varios textos llevan marcado dentro (`<strong>`, el resaltado
// `.marca-azul`, el importe elegido…).

import type { ReactNode } from 'react'

type Props = {
  es: ReactNode
  en: ReactNode
}

export default function Bilingue({ es, en }: Props) {
  return (
    <>
      <span lang="es">{es}</span>
      <span lang="en">{en}</span>
    </>
  )
}
