// "Detrás de cada consulta hay un médico que dijo que sí": las nueve fichas del equipo.

import { useState, type MouseEventHandler } from 'react'
import Bilingue from './Bilingue'
import BloqueCta from './BloqueCta'
import Carrusel from './Carrusel'
import { cls } from './clases'
import { EQUIPO, type MiembroEquipo } from './contenido'
import type { Idioma } from './idioma'

/**
 * La foto de una ficha, con su respaldo.
 *
 * `.foto::before` pinta las iniciales DEBAJO de la imagen con `content: attr(data-ini)`, así que
 * si la foto no carga la tarjeta sigue teniendo cara en vez de un hueco degradado. La plantilla
 * lo conseguía con `onerror="this.remove()"`; aquí es estado, porque arrancar un nodo del DOM que
 * React cree que sigue ahí es pedir problemas en el siguiente render.
 *
 * Con las fotos ya en `public/donaciones/equipo/` esto casi no debería dispararse; sigue puesto
 * porque un 404 en una página donde se pide dinero resta credibilidad y el respaldo es gratis.
 */
function FotoEquipo({ miembro }: { miembro: MiembroEquipo }) {
  const [fallo, setFallo] = useState(false)
  return (
    <div className={cls('foto')} data-ini={miembro.iniciales}>
      {!fallo && (
        /* eslint-disable-next-line @next/next/no-img-element -- `next/image` envuelve la imagen
           en su propio contenedor con estilos propios, y aquí la maquetación es la de la
           plantilla (`.foto img { position:absolute; inset:0; object-fit:cover }`) sobre una
           caja con `aspect-ratio`. Un `<img>` llano es lo que reproduce el diseño sin tocarlo, y
           las fotos ya vienen recortadas a 600x1075 desde el repositorio. */
        <img
          src={miembro.foto}
          alt={miembro.nombre}
          loading="lazy"
          onError={() => setFallo(true)}
        />
      )}
    </div>
  )
}

type Props = {
  idioma: Idioma
  alPulsarAncla: MouseEventHandler<HTMLAnchorElement>
}

export default function Equipo({ idioma, alPulsarAncla }: Props) {
  return (
    <section className={cls('equipo')}>
      <div className={cls('wrap')}>
        <h2>
          <Bilingue
            es={
              <>
                Detrás de cada consulta hay{' '}
                <span className={cls('marca-azul')}>un médico que dijo que sí</span>
              </>
            }
            en={
              <>
                Behind every consultation is{' '}
                <span className={cls('marca-azul')}>a doctor who said yes</span>
              </>
            }
          />
        </h2>

        <Carrusel
          idioma={idioma}
          etiqueta={{ es: 'Equipo de Médicos por Venezuela', en: 'Médicos por Venezuela team' }}
          pistaEs="Venezolanos formados en el país, atendiendo desde donde estén. Sin cobrar."
          pistaEn="Venezuelans trained at home, seeing patients from wherever they are. Free of charge."
        >
          {EQUIPO.map((miembro) => (
            <figure className={cls('card-eq')} key={miembro.nombre}>
              <FotoEquipo miembro={miembro} />
              <figcaption>
                <b>{miembro.nombre}</b>
                {miembro.especialidad && (
                  <Bilingue es={miembro.especialidad.es} en={miembro.especialidad.en} />
                )}
                {miembro.rol && (
                  <>
                    <br />
                    <span className={cls('rol')}>
                      <Bilingue es={miembro.rol.es} en={miembro.rol.en} />
                    </span>
                  </>
                )}
              </figcaption>
            </figure>
          ))}
        </Carrusel>

        <BloqueCta
          idioma={idioma}
          evento="cta_equipo"
          textoEs="Ellos ponen su conocimiento. Tú puedes poner lo tuyo."
          textoEn="They give their knowledge. You can give yours."
          alPulsarAncla={alPulsarAncla}
        />
      </div>
    </section>
  )
}
