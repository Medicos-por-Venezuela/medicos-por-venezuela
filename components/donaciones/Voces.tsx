// "Luis no es el único": los mensajes que mandan los pacientes después de su consulta.
//
// Son testimonios reales, recortados pero no reescritos. El carrusel avanza solo cada cuatro
// segundos mientras está a la vista, porque si no casi nadie pasa de la primera tarjeta.
//
// El color alterno de las tarjetas lo pone el CSS (`.voz:nth-child(odd)`), no un dato: así
// añadir o quitar un testimonio no obliga a revisar nada.

import type { MouseEventHandler } from 'react'
import Bilingue from './Bilingue'
import BloqueCta from './BloqueCta'
import Carrusel from './Carrusel'
import Estrella from './Estrella'
import { cls } from './clases'
import { VOCES } from './contenido'
import type { Idioma } from './idioma'

type Props = {
  idioma: Idioma
  alPulsarAncla: MouseEventHandler<HTMLAnchorElement>
}

export default function Voces({ idioma, alPulsarAncla }: Props) {
  return (
    <section className={cls('voces')}>
      <Estrella posicion="d5" />
      <div className={cls('wrap')}>
        <h2>
          <Bilingue
            es={
              <>
                Luis no es <span className={cls('marca-azul')}>el único</span>
              </>
            }
            en={
              <>
                Luis isn&apos;t <span className={cls('marca-azul')}>the only one</span>
              </>
            }
          />
        </h2>

        <Carrusel
          idioma={idioma}
          avanceAutomatico
          etiqueta={{ es: 'Testimonios de pacientes', en: 'Patient testimonials' }}
          pistaEs="Lo que nos escriben los pacientes después de su consulta. Desliza para leer más."
          pistaEn="What patients write to us after their consultation. Swipe to read more."
        >
          {VOCES.map((voz) => (
            <figure className={cls('voz')} key={voz.cita.es}>
              <blockquote>
                <Bilingue es={voz.cita.es} en={voz.cita.en} />
              </blockquote>
              <figcaption>
                <Bilingue es={voz.pie.es} en={voz.pie.en} />
              </figcaption>
            </figure>
          ))}
        </Carrusel>

        <BloqueCta
          idioma={idioma}
          evento="cta_voces"
          textoEs="Apoya a Médicos por Venezuela."
          textoEn="Support Médicos por Venezuela."
          alPulsarAncla={alPulsarAncla}
        />
      </div>
    </section>
  )
}
