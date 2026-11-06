import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Option = string | { value: string; label: string }

const BLANK = '__blank__'

export const normalizeOptions = (options: Option[] = []) =>
  options.map(o => (typeof o === 'string' ? { value: o, label: o } : { value: String(o.value), label: o.label }))

type Props = {
  id?: string
  value: unknown
  options: Option[]
  /** Label of an empty first option ("Not set", "All Types", …). Omit for no empty option. */
  blank?: string
  placeholder?: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

/** shadcn Select that behaves like a native <select>, including an empty option. */
export function SelectField({ id, value, options, blank, placeholder, onChange, disabled, invalid, required, className, ...aria }: Props) {
  const list = normalizeOptions(options)
  const current = value === undefined || value === null ? '' : String(value)
  const known = list.some(o => o.value === current)
  const selectValue = current === '' ? (blank !== undefined ? BLANK : undefined) : known ? current : undefined
  return (
    <Select value={selectValue ?? ''} onValueChange={v => onChange(v === BLANK ? '' : v)} disabled={disabled}>
      <SelectTrigger
        id={id}
        className={className}
        data-empty={current === '' || undefined}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        {...aria}
      >
        <SelectValue placeholder={placeholder ?? (current && !known ? current : blank ?? '')} />
      </SelectTrigger>
      <SelectContent>
        {blank !== undefined && <SelectItem value={BLANK}>{blank || ' '}</SelectItem>}
        {list.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
