import type { NavigateFunction } from 'react-router'
import { ExternalLink, Octagon, Pause, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react'
import type { MenuEntry } from '@/components/app/action-menu'
import type { Firm } from '@/data/config'
import { ask } from '@/lib/dialogs'
import { firmById, hrefFor, persist } from '@/lib/firms'
import { toast } from '@/lib/toast'

export async function deleteFirm(id: string, navigate: NavigateFunction, onList: boolean) {
  const f = firmById(id)
  if (!f) return
  const ok = await ask({ title: `Delete ${f.name}?`, text: 'The firm leaves the directory. You can restore it later from Show Deleted.', confirm: 'Delete Firm', danger: true, glyph: 'trash' })
  if (!ok) return
  f.deleted = true
  persist()
  toast(`Deleted ${f.name}.`)
  if (!onList) navigate('/firms')
}

export async function restoreFirm(id: string) {
  const f = firmById(id)
  if (!f) return
  const ok = await ask({ title: `Restore ${f.name}?`, text: 'The firm returns to the directory in the state it had before it was deleted.', confirm: 'Restore Firm', glyph: 'restore' })
  if (!ok) return
  f.deleted = false
  persist()
  toast(`Restored ${f.name}.`)
}

export async function toggleSuspend(id: string) {
  const f = firmById(id)
  if (!f) return
  const suspending = f.state !== 'suspended'
  const ok = await ask(suspending
    ? { title: `Suspend ${f.name}?`, text: 'The firm stays in the directory with its state set to Suspended. You can activate it again at any time.', confirm: 'Suspend Firm', danger: true, glyph: 'pause' }
    : { title: `Activate ${f.name}?`, text: 'The firm’s state changes back to Active.', confirm: 'Activate Firm', glyph: 'play' })
  if (!ok) return
  f.state = suspending ? 'suspended' : 'active'
  persist()
  toast(`${suspending ? 'Suspended' : 'Activated'} ${f.name}.`)
}

export async function cancelOrders(id: string) {
  const f = firmById(id)
  if (!f) return
  const ok = await ask({ title: `Cancel all orders for ${f.name}?`, text: 'This submits a mass cancel for the firm’s open orders and can’t be undone.', confirm: 'Cancel All Orders', danger: true, glyph: 'stop' })
  if (ok) toast(`Submitted mass cancel for ${f.name}.`)
}

const openInNewTab = (f: Firm) => window.open(hrefFor(f.id), '_blank')

/** Actions for a firm's "⋯" menu. The detail page leaves out the ones its header already shows. */
export function firmMenuItems(f: Firm, onDetail: boolean, navigate: NavigateFunction): MenuEntry[] {
  if (f.deleted) {
    return [
      ...(onDetail ? [] : [{ label: 'Open in New Tab', icon: ExternalLink, run: () => openInNewTab(f) }, '-' as const]),
      { label: 'Restore Firm', icon: RotateCcw, run: () => restoreFirm(f.id) },
    ]
  }
  const suspended = f.state === 'suspended'
  return [
    ...(onDetail ? [] : [
      { label: 'Edit Firm', icon: Pencil, run: () => navigate(hrefFor(f.id, 'edit')) },
      { label: 'Open in New Tab', icon: ExternalLink, run: () => openInNewTab(f) },
      '-' as const,
    ]),
    { label: suspended ? 'Activate Firm' : 'Suspend Firm', icon: suspended ? Play : Pause, run: () => toggleSuspend(f.id) },
    ...(onDetail ? [] : [{ label: 'Cancel All Orders', icon: Octagon, danger: true, run: () => cancelOrders(f.id) }]),
    '-',
    { label: 'Delete Firm', icon: Trash2, danger: true, run: () => deleteFirm(f.id, navigate, !onDetail) },
  ]
}
