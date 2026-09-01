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

  // RED DE SEGURIDAD: un token de sesión que aterriza donde nadie lo recoge.
  //
  // Supabase devuelve los tokens en el FRAGMENTO de la URL. Cuando el `redirect_to` que pide la
  // app no está en la lista de Redirect URLs del proyecto, Supabase lo descarta y cae al
  // `Site URL`, que es la raíz del sitio. Y en la raíz no pasa nada: el cliente se crea con
  // `detectSessionInUrl: false` (ver `lib/supabase.ts`), así que la portada ni siquiera mira el
  // fragmento. El usuario ve la home, sin sesión, y vuelve a intentarlo.
  //
  // Ha pasado con las dos mitades de auth, por el mismo motivo:
  //   · Recuperación de contraseña: los correos enviados desde el panel de Supabase van sin
  //     `redirectTo`, así que SIEMPRE aterrizan en la raíz.
  //   · Login con Google: la lista solo tenía el host `www` cuando el sitio pasó a servirse desde
  //     el apex, y `lib/auth.ts` construye el `redirectTo` con `window.location.origin`. Sintoma
  //     reportado: "tuve que darle dos veces a entrar con Google".
  //
  // Esto reenvía el fragmento a la página que sí sabe qué hacer con él. Es defensa en profundidad,
  // no el arreglo: lo que toca arreglar es la lista de Redirect URLs. Pero un fallo de
  // configuración no debería dejar a un usuario fuera sin explicación.
  //
  // Con `location.replace` y no con el router de Next, por dos razones: el router puede perder el
  // hash por el camino, y `replace` no deja la URL con el token en el historial del navegador.
  //
  // Un fragmento con `error=` y sin token no se reenvía: sigue sin hacer nada, igual que hoy.
  useMountEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    // Un token de recuperación va a la página que pide la contraseña nueva; cualquier otro token
    // de sesión —el de Google— va a la callback, que es quien sabe canjearlo y rutear por rol.
    const destino = hash.includes('type=recovery')
      ? '/auth/recuperar'
      : hash.includes('access_token=')
        ? '/auth/callback'
        : null

    if (!destino) return
    if (window.location.pathname === destino) return
    window.location.replace(`${destino}${hash}`)
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
