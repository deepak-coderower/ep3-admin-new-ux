export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))
export const pad2 = (n: number | string) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
export const isoDateTime = (d: Date) => `${isoDate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
export const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
export const slug = (s: unknown) => String(s || '').trim().replace(/\s+/g, '-').replace(/[^\w.-]/g, '')
export const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || v === false

export function timeLabel(seconds: number | string) {
  const total = Number(seconds) % 86400
  const hour = Math.floor(total / 3600)
  const minute = Math.floor((total % 3600) / 60)
  const suffix = hour < 12 ? 'am' : 'pm'
  return `${hour % 12 || 12}:${pad2(minute)} ${suffix}`
}

/** Formats yyyy-mm-dd, yyyy-mm-ddThh:mm and hh:mm values for display; anything else passes through. */
export function formatWhen(value: any) {
  if (typeof value !== 'string') return value
  const full = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/)
  if (full) {
    const date = `${MONTH_NAMES[Number(full[2]) - 1].slice(0, 3)} ${Number(full[3])}, ${full[1]}`
    return full[4] ? `${date}, ${timeLabel(Number(full[4]) * 3600 + Number(full[5]) * 60)}` : date
  }
  const time = value.match(/^(\d{2}):(\d{2})$/)
  return time ? timeLabel(Number(time[1]) * 3600 + Number(time[2]) * 60) : value
}

export const getPath = (o: any, path: string) =>
  String(path).split('.').reduce((v, key) => (v === undefined || v === null ? undefined : v[key]), o)

export const setPath = (o: any, path: string, value: unknown) => {
  const keys = String(path).split('.')
  const last = keys.pop() as string
  keys.reduce((v, key) => v[key], o)[last] = value
}

export const visible = (field: { when?: (v: any) => boolean; [key: string]: any }, values: any) => !field.when || field.when(values)
