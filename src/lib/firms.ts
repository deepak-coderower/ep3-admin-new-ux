import { ENTITIES, STORE_KEY, type Firm } from '@/data/config'
import { seedFirms } from '@/data/seed'
import { storage } from '@/lib/storage'
import { emitChange } from '@/lib/store'

function load(): Firm[] {
  try {
    const raw = storage.get(STORE_KEY)
    const parsed = raw && JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch { /* fall back to seed */ }
  return seedFirms()
}

let data: Firm[] | null = null

/** The live, mutable firms array. Mutate it, then call `persist()`. */
export function firms(): Firm[] {
  if (!data) data = load()
  return data
}

export function persist() {
  storage.set(STORE_KEY, JSON.stringify(firms()))
  emitChange()
}

export const firmById = (id: string | null | undefined) => firms().find(f => f.id === id)

const q = (params: Record<string, string>) => new URLSearchParams(params).toString()

/** /firm?id=…, /firm-edit?id=…, or /firm?id=…&tab=… */
export function hrefFor(id: string, tail?: string) {
  if (!tail) return `/firm?${q({ id })}`
  if (tail === 'edit') return `/firm-edit?${q({ id })}`
  return `/firm?${q({ id, tab: tail })}`
}

export const serviceOf = (f: Firm, sid: string | null | undefined) => (f.services || []).find((s: any) => s.id === sid)

export function entityRows(kind: string, f: Firm, sid?: string | null): any[] {
  if (kind !== 'keys') return f[ENTITIES[kind].key] || (f[ENTITIES[kind].key] = [])
  const svc = serviceOf(f, sid)
  return svc ? (svc.keys || (svc.keys = [])) : []
}

export const entityBase = (kind: string, f: Firm, sid?: string | null) => (kind === 'keys'
  ? `/api-keys?${q({ firm: f.id, service: sid || '' })}`
  : hrefFor(f.id, kind))

const RECORD_PATHS: Record<string, string> = { users: '/user', accounts: '/account', services: '/service', keys: '/api-key' }

const recordUrl = (kind: string, f: Firm, sid: string | null | undefined, extra: Record<string, string>) =>
  `${RECORD_PATHS[kind]}?${q({ firm: f.id, ...(sid ? { service: sid } : {}), ...extra })}`

export const entityNewHref = (kind: string, f: Firm, sid?: string | null) => recordUrl(kind, f, sid, { mode: 'new' })

export function entityHref(kind: string, f: Firm, sid: string | null | undefined, id: string, tail?: string) {
  if (tail === 'keys') return entityBase('keys', f, id)
  return recordUrl(kind, f, sid, { id, ...(tail === 'edit' ? { mode: 'edit' } : {}) })
}
