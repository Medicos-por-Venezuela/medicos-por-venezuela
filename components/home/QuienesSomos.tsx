// Quiénes Somos. Bloque de texto sobre fondo blanco, destino del ancla "Quiénes Somos" del navbar.
//
// El prototipo lo monta a dos columnas: texto a la izquierda y una foto de 460 px a la derecha
// ("médico venezolano en consulta virtual"). Esa foto NO está entre los assets entregados, así que
// la sección va a una sola columna. Para que el texto no quede en líneas larguísimas de 1180 px se
// limita el ancho de lectura; el día que llegue la foto, se recupera el `display:flex` del
// prototipo y se quita ese tope.
//
// "Conoce nuestra historia →" va como texto y no como enlace: la página Quiénes Somos está fuera
// del alcance de este trabajo, y un enlace que no lleva a ninguna parte en la home de una
// organización médica erosiona justo la credibilidad que el texto defiende.

import { QUIENES_SOMOS } from './copy'
import { useReveal } from './motion'

export default function QuienesSomos() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="quienes" id="quienes-somos">
      <div ref={ref} className={`contenido ${className}`}>
        <p className="eyebrow">{QUIENES_SOMOS.eyebrow}</p>
        <div className="filete" aria-hidden="true" />
        <h2 className="titulo">{QUIENES_SOMOS.titulo}</h2>
        {QUIENES_SOMOS.parrafos.map((p) => (
          <p className="parrafo" key={p.slice(0, 24)}>
            {p}
          </p>
        ))}
        <span className="historia" aria-disabled="true">
          {QUIENES_SOMOS.cta}
        </span>
      </div>

      <style jsx>{`
        .quienes {
          background: var(--h-white);
          padding: 110px 48px 90px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-blue);
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
          margin: 0 0 22px;
          /* Sin la foto del prototipo el titular se estiraría a 1180 px. Un titular de 40 px en
             una línea de más de ~20 palabras se lee mal. */
          max-width: 780px;
        }
        .parrafo {
          font-size: 16px;
          color: var(--h-grey);
          line-height: 1.8;
          margin: 0 0 20px;
          max-width: 720px;
        }
        .parrafo:last-of-type {
          margin-bottom: 32px;
        }
        /* Texto, no enlace: sin cursor de mano y sin reacción al hover, para no prometer un clic
           que no existe. */
        .historia {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--h-blue-deep);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--h-blue-deep);
          padding-bottom: 6px;
          opacity: 0.55;
          cursor: default;
        }

        @media (max-width: 900px) {
          .quienes {
            padding: 72px 24px 64px;
          }
          .parrafo {
            font-size: 15.5px;
          }
        }
      `}</style>
    </section>
  )
}
