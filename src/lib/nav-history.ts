/**
 * Remembers the in-app page shown before the current one, so a page can send
 * "back" to wherever the person actually came from. AppLayout updates it after
 * every navigation; read it once while the new page first renders
 * (e.g. `useState(previousPage)`), before the layout records the new location.
 */
let current: string | null = null

export function recordPage(path: string) {
  current = path
}

/** The page shown just before the one now rendering, or null on a fresh load. */
export const previousPage = () => current
