import { useSyncExternalStore } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { ICONS } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type AskOptions = {
  title: string
  text: string
  confirm: string
  danger?: boolean
  glyph?: string
}

type Pending = (AskOptions & { resolve: (ok: boolean) => void }) | null

let pending: Pending = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

/** Opens a confirmation dialog and resolves to true when the person confirms. */
export function ask(opts: AskOptions): Promise<boolean> {
  if (pending) pending.resolve(false)
  return new Promise(resolve => {
    pending = { ...opts, resolve }
    emit()
  })
}

function settle(ok: boolean) {
  if (!pending) return
  const { resolve } = pending
  pending = null
  emit()
  resolve(ok)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function AskDialogHost() {
  const current = useSyncExternalStore(subscribe, () => pending)
  const Glyph = ICONS[current?.glyph || (current?.danger ? 'warn' : 'restore')] || ICONS.warn
  return (
    <AlertDialog open={!!current} onOpenChange={open => { if (!open) settle(false) }}>
      {current && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="alert-glyph" data-danger={current.danger || undefined}><Glyph size={22} /></div>
            <AlertDialogTitle>{current.title}</AlertDialogTitle>
            <AlertDialogDescription>{current.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus onClick={() => settle(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: current.danger ? 'destructive' : 'default' }))}
              onClick={() => settle(true)}
            >
              {current.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
