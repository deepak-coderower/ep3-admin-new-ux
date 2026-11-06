import { useState } from 'react'
import { Link } from 'react-router'
import { Check, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/app/page'
import { InfoTip } from '@/components/form/info-tip'
import { ASSOC, AUTO_RELOAD_KEY, TYPES, type AssocDef, type Firm } from '@/data/config'
import { firmById, firms, persist } from '@/lib/firms'
import { storage } from '@/lib/storage'
import { toast } from '@/lib/toast'
import { CollectionTable } from '@/pages/firms/collection-table'
import { EntityTable, EntityToolbar } from '@/pages/firms/entity-table'

export function EntityTab({ kind, f }: { kind: string; f: Firm }) {
  const editable = !f.deleted
  return (
    <>
      <EntityToolbar kind={kind} f={f} editable={editable} />
      <EntityTable kind={kind} f={f} editable={editable} />
    </>
  )
}

export function AccountsTab({ f }: { f: Firm }) {
  const positions: any[] = f.positions || []
  const [auto, setAuto] = useState(() => storage.get(AUTO_RELOAD_KEY) === '1')
  const editable = !f.deleted
  return (
    <>
      <EntityToolbar kind="accounts" f={f} editable={editable} />
      <label className="check tab-option">
        <Switch id="autoReload" checked={auto} onCheckedChange={c => { setAuto(c); storage.set(AUTO_RELOAD_KEY, c ? '1' : '0') }} />
        Auto Reload Positions
      </label>
      <EntityTable kind="accounts" f={f} editable={editable} />
      <section className="section tab-block">
        <div className="section-head"><h2 className="section-title">Account Positions</h2></div>
        {positions.length ? (
          <Card className="table-scroll">
            <Table className="table-wide">
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead><TableHead>Symbol</TableHead><TableHead>Sub Type</TableHead>
                  <TableHead className="num">BOD Position</TableHead><TableHead className="num">Open Positions</TableHead><TableHead className="num">Qty Bought</TableHead>
                  <TableHead className="num">Qty Sold</TableHead><TableHead className="num">Unsettled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell><strong className="cell-strong">{p.account}</strong></TableCell>
                    <TableCell className="mono">{p.symbol}</TableCell>
                    <TableCell>{p.subType}</TableCell>
                    <TableCell className="num">{p.bod}</TableCell>
                    <TableCell className="num">{p.open}</TableCell>
                    <TableCell className="num">{p.bought}</TableCell>
                    <TableCell className="num">{p.sold}</TableCell>
                    <TableCell className="num">{p.unsettled}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : <Card><EmptyState small text="No open positions for this firm’s accounts." /></Card>}
      </section>
    </>
  )
}

export function LimitsTab({ f }: { f: Firm }) {
  const [filter, setFilter] = useState('')
  return (
    <>
      <div className="filters">
        <label className="filter-field filter-search">
          <span>Filter</span>
          <div className="search">
            <Search size={17} className="search-icon" />
            <Input id="limitFilter" type="search" placeholder="Product or symbol" autoComplete="off" value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
        </label>
      </div>
      <CollectionTable collection="limits" rows={f.limits || []} owner={{ target: f }} editable={!f.deleted} filter={filter} />
    </>
  )
}

function AssocList({ title, ids, picked, editable, onPick }: { title: string; ids: string[]; picked: Set<string>; editable: boolean; onPick: (id: string) => void }) {
  return (
    <div className="assoc-col">
      <h3 className="assoc-title">{title} <span>{ids.length}</span></h3>
      <div className="assoc-list" role="group" aria-label={title}>
        {ids.length ? ids.map(id => {
          const other = firmById(id)
          return (
            <button key={id} className="assoc-item" type="button" aria-pressed={picked.has(id)} disabled={!editable} onClick={() => onPick(id)}>
              <span>{other ? other.name : id}</span><Check size={16} />
            </button>
          )
        }) : <p className="assoc-empty">None</p>}
      </div>
    </div>
  )
}

/** One dual-list association box (available ⇄ associated) with its own Cancel / Update. */
function AssocBox({ f, cfg }: { f: Firm; cfg: AssocDef }) {
  const saved: string[] = (f.assoc || {})[cfg.key] || []
  const [list, setList] = useState<string[]>(() => [...saved])
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const typeLabel = TYPES[cfg.type].label
  const editable = !f.deleted
  const available = firms().filter(x => !x.deleted && x.type === cfg.type && x.id !== f.id && !list.includes(x.id)).map(x => x.id)
  const dirty = JSON.stringify(saved) !== JSON.stringify(list)

  const pick = (id: string) => setPicked(p => {
    const next = new Set(p)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const add = () => { setList(l => [...l, ...[...picked].filter(id => !l.includes(id))]); setPicked(new Set()) }
  const remove = () => { setList(l => l.filter(id => !picked.has(id))); setPicked(new Set()) }
  const cancel = () => { setList([...saved]); setPicked(new Set()) }
  const update = () => {
    f.assoc = f.assoc || {}
    f.assoc[cfg.key] = [...list]
    persist()
    toast('Firm associations updated.')
  }

  return (
    <section className="section" id={`assoc-${cfg.key}`}>
      <div className="section-head"><h2 className="section-title">{cfg.title(f.name)}<InfoTip text={cfg.tip(f.name)} /></h2></div>
      <Card className="form-card">
        <div className="assoc-grid">
          <AssocList title={cfg.available || `Available ${typeLabel}s`} ids={available} picked={picked} editable={editable} onPick={pick} />
          <div className="assoc-arrows">
            <Button variant="secondary" size="icon" aria-label="Associate selected firms" title="Associate selected" disabled={!editable} onClick={add}><ChevronRight size={18} /></Button>
            <Button variant="secondary" size="icon" aria-label="Remove selected firms" title="Remove selected" disabled={!editable} onClick={remove}><ChevronLeft size={18} /></Button>
          </div>
          <AssocList title={cfg.associated || `Associated ${typeLabel}s`} ids={list} picked={picked} editable={editable} onPick={pick} />
        </div>
        {editable && (
          <div className="assoc-foot">
            <Button variant="tint" asChild><Link to={`/firm-new?type=${cfg.type}`}><Plus size={17} />Add New {typeLabel}</Link></Button>
            <div className="head-acts">
              <Button variant="ghost" disabled={!dirty} onClick={cancel}>Cancel</Button>
              <Button disabled={!dirty} onClick={update}>Update</Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}

export function AssociationsTab({ f }: { f: Firm }) {
  return <div className="sections">{(ASSOC[f.type] || []).map(cfg => <AssocBox key={cfg.key} f={f} cfg={cfg} />)}</div>
}
