/**
 * Holder for the single mutable market object. It has no imports so that
 * market-config can read market data (e.g. the Product select options) without an
 * import cycle through market-sections. lib/market.ts registers the loader; use
 * `market()` from '@/lib/market' everywhere else.
 */
export type Market = {
  products: any[]
  instruments: any[]
  calendars: Record<string, { global: boolean; description: string }>
  holidays: any[]
  [key: string]: any
}

let data: Market | null = null
let loader: (() => Market) | null = null

export function registerMarketLoader(fn: () => Market) {
  loader = fn
}

export function marketData(): Market {
  if (!data) {
    if (!loader) return { products: [], instruments: [], calendars: {}, holidays: [] }
    data = loader()
  }
  return data
}
