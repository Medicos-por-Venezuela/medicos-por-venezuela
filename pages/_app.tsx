import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import '../styles/globals.css'
import { esProduccion } from '../lib/analytics'
import { useMountEffect } from '../lib/hooks'
import { PresenceProvider } from '../lib/presence'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  // El snippet de `_document` manda UNA vista de página: la de la carga inicial. Este sitio navega
  // del lado del cliente (el home enlaza a `/quienes-somos`, al registro, al panel…), y esas
  // navegaciones no recargan la página, así que sin esto Analytics vería a todo el mundo entrando
  // por el home y no saliendo de ahí jamás.
  //
  // `window.gtag` solo existe si el snippet decidió cargarse, es decir, en producción. Fuera de
  // ahí esto no hace nada, pero se comprueba igualmente con `esProduccion()` para no dejar ni la
  // suscripción a los eventos del router colgada donde no sirve.
  useMountEffect(() => {
    if (!esProduccion()) return
    const alCambiarDeRuta = (url: string) => {
      // Sin `page_title`: gtag lee el título del documento en el momento del envío, que a estas
      // alturas ya es el de la página nueva. Pasarlo a mano solo abriría la puerta a mandar el
      // anterior.
      window.gtag?.('event', 'page_view', {
        page_path: url,
        page_location: window.location.href
      })
    }
    router.events.on('routeChangeComplete', alCambiarDeRuta)
    return () => router.events.off('routeChangeComplete', alCambiarDeRuta)
  })

  // PresenceProvider ancla la presencia del médico a la SESIÓN (no a una página), con un único
  // canal que persiste entre rutas: así un médico logueado queda "online" en el panel, la consulta
  // o donde navegue, en vez de caerse al salir del panel.
  return (
    <PresenceProvider>
      <Component {...pageProps} />
    </PresenceProvider>
  )
}
