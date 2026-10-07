// El idioma de la página de donaciones (ES / EN) y cómo se recuerda.
//
// EL PROBLEMA QUE RESUELVE ESTE ARCHIVO ES LA HIDRATACIÓN.
//
// La plantilla arranca con `lang(localStorage.getItem("mxv_lang") || "es")`. Traducido a React a
// la ligera —`useState(() => localStorage.getItem('mxv_lang'))`— eso es un error de hidratación
// garantizado: en el servidor no hay `localStorage`, así que el HTML saldría con `data-lang="es"`
// y el primer render del cliente podría decir `"en"`. React compara los dos y avisa.
//
// La solución es `useSyncExternalStore`, que está hecho justo para esto: tiene un
// `getServerSnapshot` separado del `getSnapshot` del cliente. React usa el del servidor para el
// render que hidrata (siempre `'es'`, igual que el HTML) y, una vez hidratado, vuelve a pintar con
// el del cliente si resulta que la persona había elegido inglés. No es un parche: es el camino
// que la API documenta para leer algo del navegador sin romper la hidratación.
//
// Como el "almacén" es de módulo, cualquier componente puede llamar a `useIdioma()` sin que haya
// que pasar el idioma de padre a hijo ni montar un contexto: todos los que lo lean se enteran del
// cambio por la misma suscripción.

import { useSyncExternalStore } from 'react'

export type Idioma = 'es' | 'en'

/** La misma clave que usaba la plantilla, para no perder la preferencia de quien ya la tenía. */
const CLAVE = 'mxv_lang'

export const IDIOMA_INICIAL: Idioma = 'es'

const oyentes = new Set<() => void>()

/**
 * El idioma vigente en esta pestaña.
 *
 * Es la fuente de verdad, y no `localStorage` directamente, por dos motivos: `useSyncExternalStore`
 * exige que dos lecturas seguidas sin cambios devuelvan el MISMO valor (con una variable es
 * trivial), y en Safari de navegación privada `localStorage` lanza — ahí el cambio de idioma tiene
 * que funcionar igual, aunque no se recuerde para la próxima visita.
 *
 * `null` = todavía no se ha leído del almacén.
 */
let vigente: Idioma | null = null

function leerAlmacen(): Idioma {
  try {
    return localStorage.getItem(CLAVE) === 'en' ? 'en' : 'es'
  } catch {
    return IDIOMA_INICIAL
  }
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  // Otra pestaña del mismo sitio puede cambiar la preferencia; `storage` es el aviso.
  const alCambiarElAlmacen = (evento: StorageEvent) => {
    if (evento.key !== null && evento.key !== CLAVE) return
    vigente = leerAlmacen()
    oyente()
  }
  window.addEventListener('storage', alCambiarElAlmacen)
  return () => {
    oyentes.delete(oyente)
    window.removeEventListener('storage', alCambiarElAlmacen)
  }
}

function leerDelNavegador(): Idioma {
  if (vigente === null) vigente = leerAlmacen()
  return vigente
}

function leerDelServidor(): Idioma {
  return IDIOMA_INICIAL
}

/** Cambia el idioma, lo recuerda y avisa a toda la página. */
export function cambiarIdioma(idioma: Idioma): void {
  if (vigente === idioma) return
  vigente = idioma
  try {
    localStorage.setItem(CLAVE, idioma)
  } catch {
    // Sin almacenamiento el cambio vale para esta visita y no se recuerda.
  }
  for (const oyente of [...oyentes]) oyente()
}

/** El idioma activo. Se vuelve a pintar solo cuando cambia. */
export function useIdioma(): Idioma {
  return useSyncExternalStore(suscribir, leerDelNavegador, leerDelServidor)
}
