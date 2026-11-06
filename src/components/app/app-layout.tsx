import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Menu } from 'lucide-react'
import { AppSidebar } from '@/components/app/app-sidebar'
import { Ep3Logo } from '@/components/app/logo'
import { isSignedIn } from '@/lib/session'
import { cn } from '@/lib/utils'

/** Signed-in shell: icon rail and the scrolling main view. */
export function AppLayout() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Each page starts at the top with its title focused, and the expanded menu closes.
  useEffect(() => {
    setOpen(false)
    if (mainRef.current) mainRef.current.scrollTop = 0
    const title = document.querySelector<HTMLElement>('.large-title')
    title?.focus({ preventScroll: true })
  }, [location.pathname, location.search])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!isSignedIn()) return <Navigate to="/" replace />

  return (
    <div className={cn('app', open && 'side-open')}>
      <div className="topbar">
        <button type="button" className="side-toggle" aria-label="Show Navigation" onClick={() => setOpen(true)}><Menu size={26} /></button>
        <Ep3Logo className="logo" />
      </div>
      <div className="scrim" onClick={() => setOpen(false)} />
      <AppSidebar open={open} onToggle={() => setOpen(o => !o)} onNavigate={() => setOpen(false)} />
      <main className="main" id="view" ref={mainRef}>
        <Outlet />
      </main>
    </div>
  )
}
