import { useEffect } from 'react'

// Runs `effect` once on mount (cleanup on unmount). The only sanctioned bare useEffect.
export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, [])
}
