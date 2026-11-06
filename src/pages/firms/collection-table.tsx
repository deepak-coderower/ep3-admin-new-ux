import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/app/page'
import { InfoTip } from '@/components/form/info-tip'
import { openFormSheet } from '@/components/form/form-sheet'
import { COLLECTIONS, type CollectionDef } from '@/data/config'
import { ask } from '@/lib/dialogs'
import { clone, isEmpty } from '@/lib/format'
import { persist } from '@/lib/firms'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export const recordLabel = (c: CollectionDef, r: any) => (c.labelOf ? c.labelOf(r) : r[c.primary]) || c.one

/**
 * Where a collection lives. On a saved firm, changes persist with a toast.
 * Inside a firm form, they only change the draft and call `onDraftChange`.
 */
export type CollectionOwner = { target: any; inForm?: boolean; onDraftChange?: () => void }

export function openRecordSheet(key: string, index: number | null, owner: CollectionOwner) {
  const c = COLLECTIONS[key]
  const rows: any[] = owner.target[key] || (owner.target[key] = [])
  const editing = index !== null
  openFormSheet({
    title: editing ? `Edit ${c.one}` : `Add ${c.one}`,
    submit: editing ? 'Save' : 'Add',
    note: c.note,
    fields: c.fields,
    values: editing ? clone(rows[index]) : Object.fromEntries(c.fields.filter(x => x.def !== undefined).map(x => [x.k, x.def])),
    validate: c.validate,
    onSubmit: values => {
      if (editing) rows[index] = values
      else rows.push(values)
      if (owner.inForm) { owner.onDraftChange?.(); return }
      persist()
      toast(editing ? `Saved ${recordLabel(c, values)}.` : `Added ${recordLabel(c, values)}.`)
    },
  })
}

export async function removeRecord(key: string, index: number, owner: CollectionOwner) {
  const c = COLLECTIONS[key]
  const rows: any[] = owner.target[key]
  const label = recordLabel(c, rows[index])
  if (owner.inForm) {
    rows.splice(index, 1)
    owner.onDraftChange?.()
    return
  }
  const ok = await ask({ title: `Remove ${label}?`, text: `This removes it from ${owner.target.name}.`, confirm: 'Remove', danger: true, glyph: 'trash' })
  if (!ok) return
  rows.splice(index, 1)
  persist()
  toast(`Removed ${label}.`)
}

function CellValue({ value, kind, strong }: { value: any; kind?: string; strong: boolean }) {
  if (kind === 'bool') return <>{value ? 'Yes' : 'No'}</>
  if (kind === 'num') return <>{isEmpty(value) ? '—' : Number(value).toLocaleString()}</>
  if (isEmpty(value)) return <span className="row-value unset">—</span>
  return strong ? <strong className="cell-strong">{String(value)}</strong> : <>{String(value)}</>
}

type Props = {
  collection: string
  rows: any[]
  owner?: CollectionOwner
  editable: boolean
  /** Shows the section title; otherwise a row count. */
  heading?: boolean
  /** Hides rows that don't match (position limits filter). */
  filter?: string
}

/** A firm sub-collection: alternate names, key personnel, aliases or position limits. */
export function CollectionTable({ collection, rows, owner, editable, heading, filter }: Props) {
  const c = COLLECTIONS[collection]
  const columns = c.columns || [[c.primary, c.one]]
  const addBtn = editable && owner
    ? <Button variant="tint" type="button" data-add-col={collection} onClick={() => openRecordSheet(collection, null, owner)}><Plus size={17} />Add {c.one}</Button>
    : null
  const needle = (filter || '').trim().toLowerCase()
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => !needle || columns.some(([k]) => String(r[k] ?? '').toLowerCase().includes(needle)))
  return (
    <>
      <div className="section-head">
        {heading
          ? <h2 className="section-title">{c.title}<InfoTip text={c.tip} /></h2>
          : <span className="page-sub">{rows.length} {rows.length === 1 ? c.one.toLowerCase() : c.title.toLowerCase()}</span>}
        {addBtn}
      </div>
      <Card>
        {!rows.length ? <EmptyState small text={c.empty} /> : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(([k, label, sec, kind]) => <TableHead key={k} className={cn(sec && 'hide-compact', kind === 'num' && 'num')}>{label}</TableHead>)}
                {editable && <TableHead className="acts"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map(({ r, i }) => (
                <TableRow key={i}>
                  {columns.map(([k, , sec, kind], ci) => (
                    <TableCell key={k} className={cn(sec && 'hide-compact', kind === 'num' && 'num')}><CellValue value={r[k]} kind={kind} strong={ci === 0} /></TableCell>
                  ))}
                  {editable && owner && (
                    <TableCell className="acts">
                      <Button variant="ghost" size="icon" type="button" aria-label={`Edit ${recordLabel(c, r)}`} title="Edit" onClick={() => openRecordSheet(collection, i, owner)}><Pencil size={17} /></Button>
                      <Button variant="ghost" size="icon" type="button" className="icon-danger" aria-label={`Remove ${recordLabel(c, r)}`} title="Remove" onClick={() => removeRecord(collection, i, owner)}><Trash2 size={17} /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
