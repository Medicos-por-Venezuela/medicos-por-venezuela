// Google Analytics 4. Se carga SOLO en el sitio de producción.
//
// La condición se comprueba en el NAVEGADOR, contra el dominio, y no en el build contra el nombre
// de la rama. Es a propósito:
//
//   · La rama no existe en tiempo de ejecución. Depender de una variable del proveedor
//     (`AWS_BRANCH` en Amplify, `VERCEL_GIT_COMMIT_REF` en Vercel) significa que el día que esa
//     variable no esté —un build local, un runner distinto, otro proveedor— el sitio publica
//     analítica sin que nadie se entere, o deja de publicarla sin que nadie se entere.
//   · El dominio sí es exactamente lo que se pidió: que no haya código de analítica en local ni en
//     la URL de previsualización de `dev_aws`. Ninguna de las dos sirve el sitio desde este
//     dominio, así que ninguna de las dos carga nada.
//
// El efecto práctico es el mismo que "solo en main", porque `medicosporvenezuela.org` sirve main;
// pero si mañana se publicara otra rama en producción, la analítica seguiría funcionando, que es lo
// que la organización querría, en vez de apagarse en silencio.
//
// Fuera de producción no se pide NADA a googletagmanager.com: el guard va antes de crear el
// <script>, no después de cargarlo.

export const GA_ID = 'G-09M01TF5F3'

// El apex es el dominio del sitio. `www` va incluido por seguridad: si hoy redirige al apex, esta
// entrada no se usa nunca y no molesta; si algún día sirviera el sitio directamente, sin ella se
// perderían esas visitas sin que saltara ningún error.
export const DOMINIOS_PRODUCCION = ['medicosporvenezuela.org', 'www.medicosporvenezuela.org']

// Se exporta como cadena para poder incrustarla tal cual en el <script> inline de `_document`,
// que corre antes de que exista ningún bundle de JavaScript de la aplicación.
export const CONDICION_PRODUCCION =
  `location.protocol === 'https:' && ` +
  `${JSON.stringify(DOMINIOS_PRODUCCION)}.indexOf(location.hostname) !== -1`

// Versión para el código de la aplicación (ver `pages/_app.tsx`). Devuelve false en el servidor.
export function esProduccion(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.location.protocol === 'https:' && DOMINIOS_PRODUCCION.includes(window.location.hostname)
  )
}

// El fragmento que se incrusta en el HTML. Es el snippet oficial de Google con dos cambios:
//
//   1. El guard. Y `gtag.js` se carga a mano en vez de con `<script async src>`, para que la
//      petición a Google solo exista si la condición se cumple. Con el `<script src>` del snippet
//      original, el navegador la haría siempre y el guard llegaría tarde.
//   2. Va dentro de una función anónima que se ejecuta sola, y el `dataLayer` se toca siempre por
//      `window.`. El snippet de Google, tal cual, deja `dataLayer` y la variable del <script> como
//      globales sueltas: en una página que ya carga Supabase y Realtime, no hace falta añadir dos
//      nombres más al espacio global para que alguien los pise sin darse cuenta.
//
// `gtag.js` lee `window.dataLayer` por su nombre, así que encapsularlo no le afecta.
export const SNIPPET_GA = `
(function () {
  if (!(${CONDICION_PRODUCCION})) return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
})();
`.trim()

// `gtag` lo crea el snippet de arriba, no un import: sin esto TypeScript no sabe que existe.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

// --- Eventos de conversión ---

/**
 * Envía un evento a GA4. No-op fuera de producción y si `gtag` no existe.
 *
 * **Nunca le pases datos personales ni de salud.** No es solo la política de Google: este es un
 * sitio médico, y el par "quién" + "qué le pasa" es justo lo que no puede salir de aquí. GA4
 * asigna un identificador de cliente a cada visitante, así que un parámetro como la especialidad
 * pedida convertiría el evento en "este visitante solicitó Psiquiatría". Los parámetros de estos
 * eventos describen el FLUJO (de dónde vino la conversión), nunca a la persona ni su caso.
 *
 * Tres razones para que no lance nunca: `gtag` puede no existir (bloqueador de anuncios, script
 * caído, fuera de producción), y una analítica que reviente no puede tumbar un registro de
 * paciente. Medir es secundario; atender no.
 */
export function trackEvent(nombre: string, params?: Record<string, string | number>): void {
  if (!esProduccion()) return
  const gtag = typeof window === 'undefined' ? undefined : window.gtag
  if (!gtag) return
  try {
    gtag('event', nombre, params)
  } catch {
    // Silencio a propósito: ver arriba.
  }
}

/**
 * Conversión: una persona completó el registro y su caso quedó EN LA COLA.
 *
 * `generate_lead` es el nombre recomendado por GA4 para esto; usarlo (en vez de uno inventado)
 * hace que Google Ads lo reconozca como conversión sin configuración extra — relevante si algún
 * día se postula a Google Ad Grants, donde hay que demostrar que los clics terminan en algo.
 *
 * Se dispara en el ÚNICO punto donde la consulta ya existe en el backend, no al enviar el
 * formulario: si el alta falla, no hubo conversión que contar.
 */
export function trackSolicitudDeConsulta(): void {
  trackEvent('generate_lead', { method: 'registro-paciente' })
}
