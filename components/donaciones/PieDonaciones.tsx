// El pie de la plantilla de donaciones.
//
// Es el pie DE LA PÁGINA, no el del sitio (`components/home/Footer.tsx`): la plantilla trae el
// suyo y se queda con él. Lleva el aviso de transparencia —"Sobre los aportes"— al que apunta el
// enlace "Más detalles" de la caja de donación, y que es lo que una página que pide dinero tiene
// que decir sin que haya que buscarlo: la organización está en proceso de registro, los aportes
// no son deducibles y no se entrega nada a cambio.

import Bilingue from './Bilingue'
import LogoMxv from './LogoMxv'
import { cls } from './clases'
import { URL_INSTAGRAM, URL_SITIO } from './contenido'
import type { Idioma } from './idioma'
import { seguir } from './seguimiento'

type Props = {
  idioma: Idioma
}

export default function PieDonaciones({ idioma }: Props) {
  return (
    <footer>
      <div className={cls('wrap')}>
        <div className={cls('logo')}>
          <LogoMxv />
        </div>
        <p className={cls('lema-txt')}>
          <Bilingue
            es="Conocimiento médico al servicio de Venezuela"
            en="Medical knowledge at the service of Venezuela"
          />
        </p>
        <div className={cls('transparencia')} id="transparencia">
          <h3>
            <Bilingue es="Sobre los aportes" en="About donations" />
          </h3>
          <p>
            <Bilingue
              es="Médicos por Venezuela está en proceso de registro como organización sin fines de lucro en Estados Unidos. Los aportes son voluntarios, no son deducibles de impuestos y no implican la entrega de ningún bien o servicio a cambio."
              en="Médicos por Venezuela is in the process of registering as a nonprofit organization in the United States. Donations are voluntary, are not tax-deductible, and do not involve any goods or services in return."
            />
          </p>
        </div>
        <p>
          <a href={URL_SITIO}>medicosporvenezuela.org</a> &nbsp;&nbsp;{' '}
          <a href={URL_INSTAGRAM} onClick={() => seguir('seguir_instagram_pie', idioma)}>
            Instagram @medicosxvenezuela
          </a>
        </p>
        <p>
          <Bilingue
            es="Fuente del dato: Encuesta Nacional de Condiciones de Vida (Encovi) 2025, UCAB."
            en="Data source: National Survey of Living Conditions (Encovi) 2025, UCAB."
          />
        </p>
        <p>© 2026 Médicos por Venezuela</p>
      </div>
    </footer>
  )
}
