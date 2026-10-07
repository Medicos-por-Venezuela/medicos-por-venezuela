// La llamada a la acción que cierra tres de las secciones (`.cta-sec`): una frase y el botón
// "Quiero donar".
//
// Un componente y no tres bloques iguales: solo cambian la frase y el nombre del evento que se
// mide, y así no hay forma de que una de las tres se quede con el marcado viejo.

import type { MouseEventHandler, ReactNode } from 'react'
import Bilingue from './Bilingue'
import { cls } from './clases'
import type { Idioma } from './idioma'
import { seguir } from './seguimiento'

type Props = {
  idioma: Idioma
  /** La frase de la izquierda, en los dos idiomas. */
  textoEs: ReactNode
  textoEn: ReactNode
  /** El nombre con el que se mide el clic: `cta_porque`, `cta_voces`, `cta_equipo`. */
  evento: string
  alPulsarAncla: MouseEventHandler<HTMLAnchorElement>
}

export default function BloqueCta({ idioma, textoEs, textoEn, evento, alPulsarAncla }: Props) {
  return (
    <div className={cls('cta-sec')}>
      <p>
        <Bilingue es={textoEs} en={textoEn} />
      </p>
      <a
        className={cls('btn')}
        href="#donar"
        onClick={(suceso) => {
          seguir(evento, idioma)
          alPulsarAncla(suceso)
        }}
      >
        <Bilingue es="Quiero donar" en="I want to give" />
      </a>
    </div>
  )
}
