// The Markets store and helpers. Ported from the prototype's market-core.js.
import { IT, MARKET_KEY, WEEK_DAYS } from '@/data/market-config'
import { SYNC_GROUPS } from '@/data/market-sections'
import { seedMarket } from '@/data/market-seed'
import { clone, formatWhen, timeLabel } from '@/lib/format'
import { marketData, registerMarketLoader, type Market } from '@/lib/market-data'
import { storage } from '@/lib/storage'
import { emitChange } from '@/lib/store'

export type { Market }

/** Keys a product has that its instruments don't inherit (identity, categories and the Sync flags). */
export const PRODUCT_ONLY_KEYS = ['id', 'description', 'categoryLevels', ...Object.keys(SYNC_GROUPS)]

/** A new Pending instrument draft that inherits everything from the product. */
export function instrumentFromProduct(product: any): any {
  const base = clone(product)
  PRODUCT_ONLY_KEYS.forEach(k => { delete base[k] })
  return { ...base, id: '', description: '', productId: product.id, routingkey: product.id, state: 'Pending', isScheduled: false, nonTradable: false, hideMarketData: false, securityId: '', securityIdSource: '', metadata: [], legs: [], noLegs: '0', stats: {} }
}

/** Reads the market from localStorage (or seeds it) and applies scheduled state changes that are due. */
export function loadMarket(): Market {
  let data: any = null
  try {
    const raw = storage.get(MARKET_KEY)
    data = raw && JSON.parse(raw)
  } catch { /* fall back to seed */ }
  const loaded: Market = data && Array.isArray(data.instruments) ? data : seedMarket()
  const now = new Date()
  loaded.instruments.forEach(i => {
    if (i.scheduledChange && new Date(i.scheduledChange.at) <= now) {
      i.state = i.scheduledChange.state
      delete i.scheduledChange
    }
  })
  return loaded
}

registerMarketLoader(loadMarket)

/**
 * The single live, mutable market object ({ products, instruments, calendars, holidays }).
 * Mutate it (you may reassign its properties, e.g. `market().products = …`), then call saveMarket().
 */
export const market = (): Market => marketData()

/** Writes the market to localStorage and re-renders every component using useStore(). */
export function saveMarket() {
  storage.set(MARKET_KEY, JSON.stringify(market()))
  emitChange()
}

export const instrumentById = (id: string | null | undefined) => market().instruments.find(i => i.id === id)
export const productById = (id: string | null | undefined) => market().products.find(p => p.id === id)

/** Distinct Event IDs already used by Event instruments of a product (the `eventIds` datalist). */
export const eventIdsFor = (productId: string) =>
  [...new Set(market().instruments.filter(i => i.type === IT.EVENT && i.productId === productId).map(i => i.evtAttEventId).filter(Boolean))] as string[]

export const withQuery = (page: string, params: Record<string, string>) => `${page}?${new URLSearchParams(params)}`
export const instHref = (id: string, mode?: string) => withQuery('/instrument', { id, ...(mode ? { mode } : {}) })
/** Kept for completeness; state changes are shown in a dialog, not on this route. */
export const instStateHref = (id: string) => withQuery('/instrument-state', { id })
/** Kept for completeness; state changes are shown in a dialog, not on this route. */
export const instMultiStateHref = (ids: string[]) => withQuery('/instrument-state', { ids: JSON.stringify(ids) })
export const instStatsHref = (id: string) => withQuery('/instrument-stats', { id })
export const instHistoryHref = (id: string) => withQuery('/instrument-history', { id })
export const bookHref = (id: string) => withQuery('/books', { instrumentId: id })
export const productHref = (id: string, mode?: string) => withQuery('/product', { id, ...(mode ? { mode } : {}) })
/** /instrument?mode=new[&productId=…] */
export const instNewHref = (productId?: string) => withQuery('/instrument', { mode: 'new', ...(productId ? { productId } : {}) })

export const instDeletable = (i: any) => ['Pending', 'Terminated'].includes(i.state)
export const instStatsEnabled = (i: any) => !['Pending', 'Terminated'].includes(i.state)
export const instEditable = (i: any) => i.state !== 'Terminated'

export const decimalsOf = (v: unknown) => {
  const text = String(v ?? '')
  return text.includes('.') ? text.split('.')[1].length : 0
}
export const validScale = (value: unknown, increment: unknown) => decimalsOf(value) <= decimalsOf(increment)
export const showDateTime = (v: any) => formatWhen(v || '')

/** "MON - FRI  8:00 am - 5:00 pm" for a trading schedule row. */
export function hoursLabel(s: any) {
  const days: number[] = s.days || []
  const sequential = days.every((d, i) => i === 0 || days[i - 1] === d - 1)
  let dayText = days.map(d => WEEK_DAYS[d]).join(', ')
  if (days.length > 1 && sequential) dayText = `${WEEK_DAYS[days[0]]} - ${WEEK_DAYS[days[days.length - 1]]}`
  return `${dayText}  ${timeLabel(s.from)} - ${timeLabel(s.to)}`
}

/** The state the instrument's trading hours give right now ('Closed' outside them). */
export function stateFromSchedule(inst: any) {
  const now = new Date()
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60
  const match = (inst.tradingSchedule || []).find((s: any) => s.days.includes(now.getDay()) && (s.from <= s.to ? seconds >= s.from && seconds < s.to : seconds >= s.from || seconds < s.to))
  return match ? match.state : 'Closed'
}

/** Formats a price with at least the instrument's tick decimals. */
export function px(inst: any, value: any) {
  if (value === undefined || value === null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: decimalsOf(inst.minimumPriceIncrement), maximumFractionDigits: 8 }) : String(value)
}

export function hashText(text: string) {
  let h = 7
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 2147483647
  return h
}

/** Saves text as a CSV download. */
export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** [key, label, path] of the Markets module tabs. */
export const MODULE_TABS: [string, string, string][] = [['products', 'Products', '/products'], ['instruments', 'Instruments', '/instruments'], ['calendars', 'Calendars', '/calendars']]
