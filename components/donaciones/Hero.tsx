// La primera pantalla: la frase de Luis, su nota de voz y la caja de donación al lado.
//
// Es la sección que decide si alguien se queda. A partir de 920 px la rejilla se parte en dos
// columnas (testimonio | caja); por debajo, la caja baja y queda después del testimonio, que es
// el orden en que hay que leerlo.

import type { MouseEventHandler } from 'react'
import Bilingue from './Bilingue'
import CajaDonacion from './CajaDonacion'
import Estrella from './Estrella'
import NotaDeVoz from './NotaDeVoz'
import { cls } from './clases'
import type { Idioma } from './idioma'

type Props = {
  idioma: Idioma
  alPulsarAncla: MouseEventHandler<HTMLAnchorElement>
  /** Pasa de largo hasta `CajaDonacion`: es la caja la que mide su propia posición. */
  alQuedarArriba: (arriba: boolean) => void
}

export default function Hero({ idioma, alPulsarAncla, alQuedarArriba }: Props) {
  return (
    <section className={cls('hero')}>
      <Estrella posicion="d1" />
      <Estrella posicion="d2" />
      <div className={cls('wrap', 'hero-grid')}>
        <div>
          <h1 className={cls('cita')}>
            <span className={cls('comilla')}>“</span>
            <Bilingue
              es="Eso fue una luz. Me apareció un ángel."
              en="It was a light. An angel appeared to me."
            />
            <span className={cls('comilla')}>”</span>
          </h1>
          <p className={cls('firma')}>
            <span>
              <strong>Luis Hernández</strong>,{' '}
              <Bilingue es="paciente de Médicos por Venezuela" en="Médicos por Venezuela patient" />
            </span>
          </p>

          <NotaDeVoz idioma={idioma} />

          <p className={cls('cuerpo')}>
            <Bilingue
              es={
                <>
                  Luis vive con una infección causada por una placa en el cuello y no puede caminar.
                  Ir a un médico era un viaje que no podía pagar. Lo atendieron por videollamada,
                  gratis, y desde ese día le escriben para saber cómo sigue.{' '}
                  <strong>
                    Muchos otros siguen esperando esa llamada. Súmate a este proyecto.
                  </strong>
                </>
              }
              en={
                <>
                  Luis lives with an infection caused by a plate in his neck, and he can&apos;t
                  walk. Seeing a doctor meant a trip he couldn&apos;t afford. He was seen by video
                  call, for free, and his doctors have checked on him ever since.{' '}
                  <strong>Many others are still waiting for that call. Join this project.</strong>
                </>
              }
            />
          </p>
          <p className={cls('lema-hero')}>
            <Bilingue
              es="Conocimiento médico al servicio de Venezuela"
              en="Medical knowledge at the service of Venezuela"
            />
          </p>
        </div>

        <CajaDonacion
          idioma={idioma}
          alPulsarAncla={alPulsarAncla}
          alQuedarArriba={alQuedarArriba}
        />
      </div>
    </section>
  )
}
