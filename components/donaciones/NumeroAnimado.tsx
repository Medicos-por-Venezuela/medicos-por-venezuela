// Un número que cuenta hacia arriba cuando entra en pantalla ("+1.000 consultas gratuitas").
//
// HIDRATACIÓN: el primer render pinta el número FINAL (`+1.000`), exactamente lo que trae el HTML
// de la plantilla. Esto es lo que lo hace seguro: si empezara en cero, el servidor diría `+0` y
// un cliente que llegue con la sección ya en pantalla diría otra cosa. Además, quien tenga el
// JavaScript desactivado o aún sin cargar ve el dato, no un cero. La animación solo arranca
// cuando el `IntersectionObserver` avisa, y lo primero que hace es volver al principio.
//
// `requestAnimationFrame` y no un `setInterval`: el navegador decide cuándo hay un fotograma
// disponible, así que el número no se atasca mientras se hace scroll.
//
// Con `prefers-reduced-motion` no se anima: se salta al valor final en el primer fotograma, igual
// que en la plantilla (ahí `dur` pasaba de 1500 ms a 1).

import { useEffect, useRef, useState } from 'react'
import { formatearMiles, prefiereMenosMovimiento } from './utilidades'

/** Lo que dura la cuenta, en milisegundos. */
const DURACION = 1500

/** Qué parte de la cifra tiene que estar a la vista para que arranque. */
const UMBRAL = 0.5

type Props = {
  /** El número al que se llega. Se pinta siempre con un `+` delante, como en el diseño. */
  meta: number
}

export default function NumeroAnimado({ meta }: Props) {
  const elemento = useRef<HTMLElement>(null)
  const [valor, setValor] = useState(meta)

  useEffect(() => {
    const nodo = elemento.current
    if (!nodo) return
    // Sin `IntersectionObserver` (navegador muy viejo) el número se queda en su valor final, que
    // es la información; la animación es un adorno.
    if (typeof IntersectionObserver === 'undefined') return

    let fotograma = 0
    const duracion = prefiereMenosMovimiento() ? 1 : DURACION

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          // Una sola vez: contar otra vez cada vez que se pasa por delante marea.
          observador.unobserve(entrada.target)
          let inicio: number | null = null
          const paso = (marca: number) => {
            if (inicio === null) inicio = marca
            const k = Math.min(1, (marca - inicio) / duracion)
            // La misma curva de la plantilla (cúbica de salida): arranca rápido y frena al
            // llegar, que es lo que da la sensación de "aterrizar" en la cifra.
            setValor(meta * (1 - Math.pow(1 - k, 3)))
            if (k < 1) fotograma = requestAnimationFrame(paso)
          }
          fotograma = requestAnimationFrame(paso)
        }
      },
      { threshold: UMBRAL }
    )
    observador.observe(nodo)

    return () => {
      observador.disconnect()
      cancelAnimationFrame(fotograma)
    }
  }, [meta])

  return <b ref={elemento}>+{formatearMiles(valor)}</b>
}
