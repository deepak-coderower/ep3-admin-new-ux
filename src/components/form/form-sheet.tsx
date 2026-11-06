import { useReducer, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldRow } from '@/components/form/field-row'
import type { Field } from '@/data/config'
import { focusFirstError, requiredMessage } from '@/lib/form'
import { setPath, visible } from '@/lib/format'

export type FormSheetOptions = {
  title: string
  submit: string
  note?: string
  fields: Field[] | ((values: any) => Field[])
  values: Record<string, any>
  validate?: (values: any) => Record<string, string>
  onSubmit: (values: any) => void
  /** Runs after every change; may adjust values (e.g. derived fields). */
  sync?: (values: any) => void
  /** Extra content under the fields (re-rendered with the current values). */
  extra?: (values: any) => ReactNode
}

type Open = FormSheetOptions & { errors: Record<string, string> }

let current: Open | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l) }

/** Opens a modal form for adding or editing one record (the prototype's openFormSheet). */
export function openFormSheet(opts: FormSheetOptions) {
  current = { ...opts, errors: {} }
  emit()
}

function close() {
  current = null
  emit()
}

/** Closes the open form sheet (the prototype's `$('#sheet').close()`). */
export const closeFormSheet = close

export function FormSheetHost() {
  const sheet = useSyncExternalStore(subscribe, () => current)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  if (!sheet) return <Dialog open={false} />

  const { values } = sheet
  const fieldList = () => (typeof sheet.fields === 'function' ? sheet.fields(values) : sheet.fields).filter(x => visible(x, values))
  const fields = fieldList().map(x => (x.lockedBy ? { ...x, disabled: !!values[x.lockedBy] } : x))

  const onChange = (k: string, v: any) => {
    setPath(values, k, v)
    sheet.sync?.(values)
    bump()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    let errors: Record<string, string> = {}
    fields.forEach(x => {
      const v = values[x.k]
      if (x.req && !String(v ?? '').trim()) errors[x.k] = requiredMessage(x)
      if (x.inputType === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[x.k] = 'Enter an email address like name@example.com.'
      if (x.inputType === 'number' && v !== '' && v !== undefined && !(Number(v) >= 0)) errors[x.k] = `${x.label} must be 0 or more.`
    })
    if (!Object.keys(errors).length && sheet.validate) errors = sheet.validate(values)
    sheet.errors = errors
    if (Object.keys(errors).length) {
      bump()
      focusFirstError(errors, 'rec')
      return
    }
    close()
    sheet.onSubmit(values)
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) close() }}>
      <DialogContent className="sheet">
        <form className="sheet-form" noValidate onSubmit={onSubmit}>
          <DialogHeader className="sheet-head">
            <DialogTitle>{sheet.title}</DialogTitle>
            <div className="dock-acts">
              <Button variant="ghost" type="button" onClick={close}>Cancel</Button>
              <Button type="submit">{sheet.submit}</Button>
            </div>
          </DialogHeader>
          <DialogBody className="sheet-body">
            {sheet.note ? <DialogDescription className="sheet-note">{sheet.note}</DialogDescription> : <DialogDescription className="sr-only">{sheet.title}</DialogDescription>}
            <Card>
              {fields.map(x => <FieldRow key={x.k} field={x} values={values} errors={sheet.errors} ctx="rec" onChange={onChange} />)}
            </Card>
            {sheet.extra?.(values)}
          </DialogBody>
        </form>
      </DialogContent>
    </Dialog>
  )
}
