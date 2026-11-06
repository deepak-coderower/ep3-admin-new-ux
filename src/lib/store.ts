import { useSyncExternalStore } from 'react'

/**
 * The prototype keeps its data in plain mutable objects (firms, market) that are
 * saved to localStorage. Code mutates them, then calls `emitChange()` (via
 * persist/saveMarket) so every component using `useStore()` re-renders.
 */
let version = 0
const listeners = new Set<() => void>()

export function emitChange() {
  version += 1
  listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => version)
}
