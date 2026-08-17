import { useEffect, useState } from 'react'

// Wrapper for true mount-time effects (e.g. fetching a catalog once on load).
// Keeps `useEffect` itself out of components — see the project's no-use-effect rule.
export function useMountEffect(effect: () => void | (() => void)) {
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(effect, [])
}

// ¿El usuario pidió menos movimiento? Fuente ÚNICA para el JS que anima (hoy, el contador de
// métricas del home). Lo puramente visual —reveal al hacer scroll, hover, el gesto del hero— se
// desactiva además por CSS con `@media (prefers-reduced-motion: reduce)`: el CSS aplica desde el
// primer frame, mientras que este hook solo puede saberlo tras hidratar. Las dos capas juntas
// evitan el destello de movimiento que vería justo quien pidió no verlo.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useMountEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  })
  return reduced
}

// Accesibilidad mínima de modales: cierra con Escape mientras `open` sea true.
// ponytail: sin focus-trap completo (Tab aún puede salir del modal); el foco inicial
// se resuelve con autoFocus en un botón del modal. Upgrade path: focus-trap real.
export function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // En un input type="search" con texto, Escape es "limpiar el campo" (acción nativa
      // de Chrome/Edge): limpiar no debe cerrar el modal de paso.
      const t = e.target
      if (t instanceof HTMLInputElement && t.type === 'search' && t.value) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

// Corre `effect` una vez al montar y luego cada `intervalMs`, limpiando el intervalo al desmontar
// — sobre `useMountEffect` (el único primitivo de efecto-al-montar sancionado en el repo) en vez de
// un `useEffect` crudo, para que los refrescos periódicos (KPIs del dashboard, etc.) cumplan la
// regla no-use-effect. `effect` es siempre el capturado al montar (deps vacías de useMountEffect):
// quien lo use debe mantenerlo estable leyendo datos frescos por sí mismo (p. ej. re-pedir el token
// cada tick) en vez de cerrar sobre props/estado que puedan quedar obsoletos.
export function usePolling(effect: () => void, intervalMs: number) {
  useMountEffect(() => {
    effect()
    const id = setInterval(effect, intervalMs)
    return () => clearInterval(id)
  })
}
