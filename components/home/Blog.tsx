// Blog: tres tarjetas placeholder con el badge "Próximamente", como pide el copy.
//
// NO son clicables y no llevan titulares inventados. Un titular con pinta de artículo real en una
// tarjeta que no lleva a ningún sitio promete contenido que no existe; y en una organización
// médica, un titular falso sobre salud es peor que una tarjeta vacía. El día que haya blog, estas
// tarjetas se conectan al CMS.
//
// Filetes con la misma técnica que las otras rejillas: contenedor con borde arriba+izquierda,
// celdas con derecha+abajo.

import { BLOG } from './copy'
import { useReveal } from './motion'

const PLAZAS = Array.from({ length: BLOG.plazas }, (_, i) => i)

export default function Blog() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="blog" aria-label="Blog">
      <div className="contenido">
        <div className="cabecera">
          <p className="eyebrow">
            {BLOG.eyebrow}
            <span className="proximo">{BLOG.badge}</span>
          </p>
          <div className="filete" aria-hidden="true" />
          <h2 className="titulo">{BLOG.titulo}</h2>
        </div>

        <div ref={ref} className={`rejilla ${className}`}>
          {PLAZAS.map((i) => (
            <article className="tarjeta" key={i}>
              <div className="cinta" aria-hidden="true" />
              <div className="cuerpo">
                <p className="categoria">{BLOG.plaza.categoria}</p>
                <p className="titular">{BLOG.plaza.titulo}</p>
                <p className="fecha">{BLOG.plaza.fecha}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style jsx>{`
        .blog {
          background: var(--h-grey-bg);
          padding: 110px 48px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        /* Era un flex a dos columnas con el "Ver todos" a la derecha; sin él sobra el reparto. */
        .cabecera {
          margin-bottom: 52px;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-blue-dark);
          text-transform: uppercase;
          letter-spacing: 0.18em;
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 0 10px;
        }
        .proximo {
          color: var(--h-grey);
          font-weight: 700;
          letter-spacing: 0.05em;
          border: 1px solid rgba(0, 0, 0, 0.15);
          padding: 2px 9px;
          border-radius: 2px;
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
          border-top: 1px solid rgba(0, 0, 0, 0.1);
          border-left: 1px solid rgba(0, 0, 0, 0.1);
        }
        .tarjeta {
          background: var(--h-white);
          border-right: 1px solid rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        .cinta {
          height: 8px;
          background: linear-gradient(90deg, var(--h-blue), var(--h-blue-deep));
        }
        .cuerpo {
          padding: 26px;
        }
        .categoria {
          font-size: 10px;
          font-weight: 800;
          color: var(--h-blue-dark);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0 0 12px;
        }
        .titular {
          font-size: 15px;
          font-weight: 800;
          color: var(--h-navy);
          line-height: 1.4;
          margin: 0 0 10px;
        }
        .fecha {
          font-size: 11.5px;
          color: var(--h-grey);
          margin: 0;
        }

        @media (max-width: 900px) {
          .blog {
            padding: 72px 24px;
          }
          .rejilla {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
