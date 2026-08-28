// Barra superior. Fija, 76 px, sobre `--h-navy`, con el isotipo + wordmark a la izquierda y la
// navegación + "Ingresar" a la derecha. Valores tomados del prototipo de The Climb.
//
// La usan el home Y `/quienes-somos`, así que las anclas se escriben `/#seccion` y no `#seccion`:
// desde una página que no es el home, un `#seccion` a secas no lleva a ninguna parte. Con el `/`
// delante, en el home sigue siendo un salto de fragmento (misma ruta, sin recarga) y desde la otra
// página navega al home y baja a la sección.
//
// NOTA sobre el tagline: el copy pide "el tagline aparece debajo del logo en el navbar — pequeño,
// en itálica", pero el prototipo NO lo incluye ahí (solo el wordmark), y en 360 px no cabe junto
// al isotipo sin romper la barra. Se sigue el prototipo. Pendiente de decidir (pregunta abierta 4
// del spec); el tagline sí aparece en el footer, donde sí hay sitio.

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { MARCA, NAV, RUTAS } from './copy'

export default function Navbar() {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <header className="nav">
        <Link href="/" className="marca" onClick={() => setAbierto(false)}>
          {/* El isotipo es decorativo: el nombre va como texto al lado, así que un `alt` aquí
              solo haría que el lector de pantalla dijera la marca dos veces.
              `unoptimized`: es un SVG, ya es vectorial y pesa 3 KB — pasarlo por el optimizador
              de Next exigiría `dangerouslyAllowSVG`, que abre la puerta a SVG con scripts. */}
          <Image src="/brand/iso-white.svg" alt="" width={26} height={26} unoptimized />
          <span className="wordmark">{MARCA.nombre}</span>
        </Link>

        <nav className="enlaces" aria-label="Navegación principal">
          {NAV.map((item) => {
            if (item.href) {
              return (
                <Link key={item.label} href={item.href} className="item">
                  {item.label}
                </Link>
              )
            }
            if (item.ancla) {
              return (
                <a key={item.label} href={`/#${item.ancla}`} className="item">
                  {item.label}
                </a>
              )
            }
            // Sin destino todavía (hoy solo Blog): texto, no enlace. Se marca con
            // `aria-disabled` para que un lector de pantalla no lo anuncie como navegable.
            return (
              <span key={item.label} className="item item-inerte" aria-disabled="true">
                {item.label}
              </span>
            )
          })}
          <Link href={RUTAS.ingresar} className="ingresar">
            Ingresar
          </Link>
        </nav>

        <button
          type="button"
          className="hamburguesa"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setAbierto((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {/* `<nav>` y no `<div>`: axe marcaba "All page content should be contained by landmarks"
          porque el menú abierto vive fuera del `<header>` (es `fixed`, cuelga del fragmento). Con
          un landmark propio, quien navega por regiones con lector de pantalla lo encuentra. */}
      {abierto && (
        <nav id="menu-movil" className="menu-movil" aria-label="Navegación principal (móvil)">
          {NAV.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="item"
                onClick={() => setAbierto(false)}
              >
                {item.label}
              </Link>
            ) : item.ancla ? (
              <a
                key={item.label}
                href={`/#${item.ancla}`}
                className="item"
                onClick={() => setAbierto(false)}
              >
                {item.label}
              </a>
            ) : (
              <span key={item.label} className="item item-inerte" aria-disabled="true">
                {item.label}
              </span>
            )
          )}
          <Link href={RUTAS.ingresar} className="ingresar" onClick={() => setAbierto(false)}>
            Ingresar
          </Link>
        </nav>
      )}

      {/* La barra es `fixed`: este hueco evita que el hero le quede debajo. */}
      <div className="hueco" aria-hidden="true" />

      {/* styled-jsx añade su clase de scope a los elementos nativos del JSX, pero NO a los
          componentes (`Link`, `Image`): el <a> que renderiza `Link` sale con `class="item"` a
          secas, sin `jsx-…`, así que una regla `.item` escrita normal no lo alcanza. Se vio en
          pantalla: "Únete" e "Ingresar" quedaban con el color heredado — navy sobre navy, texto
          invisible. Por eso las reglas que deben tocar un `Link` van en `:global()`, acotadas
          siempre por un ancestro sí scopeado (`.nav`, `.enlaces`, `.menu-movil`) para no
          filtrarse al resto del sitio.
          El home anterior no daba con esto porque navegaba con <button onClick={router.push}>
          en lugar de enlaces; aquí son enlaces de verdad, con href, y así se quedan. */}
      <style jsx>{`
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          height: var(--h-navbar);
          padding: 0 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--h-navy);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .hueco {
          height: var(--h-navbar);
        }
        .nav :global(.marca) {
          display: flex;
          align-items: center;
          gap: 13px;
        }
        .wordmark {
          font-size: 12.5px;
          font-weight: 800;
          color: var(--h-white);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .enlaces {
          display: flex;
          align-items: center;
          gap: 34px;
        }
        .enlaces :global(.item),
        .menu-movil :global(.item) {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--h-sobre-oscuro-medio);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding-bottom: 6px;
          border-bottom: 1px solid transparent;
          transition:
            color var(--h-t-hover) var(--h-ease),
            border-color var(--h-t-hover) var(--h-ease);
        }
        .enlaces :global(.item:hover),
        .enlaces :global(.item:focus-visible),
        .menu-movil :global(.item:hover),
        .menu-movil :global(.item:focus-visible) {
          color: var(--h-white);
          border-bottom-color: var(--h-blue);
        }
        /* Sin destino: ni cursor de mano ni reacción al hover, para no prometer un clic que no
           lleva a ninguna parte. */
        .enlaces :global(.item-inerte),
        .enlaces :global(.item-inerte:hover),
        .menu-movil :global(.item-inerte),
        .menu-movil :global(.item-inerte:hover) {
          color: var(--h-sobre-oscuro-tenue);
          border-bottom-color: transparent;
          cursor: default;
        }
        .nav :global(.ingresar),
        .menu-movil :global(.ingresar) {
          border: 1px solid rgba(255, 255, 255, 0.35);
          color: var(--h-white);
          padding: 9px 20px;
          border-radius: 2px;
          font-weight: 700;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          transition:
            background var(--h-t-hover) var(--h-ease),
            color var(--h-t-hover) var(--h-ease);
        }
        .nav :global(.ingresar:hover),
        .nav :global(.ingresar:focus-visible),
        .menu-movil :global(.ingresar:hover),
        .menu-movil :global(.ingresar:focus-visible) {
          background: var(--h-white);
          color: var(--h-navy);
        }
        .hamburguesa {
          display: none;
          width: 32px;
          height: 32px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          background: none;
          border: none;
          padding: 0;
        }
        .hamburguesa span {
          width: 20px;
          height: 1px;
          background: var(--h-white);
        }
        .menu-movil {
          position: fixed;
          top: var(--h-navbar);
          left: 0;
          right: 0;
          z-index: 99;
          background: var(--h-navy);
          padding: 24px 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .menu-movil :global(.ingresar) {
          text-align: center;
        }

        @media (max-width: 960px) {
          .nav {
            padding: 0 24px;
          }
          .enlaces {
            display: none;
          }
          .hamburguesa {
            display: flex;
          }
        }
      `}</style>
    </>
  )
}
