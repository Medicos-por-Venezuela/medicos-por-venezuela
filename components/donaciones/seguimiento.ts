// La medición de la página de donaciones: el `track()` de la plantilla, enchufado a lo que el
// sitio ya tiene montado.
//
// La plantilla mandaba cada evento a tres sitios (`gtag`, `fbq` y un `dataLayer` propio) y traía
// un comentario pidiendo "pegar aquí GA4 y Meta Pixel". No hace falta pegar nada: `_document.tsx`
// ya carga los dos, y SOLO en el dominio de producción (ver `lib/analytics.ts`). Así que esto
// delega en `trackEvent`, que es el que lleva ese guard, y añade el píxel de Meta —que
// `trackEvent` no toca— porque la plantilla cuenta con él. El `dataLayer` suelto se cae: `gtag`
// ya empuja ahí todo lo que recibe.
//
// Fuera de producción no se envía nada y no se pide nada a ningún tercero.

import { esProduccion, trackEvent } from '../../lib/analytics'
import type { Idioma } from './idioma'

// Lo crea el snippet de `_document.tsx` (`SNIPPET_META`), no un import.
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export type DatosEvento = Record<string, string | number>

/**
 * Manda un evento de la página de donaciones. Nunca lanza: una medición caída no puede impedir
 * que alguien done.
 *
 * El idioma va en todos los eventos porque es la pregunta de negocio de esta página (¿llegan de
 * la diáspora o de dentro?). No lleva ningún dato personal: ver el aviso de `trackEvent`.
 */
export function seguir(evento: string, idioma: Idioma, datos: DatosEvento = {}): void {
  const conIdioma = { ...datos, idioma }
  trackEvent(evento, conIdioma)
  if (!esProduccion()) return
  try {
    window.fbq?.('trackCustom', evento, conIdioma)
  } catch {
    // Silencio a propósito, igual que en `trackEvent`.
  }
}
