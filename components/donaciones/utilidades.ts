// Cuatro ayudas pequeñas que comparten varios bloques de la página de donaciones.

import type { MouseEvent } from 'react'
import { CONFIG, TEXTO_COMPARTIR } from './contenido'
import type { Idioma } from './idioma'

/**
 * ¿La persona ha pedido menos animación en su sistema?
 *
 * La plantilla lo resolvía una sola vez al cargar (`var reduce = matchMedia(…).matches`). Aquí se
 * consulta en el momento de animar: la preferencia se puede cambiar con la página abierta, y el
 * CSS ya reacciona a eso (`@media (prefers-reduced-motion: reduce)`), así que el guion también.
 *
 * Se llama solo desde manejadores y efectos, nunca durante el render: en el servidor no hay
 * `matchMedia` y un valor distinto entre servidor y cliente sería un error de hidratación.
 */
export function prefiereMenosMovimiento(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** `'smooth'` o `'auto'`, según la preferencia de movimiento. */
export function comoDesplazar(): ScrollBehavior {
  return prefiereMenosMovimiento() ? 'auto' : 'smooth'
}

/**
 * Agrupa los millares con punto, como `toLocaleString('es-VE')`.
 *
 * A mano y no con `Intl` a propósito: el formateo de `Intl` depende de los datos de localización
 * del entorno, y el Node que renderiza en el servidor no siempre trae los mismos que el navegador
 * que hidrata. Un separador distinto entre los dos —"1000" frente a "1.000"— es un error de
 * hidratación, y estos números se pintan ya formateados en el HTML inicial.
 */
export function formatearMiles(valor: number): string {
  return String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * El enlace de "compartir por WhatsApp", con el texto en el idioma activo.
 *
 * En la plantilla el `href` nacía como `"#"` y lo rellenaba el guion al cargar. Aquí se calcula
 * en el render: no depende de nada del navegador, así que el servidor pinta el enlace definitivo
 * y quien llegue con el JavaScript a medio cargar ya puede compartir.
 */
export function enlaceCompartir(idioma: Idioma): string {
  return `https://wa.me/?text=${encodeURIComponent(TEXTO_COMPARTIR[idioma] + CONFIG.urlLanding)}`
}

/**
 * Desplazamiento suave hasta un ancla de la propia página (`href="#donar"`).
 *
 * La plantilla lo conseguía con `html { scroll-behavior: smooth }`. Esa regla no se puede portar:
 * `html` está fuera del ámbito de la página y tocarlo afectaría a todo el sitio. Se hace aquí, que
 * además permite respetar `prefers-reduced-motion` y dejar el ancla en la URL SIN añadir una
 * entrada al historial por cada clic (el salto nativo sí la añadía: con cinco botones "Quiero
 * donar" repartidos por la página, volver atrás obligaba a pulsar cinco veces).
 */
export function desplazarHastaAncla(evento: MouseEvent<HTMLAnchorElement>): void {
  const ancla = evento.currentTarget.getAttribute('href')
  if (!ancla || !ancla.startsWith('#')) return
  const destino = document.getElementById(ancla.slice(1))
  if (!destino) return
  evento.preventDefault()
  destino.scrollIntoView({ behavior: comoDesplazar(), block: 'start' })
  window.history.replaceState(null, '', ancla)
}
