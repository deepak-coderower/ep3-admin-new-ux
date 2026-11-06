// The Instruments list. Ported from instruments-list.js plus its handlers in market-events.js and events.js.
import { useReducer, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check, ChevronsUpDown, Download, Eye, Pause, Pencil, Play, Plus, RefreshCw, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActionMenu, RowContextMenu, type MenuEntry } from '@/components/app/action-menu'
import { FilterChips, Pager, SortHead, pageSlice, sortedBy, toggleSort, type FilterChip, type ListState } from '@/components/app/list-controls'
import { EmptyState, useTitle } from '@/components/app/page'
import { DateTimeField } from '@/components/form/date-time-field'
import { SelectField } from '@/components/form/select-field'
import { ModuleHead } from '@/components/market/module-head'
import { DELETE_BLOCKED, IT } from '@/data/market-config'
import { INSTRUMENT_FILTERS, type InstrumentFilter } from '@/data/market-sections'
import { formatWhen } from '@/lib/format'
import {
  deleteInstruments, haltAllInstruments, instrumentMenuItems, instSelected, openStateSheet, refreshMarketData, resumeHaltedInstruments,
} from '@/lib/instrument-actions'
import { instDeletable, instEditable, instHref, instNewHref, market, px } from '@/lib/market'
import { readListState, saveListState } from '@/lib/storage'
import { useStore } from '@/lib/store'
import {
  ApproveSettlementSheet, ImportSettlementSheet, approveRows, exportInstruments, handleSettlementFile, type ApproveRow, type SettlementRow,
} from '@/pages/market/instruments-settlement'

type InstListState = ListState & { more: boolean; [key: string]: any }

const LIST_KEY = 'instList'
const blankInstrumentFilters = () => Object.fromEntries(INSTRUMENT_FILTERS.map(f => [f.k, '']))
const newListState = (): InstListState => ({ page: 0, size: 10, more: false, sort: '', dir: 1, ...blankInstrumentFilters(), ...readListState(LIST_KEY) })

const instStat = (valueKey: string, setTime: string) => (i: any) => {
  const s = i.stats || {}
  return s[setTime] && s[valueKey] !== '' && s[valueKey] !== undefined ? Number(s[valueKey]) : null
}
const INSTRUMENT_SORTS: Record<string, (i: any) => any> = {
  productId: i => i.productId,
  id: i => i.id,
  description: i => i.description,
  tradable: i => (i.nonTradable ? 'N' : 'Y'),
  clearingHouse: i => i.clearingHouse,
  scheduled: i => (i.isScheduled ? 'Scheduled' : 'Manual'),
  open: instStat('open', 'openSetTime'),
  high: instStat('high', 'highSetTime'),
  low: instStat('low', 'lowSetTime'),
  close: instStat('close', 'closeSetTime'),
  lastPrice: instStat('lastPrice', 'lastTradeSetTime'),
  settlementPrice: instStat('settlementPrice', 'settlementSetTime'),
}

const instrumentFilterActive = (f: InstListState) => INSTRUMENT_FILTERS.some(x => f[x.k])
const secondaryFilters = (f: InstListState) => INSTRUMENT_FILTERS.filter(x => !x.primary && (!x.irs || f.type === IT.IRS))
const secondaryFilterCount = (f: InstListState) => secondaryFilters(f).filter(x => f[x.k]).length

function matchesInstrumentFilters(f: InstListState, i: any) {
  const contains = (value: any, needle: any) => String(value || '').toLowerCase().includes(String(needle).trim().toLowerCase())
  if (f.state ? i.state !== f.state : i.state === 'Terminated') return false
  if (f.productName && !contains(i.productId, f.productName)) return false
  if (f.id && !contains(i.id, f.id)) return false
  if (f.type && i.type !== f.type) return false
  if (f.isScheduled && (f.isScheduled === 'Scheduled') !== !!i.isScheduled) return false
  if (f.isTradable && (f.isTradable === 'Tradable') !== !i.nonTradable) return false
  if (f.hasLegs && (f.hasLegs === 'Has Legs') !== ((i.legs || []).length > 0)) return false
  if (f.type === IT.IRS) {
    if (f.tradeDate && i.startDate !== f.tradeDate) return false
    if (f.clearingHouse && i.clearingHouse !== f.clearingHouse) return false
    if (f.basecurrency && i.basecurrency !== f.basecurrency) return false
    if (f.tenor && !contains(i.tenor, f.tenor)) return false
    if (f.floatingRateIndex && i.floatingRateIndex !== f.floatingRateIndex) return false
    if (f.floatingRateIndexTenor && !contains(i.floatingRateIndexTenor, f.floatingRateIndexTenor)) return false
  }
  return true
}

const filteredInstruments = (f: InstListState) => market().instruments.filter(i => matchesInstrumentFilters(f, i))

function instrumentFilterChips(f: InstListState): FilterChip[] {
  return INSTRUMENT_FILTERS.filter(x => String(f[x.k] || '').trim()).map(x => ({
    key: x.k,
    label: x.label,
    value: x.date ? formatWhen(f[x.k]) : String(f[x.k]).trim(),
  }))
}

function FilterField({ f, value, onChange }: { f: InstrumentFilter; value: string; onChange: (v: string) => void }) {
  if (f.options) {
    const options = typeof f.options === 'function' ? f.options() : f.options
    return (
      <div className="filter-field">
        <span>{f.label}</span>
        <SelectField aria-label={f.label} value={value} blank="All" options={options} onChange={onChange} />
      </div>
    )
  }
  if (f.date) {
    return (
      <div className="filter-field">
        <span>{f.label}</span>
        <DateTimeField kind="date" aria-label={f.label} value={value} onChange={onChange} />
      </div>
    )
  }
  return (
    <label className="filter-field">
      <span>{f.label}</span>
      <Input className="inst-filter-input" data-filter={f.k} type="search" value={value} autoComplete="off" spellCheck={false} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function OpsMenu({ items }: { items: MenuEntry[] }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="push" type="button">Actions<ChevronsUpDown size={16} /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map((it, i) => (it === '-'
          ? <DropdownMenuSeparator key={i} />
          : (
            <DropdownMenuItem key={it.label} variant={it.danger ? 'destructive' : 'default'} onSelect={() => it.run()}>
              <it.icon size={17} /><span>{it.label}</span>
            </DropdownMenuItem>
          )))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SelectionBar({ rows, onClear, onState, onDelete }: { rows: any[]; onClear: () => void; onState: () => void; onDelete: () => void }) {
  const chosen = rows.filter(r => instSelected.has(r.id))
  if (!chosen.length) return null
  const canDelete = chosen.every(instDeletable)
  const del = <Button variant="secondary" size="sm" type="button" disabled={!canDelete} onClick={onDelete}><Trash2 size={16} />Delete Selected</Button>
  return (
    <div className="sel-bar" role="group" aria-label="Selected instruments">
      <span>{chosen.length} selected</span>
      <Button variant="secondary" size="sm" type="button" onClick={onState}><TriangleAlert size={16} />Change State</Button>
      {canDelete ? del : <span className="sel-bar-blocked" title={DELETE_BLOCKED}>{del}</span>}
      <Button variant="ghost" size="sm" type="button" onClick={onClear}>Clear</Button>
    </div>
  )
}

export function InstrumentsPage() {
  useTitle('Instruments')
  useStore()
  const navigate = useNavigate()
  const [list] = useState(() => { instSelected.clear(); return newListState() })
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [importRows, setImportRows] = useState<SettlementRow[] | null>(null)
  const [importKey, setImportKey] = useState(0)
  const [approve, setApprove] = useState<ApproveRow[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)

  const refresh = () => { saveListState(LIST_KEY, list); bump() }

  const setFilter = (k: string, value: string) => {
    list[k] = value
    list.page = 0
    if (k === 'type') {
      if (value === IT.IRS) list.more = true
      else INSTRUMENT_FILTERS.filter(x => x.irs).forEach(x => { list[x.k] = '' })
    }
    refresh()
  }
  const removeFilter = (key: string) => {
    list[key] = ''
    list.page = 0
    if (key === 'type') INSTRUMENT_FILTERS.filter(x => x.irs).forEach(x => { list[x.k] = '' })
    refresh()
  }
  const clearFilters = () => {
    Object.assign(list, blankInstrumentFilters(), { page: 0, more: false })
    refresh()
    requestAnimationFrame(() => filtersRef.current?.querySelector<HTMLElement>('[data-filter]')?.focus())
  }
  const onSort = (key: string) => { toggleSort(list, key); refresh() }

  const filtered = filteredInstruments(list)
  const rows = sortedBy(list, filtered, INSTRUMENT_SORTS)
  const pageRows = pageSlice(list, rows)
  const moreCount = secondaryFilterCount(list)
  const selectedIds = () => filteredInstruments(list).filter(i => instSelected.has(i.id)).map(i => i.id)

  const onPage = pageRows.map(r => r.id)
  const allOn = onPage.length > 0 && onPage.every(id => instSelected.has(id))
  const someOn = !allOn && onPage.some(id => instSelected.has(id))
  const toggleAll = (on: boolean) => {
    onPage.forEach(id => { if (on) instSelected.add(id); else instSelected.delete(id) })
    bump()
  }
  const toggleOne = (id: string, on: boolean) => {
    if (on) instSelected.add(id); else instSelected.delete(id)
    bump()
  }

  const opsItems: MenuEntry[] = [
    { label: 'Export Data', icon: Download, run: () => exportInstruments(filteredInstruments(list)) },
    { label: 'Import Settlement Prices', icon: Upload, run: () => fileRef.current?.click() },
    { label: 'Approve Settlement Prices', icon: Check, run: () => setApprove(approveRows()) },
    '-',
    { label: 'Resume Halted to Schedule', icon: Play, run: resumeHaltedInstruments },
    { label: 'Halt All', icon: Pause, danger: true, run: haltAllInstruments },
  ]

  const addButton = <Button asChild><Link to={instNewHref()}><Plus size={18} />Add Instrument</Link></Button>

  return (
    <div className="detail-page">
      <ModuleHead
        active="instruments"
        actions={(
          <>
            <Button variant="secondary" type="button" onClick={refreshMarketData}><RefreshCw size={16} />Refresh Market Data</Button>
            {addButton}
          </>
        )}
      />
      <div className="detail-scroll">
        <div ref={filtersRef}>
          <div className="filters">
            {INSTRUMENT_FILTERS.filter(f => f.primary).map(f => <FilterField key={f.k} f={f} value={list[f.k] || ''} onChange={v => setFilter(f.k, v)} />)}
            <Button variant="secondary" type="button" aria-expanded={!!list.more} onClick={() => { list.more = !list.more; refresh() }}>
              More Filters{moreCount > 0 && <span className="count-badge">{moreCount}</span>}
            </Button>
            <OpsMenu items={opsItems} />
          </div>
          {list.more && (
            <div className="filters filters-more">
              {secondaryFilters(list).map(f => <FilterField key={f.k} f={f} value={list[f.k] || ''} onChange={v => setFilter(f.k, v)} />)}
            </div>
          )}
        </div>
        <FilterChips chips={instrumentFilterChips(list)} onRemove={removeFilter} onClear={clearFilters} />
        <input
          ref={fileRef}
          type="file"
          id="csvFile"
          accept=".csv"
          hidden
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleSettlementFile(file, next => { setImportKey(k => k + 1); setImportRows(next) })
            e.target.value = ''
          }}
        />
        <p className="sr-only" aria-live="polite">{`${rows.length} instrument${rows.length === 1 ? '' : 's'}`}</p>
        <SelectionBar
          rows={filtered}
          onState={() => openStateSheet(selectedIds())}
          onDelete={() => deleteInstruments(selectedIds(), true, navigate)}
          onClear={() => { instSelected.clear(); bump() }}
        />
        <section className="card card-clip" aria-label="Instruments">
          {!rows.length ? (
            instrumentFilterActive(list)
              ? <EmptyState title="No matching instruments" text="Try different filters, or clear them."><Button variant="tint" type="button" onClick={clearFilters}>Clear Filters</Button></EmptyState>
              : <EmptyState title="No instruments yet" text="Add an instrument from one of your products.">{addButton}</EmptyState>
          ) : (
            <>
              <div className="table-scroll">
                <Table className="table-wide inst-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="check-cell">
                        <Checkbox checked={allOn ? true : someOn ? 'indeterminate' : false} aria-label="Select all on this page" onCheckedChange={c => toggleAll(c === true)} />
                      </TableHead>
                      <SortHead state={list} sortKey="productId" label="Product Name" onSort={onSort} />
                      <SortHead state={list} sortKey="id" label="ID (Symbol)" onSort={onSort} />
                      <SortHead state={list} sortKey="description" label="Description" onSort={onSort} />
                      <SortHead state={list} sortKey="tradable" label="Tradable" onSort={onSort} />
                      <SortHead state={list} sortKey="clearingHouse" label="Clearing House" onSort={onSort} />
                      <SortHead state={list} sortKey="scheduled" label="Scheduled" onSort={onSort} />
                      <TableHead>State</TableHead>
                      <SortHead state={list} sortKey="open" label="Open" className="num" onSort={onSort} />
                      <SortHead state={list} sortKey="high" label="High" className="num" onSort={onSort} />
                      <SortHead state={list} sortKey="low" label="Low" className="num" onSort={onSort} />
                      <SortHead state={list} sortKey="close" label="Close" className="num" onSort={onSort} />
                      <SortHead state={list} sortKey="lastPrice" label="Last-Px" className="num" onSort={onSort} />
                      <SortHead state={list} sortKey="settlementPrice" label="Settl-Px" className="num" onSort={onSort} />
                      <TableHead className="acts"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map(i => {
                      const href = instHref(i.id)
                      const s = i.stats || {}
                      const stat = (value: any, setTime: string) => (s[setTime] ? px(i, value) : '')
                      const items = instrumentMenuItems(i, false, navigate)
                      return (
                        <RowContextMenu key={i.id} items={items}>
                          <TableRow
                            className="row-link"
                            tabIndex={0}
                            data-inst={i.id}
                            onClick={e => {
                              const t = e.target as HTMLElement
                              if (!e.currentTarget.contains(t) || t.closest('a, button, input, .check-cell')) return
                              navigate(href)
                            }}
                            onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(href) }}
                          >
                            <TableCell className="check-cell">
                              <Checkbox checked={instSelected.has(i.id)} aria-label={`Select ${i.id}`} onCheckedChange={c => toggleOne(i.id, c === true)} />
                            </TableCell>
                            <TableCell>{i.productId}</TableCell>
                            <TableCell><Link className="cell-strong mono" to={href}>{i.id}</Link></TableCell>
                            <TableCell className="desc-cell" title={i.description}>{i.description}</TableCell>
                            <TableCell>{i.nonTradable ? 'N' : 'Y'}</TableCell>
                            <TableCell className="house-cell" title={i.clearingHouse}>{i.clearingHouse}</TableCell>
                            <TableCell>{i.isScheduled ? 'Scheduled' : <span className="text-bad">Manual</span>}</TableCell>
                            <TableCell><StatusBadge value={i.state} /></TableCell>
                            <TableCell className="num">{stat(s.open, 'openSetTime')}</TableCell>
                            <TableCell className="num">{stat(s.high, 'highSetTime')}</TableCell>
                            <TableCell className="num">{stat(s.low, 'lowSetTime')}</TableCell>
                            <TableCell className="num">{stat(s.close, 'closeSetTime')}</TableCell>
                            <TableCell className="num">{stat(s.lastPrice, 'lastTradeSetTime')}</TableCell>
                            <TableCell className="num">{stat(s.settlementPrice, 'settlementSetTime')}</TableCell>
                            <TableCell className="acts">
                              <Button variant="ghost" size="icon" asChild><Link to={href} aria-label={`View ${i.id}`} title="View"><Eye size={18} /></Link></Button>
                              {instEditable(i) && <Button variant="ghost" size="icon" asChild><Link to={instHref(i.id, 'edit')} aria-label={`Edit ${i.id}`} title="Edit"><Pencil size={17} /></Link></Button>}
                              <ActionMenu label={`More actions for ${i.id}`} items={items} />
                            </TableCell>
                          </TableRow>
                        </RowContextMenu>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pager state={list} total={rows.length} onChange={refresh} />
            </>
          )}
        </section>
      </div>
      <ImportSettlementSheet key={importKey} rows={importRows} onClose={() => setImportRows(null)} />
      <ApproveSettlementSheet rows={approve} onClose={() => setApprove(null)} />
    </div>
  )
}
