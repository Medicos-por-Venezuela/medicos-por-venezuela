import { useEffect } from 'react'

// Wrapper for true mount-time effects (e.g. fetching a catalog once on load).
// Keeps `useEffect` itself out of components — see the project's no-use-effect rule.
export function useMountEffect(effect: () => void | (() => void)) {
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(effect, [])
}
