// El equipo de Médicos por Venezuela, en `/quienes-somos`: cofundadoras y equipo, con cargo y
// biografía. Sobre el blanco roto de la paleta, con las fichas en blanco puro para separarlas.
//
// Son nombres REALES entregados por la organización, a diferencia de la rejilla de Especialistas
// del home, que es placeholder declarado. Van sin retrato a propósito: las fotos entregadas son
// para Especialistas, y una imagen de archivo aquí pondría una cara ajena junto al nombre de una
// persona real. Cuando lleguen sus retratos, entran en '.ficha' sin tocar la rejilla.

import { EQUIPO } from './copy'
import { useReveal } from './motion'

export default function Equipo() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="equipo" aria-label="Nuestro equipo">
      <div ref={ref} className={`contenido ${className}`}>
        <p className="eyebrow">{EQUIPO.eyebrow}</p>
        <div className="filete" aria-hidden="true" />
        <h2 className="titulo">{EQUIPO.titulo}</h2>

        {EQUIPO.grupos.map((grupo) => (
          <div className="grupo" key={grupo.titulo}>
            <h3 className="grupo-titulo">{grupo.titulo}</h3>
            <div className="rejilla">
              {grupo.personas.map((persona) => (
                <article className="ficha" key={persona.nombre}>
                  <h4 className="nombre">{persona.nombre}</h4>
                  <p className="cargo">{persona.cargo}</p>
                  <p className="bio">{persona.bio}</p>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .equipo {
          background: var(--h-grey-bg);
          padding: 96px 48px 104px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          /* Sobre el blanco roto, el azul de marca a 11 px da 4,41:1; la variante oscura, 6,20:1. */
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
          font-size: clamp(26px, 3.4vw, 36px);
          font-weight: 900;
          color: var(--h-navy);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 16px;
          max-width: 780px;
        }
        .grupo {
          margin-top: 56px;
        }
        .grupo-titulo {
          font-size: 12px;
          font-weight: 800;
          color: var(--h-navy);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin: 0 0 24px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        }
        /* 'auto-fit' con un mínimo de 300 px en vez de un número fijo de columnas: los dos grupos
           tienen distinto número de personas (2 y 4) y así los dos llenan la fila sin reglas
           separadas. Las fichas se estiran a la altura de la más alta de su fila. */
        .rejilla {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }
        .ficha {
          background: var(--h-white);
          border: 1px solid rgba(0, 0, 0, 0.08);
          padding: 30px 28px;
        }
        .nombre {
          font-size: 17px;
          font-weight: 900;
          color: var(--h-navy);
          line-height: 1.25;
          margin: 0 0 6px;
        }
        .cargo {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--h-blue-dark);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          line-height: 1.5;
          margin: 0 0 16px;
        }
        .bio {
          font-size: 13.5px;
          color: var(--h-grey);
          line-height: 1.75;
          margin: 0;
        }

        @media (max-width: 900px) {
          .equipo {
            padding: 64px 24px 72px;
          }
          .grupo {
            margin-top: 44px;
          }
          .rejilla {
            grid-template-columns: minmax(0, 1fr);
          }
          .ficha {
            padding: 26px 22px;
          }
        }
      `}</style>
    </section>
  )
}
