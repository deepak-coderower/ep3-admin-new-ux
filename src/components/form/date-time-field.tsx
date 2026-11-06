import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatWhen, isoDate, pad2 } from '@/lib/format'
import { cn } from '@/lib/utils'

export type DateKind = 'date' | 'datetime-local' | 'time'

const EMPTY: Record<DateKind, string> = { date: 'Select date', 'datetime-local': 'Select date and time', time: 'Select time' }

type Parts = { date: string; hour: number | null; minute: number | null }

function readValue(kind: DateKind, value: string): Parts {
  const [first = '', second = ''] = String(value || '').split('T')
  const date = kind === 'time' ? '' : first
  const time = kind === 'time' ? first : second
  const [hour, minute] = time ? time.split(':').map(Number) : [null, null]
  return { date, hour, minute }
}

function toValue(kind: DateKind, s: Parts) {
  const time = `${pad2(s.hour ?? 0)}:${pad2(s.minute ?? 0)}`
  if (kind === 'date') return s.date
  if (kind === 'time') return s.hour === null && s.minute === null ? '' : time
  return s.date ? `${s.date}T${time}` : ''
}

const parseDate = (iso: string) => (iso ? new Date(`${iso}T12:00`) : undefined)

type Props = {
  id?: string
  kind: DateKind
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

function TimeColumn({ label, values, current, text, onPick }: { label: string; values: (number | string)[]; current: number | string | null; text: (v: any) => string; onPick: (v: any) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const col = ref.current
    const on = col?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (col && on) col.scrollTop = on.offsetTop - (col.clientHeight - on.offsetHeight) / 2
  }, [])
  return (
    <div className="time-col" role="group" aria-label={label} ref={ref}>
      {values.map(v => (
        <button key={v} type="button" aria-pressed={v === current} onClick={() => onPick(v)}>{text(v)}</button>
      ))}
    </div>
  )
}

/** Date, date-time and time picker built from shadcn Popover + Calendar, replacing native inputs. */
export function DateTimeField({ id, kind, value, onChange, disabled, invalid, className, ...aria }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<Parts>(() => readValue(kind, value))
  const [month, setMonth] = useState<Date | undefined>(parseDate(state.date))

  const openChange = (next: boolean) => {
    if (next) {
      const s = readValue(kind, value)
      setState(s)
      setMonth(parseDate(s.date) || new Date())
    }
    setOpen(next)
  }

  const commit = (s: Parts) => {
    setState(s)
    onChange(toValue(kind, s))
  }

  const hour12 = state.hour === null ? null : (state.hour % 12 || 12)
  const meridiem = state.hour === null ? null : (state.hour < 12 ? 'AM' : 'PM')
  const setHour = (h12: number) => {
    const pm = meridiem === 'PM'
    commit({ ...state, hour: (h12 % 12) + (pm ? 12 : 0), minute: state.minute ?? 0 })
  }
  const setMeridiem = (m: string) => {
    const h = state.hour ?? 0
    commit({ ...state, hour: (h % 12) + (m === 'PM' ? 12 : 0), minute: state.minute ?? 0 })
  }

  const Icon = kind === 'time' ? Clock : CalendarDays
  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn('input select-trigger date-trigger', className)}
          data-empty={!value || undefined}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          {...aria}
        >
          <span className="select-trigger-value">{value ? formatWhen(value) : EMPTY[kind]}</span>
          <Icon size={15} className="select-trigger-icon" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="date-pop">
        <div className="date-panes">
          {kind !== 'time' && (
            <Calendar
              mode="single"
              selected={parseDate(state.date)}
              month={month}
              onMonthChange={setMonth}
              startMonth={new Date(1990, 0)}
              endMonth={new Date(2060, 11)}
              onSelect={d => {
                const next = { ...state, date: d ? isoDate(d) : '' }
                commit(next)
                if (kind === 'date') setOpen(false)
              }}
            />
          )}
          {kind !== 'date' && (
            <div className="time-pane">
              <div className="time-head"><span>Hour</span><span>Min</span><span /></div>
              <div className="time-cols">
                <TimeColumn label="Hour" values={[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]} current={hour12} text={v => String(v)} onPick={setHour} />
                <TimeColumn label="Minute" values={Array.from({ length: 60 }, (_, i) => i)} current={state.minute} text={pad2} onPick={m => commit({ ...state, minute: m, hour: state.hour ?? 0 })} />
                <TimeColumn label="AM or PM" values={['AM', 'PM']} current={meridiem} text={v => v} onPick={setMeridiem} />
              </div>
            </div>
          )}
        </div>
        <div className="date-foot">
          <Button variant="ghost" size="sm" type="button" onClick={() => { commit({ date: '', hour: null, minute: null }); setOpen(false) }}>Clear</Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              const now = new Date()
              const next = { date: isoDate(now), hour: now.getHours(), minute: now.getMinutes() }
              commit(next)
              setMonth(now)
              if (kind === 'date') setOpen(false)
            }}
          >
            {kind === 'date' ? 'Today' : 'Now'}
          </Button>
          {kind !== 'date' && <Button size="sm" type="button" className="date-done" onClick={() => setOpen(false)}>Done</Button>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
