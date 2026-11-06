import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Sets document.title as "<title> · EP3 Admin". */
export function useTitle(title: string) {
  useEffect(() => { document.title = `${title} · EP3 Admin` }, [title])
}

export function Crumb({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="crumb" to={to}><ChevronLeft size={17} />{children}</Link>
}

export function LargeTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn('large-title', className)} tabIndex={-1}>{children}</h1>
}

export function PageHead({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header className={cn('page-head', className)}>
      {typeof title === 'string' ? <LargeTitle>{title}</LargeTitle> : title}
      {children}
    </header>
  )
}

export function EmptyState({ title, text, children, small, className }: { title?: string; text?: string; children?: ReactNode; small?: boolean; className?: string }) {
  return (
    <div className={cn('empty', small && 'small', className)}>
      {title && <h3>{title}</h3>}
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

/** Inline banner: tone bad / warn / info. */
export function Banner({ tone, icon, children }: { tone: 'bad' | 'warn' | 'info'; icon?: ReactNode; children: ReactNode }) {
  return <div className="banner" data-tone={tone}>{icon}{children}</div>
}

export function NotFoundPage({ title, message, backTo, backLabel, allLabel }: { title: string; message: string; backTo: string; backLabel: string; allLabel: string }) {
  useTitle(title)
  return (
    <div className="page">
      <Crumb to={backTo}>{backLabel}</Crumb>
      <Card className="empty">
        <LargeTitle>{title}</LargeTitle>
        <p>{message}</p>
        <Button variant="tint" asChild><Link to={backTo}>{allLabel}</Link></Button>
      </Card>
    </div>
  )
}
