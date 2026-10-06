// El cierre: la última frase de Luis, el botón de donar y la alternativa para quien hoy no puede.
//
// Los dos botones de compartir son la salida para quien no va a donar: el enlace de WhatsApp
// lleva el texto ya escrito en el idioma activo.

import type { MouseEventHandler } from 'react'
import Bilingue from './Bilingue'
import Estrella from './Estrella'
import { cls } from './clases'
import { URL_INSTAGRAM } from './contenido'
import type { Idioma } from './idioma'
import { seguir } from './seguimiento'
import { enlaceCompartir } from './utilidades'

type Props = {
  idioma: Idioma
  alPulsarAncla: MouseEventHandler<HTMLAnchorElement>
}

export default function Cierre({ idioma, alPulsarAncla }: Props) {
  return (
    <section className={cls('cierre')}>
      <Estrella posicion="d4" />
      <div className={cls('wrap')}>
        <p className={cls('cita')}>
          <span className={cls('comilla')}>“</span>
          <Bilingue
            es="No alcanzo el tiempo para agradecer."
            en="I don't have enough time to thank you."
          />
          <span className={cls('comilla')}>”</span>
        </p>
        <p className={cls('sub')}>
          <Bilingue
            es="Para Luis, la ayuda llegó en una videollamada. Súmate a quienes apoyan este proyecto."
            en="For Luis, help came through a video call. Join the people supporting this project."
          />
        </p>
        <a
          className={cls('btn')}
          href="#donar"
          onClick={(evento) => {
            seguir('cta_cierre', idioma)
            alPulsarAncla(evento)
          }}
        >
          <Bilingue es="Quiero donar" en="I want to give" />
        </a>

        <div className={cls('compartir')}>
          <p>
            <Bilingue
              es="¿Hoy no puedes donar? Compartir también ayuda."
              en="Can't give today? Sharing helps too."
            />
          </p>
          <div className={cls('compartir-btns')}>
            <a
              className={cls('b-wa')}
              href={enlaceCompartir(idioma)}
              target="_blank"
              rel="noopener"
              onClick={() => seguir('compartir_whatsapp', idioma)}
            >
              <Bilingue es="Compartir por WhatsApp" en="Share on WhatsApp" />
            </a>
            <a
              className={cls('b-ig')}
              href={URL_INSTAGRAM}
              target="_blank"
              rel="noopener"
              onClick={() => seguir('seguir_instagram', idioma)}
            >
              <Bilingue es="Seguir en Instagram" en="Follow on Instagram" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
