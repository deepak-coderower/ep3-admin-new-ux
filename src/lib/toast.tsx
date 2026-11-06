import { toast as sonner } from 'sonner'
import { CircleCheck, TriangleAlert } from 'lucide-react'

/** Shows a single status toast. `info` uses the warning style the prototype uses for notices. */
export function toast(message: string, opts: { info?: boolean } = {}) {
  sonner.dismiss()
  sonner(message, {
    icon: opts.info ? <TriangleAlert size={18} /> : <CircleCheck size={18} />,
    className: opts.info ? 'toast-info' : 'toast-ok',
  })
}
