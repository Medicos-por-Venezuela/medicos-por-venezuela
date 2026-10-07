// "Por qué importa": el dato de Encovi, las cuatro cifras de la plataforma y el acompañamiento.
//
// Es la única sección de fondo claro del cuerpo, y la que justifica la petición: el 37 % que no
// fue al médico por no poder pagar la consulta.

import type { MouseEventHandler } from 'react'
import Bilingue from './Bilingue'
import BloqueCta from './BloqueCta'
import Estrella from './Estrella'
import NumeroAnimado from './NumeroAnimado'
import { cls } from './clases'
import type { Idioma } from './idioma'

type Props = {
  idioma: Idioma
  alPulsarAncla: MouseEventHandler<HTMLAnchorElement>
}

export default function PorQue({ idioma, alPulsarAncla }: Props) {
  return (
    <section className={cls('porque')}>
      <Estrella posicion="d3" />
      <div className={cls('wrap')}>
        <div className={cls('porque-grid')}>
          <div>
            <p className={cls('dato')}>37%</p>
            <p className={cls('dato-txt')}>
              <Bilingue
                es="de los venezolanos que se enfermaron no fue al médico porque no podía pagar la consulta."
                en="of Venezuelans who got sick didn't see a doctor because they couldn't pay for the visit."
              />
            </p>
            <p className={cls('fuente')}>Encovi 2025, UCAB</p>
          </div>
          <div>
            <h2>
              <Bilingue
                es={
                  <>
                    El conocimiento existe.{' '}
                    <span className={cls('marca-azul')}>Médicos por Venezuela es el puente.</span>
                  </>
                }
                en={
                  <>
                    The knowledge exists.{' '}
                    <span className={cls('marca-azul')}>Médicos por Venezuela is the bridge.</span>
                  </>
                }
              />
            </h2>
            <p className={cls('lead')}>
              <Bilingue
                es="Médicos venezolanos, dentro y fuera del país, atienden por videollamada a quien no puede pagar una consulta. Para el paciente es gratis. Mantener la plataforma, verificar a cada médico y coordinar cada caso, no."
                en="Venezuelan doctors, inside and outside the country, see patients by video call who can't afford a visit. It's free for the patient. Running the platform, verifying every doctor and coordinating every case isn't."
              />
            </p>
          </div>
        </div>

        {/* Las dos primeras cifras cuentan hacia arriba al entrar en pantalla; las otras dos son
            fijas (no son un recuento, son un "+50" y un "$0" que animados mentirían). */}
        <div className={cls('cifras')}>
          <div>
            <NumeroAnimado meta={1000} />
            <Bilingue es="consultas gratuitas" en="free consultations" />
          </div>
          <div>
            <NumeroAnimado meta={2500} />
            <Bilingue es="médicos registrados" en="registered doctors" />
          </div>
          <div>
            <b>+50</b>
            <Bilingue es="especialidades" en="specialties" />
          </div>
          <div>
            <b>$0</b>
            <Bilingue es="lo que paga el paciente" en="what the patient pays" />
          </div>
        </div>

        <div className={cls('acomp')}>
          <h3>
            <Bilingue
              es="Y cuando la consulta no alcanza, no soltamos al paciente."
              en="And when a consultation isn't enough, we don't let go."
            />
          </h3>
          <p>
            <Bilingue
              es="En los casos más difíciles, el equipo le hace seguimiento, lo orienta y busca con él la forma de continuar su tratamiento. Tu aporte también sostiene ese acompañamiento."
              en="In the hardest cases, the team follows up, guides the patient and looks for ways to continue their treatment together. Your gift sustains that support too."
            />
          </p>
        </div>

        <BloqueCta
          idioma={idioma}
          evento="cta_porque"
          textoEs="Súmate a quienes apoyan este proyecto."
          textoEn="Join the people supporting this project."
          alPulsarAncla={alPulsarAncla}
        />
      </div>
    </section>
  )
}
