// Quiénes Somos. Bloque de texto sobre el blanco roto de la paleta (#f4f4f4).
//
// El prototipo lo monta a dos columnas: texto a la izquierda y una foto de 460 px a la derecha
// ("médico venezolano en consulta virtual"). Esa foto NO está entre los assets entregados, así que
// el bloque de introducción va a una sola columna. Para que el texto no quede en líneas larguísimas
// de 1180 px se limita el ancho de lectura; el día que llegue la foto, se recupera el `display:flex`
// del prototipo y se quita ese tope.
//
// SEGUNDA RONDA (2026-08-28): el equipo NO vive aquí. Las cofundadoras y el resto de las personas
// se cuentan en `/quienes-somos` (`components/home/Equipo.tsx`), a la que se llega desde "Conoce
// nuestra historia →". El "Quiénes Somos" del menú sigue apuntando a esta sección del home.
//
// Ese CTA es ya un enlace de verdad, no el texto inerte que era: la página existe.

import Link from 'next/link'
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
        <Link href={QUIENES_SOMOS.ctaHref} className="historia">
          {QUIENES_SOMOS.cta}
        </Link>
      </div>

      <style jsx>{`
        .quienes {
          background: var(--h-grey-bg);
          padding: 110px 48px 90px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          /* Sobre el blanco roto, el azul de marca a 11 px da 4,41:1 y no llega al mínimo; la
             variante oscura da 6,20:1. Mismo criterio que la cabecera de Cómo Funciona. */
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
        /* ':global()': el <a> que renderiza Link no lleva la clase de scope. Ver Navbar.tsx. */
        .contenido :global(.historia) {
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
          transition: color var(--h-t-hover) var(--h-ease);
        }
        .contenido :global(.historia:hover),
        .contenido :global(.historia:focus-visible) {
          color: var(--h-blue-dark);
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
