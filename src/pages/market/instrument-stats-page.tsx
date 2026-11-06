// /instrument-stats (editable market stats) and /instrument-history (historical market stats). Ported from instrument-stats.js.
import { useReducer, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ChartLine, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Crumb, EmptyState, LargeTitle, PageHead, useTitle } from '@/components/app/page'
import { Pager, pageSlice, type ListState } from '@/components/app/list-controls'
import { DateTimeField } from '@/components/form/date-time-field'
import { FieldRow, ReadRow } from '@/components/form/field-row'
import { FormDock } from '@/components/form/form-dock'
import { InfoList, MarketNotFound, WideSheet } from '@/components/market/module-head'
import { createMarketForm, marketBlurHandler, marketChangeHandler } from '@/components/market/market-form'
import { HISTORY_COLUMNS, STAT_PRICE_FIELDS, STAT_TIME_FIELDS } from '@/data/market-sections'
import type { Field } from '@/data/config'
import { ask } from '@/lib/dialogs'
import { clone, isoDate, isoDateTime } from '@/lib/format'
import { isDirty, useForm, useSaveShortcut, useUnsavedGuard, type FormModel } from '@/lib/form'
import { decimalsOf, hashText, instHistoryHref, instHref, instStatsHref, instrumentById, saveMarket, showDateTime, validScale } from '@/lib/market'
import { readListState, saveListState } from '@/lib/storage'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'

// ---------- Market stats ----------

export const canEditStat = (x: any, inst: any) => x.tradable || !!inst.nonTradable

export function validateStats(v: any, inst: any) {
  const e: Record<string, string> = {}
  const qtyInc = inst.minimumTradeQuantity || '1'
  STAT_PRICE_FIELDS.forEach((x: any) => {
    const value = v[x.k]
    if (value === undefined || value === null || String(value).trim() === '') return
    if (!Number.isFinite(Number(value))) { e[x.k] = `${x.label} must be a number.`; return }
    if (!canEditStat(x, inst) || x.notional) return
    if (!validScale(value, x.qty ? qtyInc : inst.minimumPriceIncrement)) e[x.k] = `${x.label} scale is not valid.`
  })
  return e
}

const STAT_TIME_OF: Record<string, string> = { open: 'openSetTime', indicativeOpen: 'indicativeOpenSetTime', high: 'highSetTime', low: 'lowSetTime', close: 'closeSetTime', lastPrice: 'lastTradeSetTime', notionalTraded: 'notionalSetTime', settlementPrice: 'settlementSetTime', openInterest: 'openInterestSetTime', tradingReferencePrice: 'tradingReferencePriceSetTime', markPrice: 'markPriceSetTime' }

const STATS_BEFORE = ['open', 'indicativeOpen', 'high', 'low', 'close', 'lastPrice', 'lastQuantity', 'notionalTraded', 'sharesTraded', 'settlementPrice']
const STATS_AFTER = ['openInterest', 'tradingReferencePrice', 'markPrice']

type RowProps = { form: FormModel; change: (k: string, value: any) => void; blur: (k: string) => void }

function StatsBody({ inst, form, change, blur }: { inst: any } & RowProps) {
  const v = form.draft
  const price = (key: string) => STAT_PRICE_FIELDS.find((x: any) => x.k === key) as Field
  const edit = (x: Field) => <FieldRow key={x.k} field={x} values={v} errors={form.errors} onChange={change} onBlur={blur} />
  const stat = (x: Field) => (canEditStat(x, inst) ? edit(x) : <ReadRow key={x.k} field={x} values={v} />)
  return (
    <Card className="form-card">
      <div className="form-grid form-list">
        <ReadRow field={{ k: 'id', label: 'Instrument ID (Symbol)', mono: true, display: () => inst.id }} values={v} />
        <ReadRow field={{ k: 'description', label: 'Description', display: () => inst.description }} values={v} />
        {STATS_BEFORE.map(k => stat(price(k)))}
        <ReadRow field={{ k: 'settlementPriceCalculationMethod', label: 'Settlement Calculation Method' }} values={v} />
        {edit({ k: 'settlementPriceCalculationText', label: 'Settlement Price Calculation Text' })}
        {edit({ k: 'settlementPreliminary', label: 'Settlement Preliminary', kind: 'toggle' })}
        {STATS_AFTER.map(k => stat(price(k)))}
        {inst.nonTradable
          ? edit({ k: 'transactTime', label: 'Transact Time', inputType: 'datetime-local' })
          : <ReadRow field={{ k: 'transactTime', label: 'Transact Time', display: (d: any) => showDateTime(d.transactTime) }} values={v} />}
        <div className="form-subhead"><h3 className="section-title">Update Times</h3></div>
        {STAT_TIME_FIELDS.map((x: any) => (canEditStat(x, inst)
          ? edit({ ...x, inputType: 'datetime-local' })
          : <ReadRow key={x.k} field={{ k: x.k, label: x.label, display: (d: any) => showDateTime(d[x.k]) }} values={v} />))}
      </div>
    </Card>
  )
}

function StatsForm({ inst }: { inst: any }) {
  const navigate = useNavigate()
  const [form, refresh] = useForm(() => createMarketForm('edit', { ...clone(inst.stats || {}) }))
  form.module = { validate: (draft: any) => validateStats(draft, inst) }
  useTitle(`${inst.id} Market Stats`)
  useUnsavedGuard(form)

  const submit = async () => {
    if (form.saving) return
    form.errors = validateStats(form.draft, inst)
    if (Object.keys(form.errors).length) {
      refresh()
      return
    }
    refresh()
    if (!isDirty(form)) return
    const ok = await ask({ title: 'Save market stats?', text: `This saves the market stats for ${inst.id}.`, confirm: 'Save Stats', glyph: 'check' })
    if (!ok) return
    const saved = clone(form.draft)
    const before = form.original
    Object.entries(STAT_TIME_OF).forEach(([key, timeKey]) => {
      if (String(saved[key] ?? '') !== String(before[key] ?? '') && saved[timeKey] === before[timeKey]) saved[timeKey] = saved[key] === '' ? '' : isoDateTime(new Date())
    })
    inst.stats = saved
    form.done = true
    saveMarket()
    navigate('/instruments')
    toast('Instrument stats were saved.')
  }
  useSaveShortcut(submit)
  const onFormSubmit = (e: FormEvent) => { e.preventDefault(); submit() }

  return (
    <div className="page form-page">
      <Crumb to={instHref(inst.id)}>{inst.id}</Crumb>
      <PageHead title="Instrument Market Stats">
        <Button variant="secondary" asChild><Link to={instHistoryHref(inst.id)}><ChartLine size={17} />Historical Market Stats</Link></Button>
      </PageHead>
      <form id="firmForm" noValidate onSubmit={onFormSubmit}>
        <div className="form-stack" id="formBody">
          <StatsBody inst={inst} form={form} change={marketChangeHandler(form, refresh)} blur={marketBlurHandler(form, refresh)} />
        </div>
        <FormDock form={form} saveLabel="Save" backHref="/instruments" />
      </form>
    </div>
  )
}

/** /instrument-stats?id=… */
export function InstrumentStatsPage() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const inst = instrumentById(id)
  if (!inst) return <MarketNotFound title="Instrument not found" id={id} href="/instruments" label="Instruments" />
  return <StatsForm key={inst.id} inst={inst} />
}

// ---------- Historical market stats ----------

const historyList: ListState = { sort: '', dir: 1, page: 0, size: 10, from: '', to: '', ...readListState('historyList') }

export const todayRange = () => {
  const now = new Date()
  return { from: `${isoDate(now)}T00:00`, to: `${isoDate(now)}T23:59` }
}

/** 60 hourly rows of generated stats ending this hour; none without a last price. */
export function historyRows(inst: any): any[] {
  const base = Number((inst.stats || {}).lastPrice)
  if (!Number.isFinite(base) || !base) return []
  const decimals = decimalsOf(inst.minimumPriceIncrement)
  const seed = hashText(inst.id)
  const now = new Date()
  now.setMinutes(0, 0, 0)
  return Array.from({ length: 60 }, (_, n) => {
    const at = new Date(now.getTime() - n * 3600000)
    const swing = n === 0 ? 1 : 1 + (((seed + n * 37) % 41) - 20) / 2000
    const value = (factor: number) => (base * swing * factor).toFixed(decimals)
    const stamp = isoDateTime(at)
    return {
      transactionTime: stamp, openPx: value(0.996), openSetTime: stamp, indicativeOpenPx: value(0.995), indicativeOpenSetTime: stamp, highPx: value(1.012), highSetTime: stamp, lowPx: value(0.988), lowSetTime: stamp,
      closePx: value(1.001), closeSetTime: stamp, lastTradePx: value(1), lastTradeSetTime: stamp, lastTradeQty: String(1 + ((seed + n) % 25)), notionalTraded: (base * swing * (40 + n)).toFixed(2), notionalSetTime: stamp, sharesTraded: String(40 + n),
      settlementPx: value(1.002), settlementSetTime: stamp, settlementPreliminaryFlag: false, settlementPriceCalculationMethod: 'VWAP TIER 1', settlementPriceCalculationText: '', openInterest: String(3000 + ((seed + n * 11) % 500)), openInterestSetTime: stamp,
      tradingReferencePrice: value(1.002), tradingReferencePriceSetTime: stamp, markPrice: value(1.0005), markPriceSetTime: stamp,
    }
  })
}

const historyDetailRows = (r: any): [string, string][] => [
  ['Transaction Time', showDateTime(r.transactionTime)], ['Open Price', r.openPx], ['Open Set Time', showDateTime(r.openSetTime)], ['Indicative Open Price', r.indicativeOpenPx], ['Indicative Open Set Time', showDateTime(r.indicativeOpenSetTime)],
  ['High Price', r.highPx], ['High Set Time', showDateTime(r.highSetTime)], ['Low Price', r.lowPx], ['Low Set Time', showDateTime(r.lowSetTime)], ['Close Price', r.closePx], ['Close Set Time', showDateTime(r.closeSetTime)],
  ['Last Trade Price', r.lastTradePx], ['Last Trade Set Time', showDateTime(r.lastTradeSetTime)], ['Last Trade Quantity', r.lastTradeQty], ['Notional Volume', r.notionalTraded], ['Notional Volume Set Time', showDateTime(r.notionalSetTime)], ['Shares Traded', r.sharesTraded],
  ['Settlement Price', r.settlementPx], ['Settlement Set Time', showDateTime(r.settlementSetTime)], ['Settlement Preliminary Flag', String(r.settlementPreliminaryFlag)], ['Settlement Price Calculation Method', r.settlementPriceCalculationMethod], ['Settlement Price Calculation Text', r.settlementPriceCalculationText],
  ['Open Interest', r.openInterest], ['Open Interest Set Time', showDateTime(r.openInterestSetTime)], ['Trading Reference Price', r.tradingReferencePrice], ['Trading Reference Price Set Time', showDateTime(r.tradingReferencePriceSetTime)], ['Mark Price', r.markPrice], ['Mark Price Set Time', showDateTime(r.markPriceSetTime)],
]

function HistoryResults({ inst, onView, refresh }: { inst: any; onView: (time: string) => void; refresh: () => void }) {
  saveListState('historyList', historyList)
  const from = new Date(historyList.from)
  const to = new Date(historyList.to)
  const rows = historyRows(inst).filter(r => new Date(r.transactionTime) >= from && new Date(r.transactionTime) <= to)
  if (!rows.length) return <EmptyState title="No market stats" text="Nothing was recorded in this time range." />
  const shown = pageSlice(historyList, rows)
  return (
    <>
      <div className="table-scroll">
        <Table className="table-wide">
          <TableHeader>
            <TableRow>
              {HISTORY_COLUMNS.map(([label], i) => <TableHead key={label} className={i ? 'num' : ''}>{label}</TableHead>)}
              <TableHead className="acts"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map(r => (
              <TableRow key={r.transactionTime}>
                {HISTORY_COLUMNS.map(([, key], i) => <TableCell key={key} className={i ? 'num' : ''}>{i ? r[key] : showDateTime(r[key])}</TableCell>)}
                <TableCell className="acts">
                  <Button variant="ghost" size="icon" type="button" aria-label="View details" title="View" onClick={() => onView(r.transactionTime)}><Eye size={18} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager state={historyList} total={rows.length} onChange={refresh} />
    </>
  )
}

function HistoryView({ inst }: { inst: any }) {
  useTitle(`${inst.id} Historical Market Stats`)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [range, setRange] = useState(() => {
    if (!historyList.from) Object.assign(historyList, todayRange())
    return { from: historyList.from as string, to: historyList.to as string }
  })
  const [detail, setDetail] = useState<any>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const filter = () => {
    historyList.from = range.from
    historyList.to = range.to
    historyList.page = 0
    bump()
  }
  const reset = () => {
    Object.assign(historyList, todayRange(), { page: 0 })
    setRange({ from: historyList.from, to: historyList.to })
    bump()
  }
  const view = (time: string) => {
    const r = historyRows(inst).find(row => row.transactionTime === time)
    if (!r) return
    setDetail(r)
    setSheetOpen(true)
  }

  return (
    <div className="detail-page">
      <div className="detail-head detail-head-plain">
        <Crumb to={instStatsHref(inst.id)}>{inst.id} Market Stats</Crumb>
        <header className="firm-head"><LargeTitle>Historical Market Stats</LargeTitle></header>
      </div>
      <div className="detail-scroll">
        <div className="filters history-filters">
          <div className="filter-field">
            <span>Transaction Time From</span>
            <DateTimeField id="historyFrom" kind="datetime-local" aria-label="Transaction Time From" value={range.from} onChange={from => setRange(r => ({ ...r, from }))} />
          </div>
          <div className="filter-field">
            <span>Transaction Time To</span>
            <DateTimeField id="historyTo" kind="datetime-local" aria-label="Transaction Time To" value={range.to} onChange={to => setRange(r => ({ ...r, to }))} />
          </div>
          <Button type="button" onClick={filter}>Filter</Button>
          <Button variant="secondary" type="button" onClick={reset}>Reset</Button>
        </div>
        <section className="card history-card" id="historyResults" aria-label="Historical market stats">
          <HistoryResults inst={inst} onView={view} refresh={bump} />
        </section>
      </div>
      <WideSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Market Stats Details" closeLabel="OK">
        {detail && <InfoList rows={historyDetailRows(detail)} />}
      </WideSheet>
    </div>
  )
}

/** /instrument-history?id=… */
export function InstrumentHistoryPage() {
  useStore()
  const [params] = useSearchParams()
  const id = params.get('id')
  const inst = instrumentById(id)
  if (!inst) return <MarketNotFound title="Instrument not found" id={id} href="/instruments" label="Instruments" />
  return <HistoryView key={inst.id} inst={inst} />
}
