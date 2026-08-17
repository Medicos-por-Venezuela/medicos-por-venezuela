// Los cuatro valores, en una banda con filetes entre columnas, justo debajo de Quiénes Somos.
//
// El prototipo pone una foto circular de 52 px junto a cada valor; esos assets no están
// entregados, así que van solo en texto. Y los valores son los del `.docx` (Verificados,
// Autónomos, Gratuitos, Confidenciales), que difieren de los del prototipo — ver la nota en
// copy.ts.
//
// El `border-left` va en TODOS los ítems, incluido el primero, como en el prototipo: así la banda
// se lee como una rejilla y, cuando las columnas envuelven, el primero de cada fila sigue teniendo
// su filete en lugar de dejar un hueco raro.

import { VALORES } from './copy'
import { useReveal } from './motion'

export default function Valores() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="valores" aria-label="Nuestros valores">
      <div ref={ref} className={`banda ${className}`}>
        {VALORES.map((v) => (
          <div className="valor" key={v.titulo}>
            <h3 className="titulo">{v.titulo}</h3>
            <p className="descripcion">{v.descripcion}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        .valores {
          background: var(--h-white);
          padding: 0 48px 110px;
        }
        .banda {
          max-width: 1180px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        .valor {
          flex: 1 1 240px;
          padding: 32px 26px;
          border-left: 1px solid rgba(0, 0, 0, 0.1);
        }
        .titulo {
          font-size: 14px;
          font-weight: 800;
          color: var(--h-navy);
          margin: 0 0 6px;
        }
        .descripcion {
          font-size: 12.5px;
          color: var(--h-grey);
          line-height: 1.6;
          margin: 0;
        }

        @media (max-width: 900px) {
          .valores {
            padding: 0 24px 72px;
          }
          /* Apilados: el filete vertical no separa nada, y en una columna sola queda como una
             barra decorativa a la izquierda del texto. Pasa a horizontal, salvo en el primero,
             que ya tiene el borde superior de la banda. */
          .valor {
            flex-basis: 100%;
            padding: 24px 0;
            border-left: none;
          }
          .valor + .valor {
            border-top: 1px solid rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>
    </section>
  )
}
