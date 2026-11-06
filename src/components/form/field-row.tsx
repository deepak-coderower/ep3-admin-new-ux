import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DateTimeField, type DateKind } from '@/components/form/date-time-field'
import { InfoTip } from '@/components/form/info-tip'
import { SelectField } from '@/components/form/select-field'
import { STATES, TYPES, type Field } from '@/data/config'
import { getPath, isEmpty } from '@/lib/format'
import { cn } from '@/lib/utils'

export function RowError({ id, message, className }: { id?: string; message?: string; className?: string }) {
  if (!message) return null
  return (
    <div className={cn('row-err', className)} id={id} role="alert">
      <TriangleAlert size={15} />
      <span>{message}</span>
    </div>
  )
}

export const leiWarn = (v: unknown) => !!v && (String(v).length !== 20 || !/^[A-Za-z0-9]+$/.test(String(v)))
export const leiText = (v: unknown) => (!v ? '' : leiWarn(v) ? `${String(v).length} of 20 characters, letters and numbers only` : '20 characters')

/** A field tip may be text or a function of the values. */
export const tipOf = (x: Field, values: any): string | undefined => (typeof x.tip === 'function' ? x.tip(values) : x.tip)

/** The value a read-only row shows for a field. */
export function readValue(x: Field, values: any) {
  if (x.display) return x.display(values)
  if (x.kind === 'static') return x.value
  if (x.kind === 'type') return TYPES[values.type]?.label
  if (x.kind === 'select' && x.k === 'state' && STATES[values.state]) return STATES[values.state]
  return getPath(values, x.k)
}

/** A read-only label/value row (firm profile, record detail, instrument detail). */
export function ReadRow({ field: x, values }: { field: Field; values: any }) {
  if (x.kind === 'toggle') {
    return (
      <div className="row row-toggle">
        <span className="row-label">{x.label}<InfoTip text={tipOf(x, values)} /></span>
        {x.help && <span className="row-help">{x.help}</span>}
        <Switch checked={!!getPath(values, x.k)} disabled aria-label={x.label} />
      </div>
    )
  }
  const v = readValue(x, values)
  const text = Array.isArray(v) ? v.join(', ') : v
  return (
    <div className="row">
      <span className="row-label">{x.label}<InfoTip text={tipOf(x, values)} /></span>
      {isEmpty(text)
        ? <span className="row-value unset">Not set</span>
        : <span className={cn('row-value', x.mono && 'mono')}>{String(text)}</span>}
    </div>
  )
}

const ReqTag = () => <span className="req">Required</span>

type FieldRowProps = {
  field: Field
  values: any
  errors: Record<string, string>
  /** Prefix for element ids, e.g. "firm" gives #firm-name. */
  ctx?: string
  onChange: (k: string, value: any) => void
  /** Called when a text field loses focus (used for on-blur validation). */
  onBlur?: (k: string) => void
  /** Extra content under a toggle, such as a warning. */
  extra?: ReactNode
}

function PartsControl({ x, values, id, onChange }: { x: Field; values: any; id: string; onChange: FieldRowProps['onChange'] }) {
  return (
    <div className={cn('parts', `parts-${x.parts.length}`)} role="group" aria-labelledby={`${id}-label`}>
      {x.parts.map((p: any) => {
        const value = getPath(values, p.k)
        if (p.type === 'check') {
          return (
            <label key={p.k} className="chip">
              <input type="checkbox" checked={!!value} disabled={x.disabled} onChange={e => onChange(p.k, e.target.checked)} />
              <span>{p.label}</span>
            </label>
          )
        }
        return (
          <span key={p.k} className="part">
            <span className="part-label">{p.label}</span>
            {p.options
              ? <SelectField id={`${id}-${p.k}`} value={value ?? ''} options={p.options} blank="" disabled={x.disabled} aria-label={p.label} onChange={v => onChange(p.k, v)} />
              : <Input id={`${id}-${p.k}`} type="number" min={0} value={value ?? ''} disabled={x.disabled} aria-label={p.label} autoComplete="off" onChange={e => onChange(p.k, e.target.value)} />}
          </span>
        )
      })}
    </div>
  )
}

/** An editable form row. Ports the prototype's fieldRow(): text, number, select, toggle, textarea, date/time, parts, multi and LEI fields. */
export function FieldRow({ field: x, values, errors, ctx = 'firm', onChange, onBlur, extra }: FieldRowProps) {
  const id = `${ctx}-${x.k}`
  const value = getPath(values, x.k)
  const err = errors[x.k]
  const errId = err ? `${id}-err` : ''
  const helpId = x.help ? `${id}-help` : ''
  const describedBy = [errId, helpId].filter(Boolean).join(' ') || undefined
  const help = x.help ? <span className="row-help" id={helpId}>{x.help}</span> : null

  if (x.kind === 'toggle') {
    return (
      <div className="row row-toggle" id={`row-${id}`}>
        <label className="row-label" htmlFor={id}>{x.label}<InfoTip text={tipOf(x, values)} /></label>
        {help}
        <Switch id={id} checked={!!value} disabled={x.disabled} aria-describedby={describedBy} aria-invalid={!!err || undefined} onCheckedChange={c => onChange(x.k, c)} />
        {extra}
        {err && <div className="row-help"><RowError id={errId} message={err} /></div>}
      </div>
    )
  }

  if (x.kind === 'parts') {
    return (
      <div className="row" id={`row-${id}`}>
        <span className="row-label" id={`${id}-label`}>{x.label}{x.req && <ReqTag />}<InfoTip text={tipOf(x, values)} /></span>
        <div><PartsControl x={x} values={values} id={id} onChange={onChange} /><RowError id={errId} message={err} /></div>
        {help}
      </div>
    )
  }

  if (x.kind === 'multi') {
    const selected: string[] = value || []
    return (
      <div className="row row-wide" id={`row-${id}`}>
        <span className="row-label">{x.label}{x.req && <ReqTag />}</span>
        <div className="chip-list" role="group" aria-label={x.label}>
          {(x.options || []).map((o: string) => (
            <label key={o} className="chip">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                disabled={x.disabled}
                onChange={e => onChange(x.k, e.target.checked ? [...selected, o] : selected.filter(s => s !== o))}
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
        <RowError message={err} />
      </div>
    )
  }

  const common = { id, disabled: x.disabled, 'aria-describedby': describedBy, 'aria-invalid': !!err || undefined, 'aria-required': x.req || undefined }
  let control: ReactNode
  if (x.kind === 'select') {
    control = (
      <SelectField
        {...common}
        invalid={!!err}
        required={!!x.req}
        value={value ?? ''}
        options={x.options || []}
        blank={x.blank}
        onChange={v => onChange(x.k, v)}
      />
    )
  } else if (x.kind === 'textarea') {
    control = <Textarea {...common} rows={3} value={value ?? ''} onChange={e => onChange(x.k, e.target.value)} onBlur={() => onBlur?.(x.k)} />
  } else if (x.inputType === 'date' || x.inputType === 'datetime-local' || x.inputType === 'time') {
    control = <DateTimeField {...common} invalid={!!err} kind={x.inputType as DateKind} value={value ?? ''} onChange={v => onChange(x.k, v)} />
  } else {
    control = (
      <Input
        {...common}
        className={cn(x.mono && 'mono')}
        type={x.inputType || 'text'}
        value={value ?? ''}
        placeholder={x.ph}
        autoComplete={x.auto || 'off'}
        min={x.min}
        list={x.list}
        spellCheck={x.mono || x.k === 'name' ? false : undefined}
        onChange={e => onChange(x.k, e.target.value)}
        onBlur={() => onBlur?.(x.k)}
      />
    )
  }
  return (
    <div className={cn('row', x.wide && 'row-wide')} id={`row-${id}`}>
      <label className="row-label" htmlFor={id}>{x.label}{x.req && <ReqTag />}<InfoTip text={tipOf(x, values)} /></label>
      <div>
        {control}
        {x.kind === 'lei' && <span className={cn('meter', leiWarn(value) && 'warn')}>{leiText(value)}</span>}
        <RowError id={errId} message={err} />
      </div>
      {help}
    </div>
  )
}
