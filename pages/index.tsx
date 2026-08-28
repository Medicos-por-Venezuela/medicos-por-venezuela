// Home — refrescamiento de imagen 2026-08 (prototipo de The Climb).
//
// Este archivo es SOLO composición: cada sección vive en `components/home/`. El home anterior
// tenía 1313 líneas con los iconos SVG, los datos y los estilos mezclados; con doce secciones
// nuevas eso habría superado con creces el umbral de tamaño que el propio review del repo marca.
// (El home viejo sigue en el historial: `git show origin/dev_aws:pages/index.tsx`.)
//
// `.home-theme` acota los tokens de marca y la tipografía a esta página: `globals.css` lo carga
// `_app.tsx` para todo el sitio, así que tocar `:root` habría repintado el panel médico y el
// admin, que están fuera del alcance.
//
// Estado: las doce secciones del prototipo están montadas (T1–T9), más la banda de Psicología que
// entró con la segunda ronda de copy (2026-08-28). Quedan los assets de foto que no se entregaron
// y el re-skin de las páginas de registro — ver `tasks/home-refresh/todo.md`.
//
// El ORDEN de las secciones y el color de fondo de cada una los fija el copy aprobado, no el gusto
// de cada componente: 01 Hero #f4f4f4 · 02 Puertas #18202b · 03 Psicología #0066fe · 04 Quiénes
// Somos (con la banda de Valores) #f4f4f4 · 05 Cómo Funciona #18202b · 06 Especialistas #0066fe ·
// 07 Testimonios #f4f4f4 · 08 Impacto #003d5f · 09 Blog #f4f4f4 · 10 CTA final y 11 pie #18202b.
// Cada `background` vive en su sección; esta lista es el mapa para comprobarlo de un vistazo.

import Head from 'next/head'
import Blog from '../components/home/Blog'
import ComoFunciona from '../components/home/ComoFunciona'
import CtaFinal from '../components/home/CtaFinal'
import Especialistas from '../components/home/Especialistas'
import Footer from '../components/home/Footer'
import Hero from '../components/home/Hero'
import Metricas from '../components/home/Metricas'
import Navbar from '../components/home/Navbar'
import Psicologia from '../components/home/Psicologia'
import Puertas from '../components/home/Puertas'
import QuienesSomos from '../components/home/QuienesSomos'
import Testimonios from '../components/home/Testimonios'
import Valores from '../components/home/Valores'
import { MARCA } from '../components/home/copy'
import { comoScript, schemaHome } from '../lib/schema'

export default function Home() {
  return (
    <div className="home-theme">
      <Head>
        <title>{`${MARCA.nombre} — ${MARCA.tagline}`}</title>
        <meta name="description" content={MARCA.tagline} />
        {/* La tipografía de marca entra en el primer render (titular del hero): sin preload, el
            navegador no la descubre hasta parsear el CSS y el texto salta al cambiar de fuente.
            Solo se precarga la redonda: la itálica la usa el tagline, que está más abajo. */}
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
          dangerouslySetInnerHTML={{ __html: comoScript(schemaHome()) }}
        />
      </Head>

      {/* Sin JavaScript, `useReveal` nunca llega a añadir `is-visible` y las secciones que lo usan
          se quedan en `opacity: 0` para siempre: el texto está en el HTML —se indexa y lo leen los
          rastreadores— pero una persona no vería nada. El hook ya contempla que falte
          `IntersectionObserver`; esto cubre el caso de que no haya JS en absoluto, que es el único
          que no puede resolverse desde JS. */}
      <noscript>
        <style>{`.home-theme .reveal { opacity: 1; transform: none; }`}</style>
      </noscript>

      <Navbar />

      <main>
        <Hero />
        <Puertas />
        <Psicologia />
        <QuienesSomos />
        <Valores />
        <ComoFunciona />
        <Especialistas />
        <Testimonios />
        <Metricas />
        <Blog />
        <CtaFinal />
      </main>

      <Footer />
    </div>
  )
}
