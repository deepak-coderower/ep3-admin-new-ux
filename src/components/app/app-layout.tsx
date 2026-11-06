import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppSidebar } from '@/components/app/app-sidebar'
import { Ep3Logo } from '@/components/app/logo'
import { SIDE_KEY } from '@/data/config'
import { isSignedIn } from '@/lib/session'
import { storage } from '@/lib/storage'
import { cn } from '@/lib/utils'

/** Signed-in shell: sidebar, mobile top bar and the scrolling main view. */
export function AppLayout() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => storage.get(SIDE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [animating, setAnimating] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Each page starts at the top with its title focused, like the prototype's route().
  useEffect(() => {
    setMobileOpen(false)
    if (mainRef.current) mainRef.current.scrollTop = 0
    const title = document.querySelector<HTMLElement>('.large-title')
    title?.focus({ preventScroll: true })
  }, [location.pathname, location.search])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!isSignedIn()) return <Navigate to="/" replace />

  const toggle = () => {
    if (window.matchMedia('(max-width: 860px)').matches) { setMobileOpen(o => !o); return }
    setAnimating(true)
    setTimeout(() => setAnimating(false), 400)
    setCollapsed(c => {
      storage.set(SIDE_KEY, c ? '0' : '1')
      return !c
    })
  }

  return (
    <div className={cn('app', collapsed && 'side-min', mobileOpen && 'side-open', animating && 'side-anim')}>
      <div className="topbar">
        <Button variant="ghost" size="icon" aria-label="Show Navigation" onClick={() => setMobileOpen(true)}><PanelLeft size={18} /></Button>
        <Ep3Logo className="logo" />
      </div>
      <div className="scrim" onClick={() => setMobileOpen(false)} />
      <AppSidebar collapsed={collapsed} onToggle={toggle} onNavigate={() => setMobileOpen(false)} />
      <main className="main" id="view" ref={mainRef}>
        <Outlet />
      </main>
    </div>
  )
}
