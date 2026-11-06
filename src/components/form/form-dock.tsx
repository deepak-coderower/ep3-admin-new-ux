import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button, Spinner } from '@/components/ui/button'
import { isDirty, type FormModel } from '@/lib/form'
import { cn } from '@/lib/utils'

/** Sticky save bar at the bottom of every create/edit form. */
export function FormDock({ form, saveLabel, backHref, extra }: { form: FormModel; saveLabel: string; backHref: string; extra?: ReactNode }) {
  const creating = form.mode === 'create'
  const errCount = Object.keys(form.errors).length
  return (
    <div className="dock">
      <div className="dock-acts">
        <Button type="submit" id="saveBtn" disabled={form.saving || (!creating && !isDirty(form))}>
          {form.saving ? <><Spinner />{creating ? 'Creating…' : 'Saving…'}</> : saveLabel}
        </Button>
        {extra}
        <Button variant="ghost" asChild><Link to={backHref}>Cancel</Link></Button>
      </div>
      <span className={cn('dock-status', errCount && !form.saving && 'bad')}>
        {errCount && !form.saving ? `Fix ${errCount} field${errCount === 1 ? '' : 's'} to continue` : ''}
      </span>
    </div>
  )
}
