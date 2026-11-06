// /instrument: detail view, ?mode=edit, ?mode=new[&productId=] and ?mode=copy. Ported from instrument-pages.js.
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { CalendarCheck, Copy, Pencil, TriangleAlert } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ActionMenu } from '@/components/app/action-menu'
import { Banner, Crumb, LargeTitle, useTitle } from '@/components/app/page'
import { SectionRail } from '@/components/app/section-rail'
import { MarketFormPage, SectionsRead, createMarketForm, revealFormErrors, validateSections } from '@/components/market/market-form'
import { MarketNotFound } from '@/components/market/module-head'
import { previousPage } from '@/lib/nav-history'
import { IT, LIMIT_GROUPS, OPPOSING, isContinuous, isLocked } from '@/data/market-config'
import { instrumentSections } from '@/data/market-sections'
import { blankMarketValues } from '@/data/market-seed'
import { ask } from '@/lib/dialogs'
import { clone, wait } from '@/lib/format'
import { isDirty, useForm, type FormModel } from '@/lib/form'
import { instrumentMenuItems, openStateSheet } from '@/lib/instrument-actions'
import {
  eventIdsFor, instEditable, instHref, instrumentById, instrumentFromProduct, market, productById, productHref,
  saveMarket, showDateTime, stateFromSchedule, validScale,
} from '@/lib/market'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'

type Errors = Record<string, string>

/** A new instrument draft: inherits from the product when one is given. */
export function blankInstrument(productId?: string | null) {
  const product = productId && productById(productId)
  if (product) return instrumentFromProduct(product)
  return { ...blankMarketValues(), id: '', productId: '', description: '', type: '', routingkey: '', state: 'Pending', isScheduled: false, nonTradable: false, hideMarketData: false, securityId: '', securityIdSource: '', metadata: [], legs: [], noLegs: '0', stats: {} }
}

// ---------- Validation ----------

export function validateLimits(v: any): Errors {
  const e: Errors = {}
  if (v.nonTradable) return e
  LIMIT_GROUPS.forEach(g => {
    const [lowSet, low] = g.low
    const [highSet, high] = g.high
    const finite = (k: string) => v[k] !== '' && v[k] !== undefined && Number.isFinite(Number(v[k]))
    if (v[lowSet] && !finite(low)) e[low] = 'Low limit is required.'
    if (v[highSet] && !finite(high)) e[high] = 'High limit is required.'
    if (v[lowSet] && v[highSet] && finite(low) && finite(high) && Number(v[low]) >= Number(v[high])) e[low] = 'Low limit must be less than High Limit.'
    if (g.low[1] === 'lowPriceLimit' && v[highSet] && finite(high) && Number(v[high]) <= 0) e[high] = 'High limit must be greater than 0.'
  })
  return e
}

export function validateMetadata(v: any): Errors {
  const e: Errors = {}
  const rows: any[] = v.metadata || []
  rows.forEach((row, i) => {
    if (!String(row.key || '').trim()) e[`metadata.${i}.key`] = 'Key can’t be left empty.'
    if (!String(row.value || '').trim()) e[`metadata.${i}.value`] = 'Value can’t be left empty.'
    if (rows.findIndex(other => other.key === row.key) !== i) e[`metadata.${i}.key`] = `Duplicate key ${row.key}.`
  })
  return e
}

export function validateSubTypes(v: any, form: FormModel | null): Errors {
  const e: Errors = {}
  if (!form || form.mode !== 'create') return e
  ;(v.subTypes || []).forEach((row: any, i: number) => {
    if (!String(row.symbol || '').trim()) e[`subTypes.${i}.symbol`] = 'Sub Type Name is required.'
    if (!row.opposingSide) e[`subTypes.${i}.opposingSide`] = 'Opposing Side is required.'
    ;['buyPriceIncrement', 'sellPriceIncrement', 'buyScale', 'sellScale', 'buyQuantityRatio', 'sellQuantityRatio'].forEach(key => {
      if (row[key] !== '' && row[key] !== undefined && row[key] !== null && !Number.isFinite(Number(row[key]))) e[`subTypes.${i}.${key}`] = 'Must be a number.'
    })
  })
  return e
}

export function validateEventTime(v: any): Errors {
  const e: Errors = {}
  if (v.evtAttTimeSpecifierDay && !v.evtAttTimeSpecifierMonth) e.evtAttTimeSpecifier = 'Month value must be set when Day is set.'
  else if (v.evtAttTimeSpecifierMonth && !v.evtAttTimeSpecifierYear) e.evtAttTimeSpecifier = 'Year value must be set when Month is set.'
  const hasTime = ['Hour', 'Minute', 'Second'].some(p => v[`evtAttTimeOfDay${p}`] !== undefined && v[`evtAttTimeOfDay${p}`] !== '')
  if (hasTime && !v.evtAttTimeSpecifierDay) e.evtAttTimeOfDay = 'Provide a Time Specifier day when providing a Time of Day.'
  if (isContinuous(v) && !e.evtAttPayoutLowerBound && Number(v.evtAttPayoutLowerBound) > Number(v.evtAttPayoutUpperBound)) {
    e.evtAttPayoutLowerBound = 'Payout Lower Bound must be less than or equal to Payout Upper Bound.'
  }
  return e
}

export function validateScheduleDates(v: any): Errors {
  const e: Errors = {}
  if (!v.startDate) e.startDate = 'Enter a start date.'
  const order = (a: any, b: any) => new Date(a) < new Date(b)
  if (v.lastTradeDate && v.startDate && order(v.lastTradeDate, v.startDate)) e.lastTradeDate = 'Last Trade Date must be after Start Date.'
  if (v.expirationDate) {
    if (v.startDate && order(v.expirationDate, v.startDate)) e.expirationDate = 'Expiration Date must be after Start Date.'
    if (v.lastTradeDate && order(v.expirationDate, v.lastTradeDate)) e.expirationDate = 'Expiration Date must be after Last Trade Date.'
  }
  if (v.terminationDate) {
    if (v.startDate && order(v.terminationDate, v.startDate)) e.terminationDate = 'Termination Date must be after Start Date.'
    if (v.lastTradeDate && order(v.terminationDate, String(v.lastTradeDate).slice(0, 10))) e.terminationDate = 'Termination Date must be after Last Trade Date.'
    if (v.expirationDate && order(v.terminationDate, String(v.expirationDate).slice(0, 10))) e.terminationDate = 'Termination Date must be after Expiration Date.'
  }
  return e
}

export function validateInstrument(v: any, form: FormModel | null): Errors {
  const sections = instrumentSections(v)
  const e = validateSections(sections, v, form)
  if (form && form.mode === 'create') {
    const id = String(v.id || '').trim()
    if (id && instrumentById(id)) e.id = 'Another instrument already uses this symbol. Enter a different one.'
  }
  Object.assign(e, validateLimits(v))
  Object.assign(e, validateMetadata(v))
  Object.assign(e, validateSubTypes(v, form))
  if (v.type === IT.FUTURE || v.type === IT.OPTION) {
    if (!isLocked(v) && !v.maturityDateMonth) e.maturityDateParts = 'Month must be selected.'
    if (!isLocked(v) && !v.maturityDateYear) e.maturityDateParts = 'Year must be selected.'
    if (v.type === IT.OPTION && !e.strikePrice && v.strikePrice && !validScale(v.strikePrice, v.minimumPriceIncrement)) e.strikePrice = 'Strike Price scale is not valid.'
  }
  if (v.type === IT.MULTILEG) {
    ;(v.legs || []).forEach((leg: any, i: number) => {
      if (!String(leg.symbol || '').trim()) e[`legs.${i}.symbol`] = 'Enter a symbol.'
      if (leg.ratio === '' || !Number.isFinite(Number(leg.ratio))) e[`legs.${i}.ratio`] = 'Ratio must be a number.'
    })
  }
  if (v.type === IT.EVENT) Object.assign(e, validateEventTime(v))
  Object.assign(e, validateScheduleDates(v))
  return e
}

// ---------- Change handling ----------

/** The prototype's onInstrumentChange(k). The caller re-renders afterwards. */
export function onInstrumentChange(form: FormModel, k: string) {
  const v = form.draft
  if (k === 'productId') {
    const typed = { id: v.id, description: v.description }
    const product = productById(v.productId)
    form.draft = product ? { ...instrumentFromProduct(product), ...typed } : { ...blankInstrument(), ...typed }
    form.errors = {}
    form.open = new Set(instrumentSections(form.draft).filter(s => s.open).map(s => s.id))
    // The section layout may change, so put focus back on the product select.
    requestAnimationFrame(() => document.getElementById('firm-productId')?.focus({ preventScroll: true }))
    return
  }
  if (k === 'noLegs') {
    const wanted = Number(v.noLegs) || 0
    const legs: any[] = v.legs || []
    v.legs = Array.from({ length: wanted }, (_, i) => legs[i] || { symbol: '', ratio: '1', opposingSide: OPPOSING[i % 2] })
  }
  if (k === 'nonTradable' && !v.nonTradable) v.hideMarketData = false
  if (k === 'nonTradable' && v.nonTradable) v.clearingHouse = ''
  if (k === 'securityIdSource' && (!v.securityIdSource || v.securityIdSource === 'Exchange Symbol')) v.securityId = ''
  if (k === 'evtAttEventId') {
    const sibling = market().instruments.find(i => i.type === IT.EVENT && i.evtAttEventId === v.evtAttEventId)
    if (sibling) ['evtAttEventDisplayName', 'evtAttTimeSpecifierYear', 'evtAttTimeSpecifierMonth', 'evtAttTimeSpecifierDay', 'lastTradeDate', 'expirationDate'].forEach(key => { v[key] = sibling[key] })
  }
}

// ---------- Form ----------

type FormMode = 'new' | 'edit' | 'copy'

function InstrumentForm({ mode, init }: { mode: FormMode; init: () => any }) {
  const navigate = useNavigate()
  const editing = mode === 'edit'
  const [form, refresh] = useForm(() => createMarketForm(editing ? 'edit' : 'create', init(), instrumentSections))
  const title = editing ? 'Edit Instrument' : 'Create Instrument'
  const originalId = form.original.id
  // Back goes where the person came from: the instrument's view if they opened Edit there, otherwise the list.
  const [fromView] = useState(() => previousPage() === instHref(originalId))
  const back = editing && fromView ? { href: instHref(originalId), label: originalId } : { href: '/instruments', label: 'Instruments' }

  const submit = async () => {
    const v = form.draft
    const creating = form.mode === 'create'
    if (!creating && !isDirty(form)) return
    v.id = String(v.id || '').trim()
    form.errors = validateInstrument(v, form)
    if (Object.keys(form.errors).length) {
      revealFormErrors(form, instrumentSections(v), refresh)
      return
    }
    refresh()
    const ok = await ask({
      title: creating ? 'Add this instrument?' : 'Save this instrument?',
      text: creating ? `This creates ${v.id} in the Pending state.` : `This updates ${v.id}.`,
      confirm: creating ? 'Add Instrument' : 'Save Instrument',
      glyph: 'check',
    })
    if (!ok) return
    if (creating && !v.isScheduled && (v.startDate || v.startTime || v.lastTradeDate || v.expirationDate || v.terminationDate)) {
      v.isScheduled = await ask({ title: 'Follow the trading schedule?', text: 'This instrument has a Trading Schedule but is not currently following it. Set it to follow?', confirm: 'Set to Follow', glyph: 'calendar' })
    }
    form.saving = true
    refresh()
    await wait(350)
    const saved = clone(v)
    const list = market().instruments
    if (creating) {
      saved.state = saved.isScheduled ? stateFromSchedule(saved) : 'Pending'
      list.unshift(saved)
    } else {
      list[list.findIndex(i => i.id === form.original.id)] = saved
    }
    form.done = true
    saveMarket()
    navigate('/instruments')
    toast('Instrument saved.')
  }

  return (
    <MarketFormPage
      form={form}
      refresh={refresh}
      sections={instrumentSections}
      validate={validateInstrument}
      onSubmit={submit}
      onChange={k => onInstrumentChange(form, k)}
      crumb={back}
      title={title}
      backHref={back.href}
      saveLabel={editing ? 'Save' : 'Create Instrument'}
      instIdList
      eventIds={eventIdsFor(form.draft.productId)}
    />
  )
}

// ---------- View ----------

function InstrumentView({ inst: i }: { inst: any }) {
  const navigate = useNavigate()
  useTitle(i.id)
  const editable = instEditable(i)
  const sections = instrumentSections(i)
  return (
    <div className="detail-page">
      <div className="detail-head detail-head-plain">
        <Crumb to="/instruments">Instruments</Crumb>
        <header className="firm-head">
          <div>
            <div className="firm-title">
              <LargeTitle>{i.id}</LargeTitle>
              <StatusBadge value={i.state} />
            </div>
            <div className="firm-meta">
              <span>{i.type || 'Default'}</span>
              <span>·</span>
              <Link className="link-btn" to={productHref(i.productId)}>{i.productId}</Link>
              {i.description && <><span>·</span><span>{i.description}</span></>}
            </div>
          </div>
          <div className="head-acts">
            {editable && <Button variant="secondary" type="button" onClick={() => openStateSheet([i.id])}><TriangleAlert size={17} />Change State</Button>}
            <Button variant="secondary" asChild><Link to={instHref(i.id, 'copy')}><Copy size={17} />Copy</Link></Button>
            {editable && <Button asChild><Link to={instHref(i.id, 'edit')}><Pencil size={17} />Edit Instrument</Link></Button>}
            <ActionMenu variant="secondary" label="More actions" items={instrumentMenuItems(i, true, navigate)} />
          </div>
        </header>
      </div>
      <div className="detail-scroll">
        {!editable && <Banner tone="bad" icon={<TriangleAlert size={18} />}><span>This instrument is terminated, so its details are read-only.</span></Banner>}
        {i.scheduledChange && <Banner tone="warn" icon={<CalendarCheck size={18} />}><span>State change to {i.scheduledChange.state} is scheduled for {showDateTime(i.scheduledChange.at)}.</span></Banner>}
        <div className="split">
          <SectionRail sections={sections} />
          <div className="sections"><SectionsRead sections={sections} values={i} /></div>
        </div>
      </div>
    </div>
  )
}

// ---------- Route ----------

/** /instrument?id=…[&mode=edit|copy] and /instrument?mode=new[&productId=…] */
export function InstrumentPage() {
  useStore()
  const [params] = useSearchParams()
  const mode = params.get('mode')
  const id = params.get('id')
  if (mode === 'new') {
    const productId = params.get('productId')
    return <InstrumentForm key={`new|${productId || ''}`} mode="new" init={() => blankInstrument(productId)} />
  }
  const inst = instrumentById(id)
  if (!inst) return <MarketNotFound title="Instrument not found" id={id} href="/instruments" label="Instruments" />
  if (mode === 'edit') {
    if (!instEditable(inst)) return <Navigate to={instHref(inst.id)} replace />
    return <InstrumentForm key={`edit|${inst.id}`} mode="edit" init={() => clone(inst)} />
  }
  if (mode === 'copy') {
    return <InstrumentForm key={`copy|${inst.id}`} mode="copy" init={() => ({ ...clone(inst), id: '', description: '', state: 'Pending', stats: {}, isScheduled: false })} />
  }
  return <InstrumentView key={inst.id} inst={inst} />
}
