// Primitivas de movimiento del home.
//
// Se definen ANTES que las secciones a propósito: si cada una inventa su animación salen doce
// duraciones distintas y desactivar el movimiento pasa a ser doce sitios. Aquí hay dos, y el
// respeto a `prefers-reduced-motion` está garantizado en ambas.
//
// El reveal es deliberadamente delgado: solo alterna una clase. Toda la animación vive en CSS
// (`.reveal` / `.is-visible` dentro de `.home-theme`), donde el `@media (prefers-reduced-motion)`
// la apaga desde el primer frame, sin esperar a que hidrate React.

import { useRef, useState } from 'react'
import { useMountEffect, usePrefersReducedMotion } from '../../lib/hooks'

// Umbral de visibilidad para dar por "entrada" una sección. 0.15 es el valor que ya usaba el home
// anterior; se conserva para que el ritmo al hacer scroll no cambie.
const UMBRAL = 0.15

/**
 * Marca un elemento como visible la primera vez que entra en pantalla, y deja de observarlo.
 * Devuelve el `ref` y la `className` lista para aplicar.
 *
 * Sin `IntersectionObserver` (SSR o navegador antiguo) el contenido se muestra directamente: el
 * reveal es un adorno y nunca debe poder esconder texto.
 *
 * Úsalo SIEMPRE desestructurado:
 *
 *     const { ref, className } = useReveal<HTMLDivElement>()
 *     <div ref={ref} className={`seccion ${className}`}>
 *
 * y no guardando el objeto (`const r = useReveal(); <div ref={r.ref}>`): la regla
 * `react-hooks` de ESLint marca esa segunda forma con "Cannot access refs during render", porque
 * no distingue leer la propiedad `ref` de leer `ref.current`. Medido: dos secciones con la forma
 * larga añadían 4 avisos; con la desestructurada, ninguno.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)

  useMountEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          setShown(true)
          obs.unobserve(e.target)
        })
      },
      { threshold: UMBRAL }
    )
    obs.observe(el)
    return () => obs.disconnect()
  })

  return { ref, className: `reveal${shown ? ' is-visible' : ''}` }
}

/**
 * Cuenta desde 0 hasta `target` cuando el elemento entra en pantalla.
 *
 * Esto SÍ necesita JS —CSS no sabe contar—, así que aquí el guard de reduced-motion es el hook:
 * si el usuario pidió menos movimiento devuelve la cifra final de inmediato. Un número que sube
 * solo es justo el tipo de animación que molesta a quien la desactiva.
 */
export function useCountUp<T extends HTMLElement>(target: number, durationMs = 900) {
  const ref = useRef<T>(null)
  // Arranca en el valor FINAL, no en 0. El servidor pinta esto, así que sin JavaScript —o antes de
  // hidratar— se lee la cifra de verdad y no un "0". En una página cuyo argumento es la
  // credibilidad, mostrar cifras falsas por un fallo de carga es peor que no animarlas.
  // No estropea la animación: cuando el observer dispara, el primer frame ya calcula ~0 y sube.
  const [value, setValue] = useState(target)
  const reduced = usePrefersReducedMotion()

  useMountEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setValue(target)
      return
    }

    let raf = 0
    const animar = () => {
      const inicio = performance.now()
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / durationMs)
        // ease-out cúbico: arranca rápido y frena, que es como se lee natural un contador.
        setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
        if (t < 1) raf = requestAnimationFrame(paso)
      }
      raf = requestAnimationFrame(paso)
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          obs.unobserve(e.target)
          animar()
        })
      },
      { threshold: UMBRAL }
    )
    obs.observe(el)
    return () => {
      obs.disconnect()
      cancelAnimationFrame(raf)
    }
  })

  // `reduced` puede llegar tarde (solo se sabe tras hidratar): en cuanto se sepa, se corta la
  // animación mostrando el valor final.
  return { ref, value: reduced ? target : value }
}
