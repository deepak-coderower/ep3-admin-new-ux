import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Eye, Pencil, Plus, Search } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActionMenu, RowContextMenu } from '@/components/app/action-menu'
import { FilterChips, Pager, SortHead, pageSlice, sortedBy, toggleSort, type FilterChip, type ListState } from '@/components/app/list-controls'
import { EmptyState, LargeTitle, useTitle } from '@/components/app/page'
import { SelectField } from '@/components/form/select-field'
import { STATES, TYPES, type Firm } from '@/data/config'
import { firmMenuItems, restoreFirm } from '@/lib/firm-actions'
import { firms, hrefFor } from '@/lib/firms'
import { readListState, saveListState, session } from '@/lib/storage'
import { useStore } from '@/lib/store'

type FirmsListState = ListState & { q: string; type: string; state: string; deleted: boolean }

const LIST_KEY = 'firmsList'
const newListState = (): FirmsListState => ({ q: '', type: '', state: '', deleted: false, sort: 'seed', dir: 1, page: 0, size: 10, ...readListState(LIST_KEY) })

export function firmStateLabel(f: Firm) {
  return f.deleted ? 'Deleted' : STATES[f.state]
}

function filteredFirms(list: FirmsListState) {
  const q = list.q.trim().toLowerCase()
  return firms().filter(f => {
    if (!list.deleted && f.deleted) return false
    if (list.type && f.type !== list.type) return false
    if (list.state && (f.deleted || f.state !== list.state)) return false
    if (q && !f.name.toLowerCase().includes(q) && !f.id.toLowerCase().includes(q)) return false
    return true
  })
}

const FIRM_SORTS: Record<string, (f: Firm) => any> = { name: f => f.name, id: f => f.id }

function firmFilterChips(list: FirmsListState): FilterChip[] {
  return [
    list.q.trim() && { key: 'q', label: 'Firm Name', value: list.q.trim() },
    list.type && { key: 'type', label: 'Firm Type', value: TYPES[list.type].label },
    list.state && { key: 'state', label: 'Firm State', value: STATES[list.state] },
  ].filter(Boolean) as FilterChip[]
}

function SkeletonTable({ size }: { size: number }) {
  return (
    <div aria-hidden="true">
      <Table className="skel-table">
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="hide-compact">Firm ID</TableHead><TableHead className="hide-compact">Type</TableHead><TableHead>State</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {Array.from({ length: size }, (_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className={`skel-name skel-w${i % 3}`} /></TableCell>
              <TableCell className="hide-compact"><Skeleton className={`skel-id skel-w${(i + 1) % 3}`} /></TableCell>
              <TableCell className="hide-compact"><Skeleton className="skel-text" /></TableCell>
              <TableCell><Skeleton className="skel-pill" /></TableCell>
              <TableCell className="acts"><span className="skel-acts"><Skeleton className="skel-icon hide-compact" /><Skeleton className="skel-icon hide-compact" /><Skeleton className="skel-icon" /></span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="pager"><Skeleton className="skel-text" /><Skeleton className="skel-pager" /></div>
    </div>
  )
}

export function FirmsListPage() {
  useTitle('Firms')
  useStore()
  const navigate = useNavigate()
  const [list] = useState(newListState)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [loading, setLoading] = useState(() => session.get('listShown') !== '1')
  const searchRef = useRef<HTMLInputElement>(null)

  const refresh = () => { saveListState(LIST_KEY, list); bump() }

  useEffect(() => {
    if (!loading) return
    session.set('listShown', '1')
    const t = setTimeout(() => setLoading(false), 420)
    return () => clearTimeout(t)
  }, [loading])

  // "/" focuses the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest?.('input, select, textarea, [role="dialog"], [contenteditable], [role="combobox"]')
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const rows = sortedBy(list, filteredFirms(list), FIRM_SORTS)
  const pageRows = pageSlice(list, rows)
  const total = firms().filter(f => !f.deleted).length
  const filtered = !!(list.q || list.type || list.state)
  const countText = filtered ? `${rows.length} of ${list.deleted ? firms().length : total} firms` : `${rows.length} firm${rows.length === 1 ? '' : 's'}`

  const setFilter = (patch: Partial<FirmsListState>) => { Object.assign(list, patch, { page: 0 }); refresh() }
  const clearFilters = () => { setFilter({ q: '', type: '', state: '' }); searchRef.current?.focus() }
  const onSort = (key: string) => { toggleSort(list, key); refresh() }

  return (
    <div className="page">
      <header className="page-head">
        <div><LargeTitle>Firms</LargeTitle><p className="sr-only" aria-live="polite">{countText}</p></div>
        <Button asChild><Link to="/firm-new"><Plus size={18} />New Firm</Link></Button>
      </header>
      <div className="filters">
        <label className="filter-field filter-search">
          <span>Firm Name</span>
          <div className="search">
            <Search size={17} className="search-icon" />
            <Input
              ref={searchRef}
              id="q"
              type="search"
              placeholder="Partial or complete name or ID"
              autoComplete="off"
              value={list.q}
              onChange={e => setFilter({ q: e.target.value })}
              onKeyDown={e => { if (e.key === 'Escape' && list.q) setFilter({ q: '' }) }}
            />
            <kbd aria-hidden="true">/</kbd>
          </div>
        </label>
        <div className="filter-field">
          <span>Firm Type</span>
          <SelectField aria-label="Firm Type" value={list.type} blank="All Types" options={Object.entries(TYPES).map(([value, t]) => ({ value, label: t.label }))} onChange={v => setFilter({ type: v })} />
        </div>
        <div className="filter-field">
          <span>Firm State</span>
          <SelectField aria-label="Firm State" value={list.state} blank="All States" options={Object.entries(STATES).map(([value, label]) => ({ value, label }))} onChange={v => setFilter({ state: v })} />
        </div>
        <label className="check push">
          <Switch id="showDeleted" checked={list.deleted} onCheckedChange={c => setFilter({ deleted: c })} />
          Show Deleted
        </label>
      </div>
      <FilterChips chips={firmFilterChips(list)} onRemove={key => setFilter({ [key]: '' })} onClear={clearFilters} />
      <Card aria-label="Firms">
        {loading ? <SkeletonTable size={list.size} /> : !rows.length ? (
          filtered
            ? <EmptyState title="No matching firms" text="Try a different name, or clear the filters."><Button variant="tint" onClick={clearFilters}>Clear Filters</Button></EmptyState>
            : <EmptyState title="No firms yet" text="Create a firm to start onboarding it to the exchange."><Button asChild><Link to="/firm-new"><Plus size={18} />New Firm</Link></Button></EmptyState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead state={list} sortKey="name" label="Name" onSort={onSort} />
                  <SortHead state={list} sortKey="id" label="Firm ID" className="hide-compact" onSort={onSort} />
                  <TableHead className="hide-compact">Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="acts"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(f => {
                  const href = hrefFor(f.id)
                  const t = TYPES[f.type]
                  return (
                    <RowContextMenu key={f.id} items={firmMenuItems(f, false, navigate)}>
                      <TableRow
                        className="row-link"
                        data-deleted={f.deleted || undefined}
                        tabIndex={0}
                        onClick={e => { if (!(e.target as HTMLElement).closest('a, button, input')) navigate(href) }}
                        onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(href) }}
                      >
                        <TableCell>
                          <Link className="cell-strong" to={href}>{f.name}</Link>
                          <span className="cell-secondary show-compact">{t.label}</span>
                        </TableCell>
                        <TableCell className="hide-compact cell-secondary mono">{f.id}</TableCell>
                        <TableCell className="hide-compact">{t.label}</TableCell>
                        <TableCell><StatusBadge value={firmStateLabel(f)} /></TableCell>
                        <TableCell className="acts">
                          <Button variant="ghost" size="icon" className="hide-compact" asChild><Link to={href} aria-label={`View ${f.name}`} title="View"><Eye size={18} /></Link></Button>
                          {f.deleted
                            ? <Button variant="tint" size="sm" onClick={() => restoreFirm(f.id)}>Restore</Button>
                            : (
                              <>
                                <Button variant="ghost" size="icon" className="hide-compact" asChild><Link to={hrefFor(f.id, 'edit')} aria-label={`Edit ${f.name}`} title="Edit"><Pencil size={17} /></Link></Button>
                                <ActionMenu label={`More actions for ${f.name}`} items={firmMenuItems(f, false, navigate)} />
                              </>
                            )}
                        </TableCell>
                      </TableRow>
                    </RowContextMenu>
                  )
                })}
              </TableBody>
            </Table>
            <Pager state={list} total={rows.length} onChange={refresh} />
          </>
        )}
      </Card>
    </div>
  )
}
