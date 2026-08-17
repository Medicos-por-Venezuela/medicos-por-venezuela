// Impacto: la banda azul de cifras. Es el destino del ancla "Impacto" del navbar.
//
// Las tres primeras se animan con `useCountUp`; "Presencia global" no es un número y se pinta tal
// cual. El contador arranca en el valor final (ver la nota en motion.ts), así que sin JavaScript
// se leen las cifras de verdad y no ceros: en una sección cuyo argumento es el impacto, un "0" por
// un fallo de carga es peor que no animar nada.
//
// Cada cifra vive en su propio componente porque `useCountUp` es un hook y no puede llamarse
// dentro de un `.map()`.

import { conMiles, IMPACTO } from './copy'
import { useCountUp } from './motion'

function Cifra({ numero }: { numero: number }) {
  const { ref, value } = useCountUp<HTMLSpanElement>(numero)
  return (
    <span className="numero" ref={ref}>
      +{conMiles(value)}
      <style jsx>{`
        .numero {
          font-size: clamp(32px, 3.6vw, 46px);
          font-weight: 900;
          color: var(--h-white);
          line-height: 1;
          letter-spacing: -0.03em;
          /* Reserva sitio para que la cifra no cambie de ancho mientras cuenta y arrastre a la
             etiqueta de al lado. */
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </span>
  )
}

export default function Metricas() {
  return (
    <section className="impacto" id="impacto" aria-label="Nuestro impacto">
      <div className="banda">
        {IMPACTO.map((m) => (
          <div className="cifra" key={m.etiqueta}>
            {'numero' in m ? <Cifra numero={m.numero} /> : <span className="texto">{m.texto}</span>}
            <span className="etiqueta">{m.etiqueta}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .impacto {
          background: var(--h-blue);
          padding: 80px 48px;
        }
        .banda {
          max-width: 960px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 24px 0;
        }
        /* El filete va en TODAS, incluida la primera, como en el prototipo: así la banda se lee
           como una rejilla y al envolver no queda ninguna fila sin su marca inicial. */
        .cifra {
          display: flex;
          flex-direction: column;
          padding: 8px 24px;
          border-left: 1px solid rgba(255, 255, 255, 0.25);
        }
        .texto {
          font-size: clamp(22px, 2.4vw, 30px);
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .etiqueta {
          font-size: 11px;
          color: var(--h-white);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 8px;
        }

        @media (max-width: 900px) {
          .impacto {
            padding: 56px 24px;
          }
          .banda {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 460px) {
          .banda {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
