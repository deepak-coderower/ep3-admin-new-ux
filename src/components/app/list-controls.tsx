import type * as React from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableHead } from '@/components/ui/table'
import { SelectField } from '@/components/form/select-field'
import { cn } from '@/lib/utils'

/** Sort/paging state shared by every list page. */
export type ListState = { sort: string; dir: number; page: number; size: number; [key: string]: any }

/** Clicking the active column flips direction; a new column sorts ascending. Always returns to page 1. */
export function toggleSort(state: ListState, key: string) {
  if (state.sort === key) state.dir *= -1
  else { state.sort = key; state.dir = 1 }
  state.page = 0
}

/** Sorts rows by `value`; blank values always go last, numbers and numeric strings compare naturally. */
export function sortRows<T>(rows: T[], value: (row: T) => any, dir: number) {
  const blank = (v: any) => v === null || v === undefined || v === ''
  return [...rows].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (blank(x) || blank(y)) return Number(blank(x)) - Number(blank(y))
    const order = typeof x === 'number' && typeof y === 'number'
      ? x - y
      : String(x).localeCompare(String(y), undefined, { sensitivity: 'base', numeric: true })
    return order * dir
  })
}

/** Applies the list's current sort when its key is one of `sorts`; otherwise keeps the original order. */
export function sortedBy<T>(state: ListState, rows: T[], sorts: Record<string, (row: T) => any>) {
  const value = sorts[state.sort]
  return value ? sortRows(rows, value, state.dir) : rows
}

export function SortHead({ state, sortKey, label, className, onSort }: { state: ListState; sortKey: string; label: string; className?: string; onSort: (key: string) => void }) {
  const on = state.sort === sortKey
  return (
    <TableHead className={className} aria-sort={on ? (state.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="sort-btn" data-sort-key={sortKey} data-on={on || undefined} data-dir={on ? (state.dir > 0 ? 'asc' : 'desc') : undefined} onClick={() => onSort(sortKey)}>
        {label}{on ? <ChevronUp size={14} className="sort-icon" /> : <ChevronsUpDown size={14} className="sort-icon" />}
      </button>
    </TableHead>
  )
}

export type FilterChip = { key: string; label: string; value: string }

/** Active filters shown as removable chips, plus "Clear all". Renders nothing when no filter is set. */
export function FilterChips({ chips, onRemove, onClear }: { chips: FilterChip[]; onRemove: (key: string) => void; onClear: () => void }) {
  if (!chips.length) return null
  const remove = (key: string, index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const box = e.currentTarget.closest('.filter-chips')
    onRemove(key)
    // Keep focus in the chip row: the chip that takes this one's place, else the previous one, else the search box.
    requestAnimationFrame(() => {
      const left = box ? [...box.querySelectorAll<HTMLElement>('[data-chip-remove]')] : []
      const next = left[Math.min(index, left.length - 1)] || document.querySelector<HTMLElement>('.filters input[type="search"]')
      next?.focus()
    })
  }
  return (
    <div className="filter-chips" role="group" aria-label="Active filters">
      {chips.map((c, i) => (
        <span key={c.key} className="tag filter-chip">
          <span className="filter-chip-text" title={`${c.label}: ${c.value}`}><span className="filter-chip-key">{c.label}:</span> {c.value}</span>
          <button type="button" data-chip-remove aria-label={`Remove ${c.label} filter`} title="Remove filter" onClick={e => remove(c.key, i, e)}><X size={12} /></button>
        </span>
      ))}
      <button className="link-btn" type="button" onClick={onClear}>Clear all</button>
    </div>
  )
}

/** Clamps state.page and returns the rows for the current page. */
export function pageSlice<T>(state: ListState, rows: T[]) {
  const pages = Math.max(1, Math.ceil(rows.length / state.size))
  state.page = Math.min(state.page, pages - 1)
  const start = state.page * state.size
  return rows.slice(start, start + state.size)
}

export function Pager({ state, total, onChange, sizes = [10, 25, 50] }: { state: ListState; total: number; onChange: () => void; sizes?: number[] }) {
  const { page, size } = state
  const pages = Math.max(1, Math.ceil(total / size))
  const start = page * size
  const move = (d: number) => {
    state.page += d
    onChange()
    const scroller = document.querySelector('.detail-scroll') || document.querySelector('.main')
    if (scroller) scroller.scrollTop = 0
  }
  return (
    <div className="pager">
      <Button variant="secondary" className="pager-btn" aria-label="Previous Page" disabled={page === 0} onClick={() => move(-1)}><ChevronLeft size={16} />Previous</Button>
      <span className="pager-info">{total ? start + 1 : 0}–{Math.min(start + size, total)} of {total} · Page {page + 1} of {pages}</span>
      <SelectField
        className="pager-size"
        aria-label="Rows per page"
        value={String(size)}
        options={sizes.map(n => ({ value: String(n), label: `${n} rows` }))}
        onChange={v => { state.size = Number(v); state.page = 0; onChange() }}
      />
      <Button variant="secondary" className="pager-btn" aria-label="Next Page" disabled={page >= pages - 1} onClick={() => move(1)}>Next<ChevronRight size={16} /></Button>
    </div>
  )
}

export function Cell({ value, strong, mono }: { value: any; strong?: boolean; mono?: boolean }) {
  if (value === undefined || value === null || value === '' || value === false) return <span className="row-value unset">—</span>
  if (strong) return <strong className="cell-strong">{String(value)}</strong>
  return <span className={cn(mono && 'mono cell-secondary')}>{String(value)}</span>
}
