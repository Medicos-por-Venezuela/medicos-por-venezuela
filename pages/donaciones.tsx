// /donaciones — la campaña de donativos.
//
// Es un PORTE de la plantilla `mxv-donativos/index.html`, y la fidelidad visual con ese archivo
// manda sobre la coherencia con el resto del sitio: la página trae su propia cabecera y su propio
// pie y se queda con ellos (decisión del cliente). Por eso no monta `components/home/Navbar` ni
// `components/home/Footer`, y por eso tampoco hay un enlace a aquí en la navegación del sitio —
// se llega por el enlace de la campaña.
//
// LOS DOS RIESGOS DE ESTA PÁGINA, y dónde está resuelto cada uno:
//
//   1. QUE SUS ESTILOS SE ESCAPEN. La plantilla estiliza `:root`, `*`, `html`, `body`, `img`,
//      `section`, `h2` y `footer`. Volcar eso en `styles/globals.css` reventaría la aplicación.
//      Todo vive en `components/donaciones/estilos.module.css`, un CSS Module donde cada regla
//      está prefijada con el contenedor `.donaciones`; la cabecera de ese archivo explica por qué
//      un módulo y no styled-jsx (el patrón habitual del repo), y qué hace falta neutralizar en
//      el sentido contrario para que `globals.css` no le cambie el aspecto a la plantilla.
//
//   2. LA HIDRATACIÓN. El guion original arrancaba leyendo `localStorage` y animando números, dos
//      cosas que en Next hacen que el primer render del cliente no coincida con el del servidor.
//      Aquí el HTML del servidor es SIEMPRE el mismo —castellano, cifras en su valor final, barra
//      fija oculta— y el navegador solo cambia las cosas después de hidratar. Ver `idioma.ts`,
//      `NumeroAnimado.tsx` y `utilidades.ts`.

import Head from 'next/head'
import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import BarraFija from '../components/donaciones/BarraFija'
import Cabecera from '../components/donaciones/Cabecera'
import Cierre from '../components/donaciones/Cierre'
import Equipo from '../components/donaciones/Equipo'
import { DefinicionEstrella } from '../components/donaciones/Estrella'
import Hero from '../components/donaciones/Hero'
import PieDonaciones from '../components/donaciones/PieDonaciones'
import PorQue from '../components/donaciones/PorQue'
import Voces from '../components/donaciones/Voces'
import { cls } from '../components/donaciones/clases'
import { TITULO } from '../components/donaciones/contenido'
import { useIdioma } from '../components/donaciones/idioma'
import { seguir } from '../components/donaciones/seguimiento'
import { desplazarHastaAncla } from '../components/donaciones/utilidades'
import { useMountEffect } from '../lib/hooks'
import { SITIO } from '../lib/schema'

/** Las descripciones de la plantilla, una por idioma. */
const DESCRIPCION = {
  es:
    'Médicos venezolanos atienden gratis por videollamada a quien no puede pagar una consulta. ' +
    'Apoya a Médicos por Venezuela.',
  en:
    'Venezuelan doctors see patients for free by video call when they cannot pay for a visit. ' +
    'Support Médicos por Venezuela.'
}

/** El color del fondo de la plantilla (`--abismo`). */
const ABISMO = '#0a1220'

export default function Donaciones() {
  const idioma = useIdioma()
  const [cajaArriba, setCajaArriba] = useState(false)

  // `useCallback` para que el efecto de `CajaDonacion` que observa su posición no se vuelva a
  // montar en cada render del padre.
  const alQuedarArriba = useCallback((arriba: boolean) => setCajaArriba(arriba), [])

  const alPulsarAncla = useCallback(
    (evento: MouseEvent<HTMLAnchorElement>) => desplazarHastaAncla(evento),
    []
  )

  // El fondo oscuro tiene que llegar al `<body>`, que está fuera del ámbito del módulo: el
  // contenedor de la página cubre toda la pantalla, pero el rebote del scroll en iOS deja ver lo
  // que hay detrás, y detrás está el gris claro del resto del sitio (`globals.css`). Se hace con
  // un estilo en línea y se devuelve al salir, en vez de con una regla global que se quedaría
  // cargada al navegar a otra página.
  useMountEffect(() => {
    const anterior = document.body.style.background
    document.body.style.background = ABISMO
    return () => {
      document.body.style.background = anterior
    }
  })

  // `vista_landing`, el evento con el que la campaña cuenta las visitas.
  useMountEffect(() => {
    seguir('vista_landing', idioma)
  })

  // El atributo `lang` del documento lo pone `_document.tsx` en castellano, que es lo que hidrata.
  // Si la persona tenía elegido el inglés, se corrige aquí: es lo que decide la pronunciación de
  // un lector de pantalla y el idioma que ofrece el traductor del navegador. Y se restituye al
  // salir, porque el resto del sitio está en castellano.
  useEffect(() => {
    const anterior = document.documentElement.lang
    document.documentElement.lang = idioma
    return () => {
      document.documentElement.lang = anterior
    }
  }, [idioma])

  return (
    <>
      <Head>
        <title>{TITULO[idioma]}</title>
        <meta name="description" content={DESCRIPCION[idioma]} />
        <link rel="canonical" href={`${SITIO}/donaciones`} />
        {/* El navy de la plantilla, más oscuro que el del resto del sitio: en Android la barra
            del navegador se pinta con esto y así no se parte la pantalla en dos tonos. */}
        <meta name="theme-color" content={ABISMO} />
        {/* Open Graph con el título de la CAMPAÑA, que no es el de la pestaña: lo que funciona al
            compartir el enlace por WhatsApp es la promesa, no el nombre de la página. Viene así
            de la plantilla, y es la razón por la que esta página no usa `components/Seo.tsx`, que
            reutiliza un mismo título para las dos cosas. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Médicos por Venezuela" />
        <meta property="og:url" content={`${SITIO}/donaciones`} />
        <meta
          property="og:title"
          content={
            idioma === 'es'
              ? 'Tú puedes hacer posible la próxima consulta'
              : 'You can make the next consultation possible'
          }
        />
        <meta
          property="og:description"
          content={
            idioma === 'es'
              ? 'Conocimiento médico al servicio de Venezuela. Dona desde $1.'
              : 'Medical knowledge at the service of Venezuela. Give from $1.'
          }
        />
      </Head>

      {/* `data-lang` es el único interruptor del idioma: el CSS esconde con él todo lo que esté
          marcado con el otro `lang` (ver `Bilingue.tsx`). */}
      <div className={cls('donaciones')} data-lang={idioma}>
        <DefinicionEstrella />

        <div
          className={cls('bandera')}
          aria-hidden="true"
          style={{ position: 'relative', zIndex: 7 }}
        >
          <i />
          <i />
          <i />
        </div>

        <Cabecera idioma={idioma} alPulsarAncla={alPulsarAncla} />

        <main>
          <Hero idioma={idioma} alPulsarAncla={alPulsarAncla} alQuedarArriba={alQuedarArriba} />
          <PorQue idioma={idioma} alPulsarAncla={alPulsarAncla} />
          <Voces idioma={idioma} alPulsarAncla={alPulsarAncla} />
          <Equipo idioma={idioma} alPulsarAncla={alPulsarAncla} />
          <Cierre idioma={idioma} alPulsarAncla={alPulsarAncla} />
        </main>

        <div className={cls('bandera')} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <PieDonaciones idioma={idioma} />

        <BarraFija idioma={idioma} visible={cajaArriba} alPulsarAncla={alPulsarAncla} />
      </div>
    </>
  )
}
