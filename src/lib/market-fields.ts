// Non-visual half of the prototype's market-fields.js / market-events.js: the section
// engine's validation, change handling, list editing, the schedule and category sheets
// and the swap date calculator. The React half lives in components/market/market-form.tsx
// (which re-exports everything here).
import { openFormSheet } from '@/components/form/form-sheet'
import { FIELD_DEFS, LIMIT_GROUPS, OPPOSING, PERIODICITY, SCHEDULE_STATES, parseItem, resolveField } from '@/data/market-config'
import type { MarketSection } from '@/data/market-sections'
import { TIPS } from '@/data/tips'
import type { Field } from '@/data/config'
import { createForm, focusFirstError, requiredMessage, type FormModel } from '@/lib/form'
import { getPath, isoDate, setPath, timeLabel, visible } from '@/lib/format'
import { market } from '@/lib/market'
import { withMarketForm } from '@/lib/market-form-state'
import { toast } from '@/lib/toast'

/**
 * What a market form page registers on `form.module` (the prototype's form.module).
 * MarketFormPage sets it from its props on every render.
 */
export type MarketModule = {
  sections?: (draft: any) => MarketSection[]
  /** Full-form validator; used to re-validate a field that shows an error while it is edited. */
  validate?: (draft: any, form: FormModel) => Record<string, string>
  /** Called after a field change (the prototype's form.module.onChange(k)). */
  onChange?: (k: string) => void
}

export type Errors = Record<string, string>

export const LIMIT_TOGGLES = new Set(LIMIT_GROUPS.flatMap(g => [g.low[0], g.high[0]]))
export const BLOCK_ERROR_PREFIX: Record<string, string> = { metadata: 'metadata.', subTypes: 'subTypes.', legs: 'legs.', calc: 'dateCalculator' }

export const specialItem = (raw: string) => raw[0] === '#' || raw[0] === '@'

/** Keys whose change repainted the prototype's form. React re-renders on every change; kept for parity. */
export const refreshOnChange = (k: string) => !!(FIELD_DEFS[k] || {}).refresh || LIMIT_TOGGLES.has(k)

/** '#Title|tipKey' → { title, tip } (tip text from TIPS). */
export function headingParts(raw: string) {
  const [title, tipKey] = raw.slice(1).split('|')
  return { title, tip: tipKey ? TIPS[tipKey] : undefined }
}

export const listRowFields = (listKey: string, index: number, defs: Field[]): Field[] => defs.map(d => ({ ...d, k: `${listKey}.${index}.${d.key}` }))

export const SUB_TYPE_FIELDS: Field[] = [
  { k: 'symbol', key: 'symbol', label: 'Sub Type Name', req: true },
  { k: 'buyPriceIncrement', key: 'buyPriceIncrement', label: 'Buy Price Increment' },
  { k: 'sellPriceIncrement', key: 'sellPriceIncrement', label: 'Sell Price Increment' },
  { k: 'buyScale', key: 'buyScale', label: 'Buy Scale' },
  { k: 'sellScale', key: 'sellScale', label: 'Sell Scale' },
  { k: 'opposingSide', key: 'opposingSide', label: 'Opposing Side', kind: 'select', options: OPPOSING, blank: 'Choose a side', req: true },
  { k: 'buyQuantityRatio', key: 'buyQuantityRatio', label: 'Buy Quantity Ratio' },
  { k: 'sellQuantityRatio', key: 'sellQuantityRatio', label: 'Sell Quantity Ratio' },
  { k: 'strictLimit', key: 'strictLimit', label: 'Strict Limit', kind: 'toggle', always: true },
]
export const LEG_FIELDS: Field[] = [
  { k: 'symbol', key: 'symbol', label: 'Leg', list: 'instIds', ph: 'Instrument ID', mono: true },
  { k: 'ratio', key: 'ratio', label: 'Ratio', inputType: 'number', min: 1 },
  { k: 'opposingSide', key: 'opposingSide', label: 'Side', kind: 'select', options: OPPOSING },
]
export const LIST_BLANKS: Record<string, () => any> = {
  subTypes: () => ({ symbol: '', buyPriceIncrement: '', sellPriceIncrement: '', buyScale: '', sellScale: '', opposingSide: '', buyQuantityRatio: '', sellQuantityRatio: '', strictLimit: false }),
  metadata: () => ({ key: '', value: '' }),
}

/** "London - UK bank holidays", "US Federal (Global) - US federal holidays". */
export const holidayTitle = (name: string) => {
  const c = market().calendars[name]
  if (!c) return name
  return `${name}${c.global ? ' (Global)' : ''} - ${c.description}`
}

export const TIME_OPTIONS = Array.from({ length: 97 }, (_, i) => ({ value: String(i * 900), label: i === 96 ? '12:00 am (next day)' : timeLabel(i * 900) }))
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** A market form model; sections that are `open` start expanded (startMarketForm). */
export function createMarketForm(mode: 'create' | 'edit', draft: any, sections?: (draft: any) => MarketSection[], extra: Partial<FormModel> = {}) {
  return createForm(mode, draft, {
    idTouched: true,
    open: new Set(sections ? sections(draft).filter(s => s.open).map(s => s.id) : []),
    ...extra,
  })
}

/** Error keys that belong to a section (used for "Required field(s) missing" and revealing errors). */
export function sectionErrorKeys(section: MarketSection, form: FormModel) {
  return section.items.flatMap(raw => {
    if (raw[0] === '#') return []
    if (raw[0] === '@') {
      if (raw === '@limits') return LIMIT_GROUPS.flatMap(g => [g.low[1], g.high[1]])
      const prefix = BLOCK_ERROR_PREFIX[raw.slice(1)]
      return prefix ? Object.keys(form.errors).filter(k => k.startsWith(prefix)) : []
    }
    return [parseItem(raw, section.lock).k]
  }).filter(k => form.errors[k])
}

/** Required / number / range checks for every editable field of the sections. */
export function validateSections(sections: MarketSection[], v: any, form: FormModel | null): Errors {
  return withMarketForm(form, () => {
    const errors: Errors = {}
    const seen = new Set<string>()
    sections.forEach(s => s.items.forEach(raw => {
      if (specialItem(raw)) return
      const x = resolveField(parseItem(raw, s.lock), v)
      if (x.ro || x.disabled || x.kind === 'parts' || seen.has(x.k) || !visible(x, v) || (!!form && form.mode === 'edit' && x.createOnly)) return
      seen.add(x.k)
      const value = getPath(v, x.k)
      const empty = value === undefined || value === null || String(value).trim() === '' || (Array.isArray(value) && !value.length)
      if (empty) {
        if (x.req) errors[x.k] = requiredMessage(x)
        return
      }
      const n = Number(value)
      if (x.num && !Number.isFinite(n)) errors[x.k] = `${x.label} must be a number.`
      else if (x.gt !== undefined && !(n > x.gt)) errors[x.k] = `${x.label} must be greater than ${x.gt}.`
      else if (x.gte !== undefined && !(n >= x.gte)) errors[x.k] = `${x.label} must be ${x.gte} or more.`
      else if (x.max !== undefined && n > x.max) errors[x.k] = `${x.label} can’t exceed ${x.max}.`
    }))
    return errors
  })
}

/** Opens every section that has an error, re-renders, then focuses the first invalid field. */
export function revealFormErrors(form: FormModel, sections: MarketSection[], refresh: () => void) {
  sections.forEach(s => { if (sectionErrorKeys(s, form).length) form.open.add(s.id) })
  refresh()
  focusFirstError(form.errors, 'firm')
}

/** The registered full-form validator, or the plain section checks. */
export function runMarketValidate(form: FormModel): Errors {
  const mod: MarketModule | undefined = form.module
  if (mod?.validate) return mod.validate(form.draft, form)
  if (mod?.sections) return validateSections(mod.sections(form.draft), form.draft, form)
  return {}
}

/**
 * The prototype's input/change handling for module forms: sets the value, re-validates
 * the field when it already shows an error (not for switches/checkboxes), then calls
 * form.module.onChange(k). Multi-select chips (`multi`) only set the value.
 * Does not re-render; call refresh() afterwards.
 */
export function applyMarketChange(form: FormModel, k: string, value: any, opts: { multi?: boolean } = {}) {
  setPath(form.draft, k, value)
  if (opts.multi) return
  if (typeof value !== 'boolean' && form.errors[k]) {
    const next = runMarketValidate(form)
    if (next[k]) form.errors[k] = next[k]
    else delete form.errors[k]
  }
  ;(form.module as MarketModule | undefined)?.onChange?.(k)
}

/** On-blur check for the ID (and email) field, like the prototype's focusout handler. */
export function applyMarketBlur(form: FormModel, k: string) {
  if (k !== 'email' && k !== 'id') return false
  const next = runMarketValidate(form)
  if (next[k] && form.draft[k]) form.errors[k] = next[k]
  else delete form.errors[k]
  return true
}

/** (k, value, opts?) handler for FieldRow.onChange in market forms. */
export const marketChangeHandler = (form: FormModel, refresh: () => void) => (k: string, value: any, opts?: { multi?: boolean }) => {
  applyMarketChange(form, k, value, opts)
  refresh()
}

/** (k) handler for FieldRow.onBlur in market forms. */
export const marketBlurHandler = (form: FormModel, refresh: () => void) => (k: string) => {
  if (applyMarketBlur(form, k)) refresh()
}

/** list-add: appends a blank metadata / sub type row. */
export function listAdd(form: FormModel, key: string, refresh: () => void) {
  ;(form.draft[key] || (form.draft[key] = [])).push(LIST_BLANKS[key]())
  refresh()
}

/** list-del: removes a row and clears every `${key}.` error. */
export function listDel(form: FormModel, key: string, index: number, refresh: () => void) {
  form.draft[key].splice(index, 1)
  form.errors = Object.fromEntries(Object.entries(form.errors).filter(([k]) => !k.startsWith(`${key}.`)))
  refresh()
}

/** schedule-del */
export function removeSchedule(form: FormModel, index: number, refresh: () => void) {
  form.draft.tradingSchedule.splice(index, 1)
  refresh()
}

/** category-del */
export function removeCategory(form: FormModel, index: number, refresh: () => void) {
  form.draft.categoryLevels.splice(index, 1)
  refresh()
}

/** data-holiday: turns a (non-global) holiday calendar on or off. */
export function toggleHoliday(form: FormModel, name: string, on: boolean, refresh: () => void) {
  const current: string[] = form.draft.holidayCalendars || []
  form.draft.holidayCalendars = on ? [...current, name] : current.filter(x => x !== name)
  refresh()
}

/** Adds (index null) or edits a trading-hours row in a sheet. */
export function openScheduleSheet(form: FormModel, index: number | null, refresh: () => void) {
  const rows: any[] = form.draft.tradingSchedule || (form.draft.tradingSchedule = [])
  const current = index === null ? { days: [], from: 28800, to: 61200, state: 'Open', periodicity: PERIODICITY.everyday } : rows[index]
  const values = {
    state: current.state, from: String(current.from), to: String(current.to), periodicity: current.periodicity, repeatNum: '1', repeatUnit: 'Weeks',
    ...Object.fromEntries(DAY_LETTERS.map((_, i) => [`day${i}`, current.days.includes(i)])),
  }
  openFormSheet({
    title: 'Instrument Trading Hours',
    submit: 'Done',
    values,
    fields: [
      { k: 'state', label: 'State', kind: 'select', options: SCHEDULE_STATES },
      { k: 'from', label: 'From', kind: 'select', options: TIME_OPTIONS },
      { k: 'to', label: 'To', kind: 'select', options: TIME_OPTIONS },
      { k: 'periodicity', label: 'Repeat', kind: 'select', options: Object.values(PERIODICITY) },
      { k: '_repeat', label: 'Repeat Every', kind: 'parts', when: (v: any) => v.periodicity === PERIODICITY.custom, parts: [{ k: 'repeatNum', label: 'Count' }, { k: 'repeatUnit', label: 'Unit', options: ['Weeks', 'Months'] }] },
      { k: '_days', label: 'Repeat On', kind: 'parts', when: (v: any) => v.periodicity === PERIODICITY.custom, parts: DAY_LETTERS.map((label, i) => ({ k: `day${i}`, label, type: 'check' })) },
    ],
    validate: (v): Errors => {
      if (v.periodicity === PERIODICITY.custom && !DAY_LETTERS.some((_, i) => v[`day${i}`])) return { _days: 'Choose at least one day.' }
      return {}
    },
    onSubmit: v => {
      const days = v.periodicity === PERIODICITY.everyday ? [0, 1, 2, 3, 4, 5, 6]
        : v.periodicity === PERIODICITY.weekdays ? [1, 2, 3, 4, 5]
          : DAY_LETTERS.map((_, i) => i).filter(i => v[`day${i}`])
      const saved = { days, from: Number(v.from), to: Number(v.to), state: v.state, periodicity: v.periodicity }
      if (index === null) rows.push(saved)
      else rows[index] = saved
      refresh()
    },
  })
}

/** Adds the next category level (product form). Ported from products.js. */
export function openCategorySheet(form: FormModel, refresh: () => void) {
  const levels: string[] = form.draft.categoryLevels || (form.draft.categoryLevels = [])
  const known = [...new Set(market().products.map(p => (p.categoryLevels || [])[levels.length]).filter(Boolean))]
  openFormSheet({
    title: 'Add Category',
    submit: 'Submit',
    values: { category: '' },
    fields: [{ k: 'category', label: 'Add Category', req: true, ph: 'Enter Category', help: known.length ? `Existing at this level: ${known.join(', ')}` : '' }],
    onSubmit: v => {
      const name = v.category.trim()
      if (name && !levels.includes(name)) levels.push(name)
      refresh()
    },
  })
}

export function addBusinessDays(date: Date, count: number) {
  const d = new Date(date)
  const step = count < 0 ? -1 : 1
  let left = Math.abs(count)
  while (left > 0) {
    d.setDate(d.getDate() + step)
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1
  }
  return d
}

/** Adds a tenor like '5Y', '6M', '90D' (or a bare number in `period` units); null if unparseable. */
export function addTenor(date: Date, tenor: any, period?: string) {
  const d = new Date(date)
  const text = String(tenor || '').trim().toUpperCase()
  const match = text.match(/^(\d+)\s*([YMD])?$/)
  if (!match) return null
  const unit = match[2] || (period || 'Years')[0].toUpperCase()
  const n = Number(match[1])
  if (unit === 'Y') d.setFullYear(d.getFullYear() + n)
  else if (unit === 'M') d.setMonth(d.getMonth() + n)
  else d.setDate(d.getDate() + n)
  return d
}

export const FREQUENCY_MONTHS: Record<string, number> = { Monthly: 1, Quarterly: 3, Semiannually: 6, Annually: 12 }

/** "Calculate Dates": fills effective, maturity, fixing and payment dates from the swap inputs. */
export function calculateSwapDates(form: FormModel, refresh: () => void) {
  const v = form.draft
  delete form.errors.dateCalculator
  const start = v.startDate || v.swapEffectiveDate
  if (!start) {
    form.errors.dateCalculator = 'Trade Date missing.'
    refresh()
    return
  }
  const trade = new Date(`${start}T12:00`)
  const effective = addBusinessDays(trade, Number(v.effectiveDateOffset) || 0)
  const maturity = addTenor(effective, v.tenor, v.tenorTimePeriod)
  if (!maturity) {
    form.errors.dateCalculator = 'Enter a tenor like 5Y, 6M or 90D.'
    refresh()
    return
  }
  const after = (months: number) => { const d = new Date(effective); d.setMonth(d.getMonth() + (months || 3)); return isoDate(d) }
  const fixing = isoDate(addBusinessDays(effective, Number(v.floatFixingDatesOffset) || -2))
  const dates: Record<string, string> = {
    swapEffectiveDate: isoDate(effective), unadjustedEffectiveDate: isoDate(effective), maturityDate: isoDate(maturity), unadjustedMaturityDate: isoDate(maturity),
    fixedFirstUnadjustedPaymentDate: after(FREQUENCY_MONTHS[v.fixedPaymentFrequency]), floatFirstUnadjustedPaymentDate: after(FREQUENCY_MONTHS[v.floatPaymentFrequency]),
    firstFloatResetDate: isoDate(effective), firstFloatFixingDate: fixing, floatFixingDate: fixing,
    leg1FirstFloatResetDate: isoDate(effective), leg2FirstFloatResetDate: isoDate(effective), leg1FirstFloatFixingDate: fixing, leg2FirstFloatFixingDate: fixing,
    leg1FloatFirstUnadjustedPaymentDate: after(FREQUENCY_MONTHS[v.leg1FloatPaymentFrequency]), leg2FloatFirstUnadjustedPaymentDate: after(FREQUENCY_MONTHS[v.leg2FloatPaymentFrequency]),
    floatFirstUnadjustedEffectiveDate: isoDate(effective),
  }
  Object.assign(v, dates)
  Object.keys(dates).forEach(k => delete form.errors[k])
  refresh()
  toast('Dates calculated.')
}
