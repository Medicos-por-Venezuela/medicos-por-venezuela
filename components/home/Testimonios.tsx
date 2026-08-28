// Testimonios: seis citas reales de pacientes, sobre el blanco roto de la paleta (#f4f4f4). Hasta
// la segunda ronda de copy (2026-08-28) iba sobre `--h-blue-deep`, así que todo el texto de aquí
// está recalculado para fondo claro.
//
// Son las únicas voces de terceros del home, así que van en `<blockquote>` con su `<cite>`: no es
// decoración, es una atribución. Todas son "Paciente, Venezuela" — anónimas a propósito, por eso
// NO llevan la foto circular que pone el prototipo: ponerle cara a un testimonio médico anónimo
// sería atribuírselo a alguien que no lo dio.
//
// Filetes con la misma técnica que Especialistas: borde arriba+izquierda en el contenedor y
// derecha+abajo en cada celda, que aguanta cualquier número de columnas.

import { TESTIMONIOS } from './copy'
import { useReveal } from './motion'

export default function Testimonios() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="testimonios" aria-label="Testimonios de pacientes">
      <div className="contenido">
        <div className="cabecera">
          <p className="eyebrow">{TESTIMONIOS.eyebrow}</p>
          <div className="filete" aria-hidden="true" />
          <h2 className="titulo">{TESTIMONIOS.titulo}</h2>
        </div>

        <div ref={ref} className={`rejilla ${className}`}>
          {TESTIMONIOS.citas.map((cita) => (
            <figure className="celda" key={cita.slice(0, 28)}>
              <blockquote className="cita">
                <p>«{cita}»</p>
              </blockquote>
              <figcaption className="autor">{TESTIMONIOS.autor}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <style jsx>{`
        .testimonios {
          background: var(--h-grey-bg);
          padding: 110px 48px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        .cabecera {
          margin-bottom: 56px;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          /* Sobre el blanco roto, el azul de marca a 11 px da 4,41:1; la variante oscura, 6,20:1.
             Mismo criterio que Quiénes Somos. */
          color: var(--h-blue-dark);
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin: 0 0 10px;
        }
        .filete {
          width: 36px;
          height: 2px;
          background: var(--h-blue);
          margin-bottom: 26px;
        }
        .titulo {
          font-size: clamp(28px, 3.6vw, 40px);
          font-weight: 900;
          color: var(--h-navy);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .rejilla {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid rgba(0, 0, 0, 0.12);
          border-left: 1px solid rgba(0, 0, 0, 0.12);
        }
        .celda {
          margin: 0;
          padding: 34px 30px;
          border-right: 1px solid rgba(0, 0, 0, 0.12);
          border-bottom: 1px solid rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
        }
        .cita {
          margin: 0 0 20px;
          /* 'flex-grow' empuja la atribución al pie de la celda: con citas de distinto largo, si no
             se alinean quedan a alturas distintas dentro de la misma fila. */
          flex-grow: 1;
        }
        .cita p {
          font-size: 15px;
          /* La cita es la voz del paciente y es lo que se viene a leer: va en navy, no en el gris
             de cuerpo. Es el equivalente en claro del blanco casi puro que tenía sobre azul. */
          color: var(--h-navy);
          line-height: 1.75;
          margin: 0;
        }
        .autor {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-grey);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        @media (max-width: 900px) {
          .testimonios {
            padding: 72px 24px;
          }
          .rejilla {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .celda {
            padding: 28px 22px;
          }
        }
        @media (max-width: 560px) {
          .rejilla {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
