// Instrument actions shared by the Instruments list and the instrument detail pages.
// Ported from instrumentMenuItems / deleteInstruments / haltAllInstruments / resumeHaltedInstruments /
// refreshMarketData in instruments-list.js and the Change State sheet in instrument-state.js.
import { useReducer } from 'react'
import type { NavigateFunction } from 'react-router'
import { BookOpen, ChartLine, Copy, ExternalLink, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { MenuEntry } from '@/components/app/action-menu'
import { FieldRow } from '@/components/form/field-row'
import { closeFormSheet, openFormSheet } from '@/components/form/form-sheet'
import type { Field } from '@/data/config'
import { DELETE_BLOCKED, EDIT_BLOCKED, HALTABLE_EXCLUDED, INST_STATES, IT, NETTING_ENABLED, RESOLUTION_SIDES, STATS_BLOCKED } from '@/data/market-config'
import { TIPS } from '@/data/tips'
import { ask } from '@/lib/dialogs'
import { focusFirstError } from '@/lib/form'
import { isoDateTime, setPath } from '@/lib/format'
import { bookHref, decimalsOf, instDeletable, instEditable, instHref, instrumentById, instStatsEnabled, instStatsHref, market, saveMarket, stateFromSchedule } from '@/lib/market'
import { toast } from '@/lib/toast'

/** Ids ticked in the Instruments list (the prototype's instSelected). Cleared when the list page mounts. */
export const instSelected = new Set<string>()

const onInstrumentsList = () => window.location.pathname === '/instruments'

/** Actions for an instrument's "⋯" / right-click menu. The detail page leaves out the ones its header already shows. */
export function instrumentMenuItems(inst: any, onDetail: boolean, navigate: NavigateFunction): MenuEntry[] {
  const editable = instEditable(inst)
  return [
    ...(onDetail ? [] : [
      { label: 'Change State', icon: TriangleAlert, disabled: !editable, reason: EDIT_BLOCKED, run: () => openStateSheet([inst.id]) },
      { label: 'Edit', icon: Pencil, disabled: !editable, reason: EDIT_BLOCKED, run: () => navigate(instHref(inst.id, 'edit')) },
      { label: 'Copy', icon: Copy, run: () => navigate(instHref(inst.id, 'copy')) },
      '-' as const,
    ]),
    { label: 'Book', icon: BookOpen, run: () => navigate(bookHref(inst.id)) },
    { label: 'Review Market Stats', icon: ChartLine, disabled: !instStatsEnabled(inst), reason: STATS_BLOCKED, run: () => navigate(instStatsHref(inst.id)) },
    ...(onDetail ? [] : [{ label: 'Open in New Tab', icon: ExternalLink, run: () => { window.open(instHref(inst.id), '_blank') } }]),
    '-',
    { label: 'Delete', icon: Trash2, danger: true, disabled: !instDeletable(inst), reason: DELETE_BLOCKED, run: () => deleteInstruments([inst.id], false, navigate) },
  ]
}

/**
 * Confirms and deletes instruments. `fromSelection` is true for the list's "Delete Selected" (it changes the wording).
 * On the Instruments list the list re-renders; anywhere else it goes back to /instruments.
 */
export async function deleteInstruments(ids: string[], fromSelection: boolean, navigate: NavigateFunction) {
  const many = ids.length > 1
  const ok = await ask({
    title: `Delete ${many ? `${ids.length} instruments` : ids[0]}?`,
    text: fromSelection ? `This permanently deletes the selected instrument${many ? 's' : ''}.` : 'This permanently deletes the instrument.',
    confirm: many ? 'Delete Instruments' : 'Delete Instrument',
    danger: true,
    glyph: 'trash',
  })
  if (!ok) return
  market().instruments = market().instruments.filter(i => !ids.includes(i.id))
  ids.forEach(id => instSelected.delete(id))
  saveMarket()
  if (!onInstrumentsList()) navigate('/instruments')
  toast(`${many ? 'Instruments' : 'Instrument'} deleted.`)
}

export async function haltAllInstruments() {
  const ok = await ask({ title: 'Halt all instruments?', text: 'This halts all active tradable instruments.', confirm: 'Halt All', danger: true, glyph: 'pause' })
  if (!ok) return
  const targets = market().instruments.filter(i => !i.nonTradable && !HALTABLE_EXCLUDED.includes(i.state))
  targets.forEach(i => { i.state = 'Halted'; i.isScheduled = false })
  saveMarket()
  toast(`Halted ${targets.length} instrument${targets.length === 1 ? '' : 's'}.`)
}

export async function resumeHaltedInstruments() {
  const ok = await ask({ title: 'Resume halted instruments?', text: 'This resumes all halted tradable instruments to their original schedule.', confirm: 'Resume to Schedule', glyph: 'play' })
  if (!ok) return
  const targets = market().instruments.filter(i => !i.nonTradable && i.state === 'Halted')
  targets.forEach(i => { i.isScheduled = true; i.state = stateFromSchedule(i) })
  saveMarket()
  toast(`Resumed ${targets.length} instrument${targets.length === 1 ? '' : 's'}.`)
}

/** Nudges the last price of every open instrument that has traded (a stand-in for a market data feed). */
export function refreshMarketData() {
  market().instruments.forEach(i => {
    const s = i.stats || {}
    if (!s.lastTradeSetTime || !s.lastPrice || i.state !== 'Open') return
    const move = 1 + (Math.random() - 0.5) * 0.004
    s.lastPrice = (Number(s.lastPrice) * move).toFixed(Math.max(decimalsOf(i.minimumPriceIncrement), decimalsOf(s.lastPrice)))
    s.high = String(Math.max(Number(s.high), Number(s.lastPrice)))
    s.low = String(Math.min(Number(s.low), Number(s.lastPrice)))
    s.lastTradeSetTime = isoDateTime(new Date())
  })
  saveMarket()
  toast('Market data refreshed.')
}

/* ---------- Change State dialog (instrument-state.js) ---------- */

type StateSheet = { rows: any[]; values: Record<string, any>; errors: Record<string, string>; paint: () => void }
let stateSheet: StateSheet | null = null

export function allowedStates(rows: any[]) {
  const allPending = rows.every(r => r.state === 'Pending')
  return INST_STATES.filter(s => s !== 'Pending' || allPending)
}

export const stateFields = (rows: any[]) => (v: any): Field[] => [
  { k: 'selState', label: 'State', kind: 'select', options: allowedStates(rows), blank: 'Choose a state', req: !v.isScheduled, disabled: !!v.isScheduled },
  { k: 'isScheduled', label: 'Follow Instrument Trading Hours', kind: 'toggle' },
  { k: 'scheduleExecutionTime', label: 'Schedule Execution Time', inputType: 'datetime-local', help: 'Leave empty to change the state now.' },
]

function ResolutionFields({ rows, values, errors, onChange }: { rows: any[]; values: any; errors: Record<string, string>; onChange: (k: string, v: any) => void }) {
  const hasSubTypes = (rows[0].subTypes || []).length > 0
  const row = (x: Field) => <FieldRow key={x.k} field={x} values={values} errors={errors} ctx="rec" onChange={onChange} />
  return (
    <>
      {hasSubTypes
        ? row({ k: 'symbolSubType', label: 'Winning Symbol Sub Type', kind: 'select', options: rows[0].subTypes.map((t: any) => t.symbol), blank: 'Choose a sub type' })
        : row({ k: 'side', label: 'Winning Side', kind: 'select', options: RESOLUTION_SIDES, blank: 'Choose a side' })}
      {row({ k: 'resolutionPrice', label: 'Resolution Price', tip: TIPS.resolutionPrice, disabled: !hasSubTypes && values.side !== 'Dual' })}
      {row({ k: 'outcomeResult', label: 'Resolution Outcome Result', tip: TIPS.outcomeResult })}
    </>
  )
}

/** The EOD button and, for Event instruments, the Resolution block under the Change State fields. */
function StateExtra({ rows, values }: { rows: any[]; values: any }) {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  if (stateSheet) stateSheet.paint = bump
  const errors = stateSheet?.errors || {}
  const isEvent = rows.every(r => r.type === IT.EVENT)
  const onChange = (k: string, v: any) => { setPath(values, k, v); bump() }
  return (
    <>
      <div className="sheet-extra card-acts">
        <Button variant="secondary" type="button" onClick={performEodActions}>Perform EOD Actions</Button>
      </div>
      {NETTING_ENABLED && isEvent && (
        <div className="sheet-extra">
          <h3 className="section-title">Resolution</h3>
          <Card><ResolutionFields rows={rows} values={values} errors={errors} onChange={onChange} /></Card>
          <div className="card-acts">
            <Button variant="tint" type="button" onClick={performResolution}>Perform Resolution</Button>
            <Button variant="secondary" type="button" onClick={undoResolution}>Undo Resolution</Button>
          </div>
        </div>
      )}
    </>
  )
}

function finishStateChange(message: string) {
  instSelected.clear()
  saveMarket()
  toast(message)
}

export function saveInstrumentState(rows: any[], v: any) {
  const future = v.scheduleExecutionTime && new Date(v.scheduleExecutionTime) > new Date()
  rows.forEach(r => {
    r.isScheduled = !!v.isScheduled
    if (future) r.scheduledChange = { state: v.isScheduled ? stateFromSchedule(r) : v.selState, at: v.scheduleExecutionTime }
    else {
      r.state = v.isScheduled ? stateFromSchedule(r) : v.selState
      delete r.scheduledChange
    }
  })
  finishStateChange(future ? 'State change scheduled.' : 'Instrument state saved.')
}

/** Opens the Change State dialog for one or more instrument ids. */
export function openStateSheet(ids: string[]) {
  const rows = ids.map(instrumentById).filter(Boolean)
  if (!rows.length) return
  const single = rows.length === 1 ? rows[0] : null
  const values: Record<string, any> = {
    selState: single ? single.state : '', isScheduled: single ? !!single.isScheduled : false, scheduleExecutionTime: '',
    symbolSubType: '', side: '', resolutionPrice: '', outcomeResult: '',
  }
  stateSheet = { rows, values, errors: {}, paint: () => {} }
  openFormSheet({
    title: single ? 'Change State' : `Change State for ${rows.length} Instruments`,
    submit: 'Save',
    note: `${single ? 'Instrument' : 'Instruments'}: ${rows.map(r => r.id).join(', ')}`,
    fields: stateFields(rows),
    values,
    extra: v => <StateExtra rows={rows} values={v} />,
    onSubmit: v => saveInstrumentState(rows, v),
  })
}

export async function performEodActions() {
  if (!stateSheet) return
  const { rows } = stateSheet
  const ok = await ask({ title: 'Perform EOD actions?', text: `This runs end of day actions for ${rows.length === 1 ? rows[0].id : `${rows.length} instruments`}.`, confirm: 'Confirm', glyph: 'play' })
  if (!ok) return
  closeFormSheet()
  finishStateChange('EOD actions submitted.')
}

export async function performResolution() {
  const sheet = stateSheet
  if (!sheet) return
  const { rows, values: v } = sheet
  const hasSubTypes = (rows[0].subTypes || []).length > 0
  sheet.errors = {}
  if (v.resolutionPrice && !Number.isFinite(Number(v.resolutionPrice))) sheet.errors.resolutionPrice = 'Please enter a valid Resolution Price.'
  else if (hasSubTypes && !v.symbolSubType) sheet.errors.symbolSubType = 'Please select Winning Symbol Sub Type.'
  else if (!hasSubTypes && !v.side) sheet.errors.side = 'Please select Winning Side.'
  sheet.paint()
  if (Object.keys(sheet.errors).length) {
    focusFirstError(sheet.errors, 'rec')
    return
  }
  const ok = await ask({ title: 'Perform resolution?', text: 'This performs resolution for all selected instruments.', confirm: 'Perform Resolution', glyph: 'check' })
  if (!ok) return
  rows.forEach(r => { r.resolution = { winner: v.symbolSubType || v.side, price: v.resolutionPrice, outcomeResult: v.outcomeResult } })
  closeFormSheet()
  finishStateChange('Perform resolution completed successfully.')
}

export async function undoResolution() {
  if (!stateSheet) return
  const { rows } = stateSheet
  const ok = await ask({ title: 'Undo resolution?', text: 'This undoes resolution for all selected instruments.', confirm: 'Undo Resolution', danger: true, glyph: 'restore' })
  if (!ok) return
  rows.forEach(r => { delete r.resolution })
  closeFormSheet()
  finishStateChange('Undo resolution completed successfully.')
}
