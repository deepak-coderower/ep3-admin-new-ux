import { useEffect, useReducer, useRef, useState } from 'react'
import { useBlocker } from 'react-router'
import { ask } from '@/lib/dialogs'
import { clone } from '@/lib/format'
import type { Field } from '@/data/config'

/**
 * Mutable form state, like the prototype's global `form`. Mutate `draft` /
 * `errors`, then call the `refresh()` returned by useForm() to re-render.
 */
export type FormModel = {
  mode: 'create' | 'edit'
  draft: any
  original: any
  errors: Record<string, string>
  open: Set<string>
  saving: boolean
  idTouched: boolean
  /** Set once the form has been saved, so navigating away isn't blocked. */
  done?: boolean
  [key: string]: any
}

export function createForm(mode: 'create' | 'edit', draft: any, extra: Partial<FormModel> = {}): FormModel {
  return { mode, draft, original: clone(draft), errors: {}, open: new Set(), saving: false, idTouched: false, ...extra }
}

export const isDirty = (form: FormModel | null | undefined) =>
  !!form && !form.done && JSON.stringify(form.draft) !== JSON.stringify(form.original)

export function useForm(init: () => FormModel): [FormModel, () => void] {
  const [form] = useState(init)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  return [form, bump]
}

export const requiredMessage = (x: Field) =>
  (x.kind === 'select' || x.kind === 'multi' ? `Choose ${String(x.label).toLowerCase()}.` : `Enter ${String(x.label).toLowerCase()}.`)

/** Focuses and centres the first invalid field after the next paint. */
export function focusFirstError(errors: Record<string, string>, ctx = 'firm') {
  const first = Object.keys(errors)[0]
  if (!first) return
  requestAnimationFrame(() => {
    const el = document.getElementById(`${ctx}-${first}`) as HTMLElement | null
    if (el) {
      el.focus({ preventScroll: true })
      el.scrollIntoView({ block: 'center' })
    }
  })
}

/** Asks before leaving a form with unsaved changes (in-app navigation and tab close). */
export function useUnsavedGuard(form: FormModel | null) {
  const formRef = useRef(form)
  formRef.current = form
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty(formRef.current) && !formRef.current?.saving &&
    currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let cancelled = false
    ask({ title: 'Discard your changes?', text: 'The changes you made haven’t been saved.', confirm: 'Discard Changes', danger: true, glyph: 'warn' })
      .then(ok => {
        if (cancelled) return
        if (ok) {
          if (formRef.current) formRef.current.done = true
          blocker.proceed?.()
        } else blocker.reset?.()
      })
    return () => { cancelled = true }
  }, [blocker])

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (isDirty(formRef.current)) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])
}

/** Ctrl/Cmd+S submits the page form when no dialog is open. */
export function useSaveShortcut(submit: () => void) {
  const ref = useRef(submit)
  ref.current = submit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        e.preventDefault()
        ref.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}
