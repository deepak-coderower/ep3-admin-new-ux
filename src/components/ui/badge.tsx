import * as React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'

const TONES: Record<string, Tone> = {
  active: 'ok', open: 'ok', approved: 'ok', 'match-and-close-auction': 'info',
  suspended: 'warn', halted: 'warn', 'liquidate-only': 'warn', preopen: 'info', pending: 'neutral',
  deleted: 'bad', terminated: 'bad', expired: 'bad', closed: 'neutral',
}

function toneFor(label: string): Tone {
  return TONES[String(label).toLowerCase().replace(/\s+/g, '-')] || 'neutral'
}

function Badge({ className, tone = 'neutral', dot = true, children, ...props }: React.ComponentProps<'span'> & { tone?: Tone; dot?: boolean }) {
  return (
    <span data-slot="badge" data-tone={tone} className={cn('badge', className)} {...props}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** A status pill whose colour comes from the state label (Active, Suspended, Open, …). */
function StatusBadge({ value, className }: { value?: string; className?: string }) {
  const label = value || 'Active'
  return <Badge tone={toneFor(label)} className={className}>{label}</Badge>
}

export { Badge, StatusBadge, toneFor }
