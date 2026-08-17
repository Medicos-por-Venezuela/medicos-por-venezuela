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
// Estado: las doce secciones del prototipo están montadas (T1–T9). Quedan los assets de foto
// que no se entregaron y el re-skin de las páginas de registro — ver `tasks/todo.md`.

import Head from 'next/head'
import Blog from '../components/home/Blog'
import ComoFunciona from '../components/home/ComoFunciona'
import CtaFinal from '../components/home/CtaFinal'
import Especialistas from '../components/home/Especialistas'
import Footer from '../components/home/Footer'
import Hero from '../components/home/Hero'
import Metricas from '../components/home/Metricas'
import Navbar from '../components/home/Navbar'
import Puertas from '../components/home/Puertas'
import QuienesSomos from '../components/home/QuienesSomos'
import Testimonios from '../components/home/Testimonios'
import Valores from '../components/home/Valores'
import { MARCA } from '../components/home/copy'

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
