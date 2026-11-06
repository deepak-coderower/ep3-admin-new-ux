import type { FormModel } from '@/lib/form'

/**
 * The market form that is currently mounted. The prototype's FIELD_DEFS read the
 * global `form` (e.g. `when: () => !!form && form.mode === 'edit'`); here they read
 * this reference instead. MarketFormPage sets it while mounted, and the section
 * engine (SectionsForm, SectionsRead, validateSections) scopes it with withMarketForm.
 */
let activeForm: FormModel | null = null

export const getActiveMarketForm = () => activeForm

export function setActiveMarketForm(form: FormModel | null) {
  activeForm = form
}

/** Runs fn with `form` as the active market form, then restores the previous one. */
export function withMarketForm<T>(form: FormModel | null, fn: () => T): T {
  const previous = activeForm
  activeForm = form
  try {
    return fn()
  } finally {
    activeForm = previous
  }
}
