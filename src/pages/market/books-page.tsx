// /books?instrumentId=…: the unaggregated limit and stop book of an instrument. Ported from books.js.
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTitle } from '@/components/app/page'
import { ModuleHead } from '@/components/market/module-head'
import { ask } from '@/lib/dialogs'
import { bookHref, decimalsOf, hashText, instrumentById, market, px, saveMarket } from '@/lib/market'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'

const BOOK_FIRMS = [['Connamara Trading', 'CT-Main', 'alex.morgan'], ['Connamara Trading', 'CT-Prop', 'riley.chen'], ['A1 Trading', 'A1-Main', 'a1.desk'], ['Northline Capital', 'NL-House', 'nl.trader']]

/** The instrument's resting orders (generated once from its last price and cached on `inst.book`). */
export function bookOf(inst: any): { limit: any[]; stop: any[] } {
  if (inst.book) return inst.book
  const last = Number((inst.stats || {}).lastPrice)
  if (!Number.isFinite(last) || !last || !['Open', 'Preopen', 'Halted', 'Suspended'].includes(inst.state)) return (inst.book = { limit: [], stop: [] })
  const seed = hashText(inst.id)
  const step = Number(inst.minimumPriceIncrement) || 0.01
  const decimals = decimalsOf(inst.minimumPriceIncrement)
  const order = (prefix: string, n: number) => `${prefix}${String((seed + n * 7919) % 900000 + 100000)}`
  const side = (n: number) => BOOK_FIRMS[(seed + n) % BOOK_FIRMS.length]
  const level = (n: number, stop: boolean) => {
    const buy = side(n)
    const sell = side(n + 1)
    return {
      buyorderid: order('B', n + (stop ? 40 : 0)), buyFirm: buy[0], buyAccount: buy[1], buyUser: buy[2], qtyToBuy: String(1 + (seed + n) % 40),
      priceToBuy: (last - step * (n + 1) * 2).toFixed(decimals), sellorderid: order('S', n + (stop ? 40 : 0)), sellFirm: sell[0], sellAccount: sell[1], sellUser: sell[2], qtyToSell: String(1 + (seed + n * 3) % 40),
      priceToSell: (last + step * (n + 1) * 2).toFixed(decimals),
      ...(stop ? { stopBuyPrice: (last + step * (n + 6) * 2).toFixed(decimals), stopSellPrice: (last - step * (n + 6) * 2).toFixed(decimals) } : {}),
    }
  }
  return (inst.book = { limit: Array.from({ length: 6 }, (_, n) => level(n, false)), stop: Array.from({ length: 2 }, (_, n) => level(n, true)) })
}

async function cancelBookOrder(orderId: string, symbol: string) {
  const inst = instrumentById(symbol)
  const ok = await ask({ title: `Cancel ${orderId}?`, text: 'Are you sure you want to cancel this order?', confirm: 'Cancel Order', danger: true, glyph: 'x' })
  if (!ok) return
  const book = bookOf(inst) as any
  ;['limit', 'stop'].forEach(kind => {
    book[kind].forEach((row: any) => {
      if (row.buyorderid === orderId) row.buyorderid = ''
      if (row.sellorderid === orderId) row.sellorderid = ''
    })
    book[kind] = book[kind].filter((row: any) => row.buyorderid || row.sellorderid)
  })
  saveMarket()
  toast(`Submitted cancel for ${orderId}.`)
}

async function cancelAllBookOrders(symbol: string) {
  const inst = instrumentById(symbol)
  const ok = await ask({ title: `Cancel all orders for ${symbol}?`, text: 'This submits a mass cancel for every resting order in this book.', confirm: 'Cancel All Orders', danger: true, glyph: 'stop' })
  if (!ok) return
  inst.book = { limit: [], stop: [] }
  saveMarket()
  toast(`Submitted mass cancel for ${symbol}.`)
}

function OrderCell({ id, sym }: { id: string; sym: string }) {
  if (!id) return null
  return (
    <>
      <button className="link-btn mono" type="button" onClick={() => toast('Order Search isn’t part of this prototype.', { info: true })}>{id}</button>
      <Button variant="ghost" size="icon-sm" type="button" className="icon-danger book-cancel" aria-label={`Cancel ${id}`} title="Cancel Order" onClick={() => cancelBookOrder(id, sym)}><X size={13} /></Button>
    </>
  )
}

function BookTable({ rows, inst, isStop }: { rows: any[]; inst: any; isStop: boolean }) {
  if (!rows.length) return <Card className="empty small"><p>No resting orders.</p></Card>
  return (
    <Card className="table-scroll book-card">
      <Table className="table-wide book-table">
        <TableHeader>
          <TableRow>
            <TableHead className="buy">Buy Order ID</TableHead><TableHead className="buy">Firm</TableHead><TableHead className="buy">Account</TableHead><TableHead className="buy">User</TableHead><TableHead className="buy num">Qty to Buy</TableHead><TableHead className="buy num">Limit Buy Px</TableHead>
            {isStop && <><TableHead className="buy num">Stop Buy Px</TableHead><TableHead className="sell num">Stop Sell Px</TableHead></>}
            <TableHead className="sell num">Limit Sell Px</TableHead><TableHead className="sell num">Qty to Sell</TableHead><TableHead className="sell">Firm</TableHead><TableHead className="sell">Account</TableHead><TableHead className="sell">User</TableHead><TableHead className="sell">Sell Order ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const b = !!r.buyorderid
            const s = !!r.sellorderid
            return (
              <TableRow key={`${i}-${r.buyorderid}-${r.sellorderid}`}>
                <TableCell className="buy"><OrderCell id={r.buyorderid} sym={inst.id} /></TableCell>
                <TableCell className="buy">{b ? r.buyFirm : ''}</TableCell><TableCell className="buy">{b ? r.buyAccount : ''}</TableCell><TableCell className="buy">{b ? r.buyUser : ''}</TableCell>
                <TableCell className="buy num">{b ? r.qtyToBuy : ''}</TableCell><TableCell className="buy num">{b ? px(inst, r.priceToBuy) : ''}</TableCell>
                {isStop && <><TableCell className="buy num">{b ? px(inst, r.stopBuyPrice) : ''}</TableCell><TableCell className="sell num">{s ? px(inst, r.stopSellPrice) : ''}</TableCell></>}
                <TableCell className="sell num">{s ? px(inst, r.priceToSell) : ''}</TableCell><TableCell className="sell num">{s ? r.qtyToSell : ''}</TableCell>
                <TableCell className="sell">{s ? r.sellFirm : ''}</TableCell><TableCell className="sell">{s ? r.sellAccount : ''}</TableCell><TableCell className="sell">{s ? r.sellUser : ''}</TableCell>
                <TableCell className="sell"><OrderCell id={r.sellorderid} sym={inst.id} /></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

/** /books?instrumentId=… */
export function BooksPage() {
  useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const symbol = params.get('instrumentId') || ''
  const inst = symbol ? instrumentById(symbol) : null
  useTitle(symbol ? `${symbol} Book` : 'Book')
  const [query, setQuery] = useState(symbol)
  useEffect(() => { setQuery(symbol) }, [symbol])
  const book = inst ? bookOf(inst) : null
  const hasOrders = !!book && !!(book.limit.length || book.stop.length)

  const search = () => {
    const value = query.trim()
    if (value) navigate(bookHref(value))
  }

  let body = <Card className="empty"><h3>Find a book</h3><p>Enter an Instrument ID to see its limit and stop orders.</p></Card>
  if (symbol && !inst) body = <Card className="empty"><h3>No instrument found</h3><p>Sorry, but we didn’t find any Instrument with that ID.</p></Card>
  if (inst && book) {
    body = (
      <>
        <section className="section"><div className="section-head"><h2 className="section-title">Limit Book</h2></div><BookTable rows={book.limit} inst={inst} isStop={false} /></section>
        <section className="section tab-block"><div className="section-head"><h2 className="section-title">Stop Book</h2></div><BookTable rows={book.stop} inst={inst} isStop /></section>
      </>
    )
  }

  return (
    <div className="detail-page">
      <ModuleHead
        active="instruments"
        title={inst ? `${inst.id} Book` : 'Unaggregated Book'}
        actions={hasOrders ? <Button variant="secondary" type="button" onClick={() => cancelAllBookOrders(inst.id)}>Cancel All Orders</Button> : null}
      />
      <div className="detail-scroll">
        <div className="filters">
          <label className="filter-field filter-search">
            <span>Instrument ID</span>
            <div className="search">
              <Search size={17} className="search-icon" />
              <Input
                id="bookSearch"
                type="search"
                list="bookIds"
                placeholder="Instrument ID"
                value={query}
                autoComplete="off"
                spellCheck={false}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
              />
            </div>
          </label>
          <datalist id="bookIds">{market().instruments.map(i => <option key={i.id} value={i.id} />)}</datalist>
          <Button type="button" onClick={search}>Search</Button>
        </div>
        {body}
      </div>
    </div>
  )
}
