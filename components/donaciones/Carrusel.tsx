// El carrusel horizontal que usan "Voces" y "Equipo": la pista con la frase de ayuda, las dos
// flechas (solo en pantalla grande) y la tira deslizable.
//
// Desliza con el dedo en móvil y con `scroll-snap` encaja cada tarjeta. En escritorio aparecen
// las flechas, que mueven el 80 % del ancho visible.
//
// EL AVANCE AUTOMÁTICO (solo el de testimonios) se pausa al tocar, al pasar el ratón, al entrar
// con el teclado y cuando la pestaña está en segundo plano, y solo corre mientras el carrusel
// está a la vista. Con `prefers-reduced-motion` no arranca: algo que se mueve solo es justo lo
// que esa preferencia pide evitar.
//
// Todos los oyentes se quitan al desmontar, incluidos el `IntersectionObserver` y los
// temporizadores.

import { useEffect, useRef, type ReactNode } from 'react'
import Bilingue from './Bilingue'
import { cls } from './clases'
import type { Idioma } from './idioma'
import { comoDesplazar, prefiereMenosMovimiento } from './utilidades'

/** El `gap` de `.carrusel`, en píxeles: hace falta para calcular el salto de una tarjeta. */
const HUECO = 14

/** Cada cuánto avanza solo, en milisegundos. */
const PERIODO = 4000

/** Lo que espera antes de volver a avanzar después de que alguien lo toque. */
const ESPERA_TRAS_TOCAR = 2500

/** Qué parte del carrusel tiene que estar a la vista para que el avance automático corra. */
const UMBRAL = 0.4

type Props = {
  idioma: Idioma
  /** La frase de ayuda sobre el carrusel ("Desliza para leer más"). */
  pistaEs: ReactNode
  pistaEn: ReactNode
  /** Lo que anuncia un lector de pantalla al entrar en la tira. */
  etiqueta: { es: string; en: string }
  /** Solo el carrusel de testimonios avanza por su cuenta. */
  avanceAutomatico?: boolean
  children: ReactNode
}

export default function Carrusel({
  idioma,
  pistaEs,
  pistaEn,
  etiqueta,
  avanceAutomatico = false,
  children
}: Props) {
  const pista = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!avanceAutomatico) return
    const tira = pista.current
    if (!tira) return
    if (prefiereMenosMovimiento()) return

    let pausado = false
    let intervalo = 0
    let reanudacion = 0

    const avanzar = () => {
      if (pausado || document.hidden) return
      const primera = tira.firstElementChild
      if (!primera) return
      const salto = primera.getBoundingClientRect().width + HUECO
      const maximo = tira.scrollWidth - tira.clientWidth
      // Al llegar al final vuelve al principio en vez de quedarse clavado.
      const destino = tira.scrollLeft + salto >= maximo - 4 ? 0 : tira.scrollLeft + salto
      tira.scrollTo({ left: destino, behavior: 'smooth' })
    }

    const arrancar = () => {
      window.clearInterval(intervalo)
      intervalo = window.setInterval(avanzar, PERIODO)
    }
    const parar = () => window.clearInterval(intervalo)

    const pausar = () => {
      pausado = true
    }
    const reanudar = () => {
      window.clearTimeout(reanudacion)
      reanudacion = window.setTimeout(() => {
        pausado = false
      }, ESPERA_TRAS_TOCAR)
    }

    const EVENTOS_PAUSA = ['mouseenter', 'touchstart', 'focusin'] as const
    const EVENTOS_REANUDA = ['mouseleave', 'touchend', 'focusout'] as const
    for (const evento of EVENTOS_PAUSA) tira.addEventListener(evento, pausar, { passive: true })
    for (const evento of EVENTOS_REANUDA) tira.addEventListener(evento, reanudar, { passive: true })

    let observador: IntersectionObserver | null = null
    if (typeof IntersectionObserver === 'undefined') {
      arrancar()
    } else {
      observador = new IntersectionObserver(
        (entradas) => {
          for (const entrada of entradas) {
            if (entrada.isIntersecting) arrancar()
            else parar()
          }
        },
        { threshold: UMBRAL }
      )
      observador.observe(tira)
    }

    return () => {
      parar()
      window.clearTimeout(reanudacion)
      observador?.disconnect()
      for (const evento of EVENTOS_PAUSA) tira.removeEventListener(evento, pausar)
      for (const evento of EVENTOS_REANUDA) tira.removeEventListener(evento, reanudar)
    }
  }, [avanceAutomatico])

  function mover(direccion: 1 | -1) {
    const tira = pista.current
    if (!tira) return
    tira.scrollBy({ left: direccion * tira.clientWidth * 0.8, behavior: comoDesplazar() })
  }

  return (
    <>
      <div className={cls('pista-d')}>
        <Bilingue es={pistaEs} en={pistaEn} />
        <div className={cls('flechas')}>
          <button
            type="button"
            aria-label={idioma === 'es' ? 'Anterior' : 'Previous'}
            onClick={() => mover(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={idioma === 'es' ? 'Siguiente' : 'Next'}
            onClick={() => mover(1)}
          >
            ›
          </button>
        </div>
      </div>
      {/* `tabIndex` + `role="group"`: la plantilla deja la tira sin acceso por teclado y las
          flechas desaparecen por debajo de 920 px, así que ahí no había forma de recorrerla sin
          ratón ni dedo. Con esto se entra con el tabulador y se mueve con las flechas del
          teclado, que es lo que hace de serie cualquier zona con scroll. No cambia nada de lo
          que se ve: solo aparece el aro de foco al tabular. */}
      <div
        ref={pista}
        className={cls('carrusel')}
        role="group"
        aria-label={etiqueta[idioma]}
        tabIndex={0}
      >
        {children}
      </div>
    </>
  )
}
