// The section-based form/read engine of the Markets module (the prototype's market-fields.js).
import { useEffect, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Crumb, EmptyState, PageHead, useTitle } from '@/components/app/page'
import { FieldRow, ReadRow, RowError } from '@/components/form/field-row'
import { FormDock } from '@/components/form/form-dock'
import { InfoTip } from '@/components/form/info-tip'
import { LIMIT_GROUPS, MARKET_TZ, isLocked, parseItem, resolveField } from '@/data/market-config'
import type { MarketSection } from '@/data/market-sections'
import { TIPS } from '@/data/tips'
import { isEmpty, visible } from '@/lib/format'
import { useSaveShortcut, useUnsavedGuard, type FormModel } from '@/lib/form'
import { hoursLabel, market } from '@/lib/market'
import {
  LEG_FIELDS, SUB_TYPE_FIELDS, calculateSwapDates, headingParts, holidayTitle, listAdd, listDel, listRowFields,
  marketBlurHandler, marketChangeHandler, openCategorySheet, openScheduleSheet, removeCategory, removeSchedule,
  sectionErrorKeys, toggleHoliday, type MarketModule,
} from '@/lib/market-fields'
import { getActiveMarketForm, setActiveMarketForm, withMarketForm } from '@/lib/market-form-state'

export * from '@/lib/market-fields'

type Change = (k: string, value: any, opts?: { multi?: boolean }) => void

/** Props every MARKET_BLOCKS form component receives. */
export type BlockFormProps = { form: FormModel; values: any; refresh: () => void; change: Change; blur: (k: string) => void }

// ---------- Read table ----------

/** [label, getter, tip?] */
export type ReadColumn = [string, (row: any) => any, string?]

function ReadCell({ value }: { value: any }) {
  if (isEmpty(value)) return <span className="row-value unset">—</span>
  return <>{String(value)}</>
}

/** A small read-only table (metadata, legs, sub types, components); `empty` text when there are no rows. */
export function ReadTable({ columns, rows, empty }: { columns: ReadColumn[]; rows: any[]; empty: string }) {
  if (!rows.length) return <EmptyState small text={empty} />
  return (
    <div className="table-scroll">
      <Table>
        <TableHeader>
          <TableRow>{columns.map(([label, , tip]) => <TableHead key={label}>{label}<InfoTip text={tip} /></TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>{columns.map(([label, get]) => <TableCell key={label}><ReadCell value={get(r)} /></TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------- Blocks ----------

function CalcForm({ form, values: v, refresh }: BlockFormProps) {
  return (
    <div className="form-subhead calc-row">
      {!isLocked(v) && <Button variant="tint" type="button" data-act="calc-dates" onClick={() => calculateSwapDates(form, refresh)}><CalendarDays size={17} />Calculate Dates</Button>}
      <p>Fills in the effective, maturity, fixing and payment dates from the inputs above.</p>
      <RowError message={form.errors.dateCalculator} />
    </div>
  )
}

function TradingHoursForm({ form, values: v, refresh }: BlockFormProps) {
  const rows: any[] = v.tradingSchedule || []
  const { calendars } = market()
  return (
    <div className="list-block">
      <div className="list-head">
        <h3 className="section-title">Trading Hours ({MARKET_TZ})</h3>
        <Button variant="tint" size="sm" type="button" data-act="schedule-add" onClick={() => openScheduleSheet(form, null, refresh)}><Plus size={16} />Add</Button>
      </div>
      {rows.length ? (
        <div className="hours-list">
          {rows.map((s, i) => (
            <div className="hours-row" key={i}>
              <span className="hours-text">{hoursLabel(s)}</span>
              <em>{s.state}</em>
              <span className="hours-acts">
                <Button variant="ghost" size="icon" type="button" aria-label="Edit hours" title="Edit" onClick={() => openScheduleSheet(form, i, refresh)}><Pencil size={17} /></Button>
                <Button variant="ghost" size="icon" type="button" className="icon-danger" aria-label="Remove hours" title="Remove" onClick={() => removeSchedule(form, i, refresh)}><Trash2 size={17} /></Button>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="list-empty">No trading hours yet.</p>}
      <h3 className="section-title list-subtitle">Holiday Calendars</h3>
      <div className="holiday-list">
        {Object.keys(calendars).map(name => {
          const c = calendars[name]
          const checked = c.global || (v.holidayCalendars || []).includes(name)
          return (
            <label className="check" key={name}>
              <Switch checked={checked} disabled={c.global} onCheckedChange={on => toggleHoliday(form, name, on, refresh)} />
              {holidayTitle(name)}
            </label>
          )
        })}
      </div>
    </div>
  )
}

function TradingHoursRead({ values: v }: { values: any }) {
  const { calendars } = market()
  const names = Object.keys(calendars).filter(n => calendars[n].global || (v.holidayCalendars || []).includes(n))
  return (
    <>
      <ReadRow field={{ k: '_hours', label: `Trading Hours (${MARKET_TZ})`, display: () => (v.tradingSchedule || []).map((s: any) => `${hoursLabel(s)} (${s.state})`).join('; ') }} values={v} />
      <ReadRow field={{ k: '_holidays', label: 'Holiday Calendars', display: () => names.map(holidayTitle).join('; ') }} values={v} />
    </>
  )
}

function LimitInput({ setKey, valueKey, label, form, values: v, change }: { setKey: string; valueKey: string; label: string } & BlockFormProps) {
  const on = !!v[setKey]
  const err = form.errors[valueKey]
  return (
    <div className="limit-row">
      <label className="check"><Switch id={`firm-${setKey}`} checked={on} onCheckedChange={c => change(setKey, c)} />Set</label>
      <span className="part">
        <span className="part-label">{label}</span>
        <Input
          id={`firm-${valueKey}`}
          value={v[valueKey] ?? ''}
          autoComplete="off"
          disabled={!on}
          aria-invalid={err ? true : undefined}
          aria-label={label}
          onChange={e => change(valueKey, e.target.value)}
        />
      </span>
      <RowError className="limit-err" message={err} />
    </div>
  )
}

function LimitsForm(props: BlockFormProps) {
  if (props.values.nonTradable) return null
  return (
    <div className="limit-grid">
      {LIMIT_GROUPS.map(g => (
        <div className="limit-card" key={g.title}>
          <h3 className="section-title">{g.title}<InfoTip text={g.tip} /></h3>
          <LimitInput {...props} setKey={g.low[0]} valueKey={g.low[1]} label={`Low Limit${g.unit}`} />
          <LimitInput {...props} setKey={g.high[0]} valueKey={g.high[1]} label={`High Limit${g.unit}`} />
        </div>
      ))}
    </div>
  )
}

function LimitsRead({ values: v }: { values: any }) {
  return (
    <>
      {LIMIT_GROUPS.map(g => (
        <ReadRow
          key={g.title}
          field={{
            k: g.low[1], label: g.title, tip: g.tip, display: () => {
              const low = v[g.low[0]] ? `Low ${v[g.low[1]]}${g.unit}` : ''
              const high = v[g.high[0]] ? `High ${v[g.high[1]]}${g.unit}` : ''
              return [low, high].filter(Boolean).join(' · ')
            },
          }}
          values={v}
        />
      ))}
    </>
  )
}

function MetadataForm({ form, values: v, refresh, change, blur }: BlockFormProps) {
  return (
    <div className="list-block">
      {(v.metadata || []).map((_: any, i: number) => (
        <div className="meta-row" key={i}>
          <FieldRow field={{ k: `metadata.${i}.key`, label: 'Key' }} values={v} errors={form.errors} onChange={change} onBlur={blur} />
          <FieldRow field={{ k: `metadata.${i}.value`, label: 'Value' }} values={v} errors={form.errors} onChange={change} onBlur={blur} />
          <Button variant="ghost" size="icon" type="button" className="icon-danger" aria-label="Delete metadata" title="Delete" onClick={() => listDel(form, 'metadata', i, refresh)}><Trash2 size={17} /></Button>
        </div>
      ))}
      <Button variant="tint" size="sm" type="button" data-act="list-add" data-list="metadata" onClick={() => listAdd(form, 'metadata', refresh)}><Plus size={16} />Add</Button>
    </div>
  )
}

function MetadataRead({ values: v }: { values: any }) {
  return <ReadTable columns={[['Key', r => r.key], ['Value', r => r.value]]} rows={v.metadata || []} empty="No metadata." />
}

function SubTypesForm({ form, values: v, refresh, change, blur }: BlockFormProps) {
  const creating = form.mode === 'create'
  const rows: any[] = v.subTypes || []
  return (
    <div className="list-block">
      <div className="list-head">
        <h3 className="section-title">Sub Types</h3>
        {creating && <Button variant="tint" size="sm" type="button" data-act="list-add" data-list="subTypes" onClick={() => listAdd(form, 'subTypes', refresh)}><Plus size={16} />Add Sub Type</Button>}
      </div>
      {rows.length ? rows.map((_, i) => (
        <div className="list-row" key={i}>
          <div className="form-grid">
            {listRowFields('subTypes', i, SUB_TYPE_FIELDS).map(d => (
              <FieldRow key={d.k} field={{ ...d, disabled: !creating && !d.always }} values={v} errors={form.errors} onChange={change} onBlur={blur} />
            ))}
          </div>
          {creating && <Button variant="ghost" size="sm" type="button" onClick={() => listDel(form, 'subTypes', i, refresh)}><Trash2 size={16} />Remove Sub Type</Button>}
        </div>
      )) : <p className="list-empty">No sub types.</p>}
    </div>
  )
}

function SubTypesRead({ values: v }: { values: any }) {
  return (
    <>
      <div className="read-subhead">Sub Types</div>
      <ReadTable columns={SUB_TYPE_FIELDS.map(d => [d.label as string, (r: any) => (d.kind === 'toggle' ? (r[d.key] ? 'Yes' : 'No') : r[d.key])] as ReadColumn)} rows={v.subTypes || []} empty="No sub types." />
    </>
  )
}

function ComponentsRead({ values: v }: { values: any }) {
  if (!(v.componentInstruments || []).length) return null
  return (
    <>
      <div className="read-subhead">Component Instruments<InfoTip text={TIPS.componentInstruments} /></div>
      <ReadTable columns={[['Symbol', r => r.symbol], ['Opposing Side', r => r.opposingSide, TIPS.opposingSide]]} rows={v.componentInstruments} empty="" />
    </>
  )
}

function LegsForm({ form, values: v, change, blur }: BlockFormProps) {
  return (
    <div className="list-block">
      {(v.legs || []).map((_: any, i: number) => (
        <div className="form-grid leg-row" key={i}>
          {listRowFields('legs', i, LEG_FIELDS).map(d => (
            <FieldRow key={d.k} field={{ ...d, label: d.key === 'symbol' ? `Leg ${i}` : d.label, disabled: isLocked(v) }} values={v} errors={form.errors} onChange={change} onBlur={blur} />
          ))}
        </div>
      ))}
    </div>
  )
}

function LegsRead({ values: v }: { values: any }) {
  return <ReadTable columns={[['Leg', r => r.symbol], ['Ratio', r => r.ratio], ['Side', r => r.opposingSide]]} rows={v.legs || []} empty="No legs." />
}

function CategoriesForm({ form, values: v, refresh }: BlockFormProps) {
  return (
    <div className="row row-wide">
      <span className="row-label">Category Levels<InfoTip text={TIPS.categoryLevels} /></span>
      <div className="chip-list">
        {(v.categoryLevels || []).map((c: string, i: number) => (
          <span className="tag" key={`${i}-${c}`}>
            {c}
            <button type="button" aria-label={`Remove ${c}`} onClick={() => removeCategory(form, i, refresh)}><X size={12} /></button>
          </span>
        ))}
        <Button variant="tint" size="sm" type="button" data-act="category-add" onClick={() => openCategorySheet(form, refresh)}><Plus size={16} />Add</Button>
      </div>
    </div>
  )
}

function CategoriesRead({ values: v }: { values: any }) {
  return <ReadRow field={{ k: '_categories', label: 'Category Levels', tip: TIPS.categoryLevels, display: () => (v.categoryLevels || []).join(' > ') }} values={v} />
}

/** The '@name' section items: a form and a read variant each. */
export const MARKET_BLOCKS: Record<string, { Form: (p: BlockFormProps) => ReactNode; Read: (p: { values: any }) => ReactNode }> = {
  calc: { Form: CalcForm, Read: () => null },
  tradingHours: { Form: TradingHoursForm, Read: TradingHoursRead },
  limits: { Form: LimitsForm, Read: LimitsRead },
  metadata: { Form: MetadataForm, Read: MetadataRead },
  subTypes: { Form: SubTypesForm, Read: SubTypesRead },
  components: { Form: ({ values }) => <ComponentsRead values={values} />, Read: ComponentsRead },
  legs: { Form: LegsForm, Read: LegsRead },
  categories: { Form: CategoriesForm, Read: CategoriesRead },
}

// ---------- Section form ----------

function formItem(raw: string, i: number, section: MarketSection, seen: Set<string>, p: BlockFormProps): ReactNode {
  const { form, values: v } = p
  const key = `${i}-${raw}`
  if (raw[0] === '#') {
    const { title, tip } = headingParts(raw)
    return <div className="form-subhead" key={key}><h3 className="section-title">{title}<InfoTip text={tip} /></h3></div>
  }
  if (raw[0] === '@') {
    const Block = MARKET_BLOCKS[raw.slice(1)].Form
    return <Block key={key} {...p} />
  }
  const x = resolveField(parseItem(raw, section.lock), v)
  if (!visible(x, v)) return null
  if (x.ro || seen.has(x.k) || (form.mode === 'edit' && x.createOnly)) return <ReadRow key={key} field={x} values={v} />
  seen.add(x.k)
  if (x.kind === 'multi') return <FieldRow key={key} field={x} values={v} errors={form.errors} onChange={(k, value) => p.change(k, value, { multi: true })} />
  return <FieldRow key={key} field={x} values={v} errors={form.errors} onChange={p.change} onBlur={p.blur} />
}

function sectionForm(section: MarketSection, seen: Set<string>, p: BlockFormProps) {
  const { form, refresh } = p
  const body = <div className="form-grid form-list">{section.items.map((raw, i) => formItem(raw, i, section, seen, p))}</div>
  if (section.always) return <Card className="form-card" key={section.id}>{body}</Card>
  const missing = sectionErrorKeys(section, form).length > 0
  return (
    <Collapsible
      key={section.id}
      className="card form-collapse"
      data-sec={section.id}
      open={form.open.has(section.id)}
      onOpenChange={open => { if (open) form.open.add(section.id); else form.open.delete(section.id); refresh() }}
    >
      <CollapsibleTrigger className="form-collapse-trigger">
        <span className="section-title">{section.title}</span>
        <span className="form-collapse-meta">{missing && <span className="sec-err">Required field(s) missing</span>}<ChevronUp size={17} className="chevron" /></span>
      </CollapsibleTrigger>
      <CollapsibleContent className="form-collapse-body">{body}</CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Renders the sections of a market form: `always` sections as a card, the rest as
 * collapsibles that follow `form.open`. Every change sets the draft, re-validates a
 * field that shows an error, calls `onFieldChange(k)` (or form.module.onChange) and re-renders.
 */
export function SectionsForm({ form, sections, refresh, onFieldChange }: { form: FormModel; sections: MarketSection[]; refresh: () => void; onFieldChange?: (k: string) => void }) {
  const mod: MarketModule = form.module || (form.module = {})
  if (!mod.sections && !mod.validate) mod.sections = () => sections
  if (onFieldChange) mod.onChange = onFieldChange
  const p: BlockFormProps = { form, values: form.draft, refresh, change: marketChangeHandler(form, refresh), blur: marketBlurHandler(form, refresh) }
  return withMarketForm(form, () => {
    const seen = new Set<string>()
    return <>{sections.map(s => sectionForm(s, seen, p))}</>
  })
}

// ---------- Section read ----------

function readItem(raw: string, i: number, section: MarketSection, v: any, seen: Set<string>): ReactNode {
  const key = `${i}-${raw}`
  if (raw[0] === '#') {
    const { title, tip } = headingParts(raw)
    return <div className="read-subhead" key={key}>{title}<InfoTip text={tip} /></div>
  }
  if (raw[0] === '@') {
    const Block = MARKET_BLOCKS[raw.slice(1)].Read
    return <Block key={key} values={v} />
  }
  const x = parseItem(raw, section.lock)
  if (seen.has(x.k) || !visible(x, v)) return null
  seen.add(x.k)
  return <ReadRow key={key} field={x} values={v} />
}

/** Read-only sections (`<section id="sec-…">`) for detail pages; pair with SectionRail inside `.detail-scroll`. */
export function SectionsRead({ sections, values }: { sections: MarketSection[]; values: any }) {
  return withMarketForm(null, () => {
    const seen = new Set<string>()
    return (
      <>
        {sections.map(s => (
          <section className="section" id={`sec-${s.id}`} key={s.id}>
            <div className="section-head"><h2 className="section-title">{s.title}</h2></div>
            <Card>{s.items.map((raw, i) => readItem(raw, i, s, values, seen))}</Card>
          </section>
        ))}
      </>
    )
  })
}

// ---------- Page shell ----------

export type MarketFormPageProps = {
  form: FormModel
  refresh: () => void
  /** Section layout for the draft; omit and pass `children` for a custom body. */
  sections?: (draft: any) => MarketSection[]
  /** Full-form validator (also used to re-validate an erroring field while it is edited). */
  validate?: (draft: any, form: FormModel) => Record<string, string>
  /** Save button / form submit / Ctrl+S. Not called while form.saving. */
  onSubmit: () => void
  /** Called after each field change with its key (the prototype's module onChange). */
  onChange?: (k: string) => void
  title: string
  crumb: { href: string; label: string }
  backHref: string
  saveLabel: string
  /** Extra dock buttons, between Save and Cancel. */
  extra?: ReactNode
  /** Renders <datalist id="instIds"> of all instrument IDs. */
  instIdList?: boolean
  /** Renders <datalist id="eventIds"> with these IDs (see eventIdsFor). */
  eventIds?: string[]
  children?: ReactNode
}

/** The prototype's startMarketForm shell: crumb, title, section form body, dock and datalists. */
export function MarketFormPage({ form, refresh, sections, validate, onSubmit, onChange, title, crumb, backHref, saveLabel, extra, instIdList, eventIds, children }: MarketFormPageProps) {
  const mod: MarketModule = { sections, validate, onChange }
  form.module = mod
  setActiveMarketForm(form)
  useEffect(() => {
    setActiveMarketForm(form)
    return () => { if (getActiveMarketForm() === form) setActiveMarketForm(null) }
  }, [form])
  useTitle(title)
  useUnsavedGuard(form)
  const submit = () => { if (!form.saving) onSubmit() }
  useSaveShortcut(submit)
  const onFormSubmit = (e: FormEvent) => { e.preventDefault(); submit() }

  return (
    <div className="page form-page">
      <Crumb to={crumb.href}>{crumb.label}</Crumb>
      <PageHead title={title} />
      <form id="firmForm" noValidate onSubmit={onFormSubmit}>
        <div className="form-stack" id="formBody">
          {sections ? <SectionsForm form={form} sections={sections(form.draft)} refresh={refresh} /> : children}
        </div>
        <FormDock form={form} saveLabel={saveLabel} backHref={backHref} extra={extra} />
      </form>
      {instIdList && <datalist id="instIds">{market().instruments.map(i => <option key={i.id} value={i.id} />)}</datalist>}
      {eventIds && <datalist id="eventIds">{eventIds.map(id => <option key={id} value={id} />)}</datalist>}
    </div>
  )
}
