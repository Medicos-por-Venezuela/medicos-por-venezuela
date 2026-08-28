// Psicología: banda sobre el azul eléctrico de marca, entre las puertas de entrada y Quiénes
// Somos. Sección nueva de la segunda ronda de copy (2026-08-28).
//
// Va como banda de dos columnas (mensaje a la izquierda, botón a la derecha) y no como sección de
// contenido al uso: es una interrupción corta entre dos bloques largos, y darle la misma anatomía
// que Quiénes Somos o Cómo Funciona la haría pesar más de lo que dice.
//
// CONTRASTE — el azul `--h-blue` es el fondo más exigente de la paleta: da 4,85:1 contra blanco
// PURO, apenas por encima del 4,5:1 que pide WCAG AA. Un blanco al 80 % (`--h-sobre-oscuro-medio`,
// que es lo que usan las secciones navy) se queda en 3,63:1 y NO cumple. Por eso aquí todo el
// texto es `--h-white` sin transparencias, y la jerarquía se hace con tamaño y peso.
//
// El botón lleva al registro de paciente, el mismo destino que la telemedicina: no existe un flujo
// aparte para salud mental, y mandar a la gente a otra ruta sería prometer algo que no hay.
// Al pasar el ratón se vuelve navy en vez de aclararse: un blanco al 90 % dejaría el texto azul
// del botón en 4,20:1, por debajo del mínimo.

import Link from 'next/link'
import { PSICOLOGIA } from './copy'
import { useReveal } from './motion'

export default function Psicologia() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="psicologia" aria-label="Atención psicológica">
      <div ref={ref} className={`contenido ${className}`}>
        <div className="mensaje">
          <div className="filete" aria-hidden="true" />
          <h2 className="titulo">{PSICOLOGIA.titulo}</h2>
          <p className="texto">{PSICOLOGIA.texto}</p>
        </div>
        <Link href={PSICOLOGIA.href} className="cta">
          {PSICOLOGIA.cta}
        </Link>
      </div>

      {/* `:global()` acotado por un ancestro scopeado: el <a> que renderiza `Link` no lleva la
          clase de styled-jsx. Explicación completa en components/home/Navbar.tsx. */}
      <style jsx>{`
        .psicologia {
          background: var(--h-blue);
          padding: 84px 48px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 40px;
        }
        .mensaje {
          flex: 1 1 520px;
        }
        .filete {
          width: 36px;
          height: 2px;
          background: var(--h-white);
          margin-bottom: 24px;
        }
        .titulo {
          font-size: clamp(26px, 3.4vw, 36px);
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 18px;
        }
        .texto {
          font-size: 15.5px;
          color: var(--h-white);
          line-height: 1.8;
          margin: 0;
          max-width: 620px;
        }
        .contenido :global(.cta) {
          flex-shrink: 0;
          background: var(--h-white);
          color: var(--h-blue-dark);
          padding: 16px 30px;
          border-radius: 2px;
          font-size: 12.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          transition:
            background var(--h-t-hover) var(--h-ease),
            color var(--h-t-hover) var(--h-ease);
        }
        .contenido :global(.cta:hover),
        .contenido :global(.cta:focus-visible) {
          background: var(--h-navy);
          color: var(--h-white);
        }

        @media (max-width: 900px) {
          .psicologia {
            padding: 64px 24px;
          }
          .contenido {
            gap: 32px;
          }
          .texto {
            font-size: 15px;
          }
        }
      `}</style>
    </section>
  )
}
