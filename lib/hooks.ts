import { useEffect } from 'react'

// Wrapper for true mount-time effects (e.g. fetching a catalog once on load).
// Keeps `useEffect` itself out of components — see the project's no-use-effect rule.
export function useMountEffect(effect: () => void | (() => void)) {
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(effect, [])
}

// Accesibilidad mínima de modales: cierra con Escape mientras `open` sea true.
// ponytail: sin focus-trap completo (Tab aún puede salir del modal); el foco inicial
// se resuelve con autoFocus en un botón del modal. Upgrade path: focus-trap real.
export function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}
