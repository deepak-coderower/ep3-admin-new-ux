import { Link, useNavigate, type NavigateFunction } from 'react-router'
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/app/page'
import { ENTITIES, type Firm } from '@/data/config'
import { ask } from '@/lib/dialogs'
import { isEmpty } from '@/lib/format'
import { entityBase, entityHref, entityNewHref, entityRows, persist } from '@/lib/firms'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export async function deleteEntity(kind: string, f: Firm, sid: string | null, id: string, navigate: NavigateFunction) {
  const e = ENTITIES[kind]
  const rows = entityRows(kind, f, sid)
  const index = rows.findIndex(r => r.id === id)
  const name = e.title(rows[index])
  const ok = await ask({ title: `Delete ${name}?`, text: `This removes the ${e.one.toLowerCase()} from ${f.name}.`, confirm: `Delete ${e.one}`, danger: true, glyph: 'trash' })
  if (!ok) return
  rows.splice(index, 1)
  persist()
  navigate(entityBase(kind, f, sid))
  toast(`Deleted ${name}.`)
}

async function bulkState(kind: string, f: Firm, state: string) {
  const e = ENTITIES[kind]
  const suspending = state === 'Suspended'
  const ok = await ask({
    title: `${suspending ? 'Suspend' : 'Activate'} all ${e.plural.toLowerCase()}?`,
    text: `This changes every ${e.one.toLowerCase()} in ${f.name} to ${state}.`,
    confirm: `${suspending ? 'Suspend' : 'Activate'} All`,
    danger: suspending,
    glyph: suspending ? 'pause' : 'play',
  })
  if (!ok) return
  entityRows(kind, f).forEach(r => { r.state = state })
  persist()
  toast(`${suspending ? 'Suspended' : 'Activated'} all ${e.plural.toLowerCase()}.`)
}

export function EntityToolbar({ kind, f, sid = null, editable }: { kind: string; f: Firm; sid?: string | null; editable: boolean }) {
  const e = ENTITIES[kind]
  const rows = entityRows(kind, f, sid)
  return (
    <div className="tab-toolbar">
      <span className="page-sub">{rows.length} {rows.length === 1 ? e.one.toLowerCase() : e.plural.toLowerCase()}</span>
      {editable && (
        <div className="head-acts">
          {e.bulk && (
            <>
              <Button variant="secondary" disabled={!rows.length} onClick={() => bulkState(kind, f, 'Suspended')}>Suspend All</Button>
              <Button variant="secondary" disabled={!rows.length} onClick={() => bulkState(kind, f, 'Active')}>Activate All</Button>
            </>
          )}
          <Button asChild><Link to={entityNewHref(kind, f, sid)}><Plus size={18} />{kind === 'keys' ? 'Create API Key' : `Add New ${e.one}`}</Link></Button>
        </div>
      )}
    </div>
  )
}

function EntityCell({ value, opts }: { value: any; opts: Record<string, any> }) {
  if (opts.pill) return <StatusBadge value={value} />
  if (isEmpty(value)) return <span className="row-value unset">—</span>
  if (opts.strong) return <strong className="cell-strong">{String(value)}</strong>
  return opts.mono ? <span className="mono cell-secondary">{String(value)}</span> : <>{String(value)}</>
}

export function EntityTable({ kind, f, sid = null, editable }: { kind: string; f: Firm; sid?: string | null; editable: boolean }) {
  const navigate = useNavigate()
  const e = ENTITIES[kind]
  const rows = entityRows(kind, f, sid)
  if (!rows.length) return <Card><EmptyState small text={`This ${kind === 'keys' ? 'service' : 'firm'} has no ${e.plural.toLowerCase()} yet.`} /></Card>
  return (
    <Card className={cn(e.wide && 'table-scroll')}>
      <Table className={cn(e.wide && 'table-wide')}>
        <TableHeader>
          <TableRow>
            {e.columns.map(([label, , o = {}]) => <TableHead key={label} className={cn(o.sec && 'hide-compact', o.num && 'num')}>{label}</TableHead>)}
            {kind === 'services' && <TableHead>Keys</TableHead>}
            <TableHead className="acts"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => {
            const href = entityHref(kind, f, sid, r.id)
            return (
              <TableRow
                key={r.id}
                className="row-link"
                tabIndex={0}
                onClick={ev => { if (!(ev.target as HTMLElement).closest('a, button, input')) navigate(href) }}
                onKeyDown={ev => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) navigate(href) }}
              >
                {e.columns.map(([label, get, o = {}]) => (
                  <TableCell key={label} className={cn(o.sec && 'hide-compact', o.num && 'num')}><EntityCell value={get(r, f)} opts={o} /></TableCell>
                ))}
                {kind === 'services' && (
                  <TableCell>
                    <Button variant="tint" size="sm" asChild><Link to={entityHref(kind, f, sid, r.id, 'keys')}><KeyRound size={15} />{(r.keys || []).length}</Link></Button>
                  </TableCell>
                )}
                <TableCell className="acts">
                  {editable && (
                    <>
                      <Button variant="ghost" size="icon" asChild><Link to={entityHref(kind, f, sid, r.id, 'edit')} aria-label={`Edit ${e.title(r)}`} title="Edit"><Pencil size={17} /></Link></Button>
                      <Button variant="ghost" size="icon" className="icon-danger" aria-label={`Delete ${e.title(r)}`} title="Delete" onClick={() => deleteEntity(kind, f, sid, r.id, navigate)}><Trash2 size={17} /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
