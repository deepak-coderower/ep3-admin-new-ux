// Holiday calendars: agenda and week views, the holiday sheet and the calendar manager. Ported from calendars.js.
import { useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EmptyState, useTitle } from '@/components/app/page'
import { FieldRow } from '@/components/form/field-row'
import { openFormSheet } from '@/components/form/form-sheet'
import { ModuleHead } from '@/components/market/module-head'
import type { Field } from '@/data/config'
import { WEEK_DAYS } from '@/data/market-config'
import { ask } from '@/lib/dialogs'
import { focusFirstError, requiredMessage } from '@/lib/form'
import { MONTH_NAMES, isoDate, pad2, timeLabel } from '@/lib/format'
import { market, saveMarket } from '@/lib/market'
import { readListState, saveListState } from '@/lib/storage'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type CalendarView = { view: 'agenda' | 'week'; anchor: string }

const VIEW_KEY = 'calendarView'
const DAY_MS = 86400000
const AGENDA_DAYS = 365
const CAL_HOUR_PX = 44
const CAL_OPEN_HOUR = 6
const VIEWS: [CalendarView['view'], string][] = [['week', 'Week'], ['agenda', 'Agenda']]

const parseDay = (text: string) => new Date(`${text}T12:00`)
const longDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const holidayName = (e: any) => `${e.calendar}${(market().calendars[e.calendar] || {} as any).global ? ' (Global)' : ''}`
const holidayLabel = (e: any) => `${holidayName(e)} - ${e.title}`
const sortedHolidays = () => [...market().holidays].sort((a, b) => a.start.localeCompare(b.start))
const weekStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay(), 12)
const calendarExists = (name: string) => Object.prototype.hasOwnProperty.call(market().calendars, name)

function holidayTime(e: any) {
  const start = new Date(e.start)
  const end = new Date(e.end)
  if (start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 23) return 'All day'
  return `${timeLabel(start.getHours() * 3600 + start.getMinutes() * 60)} - ${timeLabel(end.getHours() * 3600 + end.getMinutes() * 60)}`
}

const isAllDayEvent = (e: any) => holidayTime(e) === 'All day' || e.start.slice(0, 10) !== e.end.slice(0, 10)
const eventCoversDay = (e: any, key: string) => e.start.slice(0, 10) <= key && e.end.slice(0, 10) >= key
const minutesOf = (text: string) => { const d = new Date(text); return d.getHours() * 60 + d.getMinutes() }
const percent = (minutes: number) => `${(minutes / 1440) * 100}%`

function calendarRangeLabel(view: CalendarView['view'], anchor: Date) {
  if (view === 'week') {
    const start = weekStart(anchor)
    const end = new Date(start.getTime() + 6 * DAY_MS)
    const month = (d: Date) => MONTH_NAMES[d.getMonth()]
    return start.getMonth() === end.getMonth()
      ? `${month(start)} ${pad2(start.getDate())} – ${pad2(end.getDate())}`
      : `${month(start)} ${pad2(start.getDate())} – ${month(end)} ${pad2(end.getDate())}`
  }
  const short = (d: Date) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`
  return `${short(anchor)} – ${short(new Date(anchor.getTime() + AGENDA_DAYS * DAY_MS))}`
}

// ---------- Holiday actions ----------

function openHolidaySheet() {
  const today = isoDate(new Date())
  openFormSheet({
    title: 'Create Holiday Event',
    submit: 'Create',
    values: { calendar: '', title: '', start: `${today}T00:00`, end: `${today}T23:59` },
    fields: () => [
      { k: 'calendar', label: 'Holiday Calendar', kind: 'select', options: Object.keys(market().calendars), blank: 'Choose a calendar', req: true },
      { k: 'title', label: 'Holiday Title', req: true },
      { k: 'start', label: 'Start Date/Time', inputType: 'datetime-local', req: true },
      { k: 'end', label: 'End Date/Time', inputType: 'datetime-local', req: true },
    ],
    validate: (v): Record<string, string> => (new Date(v.end) < new Date(v.start) ? { end: 'End must be after Start.' } : {}),
    onSubmit: v => {
      market().holidays.push({ id: `h${Date.now()}`, calendar: v.calendar, title: v.title.trim(), start: v.start, end: v.end })
      saveMarket()
      toast(`Added ${v.title.trim()}.`)
    },
  })
}

async function openHolidayEvent(id: string) {
  const m = market()
  const e = m.holidays.find(h => h.id === id)
  if (!e) return
  const ok = await ask({ title: holidayName(e), text: `${e.title} · ${longDate(new Date(e.start))} · ${holidayTime(e)}`, confirm: 'Delete', danger: true, glyph: 'calendar' })
  if (!ok) return
  m.holidays = m.holidays.filter(h => h.id !== id)
  saveMarket()
  toast(`Deleted ${e.title}.`)
}

// ---------- Calendar manager ----------

type ManagerValues = { existing: string; name: string; description: string; global: boolean }
const blankManager = (): ManagerValues => ({ existing: '', name: '', description: '', global: false })

/**
 * "Manage Holiday Calendars" (openCalendarManager): pick a calendar to delete it, or type a new
 * title to create one. Choosing a calendar fills the title; editing the title clears the choice.
 * A title that matches a calendar locks Description / Global and turns the submit into Delete.
 */
function CalendarManagerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [values] = useState(blankManager)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const { calendars } = market()
  const found = calendarExists(values.name.trim())

  const fields: Field[] = [
    { k: 'existing', label: 'Holiday Calendar', kind: 'select', options: Object.keys(calendars), blank: 'New calendar' },
    { k: 'name', label: 'Calendar Title', req: true },
    { k: 'description', label: 'Description', disabled: found },
    { k: 'global', label: 'Global (apply to all instruments)', kind: 'toggle', disabled: found },
  ]

  const onChange = (k: string, value: any) => {
    ;(values as any)[k] = value
    if (k === 'existing') {
      if (value) values.name = value
    } else if (values.existing && values.name !== values.existing) values.existing = ''
    const match = market().calendars[values.name.trim()]
    if (calendarExists(values.name.trim())) {
      values.description = match.description
      values.global = match.global
    }
    bump()
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    fields.forEach(x => { if (x.req && !String((values as any)[x.k] ?? '').trim()) next[x.k] = requiredMessage(x) })
    setErrors(next)
    if (Object.keys(next).length) {
      focusFirstError(next, 'rec')
      return
    }
    onClose()
    const name = values.name.trim()
    const deleting = calendarExists(name)
    const ok = await ask(deleting
      ? { title: `Delete ${name}?`, text: 'This deletes the calendar and all of its events.', confirm: 'Delete Calendar', danger: true, glyph: 'trash' }
      : { title: `Create ${name}?`, text: 'This creates a new holiday calendar.', confirm: 'Create Calendar', glyph: 'calendar' })
    if (!ok) return
    const m = market()
    if (deleting) {
      delete m.calendars[name]
      m.holidays = m.holidays.filter(h => h.calendar !== name)
    } else {
      m.calendars[name] = { global: !!values.global, description: values.description.trim() }
    }
    saveMarket()
    toast(deleting ? `Deleted ${name}.` : `Created ${name}.`)
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sheet">
        <form className="sheet-form" noValidate onSubmit={onSubmit}>
          <DialogHeader className="sheet-head">
            <DialogTitle>Manage Holiday Calendars</DialogTitle>
            <div className="dock-acts">
              <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant={found ? 'destructive' : 'default'}>{found ? 'Delete' : 'Create'}</Button>
            </div>
          </DialogHeader>
          <DialogBody className="sheet-body">
            <DialogDescription className="sheet-note">Choose a calendar to delete it, or type a new title to create one.</DialogDescription>
            <Card>
              {fields.map(x => <FieldRow key={x.k} field={x} values={values} errors={errors} ctx="rec" onChange={onChange} />)}
            </Card>
          </DialogBody>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Views ----------

function CalEvent({ e, className, style }: { e: any; className?: string; style?: CSSProperties }) {
  const label = holidayLabel(e)
  return <button className={cn('cal-event', className)} type="button" title={label} style={style} onClick={() => openHolidayEvent(e.id)}>{label}</button>
}

function Agenda({ anchor }: { anchor: Date }) {
  const from = isoDate(anchor)
  const to = isoDate(new Date(anchor.getTime() + AGENDA_DAYS * DAY_MS))
  const rows = sortedHolidays().filter(e => e.start.slice(0, 10) >= from && e.start.slice(0, 10) <= to)
  if (!rows.length) return <EmptyState className="card" title="No events" text="There are no events in this range." />
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Date</TableHead><TableHead className="hide-compact">Time</TableHead><TableHead>Event</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(e => (
            <TableRow key={e.id}>
              <TableCell className="cal-date">{longDate(new Date(e.start))}</TableCell>
              <TableCell className="hide-compact">{holidayTime(e)}</TableCell>
              <TableCell><button className="link-btn" type="button" onClick={() => openHolidayEvent(e.id)}>{holidayLabel(e)}</button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

/** Timed events of one day, placed in lanes so overlapping events sit side by side. */
function TimedEvents({ events }: { events: any[] }) {
  const laneEnds: number[] = []
  const placed = events.map(e => {
    const start = minutesOf(e.start)
    const end = Math.max(minutesOf(e.end), start + 30)
    let lane = laneEnds.findIndex(until => until <= start)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = end
    return { e, start, end, lane }
  })
  const lanes = laneEnds.length
  return (
    <>
      {placed.map(p => (
        <CalEvent
          key={p.e.id}
          e={p.e}
          className="cal-timed"
          style={{ top: percent(p.start), height: percent(p.end - p.start), left: `${(p.lane / lanes) * 100}%`, width: `${100 / lanes}%` }}
        />
      ))}
    </>
  )
}

function Week({ anchor, scrollRef }: { anchor: Date; scrollRef: RefObject<HTMLDivElement | null> }) {
  const start = weekStart(anchor)
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS))
  const now = new Date()
  const today = isoDate(now)
  const events = sortedHolidays()
  const dayClass = (key: string) => (key === today ? 'is-today' : undefined)
  return (
    <Card className="card-clip">
      <div className="cal-scroll" id="calScroll" ref={scrollRef}>
        <div className="cal-sticky">
          <div className="cal-row">
            <span className="cal-gutter" />
            {days.map(d => {
              const day = WEEK_DAYS[d.getDay()]
              return <div key={isoDate(d)} className={cn('cal-head', dayClass(isoDate(d)))}>{pad2(d.getDate())} {day[0]}{day.slice(1).toLowerCase()}</div>
            })}
          </div>
          <div className="cal-row cal-allday">
            <span className="cal-gutter" />
            {days.map(d => {
              const key = isoDate(d)
              return (
                <div key={key} className={cn('cal-allday-cell', dayClass(key))}>
                  {events.filter(e => isAllDayEvent(e) && eventCoversDay(e, key)).map(e => <CalEvent key={e.id} e={e} />)}
                </div>
              )
            })}
          </div>
        </div>
        <div className="cal-row">
          <div className="cal-gutter cal-hours">{Array.from({ length: 24 }, (_, h) => <span key={h}>{timeLabel(h * 3600)}</span>)}</div>
          {days.map(d => {
            const key = isoDate(d)
            const timed = events.filter(e => !isAllDayEvent(e) && e.start.slice(0, 10) === key)
            return (
              <div key={key} className={cn('cal-col', dayClass(key))}>
                <TimedEvents events={timed} />
                {key === today && <span className="cal-now" style={{ top: percent(now.getHours() * 60 + now.getMinutes()) }} />}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// ---------- Page ----------

/** /calendars */
export function CalendarsPage() {
  useTitle('Calendars')
  const version = useStore()
  const [state] = useState<CalendarView>(() => ({ view: 'agenda', anchor: isoDate(new Date()), ...readListState(VIEW_KEY) }))
  const [tick, bump] = useReducer((x: number) => x + 1, 0)
  const [managing, setManaging] = useState(false)
  const [managerKey, setManagerKey] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const anchor = parseDay(state.anchor)

  saveListState(VIEW_KEY, state)
  const update = (patch: Partial<CalendarView>) => { Object.assign(state, patch); bump() }
  const moveCalendar = (direction: number) => {
    const step = state.view === 'week' ? 7 : AGENDA_DAYS
    update({ anchor: isoDate(new Date(parseDay(state.anchor).getTime() + direction * step * DAY_MS)) })
  }
  const openCalendarManager = () => { setManagerKey(k => k + 1); setManaging(true) }

  // layoutWeek: each calendar render (navigation, view change, data change) opens the week at 6 am.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = CAL_OPEN_HOUR * CAL_HOUR_PX
  }, [tick, version])

  return (
    <div className="detail-page">
      <ModuleHead
        active="calendars"
        actions={(
          <>
            <Button variant="secondary" type="button" data-act="calendar-manage" onClick={openCalendarManager}>Manage Calendars</Button>
            <Button type="button" data-act="holiday-add" onClick={openHolidaySheet}><Plus size={18} />Add New Event</Button>
          </>
        )}
      />
      <div className="detail-scroll">
        <div className="cal-toolbar">
          <div className="btn-group" role="group" aria-label="Calendar navigation">
            <button type="button" data-act="calendar-today" onClick={() => update({ anchor: isoDate(new Date()) })}>Today</button>
            <button type="button" data-act="calendar-move" onClick={() => moveCalendar(-1)}>Back</button>
            <button type="button" data-act="calendar-move" onClick={() => moveCalendar(1)}>Next</button>
          </div>
          <strong className="cal-range">{calendarRangeLabel(state.view, anchor)}</strong>
          <ToggleGroup type="single" className="cal-seg" aria-label="Calendar view" value={state.view} onValueChange={v => { if (v) update({ view: v as CalendarView['view'] }) }}>
            {VIEWS.map(([key, label]) => <ToggleGroupItem key={key} value={key}><span>{label}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        {state.view === 'week' ? <Week anchor={anchor} scrollRef={scrollRef} /> : <Agenda anchor={anchor} />}
      </div>
      <CalendarManagerSheet key={managerKey} open={managing} onClose={() => setManaging(false)} />
    </div>
  )
}
