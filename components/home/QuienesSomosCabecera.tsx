// Cabecera de la página `/quienes-somos`. Sobre navy, pegada a la barra fija: las dos juntas leen
// como una sola masthead, que es lo que distingue una página interior del home.
//
// El texto es EL MISMO que el de la sección del home (`QUIENES_SOMOS`), a propósito: es el copy
// aprobado sobre la organización, y escribir aquí una variante «para la página» sería inventarse
// texto institucional que nadie ha aprobado. Lo que la página añade de nuevo es el equipo.
//
// Contraste sobre navy: eyebrow en la variante aclarada del azul (4,95:1; el azul de marca a 11 px
// se quedaría en 3,38:1) y los párrafos con el token de cuerpo sobre oscuro (10,9:1).

import { QUIENES_SOMOS } from './copy'

export default function QuienesSomosCabecera() {
  return (
    <section className="masthead" aria-label="Quiénes somos">
      <div className="contenido">
        <p className="eyebrow">{QUIENES_SOMOS.eyebrow}</p>
        <div className="filete" aria-hidden="true" />
        <h1 className="titulo">{QUIENES_SOMOS.titulo}</h1>
        {QUIENES_SOMOS.parrafos.map((p) => (
          <p className="parrafo" key={p.slice(0, 24)}>
            {p}
          </p>
        ))}
      </div>

      <style jsx>{`
        .masthead {
          background: var(--h-navy);
          padding: 96px 48px 104px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-blue-claro);
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
          font-size: clamp(30px, 4vw, 46px);
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.12;
          letter-spacing: -0.025em;
          margin: 0 0 24px;
          max-width: 820px;
        }
        .parrafo {
          font-size: 16px;
          color: var(--h-sobre-oscuro-medio);
          line-height: 1.8;
          margin: 0 0 18px;
          max-width: 720px;
        }
        .parrafo:last-child {
          margin-bottom: 0;
        }

        @media (max-width: 900px) {
          .masthead {
            padding: 64px 24px 72px;
          }
          .parrafo {
            font-size: 15.5px;
          }
        }
      `}</style>
    </section>
  )
}
