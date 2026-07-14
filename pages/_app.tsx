import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { PresenceProvider } from '../lib/presence'

export default function App({ Component, pageProps }: AppProps) {
  // PresenceProvider ancla la presencia del médico a la SESIÓN (no a una página), con un único
  // canal que persiste entre rutas: así un médico logueado queda "online" en el panel, la consulta
  // o donde navegue, en vez de caerse al salir del panel.
  return (
    <PresenceProvider>
      <Component {...pageProps} />
    </PresenceProvider>
  )
}
