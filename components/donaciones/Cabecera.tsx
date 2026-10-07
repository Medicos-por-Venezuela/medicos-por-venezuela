// La cabecera de la plantilla: logo, "Donar" y el alternador ES/EN.
//
// Es la cabecera DE LA PLANTILLA, no la del sitio: la página de donaciones trae su propio
// encabezado y su propio pie, y se queda con ellos (decisión del cliente). Va en `position:absolute`
// sobre el hero, que es de donde sale el degradado del fondo.

import type { MouseEventHandler } from 'react'
import LogoMxv from './LogoMxv'
import Bilingue from './Bilingue'
import { cls } from './clases'
import { URL_SITIO } from './contenido'
import { cambiarIdioma, type Idioma } from './idioma'
import { seguir } from './seguimiento'

type Props = {
  idioma: Idioma
  /** Lleva a la caja de donación con desplazamiento suave. */
  alPulsarAncla: MouseEventHandler<HTMLAnchorElement>
}

const IDIOMAS: { codigo: Idioma; rotulo: string }[] = [
  { codigo: 'es', rotulo: 'ES' },
  { codigo: 'en', rotulo: 'EN' }
]

export default function Cabecera({ idioma, alPulsarAncla }: Props) {
  return (
    <header className={cls('top')}>
      <div className={cls('wrap')}>
        <a className={cls('logo')} href={URL_SITIO} aria-label="Médicos por Venezuela">
          <LogoMxv />
        </a>
        <div className={cls('der')}>
          <a
            className={cls('btn', 'btn-top')}
            href="#donar"
            onClick={(evento) => {
              seguir('cta_header', idioma)
              alPulsarAncla(evento)
            }}
          >
            <Bilingue es="Donar" en="Give" />
          </a>
          {/* `role="group"` + `aria-pressed` es lo que hace que un lector de pantalla anuncie
              "ES, botón, presionado": el estado va en el botón, no en una clase. Ojo: estos dos
              botones NO llevan atributo `lang`, porque el CSS bilingüe esconde todo lo que lo
              lleve y el alternador tiene que verse en los dos idiomas. */}
          <div className={cls('idioma')} role="group" aria-label="Idioma / Language">
            {IDIOMAS.map(({ codigo, rotulo }) => (
              <button
                key={codigo}
                type="button"
                aria-pressed={idioma === codigo}
                onClick={() => {
                  cambiarIdioma(codigo)
                  seguir('cambio_idioma', codigo, { a: codigo })
                }}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
