// Página "Quiénes Somos". Destino de "Conoce nuestra historia →" del home y del enlace del pie.
//
// El "Quiénes Somos" del MENÚ no lleva aquí: sigue siendo el ancla de la sección del home. Fue una
// decisión explícita del equipo (2026-08-28) — el menú da un vistazo, la página cuenta la historia
// y presenta a las personas.
//
// Composición, igual que `pages/index.tsx`: el envoltorio `.home-theme` acota los tokens de marca
// y la tipografía a esta página, sin tocar `:root`, para no repintar el panel médico ni el admin.
// Navbar y Footer son los mismos componentes del home; sus anclas se escriben con `/` delante
// justamente para que desde aquí lleven a la sección correspondiente del home.

import Head from 'next/head'
import Equipo from '../components/home/Equipo'
import Footer from '../components/home/Footer'
import Navbar from '../components/home/Navbar'
import QuienesSomosCabecera from '../components/home/QuienesSomosCabecera'
import { MARCA, QUIENES_SOMOS } from '../components/home/copy'
import { comoScript, schemaQuienesSomos } from '../lib/schema'

export default function QuienesSomosPage() {
  return (
    <div className="home-theme">
      <Head>
        <title>{`${QUIENES_SOMOS.eyebrow} — ${MARCA.nombre}`}</title>
        <meta name="description" content={QUIENES_SOMOS.titulo} />
        {/* Mismo preload que el home: el titular de la cabecera se pinta con la fuente de marca en
            el primer render, y sin preload el texto salta al cambiar de fuente. */}
        <link
          rel="preload"
          href="/brand/nunito-sans-variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* JSON-LD. Va en el HTML del servidor, no inyectado desde JavaScript: la guía de
            Google de diciembre de 2025 avisa de que los datos estructurados que aparecen solo tras
            ejecutar JS pueden procesarse con retraso. Estas páginas son estáticas, así que sale ya
            en la respuesta. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: comoScript(schemaQuienesSomos()) }}
        />
      </Head>

      {/* Sin JavaScript, `useReveal` nunca añade `is-visible` y el equipo se quedaría en
          `opacity: 0` para siempre. Misma red de seguridad que en el home. */}
      <noscript>
        <style>{`.home-theme .reveal { opacity: 1; transform: none; }`}</style>
      </noscript>

      <Navbar />

      <main>
        <QuienesSomosCabecera />
        <Equipo />
      </main>

      <Footer />
    </div>
  )
}
