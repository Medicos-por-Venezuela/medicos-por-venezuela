// Pie del home, sobre `--h-navy`. Cuatro columnas (marca, plataforma, organización, contacto) y
// una franja inferior con el aviso legal y el copyright. Valores del prototipo de The Climb.
//
// El aviso legal va completo y legible a propósito: en una plataforma de orientación médica, la
// frase de "esto no reemplaza la atención de urgencia" es lo que evita que alguien con una
// emergencia se quede esperando una videollamada.

import Image from 'next/image'
import Link from 'next/link'
import { FOOTER, MARCA } from './copy'

export default function Footer() {
  return (
    <footer className="pie">
      <div className="contenido">
        <div className="columnas">
          <div className="col col-marca">
            {/* `unoptimized`: SVG vectorial de 4 KB; ver la nota del isotipo en Navbar. */}
            <Image
              src="/brand/logo-white.svg"
              alt={MARCA.nombre}
              width={168}
              height={64}
              unoptimized
            />
            <p className="tagline">{MARCA.tagline}</p>
            <p className="descripcion">{FOOTER.descripcion}</p>
          </div>

          {FOOTER.columnas.map((columna) => (
            <div className="col" key={columna.titulo}>
              <h2 className="titulo">{columna.titulo}</h2>
              <div className="lista">
                {columna.enlaces.map((enlace) =>
                  'href' in enlace && enlace.href ? (
                    <Link key={enlace.label} href={enlace.href} className="enlace">
                      {enlace.label}
                    </Link>
                  ) : 'ancla' in enlace && enlace.ancla ? (
                    <a key={enlace.label} href={`#${enlace.ancla}`} className="enlace">
                      {enlace.label}
                    </a>
                  ) : (
                    // Página aún inexistente: texto, no enlace.
                    <span key={enlace.label} className="enlace enlace-inerte" aria-disabled="true">
                      {enlace.label}
                    </span>
                  )
                )}
              </div>
            </div>
          ))}

          <div className="col">
            <h2 className="titulo">Contacto</h2>
            <div className="lista">
              <a className="enlace" href={`mailto:${MARCA.correo}`}>
                {MARCA.correo}
              </a>
              <a
                className="enlace"
                href={MARCA.instagramUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {MARCA.instagram}
              </a>
              <a
                className="enlace"
                href={`https://${MARCA.web}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {MARCA.web}
              </a>
            </div>
          </div>
        </div>

        <div className="legal">
          <p className="aviso">{FOOTER.avisoLegal}</p>
          <p className="copyright">{FOOTER.copyright}</p>
        </div>
      </div>

      {/* `:global()` acotado por un ancestro scopeado: los <a> que renderiza `Link` y el
          <img> que renderiza `Image` no llevan la clase de styled-jsx. Sin esto, los tres
          enlaces de "Plataforma" se pintaban con el color y el tamaño heredados en vez de
          los suyos. Explicación completa en components/home/Navbar.tsx. */}
      <style jsx>{`
        .pie {
          background: var(--h-navy);
          color: var(--h-white);
          padding: 72px 40px 32px;
        }
        .contenido {
          max-width: 1200px;
          margin: 0 auto;
        }
        .columnas {
          display: flex;
          flex-wrap: wrap;
          gap: 48px;
          padding-bottom: 44px;
        }
        .col {
          flex: 1 1 180px;
        }
        .col-marca {
          flex: 1 1 320px;
        }
        .col-marca :global(img) {
          height: auto;
          max-width: 168px;
        }
        .tagline {
          font-size: 12.5px;
          font-style: italic;
          color: rgba(255, 255, 255, 0.6);
          margin: 14px 0 0;
        }
        .descripcion {
          font-size: 12.5px;
          line-height: 1.7;
          color: var(--h-sobre-oscuro-tenue);
          margin: 16px 0 0;
          max-width: 380px;
        }
        .titulo {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--h-sobre-oscuro-tenue);
          margin: 0 0 20px;
        }
        .lista {
          display: flex;
          flex-direction: column;
          gap: 11px;
        }
        .lista :global(.enlace) {
          font-size: 12.5px;
          color: var(--h-sobre-oscuro-medio);
          transition: color var(--h-t-hover) var(--h-ease);
        }
        .lista :global(.enlace:hover),
        .lista :global(.enlace:focus-visible) {
          color: rgba(255, 255, 255, 0.9);
        }
        .lista :global(.enlace-inerte),
        .lista :global(.enlace-inerte:hover) {
          color: var(--h-sobre-oscuro-tenue);
          cursor: default;
        }
        .legal {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 26px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .aviso {
          font-size: 11px;
          line-height: 1.6;
          color: var(--h-sobre-oscuro-tenue);
          max-width: 640px;
          margin: 0;
        }
        .copyright {
          font-size: 11px;
          color: var(--h-sobre-oscuro-tenue);
          white-space: nowrap;
          margin: 0;
        }

        @media (max-width: 960px) {
          .pie {
            padding: 56px 24px 28px;
          }
          .columnas {
            gap: 36px;
          }
        }
      `}</style>
    </footer>
  )
}
