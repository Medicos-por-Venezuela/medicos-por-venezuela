// Cómo Funciona: la única sección del home con estado. Tres pestañas (interconsulta, paciente,
// voluntario) con cuatro pasos cada una. Arranca en la primera —el médico que pide apoyo clínico—,
// como pide el copy de la segunda ronda; antes arrancaba en paciente.
//
// La sección pasó de blanco roto a navy en esa misma ronda, así que TODO el texto de aquí está
// recalculado sobre fondo oscuro: ver los tokens `--h-sobre-oscuro-*` de globals.css.
//
// Accesibilidad: es un tablist de verdad, no tres botones que cambian un div.
//   · `role="tablist"` / `role="tab"` / `role="tabpanel"`, con `aria-selected`, `aria-controls`
//     y `aria-labelledby` enlazados por id.
//   · **Roving tabindex**: solo la pestaña activa es tabulable (`tabIndex 0`), las otras quedan en
//     -1. Así el tabulador salta de la barra de pestañas al panel en un paso, en vez de obligar a
//     pasar por las tres. Dentro del grupo se navega con las flechas, que es lo que espera quien
//     usa lector de pantalla.
//   · Flechas izquierda/derecha (y Home/End) mueven foco Y selección — activación automática, que
//     es lo recomendado cuando el panel es texto y no hay nada costoso que cargar. Enter y Espacio
//     también seleccionan, por si alguien los pulsa.
//
// Cada panel termina en su BOTÓN DE REGISTRO (2026-08-28), con el mismo texto y el mismo destino
// que la puerta de entrada equivalente del principio del home: quien baja leyendo los pasos no
// debería tener que subir otra vez para encontrar por dónde se entra.
//
// El prototipo pone una foto a la izquierda ("médico atendiendo consulta por videollamada") que no
// está entre los assets entregados; la sección va a una columna, como Quiénes Somos.

import Link from 'next/link'
import { useRef, useState } from 'react'
import { COMO_FUNCIONA } from './copy'
import { useReveal } from './motion'

const FLUJOS = COMO_FUNCIONA.flujos

export default function ComoFunciona() {
  const [activo, setActivo] = useState(0)
  const { ref, className } = useReveal<HTMLDivElement>()
  const botones = useRef<Array<HTMLButtonElement | null>>([])

  const irA = (i: number) => {
    const siguiente = (i + FLUJOS.length) % FLUJOS.length
    setActivo(siguiente)
    botones.current[siguiente]?.focus()
  }

  const alPulsarTecla = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const acciones: Record<string, () => void> = {
      ArrowRight: () => irA(i + 1),
      ArrowLeft: () => irA(i - 1),
      Home: () => irA(0),
      End: () => irA(FLUJOS.length - 1),
      Enter: () => setActivo(i),
      ' ': () => setActivo(i)
    }
    const accion = acciones[e.key]
    if (!accion) return
    e.preventDefault()
    accion()
  }

  const flujo = FLUJOS[activo]

  return (
    <section className="como" id="como-funciona">
      <div ref={ref} className={`contenido ${className}`}>
        <div className="cabecera">
          <p className="eyebrow">{COMO_FUNCIONA.eyebrow}</p>
          <div className="filete" aria-hidden="true" />
          <h2 className="titulo">{COMO_FUNCIONA.titulo}</h2>
          <p className="intro">{COMO_FUNCIONA.intro}</p>
        </div>

        <div className="tabs" role="tablist" aria-label="Elige tu perfil">
          {FLUJOS.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              id={`tab-${f.id}`}
              aria-selected={i === activo}
              aria-controls={`panel-${f.id}`}
              tabIndex={i === activo ? 0 : -1}
              ref={(el) => {
                botones.current[i] = el
              }}
              className={`tab ${i === activo ? 'tab-activa' : ''}`}
              onClick={() => setActivo(i)}
              onKeyDown={(e) => alPulsarTecla(e, i)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        {/* `key` fuerza el remontado al cambiar de pestaña, que es lo que hace que la animación de
            entrada vuelva a correr. Solo se pinta el panel activo: los ocultos no deben ser
            tabulables ni leerse. */}
        <div
          key={flujo.id}
          className="panel"
          role="tabpanel"
          id={`panel-${flujo.id}`}
          aria-labelledby={`tab-${flujo.id}`}
          tabIndex={0}
        >
          <p className="panel-intro">{flujo.intro}</p>
          <ol className="pasos">
            {flujo.pasos.map((p) => (
              <li className="paso" key={p.numero}>
                <span className="numero" aria-hidden="true">
                  {p.numero}
                </span>
                <span className="detalle">
                  <span className="paso-titulo">{p.titulo}</span>
                  <span className="paso-desc">{p.descripcion}</span>
                </span>
              </li>
            ))}
          </ol>
          {/* El botón cierra el flujo: quien ha bajado leyendo los cuatro pasos no debería tener
              que volver a las puertas del principio para encontrar el registro. */}
          <Link href={flujo.href} className="cta">
            {flujo.cta}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .como {
          background: var(--h-navy);
          padding: 110px 48px;
        }
        .contenido {
          max-width: 1180px;
          margin: 0 auto;
        }
        .cabecera {
          margin-bottom: 44px;
          max-width: 720px;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          /* Sobre navy, el azul oscuro de marca es ilegible. La variante aclarada da 4,95:1. */
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
          font-size: clamp(26px, 3.4vw, 36px);
          font-weight: 900;
          color: var(--h-white);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 16px;
        }
        .intro {
          font-size: 15.5px;
          color: var(--h-sobre-oscuro-medio);
          line-height: 1.75;
          margin: 0;
        }
        .tabs {
          display: flex;
          flex-wrap: wrap;
          margin-bottom: 40px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.18);
        }
        .tab {
          padding: 12px 0;
          margin-right: 28px;
          font-size: 12px;
          font-weight: 700;
          border: none;
          border-bottom: 2px solid transparent;
          background: transparent;
          color: var(--h-sobre-oscuro-tenue);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition:
            color var(--h-t-hover) var(--h-ease),
            border-color var(--h-t-hover) var(--h-ease);
        }
        .tab:hover {
          color: var(--h-white);
        }
        .tab-activa {
          border-bottom-color: var(--h-white);
          color: var(--h-white);
        }
        /* El navegador no dibuja su contorno de foco sobre un borde de 2 px que ya cambia de color,
           así que se marca aparte: si no, con teclado no se distingue la pestaña enfocada. */
        .tab:focus-visible {
          outline: 2px solid var(--h-blue-claro);
          outline-offset: 3px;
        }
        .panel {
          /* Fundido de entrada de 200 ms al cambiar de pestaña. No es un cross-fade literal (el
             panel saliente no se desvanece a la vez): con paneles de altura distinta, superponerlos
             daría saltos de maquetación. Lo apaga el bloque de 'prefers-reduced-motion' de
             globals.css, que fuerza 'animation-duration' a ~0 dentro de '.home-theme'. */
          animation: como-entra 200ms var(--h-ease) both;
        }
        .panel:focus-visible {
          outline: 2px solid var(--h-blue-claro);
          outline-offset: 4px;
        }
        @keyframes como-entra {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .panel-intro {
          font-size: 14.5px;
          color: var(--h-sobre-oscuro-medio);
          line-height: 1.75;
          margin: 0 0 32px;
          max-width: 680px;
        }
        .pasos {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 26px;
          max-width: 680px;
        }
        .paso {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .numero {
          font-size: 26px;
          font-weight: 900;
          color: var(--h-blue-claro);
          line-height: 1.2;
          letter-spacing: -0.02em;
          flex-shrink: 0;
          width: 44px;
        }
        .detalle {
          display: flex;
          flex-direction: column;
        }
        .paso-titulo {
          font-size: 15px;
          font-weight: 800;
          color: var(--h-white);
          margin-bottom: 6px;
        }
        .paso-desc {
          font-size: 13px;
          color: var(--h-sobre-oscuro-medio);
          line-height: 1.7;
        }
        /* ':global()': el <a> que renderiza Link no lleva la clase de scope. Ver Navbar.tsx.
           Blanco sobre el azul de marca da 4,85:1, por encima del mínimo AA. */
        .panel :global(.cta) {
          display: inline-block;
          margin-top: 36px;
          background: var(--h-blue);
          color: var(--h-white);
          padding: 15px 28px;
          border-radius: 2px;
          font-size: 12.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          transition: background var(--h-t-hover) var(--h-ease);
        }
        .panel :global(.cta:hover),
        .panel :global(.cta:focus-visible) {
          background: var(--h-blue-dark);
        }

        @media (max-width: 900px) {
          .como {
            padding: 72px 24px;
          }
          .tab {
            margin-right: 20px;
            font-size: 11.5px;
          }
          .numero {
            font-size: 22px;
            width: 36px;
          }
        }
      `}</style>
    </section>
  )
}
