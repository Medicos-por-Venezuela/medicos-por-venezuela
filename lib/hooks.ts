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
