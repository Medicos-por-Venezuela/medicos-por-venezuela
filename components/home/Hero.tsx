// Hero del home. Split a dos columnas: a la izquierda el mensaje (eyebrow, titular, subtítulo,
// dos CTA y tres métricas), a la derecha la foto con el rótulo "Interconsulta en curso" y la
// franja "24/7 · Disponible · Confidencial". Medidas tomadas del prototipo de The Climb.
//
// Es donde vive el **gesto mayor** que se acordó: el texto entra escalonado (60 ms entre bloques)
// mientras la foto hace un `scale(1.06) → 1` de 900 ms. Lo demás del sitio es sobrio a propósito;
// aquí se concentra el movimiento. Ambas cosas se apagan con `prefers-reduced-motion: reduce`.
//
// El escalonado se resuelve con la clase `.stagger` de `globals.css` y una animación CSS con
// `both`, no con JavaScript: el hero está sobre la línea de flotación y una animación que espera
// a que React hidrate se ve entrar tarde.
//
// NOMBRES DE CLASE — regla para las secciones que faltan: `globals.css` es global de verdad, y una
// regla scopeada de styled-jsx solo gana en las propiedades que declara; el resto cae al global del
// mismo nombre. Esta sección se llamaba `.hero` y `.badge`, que ya existían en `globals.css`, y
// heredaba en silencio `padding: 40px 24px`, `border-radius: 24px` y `color: white` del uno y
// `border-radius: 999px` del otro. Las demás clases de aquí (`columna`, `rejilla`, `franja`,
// `filete`) se libraron por estar en español. Así que: nombres en español, y antes de bautizar una
// clase, comprobar que no exista ya (`grep -n "^\.nombre" styles/globals.css`).

import Image from 'next/image'
import Link from 'next/link'
import { HERO, RUTAS } from './copy'

export default function Hero() {
  return (
    <section className="portada" id="inicio">
      <div className="rejilla">
        <div className="columna">
          {/* Marca de agua del prototipo: el isotipo al 4 % de opacidad. Decorativa por completo,
              de ahí el `alt` vacío y el `aria-hidden`. */}
          <Image
            className="marca-agua"
            src="/brand/iso-navy.svg"
            alt=""
            width={180}
            height={148}
            aria-hidden="true"
            unoptimized
          />

          <div className="texto stagger">
            <p className="eyebrow">{HERO.eyebrow}</p>
            <div className="filete" aria-hidden="true" />
            <h1 className="titular">
              {HERO.titulo}
              <span className="acento">{HERO.tituloAcento}</span>
            </h1>
            <p className="subtitulo">
              {HERO.subtitulo}
              <strong>{HERO.subtituloFuerte}</strong>
            </p>
            <div className="botones">
              <Link href={RUTAS.paciente} className="cta-primario">
                {HERO.ctaPrimario}
              </Link>
              {/* Ancla, no enlace a otra página: "Cómo funciona" es una sección de este mismo
                  home (llega en T7). */}
              <a href="#como-funciona" className="cta-secundario">
                {HERO.ctaSecundario}
              </a>
            </div>
            {/* Los separadores del prototipo son `border-left`, no elementos. Con <span> sueltos,
                al envolverse la fila quedaba una rayita colgando al final de la primera línea. */}
            <div className="metricas">
              {HERO.metricas.map((m) => (
                <div className="metrica" key={m.etiqueta}>
                  <span className="valor">{m.valor}</span>
                  <span className="etiqueta">{m.etiqueta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="media">
          {/* El `scale` va en este envoltorio y no en la <Image>: así la animación es de un
              elemento nativo y `overflow:hidden` del padre recorta lo que se sale al ampliar. */}
          <div className="foto">
            <Image
              src="/img/hero-interconsulta.webp"
              alt={HERO.fotoAlt}
              fill
              priority
              /* En móvil la foto ocupa el ancho completo; en escritorio, media pantalla. Sin esto
                 Next serviría la variante grande también en el móvil. */
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          </div>
          <span className="rotulo">{HERO.fotoBadge}</span>
          <div className="franja">
            <span className="dato">{HERO.fotoDato}</span>
            <span className="dato-pie">{HERO.fotoDatoPie}</span>
          </div>
        </div>
      </div>

      {/* Como en Navbar: `Link` e `Image` no reciben la clase de scope de styled-jsx, así que sus
          reglas van en `:global()` acotadas por un ancestro que sí la tiene. */}
      <style jsx>{`
        .portada {
          position: relative;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          background: var(--h-white);
        }
        .rejilla {
          display: flex;
          flex-wrap: wrap;
          align-items: stretch;
        }
        .columna {
          position: relative;
          overflow: hidden;
          flex: 1 1 480px;
          min-width: 340px;
          background: var(--h-white);
          padding: 60px 64px 72px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .columna :global(.marca-agua) {
          position: absolute;
          top: 40px;
          right: 0;
          width: 180px;
          height: auto;
          opacity: 0.04;
          pointer-events: none;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: var(--h-blue);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin: 0 0 10px;
        }
        .filete {
          width: 36px;
          height: 2px;
          background: var(--h-blue);
          margin-bottom: 28px;
        }
        .titular {
          font-size: clamp(34px, 4.4vw, 54px);
          font-weight: 900;
          color: var(--h-navy);
          line-height: 1.05;
          letter-spacing: -0.025em;
          margin: 0 0 22px;
          max-width: 560px;
        }
        .acento {
          color: var(--h-blue);
        }
        .subtitulo {
          font-size: 16.5px;
          color: var(--h-grey);
          line-height: 1.75;
          margin: 0 0 38px;
          max-width: 480px;
        }
        .subtitulo strong {
          color: var(--h-navy);
          font-weight: 700;
        }
        .botones {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 48px;
        }
        .botones :global(.cta-primario) {
          background: var(--h-blue);
          color: var(--h-white);
          padding: 15px 28px;
          border-radius: 2px;
          font-weight: 700;
          font-size: 12.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          transition: background var(--h-t-hover) var(--h-ease);
        }
        .botones :global(.cta-primario:hover),
        .botones :global(.cta-primario:focus-visible) {
          background: var(--h-blue-dark);
        }
        .cta-secundario {
          border: 1px solid rgba(0, 61, 95, 0.3);
          color: var(--h-blue-deep);
          padding: 14px 28px;
          border-radius: 2px;
          font-weight: 700;
          font-size: 12.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          transition:
            border-color var(--h-t-hover) var(--h-ease),
            background var(--h-t-hover) var(--h-ease);
        }
        .cta-secundario:hover,
        .cta-secundario:focus-visible {
          border-color: var(--h-blue-deep);
          background: var(--h-grey-bg);
        }
        .metricas {
          display: flex;
          align-items: center;
          gap: 16px 22px;
          flex-wrap: wrap;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          padding-top: 24px;
        }
        .metrica {
          display: flex;
          flex-direction: column;
        }
        /* Container query, no media query: lo que decide si las tres métricas caben en una línea
           es el ancho de ESTA columna, no el de la pantalla. Con un breakpoint de viewport se veía
           bien a 1440 y a 360 pero se rompía sobre los 1100, donde la pantalla es ancha y la
           columna estrecha. Por debajo del umbral se envuelven sin filete; por encima van en una
           sola fila con el filete entre ellas, como el prototipo. */
        .texto {
          position: relative;
          container-type: inline-size;
        }
        @container (min-width: 480px) {
          .metricas {
            flex-wrap: nowrap;
          }
          .metrica + .metrica {
            border-left: 1px solid rgba(0, 0, 0, 0.12);
            padding-left: 22px;
          }
        }
        .valor {
          font-size: 24px;
          font-weight: 900;
          color: var(--h-navy);
          line-height: 1;
        }
        .etiqueta {
          font-size: 10px;
          color: var(--h-grey);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
          margin-top: 4px;
        }

        .media {
          position: relative;
          overflow: hidden;
          flex: 1 1 480px;
          min-width: 340px;
          min-height: 560px;
          border-left: 1px solid rgba(0, 0, 0, 0.08);
        }
        .foto {
          position: absolute;
          inset: 0;
          animation: hero-foto 900ms var(--h-ease) both;
        }
        .foto :global(img) {
          object-fit: cover;
        }
        @keyframes hero-foto {
          from {
            transform: scale(1.06);
          }
          to {
            transform: none;
          }
        }
        .rotulo {
          position: absolute;
          left: 0;
          top: 0;
          background: var(--h-navy);
          color: var(--h-white);
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 10px 16px;
        }
        .franja {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.65), transparent);
          padding: 56px 24px 20px;
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .dato {
          font-size: 20px;
          font-weight: 900;
          color: var(--h-white);
          line-height: 1;
        }
        .dato-pie {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.75);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        /* Por debajo de 900 px las columnas se apilan: el padding del prototipo (64 px) dejaría
           el texto en una tira estrecha en un móvil de 360. */
        @media (max-width: 900px) {
          .columna {
            flex-basis: 100%;
            min-width: 0;
            padding: 72px 24px 56px;
          }
          .columna :global(.marca-agua) {
            width: 120px;
            top: 24px;
          }
          .media {
            flex-basis: 100%;
            min-width: 0;
            min-height: 420px;
            border-left: none;
            border-top: 1px solid rgba(0, 0, 0, 0.08);
          }
          .subtitulo {
            font-size: 15.5px;
            margin-bottom: 30px;
          }
          .botones {
            margin-bottom: 36px;
          }
        }
      `}</style>
    </section>
  )
}
