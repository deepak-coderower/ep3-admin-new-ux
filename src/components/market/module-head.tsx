// Shared Markets page chrome. Ported from moduleHeadHTML, marketNotFound, infoListHTML and openWideSheet in market-core.js.
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LargeTitle, NotFoundPage } from '@/components/app/page'
import { isEmpty } from '@/lib/format'
import { MODULE_TABS } from '@/lib/market'

/** Title, header actions and the Products / Instruments / Calendars tabs (use inside `.detail-page`). */
export function ModuleHead({ active, actions, title = 'Instruments' }: { active: string; actions?: ReactNode; title?: string }) {
  return (
    <div className="detail-head">
      <header className="firm-head">
        <LargeTitle>{title}</LargeTitle>
        <div className="head-acts">{actions}</div>
      </header>
      <nav className="tabs" aria-label="Instrument sections">
        {MODULE_TABS.map(([key, label, href]) => <Link key={key} to={href} aria-current={key === active ? 'page' : undefined}>{label}</Link>)}
      </nav>
    </div>
  )
}

/** "Instrument not found" page: crumb, card, “Nothing has the ID …” and a Show All button. */
export function MarketNotFound({ title, id, href, label }: { title: string; id: string | null | undefined; href: string; label: string }) {
  return <NotFoundPage title={title} message={`Nothing has the ID “${id ?? ''}”.`} backTo={href} backLabel={label} allLabel={`Show All ${label}`} />
}

/** A label / value list; empty values show an em dash. */
export function InfoList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="info-list">
      {rows.map(([label, value], i) => (
        <div key={`${i}-${label}`}>
          <dt>{label}</dt>
          <dd>{isEmpty(value) ? <span className="row-value unset">—</span> : value}</dd>
        </div>
      ))}
    </dl>
  )
}

type WideSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Shows a primary button with this label. */
  primaryLabel?: string
  onPrimary?: () => void
  primaryDisabled?: boolean
  closeLabel?: string
  /** Screen-reader description; defaults to the title. */
  description?: string
  children: ReactNode
}

/** A wide modal sheet (the prototype's openWideSheet): title, Close (+ optional primary button) and a scrolling body. */
export function WideSheet({ open, onOpenChange, title, primaryLabel, onPrimary, primaryDisabled, closeLabel = 'Close', description, children }: WideSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sheet sheet-wide">
        <div className="sheet-form">
          <DialogHeader className="sheet-head">
            <DialogTitle>{title}</DialogTitle>
            <div className="dock-acts">
              <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>{closeLabel}</Button>
              {primaryLabel && <Button type="button" disabled={primaryDisabled} onClick={() => onPrimary?.()}>{primaryLabel}</Button>}
            </div>
          </DialogHeader>
          <DialogDescription className="sr-only">{description || title}</DialogDescription>
          <DialogBody className="sheet-body">{children}</DialogBody>
        </div>
      </DialogContent>
    </Dialog>
  )
}
