// Las tres puertas de entrada, sobre `--h-navy`, justo debajo del hero. Cada tarjeta es un enlace
// entero (no un div con un <a> dentro): el área de clic es la tarjeta completa, que es lo que
// espera cualquiera que la vea en un móvil.
//
// Los tres destinos existen de verdad. El de "Soy médico en Venezuela" es provisional: hoy no hay
// un flujo público de interconsulta —solo se puede invitar a un colega desde un caso ya abierto en
// el panel—, así que apunta al registro. Está anotado en `RUTAS.medicoVenezuela` y pendiente de
// verificar con las owners.
//
// Nombres de clase en español y comprobados contra `globals.css`; ver la nota en Hero.tsx.

import Link from 'next/link'
import { PUERTAS } from './copy'
import { useReveal } from './motion'

export default function Puertas() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="puertas" aria-label="Cómo entrar a la plataforma">
      <div className="contenido">
        <div ref={ref} className={`rejilla ${className}`}>
          {PUERTAS.tarjetas.map((t) => (
            <Link key={t.numero} href={t.href} className="puerta">
              <span className="numero">{t.numero}</span>
              <span className="nombre">{t.titulo}</span>
              <span className="descripcion">{t.descripcion}</span>
              <span className="accion">{t.accion}</span>
            </Link>
          ))}
        </div>
        <p className="pie">{PUERTAS.pie}</p>
      </div>

      <style jsx>{`
        .puertas {
          background: var(--h-navy);
        }
        .contenido {
          max-width: 1200px;
          margin: 0 auto;
        }
        .rejilla {
          display: flex;
          flex-wrap: wrap;
        }
        .rejilla :global(.puerta) {
          flex: 1 1 300px;
          padding: 48px 44px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          border-top: 2px solid transparent;
          transition: border-top-color var(--h-t-hover) var(--h-ease);
        }
        /* El filete azul superior del prototipo. También en :focus-visible: quien navega con
           teclado tiene que ver dónde está, no solo quien usa ratón. */
        .rejilla :global(.puerta:hover),
        .rejilla :global(.puerta:focus-visible) {
          border-top-color: var(--h-blue);
        }
        /* Separador entre tarjetas. Va con '+' en lugar de ':not(:first-child)' para que, cuando
           envuelvan en móvil, la primera de cada fila tampoco lo lleve de más: al apilarse en una
           sola columna se cambia por un borde superior (ver la media query). */
        .rejilla :global(.puerta + .puerta) {
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }
        .numero {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-sobre-oscuro-tenue);
          letter-spacing: 0.14em;
        }
        .nombre {
          font-size: 19px;
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.2;
        }
        .descripcion {
          font-size: 13.5px;
          color: var(--h-sobre-oscuro-medio);
          line-height: 1.65;
          flex-grow: 1;
        }
        .accion {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--h-blue-claro);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-top: 6px;
        }
        .pie {
          margin: 0;
          padding: 0 44px 40px;
          font-size: 11px;
          font-weight: 600;
          color: var(--h-sobre-oscuro-tenue);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        @media (max-width: 900px) {
          .rejilla :global(.puerta) {
            flex-basis: 100%;
            padding: 36px 24px;
          }
          /* Apiladas, el separador pasa a horizontal — pero por ABAJO, no por arriba: el borde
             superior se reserva para el acento azul del hover, que si no se pelearía con el
             separador y dejaría la primera tarjeta con un grosor distinto al resto. */
          .rejilla :global(.puerta + .puerta) {
            border-left: none;
          }
          .rejilla :global(.puerta:not(:last-child)) {
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
          .pie {
            padding: 0 24px 32px;
          }
        }
      `}</style>
    </section>
  )
}
