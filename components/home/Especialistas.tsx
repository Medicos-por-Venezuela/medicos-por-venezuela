// Especialistas: rejilla de seis perfiles sobre navy.
//
// ⚠️ Los seis son PLACEHOLDER, como declara el propio copy ("Oriana y Ada seleccionan los
// especialistas reales"). No llevan nombres inventados a propósito: una tarjeta con un nombre y
// una especialidad plausibles junto a un "✓ Verificado" es una credencial falsa aunque sea de
// mentira para maquetar, y esta organización se define justamente por verificar a sus médicos.
// Esto NO puede publicarse así; hay que cambiarlo por los perfiles reales.
//
// "Ver todos los especialistas →" va como texto: esa página está fuera del alcance de este trabajo.
//
// Los filetes de la rejilla se hacen con borde arriba+izquierda en el contenedor y
// derecha+abajo en cada celda. Es la técnica que no depende de cuántas columnas haya, así que
// sobrevive a los cambios de breakpoint sin dejar rayas sueltas.

import Image from 'next/image'
import { ESPECIALISTAS } from './copy'
import { useReveal } from './motion'

const PLAZAS = Array.from({ length: ESPECIALISTAS.plazas }, (_, i) => i)

export default function Especialistas() {
  const { ref, className } = useReveal<HTMLDivElement>()

  return (
    <section className="especialistas" aria-label="Nuestros especialistas">
      <div className="contenido">
        <div className="cabecera">
          <p className="eyebrow">{ESPECIALISTAS.eyebrow}</p>
          <div className="filete" aria-hidden="true" />
          <h2 className="titulo">{ESPECIALISTAS.titulo}</h2>
          <p className="subtitulo">{ESPECIALISTAS.subtitulo}</p>
        </div>

        <div ref={ref} className={`rejilla ${className}`}>
          {PLAZAS.map((i) => (
            <div className="ficha" key={i}>
              <Image
                className="avatar"
                src="/img/avatar-placeholder.png"
                alt=""
                width={64}
                height={64}
              />
              <p className="nombre">{ESPECIALISTAS.plaza.nombre}</p>
              <p className="especialidad">{ESPECIALISTAS.plaza.especialidad}</p>
              <p className="pais">{ESPECIALISTAS.plaza.pais}</p>
              <p className="verificado">
                <span className="check" aria-hidden="true">
                  ✓
                </span>{' '}
                {ESPECIALISTAS.verificado}
              </p>
            </div>
          ))}
        </div>

        <p className="ver-todos" aria-disabled="true">
          {ESPECIALISTAS.cta}
        </p>
      </div>

      <style jsx>{`
        .especialistas {
          background: var(--h-navy);
          padding: 110px 48px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        .cabecera {
          margin-bottom: 56px;
          max-width: 660px;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-sobre-oscuro-tenue);
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
          font-size: clamp(28px, 3.6vw, 42px);
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 18px;
        }
        .subtitulo {
          font-size: 15.5px;
          color: var(--h-sobre-oscuro-medio);
          line-height: 1.78;
          margin: 0;
        }
        .rejilla {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          border-left: 1px solid rgba(255, 255, 255, 0.12);
        }
        .ficha {
          border-right: 1px solid rgba(255, 255, 255, 0.12);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          padding: 26px;
        }
        .ficha :global(.avatar) {
          border-radius: 50%;
          margin-bottom: 18px;
          /* Es una silueta genérica, no una persona: se atenúa para que no compita con el texto
             ni parezca una foto real. */
          opacity: 0.5;
        }
        .nombre {
          font-size: 14.5px;
          font-weight: 800;
          color: var(--h-white);
          margin: 0 0 4px;
        }
        .especialidad {
          font-size: 11.5px;
          color: var(--h-blue-claro);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 8px;
        }
        .pais {
          font-size: 11px;
          color: var(--h-sobre-oscuro-tenue);
          margin: 0 0 16px;
        }
        .verificado {
          font-size: 9.5px;
          font-weight: 700;
          color: var(--h-sobre-oscuro-tenue);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0;
        }
        .check {
          color: var(--h-green);
        }
        .ver-todos {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 40px 0 0;
          padding-bottom: 14px;
          color: var(--h-white);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.5);
          opacity: 0.75;
          cursor: default;
        }

        @media (max-width: 900px) {
          .especialistas {
            padding: 72px 24px;
          }
          .rejilla {
            grid-template-columns: repeat(2, minmax(0, 1fr));
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
