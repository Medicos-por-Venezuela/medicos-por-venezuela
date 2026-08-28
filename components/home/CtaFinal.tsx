// Cierre del home: las mismas tres audiencias que las puertas de entrada, ahora con el mensaje
// escrito desde el beneficio en vez de desde la necesidad. Es el último punto de conversión de la
// página, así que los tres destinos son los reales, no anclas.
//
// El prototipo lo monta sobre una foto de fondo ("médico venezolano sonriendo, ambiente clínico")
// que no está entre los assets entregados. Se resuelve con `--h-navy` y el mismo degradado que
// llevaría encima de la foto, de modo que el día que llegue solo hay que ponerla de fondo aquí.

import Link from 'next/link'
import { CTA_FINAL } from './copy'
import { useReveal } from './motion'

export default function CtaFinal() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="cierre" id="unete">
      <div className="contenido">
        <div className="cabecera">
          <p className="eyebrow">{CTA_FINAL.eyebrow}</p>
          <div className="filete" aria-hidden="true" />
          <h2 className="titulo">{CTA_FINAL.titulo}</h2>
        </div>

        <div ref={ref} className={`tarjetas ${className}`}>
          {CTA_FINAL.tarjetas.map((t) => (
            <div className="tarjeta" key={t.pretitulo}>
              <p className="pretitulo">{t.pretitulo}</p>
              <p className="tarjeta-titulo">{t.titulo}</p>
              <p className="descripcion">{t.descripcion}</p>
              <Link href={t.href} className="accion">
                {t.accion}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .cierre {
          position: relative;
          background: var(--h-navy);
          /* El degradado del prototipo, que allí iba sobre la foto. Sin ella no cambia gran cosa,
             pero deja el sitio preparado y da algo de profundidad al bloque. */
          background-image: linear-gradient(
            to top,
            rgba(11, 16, 24, 0.94),
            rgba(11, 16, 24, 0.55) 55%,
            rgba(11, 16, 24, 0.15)
          );
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
          padding: 64px 48px;
        }
        .cabecera {
          margin-bottom: 40px;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.55);
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
          color: var(--h-white);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0;
        }
        /* Número de columnas EXPLÍCITO, no 'auto-fit'. Con auto-fit el navegador decide cuántas
           columnas caben, y entonces las reglas de borde ya no pueden saber cuál es la última de
           cada fila: a 768 px seguían entrando tres columnas mientras la media query aplicaba los
           bordes pensados para el apilado, y la tercera tarjeta se descolgaba. Sabiendo el número
           de columnas, "última de la fila" es simplemente ':last-child'. */
        .tarjetas {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid rgba(255, 255, 255, 0.25);
        }
        .tarjeta {
          padding: 32px 32px 36px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255, 255, 255, 0.25);
        }
        .tarjeta:last-child {
          border-right: none;
        }
        .pretitulo {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.55);
          margin: 0 0 14px;
        }
        .tarjeta-titulo {
          font-size: 18px;
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.3;
          letter-spacing: -0.01em;
          margin: 0 0 12px;
        }
        .descripcion {
          font-size: 13.5px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.65;
          margin: 0 0 20px;
          flex-grow: 1;
        }
        .tarjetas :global(.accion) {
          align-self: flex-start;
          color: var(--h-white);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.5);
          padding-bottom: 4px;
          transition: border-color var(--h-t-hover) var(--h-ease);
        }
        .tarjetas :global(.accion:hover),
        .tarjetas :global(.accion:focus-visible) {
          border-bottom-color: var(--h-white);
        }

        /* Mismo punto de corte que las puertas de entrada (900 px): o las dos rejillas se apilan
           juntas o la página se ve a medio apilar. Al pasar a una columna, el separador deja de
           ser vertical y pasa a horizontal. */
        @media (max-width: 900px) {
          .contenido {
            padding: 56px 24px;
          }
          .tarjetas {
            grid-template-columns: minmax(0, 1fr);
          }
          .tarjeta {
            padding: 28px 0 32px;
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.25);
          }
          .tarjeta:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }
        }
      `}</style>
    </section>
  )
}
