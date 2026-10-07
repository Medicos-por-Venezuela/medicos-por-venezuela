// El botón "Quiero donar" que se pega abajo (o a la derecha, en escritorio) cuando la caja de
// donación ya ha quedado arriba.
//
// Es solo presentación: quién decide si se ve es la propia caja, que es la que sabe dónde está
// (ver el `IntersectionObserver` de `CajaDonacion`). La plantilla lo resolvía al revés —un oyente
// de `scroll` global que buscaba `#donar` con `getElementById` y medía su rectángulo en cada
// fotograma—, y eso en React sobra: el elemento ya tiene dueño.
//
// La transición de entrada la hace el CSS con la clase `ver`; el primer render es sin ella, igual
// que el HTML de la plantilla, así que no hay nada que pueda diferir entre servidor y cliente.

import type { MouseEventHandler } from 'react'
import Bilingue from './Bilingue'
import { cls } from './clases'
import type { Idioma } from './idioma'
import { seguir } from './seguimiento'

type Props = {
  idioma: Idioma
  /** `true` cuando la caja de donación ya ha quedado por encima de la pantalla. */
  visible: boolean
  alPulsarAncla: MouseEventHandler<HTMLAnchorElement>
}

export default function BarraFija({ idioma, visible, alPulsarAncla }: Props) {
  return (
    <div className={visible ? cls('fija', 'ver') : cls('fija')}>
      <a
        className={cls('btn')}
        href="#donar"
        onClick={(evento) => {
          seguir('cta_fija', idioma)
          alPulsarAncla(evento)
        }}
      >
        <Bilingue es="Quiero donar" en="I want to give" />
      </a>
    </div>
  )
}
