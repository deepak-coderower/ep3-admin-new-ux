import { useSyncExternalStore } from 'react'
import { storage } from '@/lib/storage'

export const THEME_KEY = 'ep3.firms.prototype.theme'
export type ThemePref = 'light' | 'dark'

const listeners = new Set<() => void>()

export function themePref(): ThemePref {
  return storage.get(THEME_KEY) === 'dark' ? 'dark' : 'light'
}

export function applyTheme() {
  const root = document.documentElement
  const theme = themePref()
  root.classList.add('theme-switching')
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
  listeners.forEach(l => l())
}

export function setThemePref(pref: ThemePref) {
  storage.set(THEME_KEY, pref)
  applyTheme()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, themePref)
  return { pref, resolved: pref, setPref: setThemePref }
}
