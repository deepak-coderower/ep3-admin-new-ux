export const storage = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* unavailable */ } },
  del(k: string) { try { localStorage.removeItem(k) } catch { /* unavailable */ } },
}

export const session = {
  get(k: string) { try { return sessionStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v) } catch { /* unavailable */ } },
  clear() { try { sessionStorage.clear() } catch { /* unavailable */ } },
}

const LIST_STATE_PREFIX = 'ep3.list.'

export const readListState = (key: string): Record<string, any> => {
  try { return JSON.parse(storage.get(LIST_STATE_PREFIX + key) as string) || {} } catch { return {} }
}

export const saveListState = (key: string, state: unknown) => storage.set(LIST_STATE_PREFIX + key, JSON.stringify(state))

export const clearListStates = () => {
  try {
    Object.keys(localStorage).filter(k => k.startsWith(LIST_STATE_PREFIX)).forEach(k => localStorage.removeItem(k))
  } catch { /* unavailable */ }
}
