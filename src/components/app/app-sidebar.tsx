import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  BadgeCheck, Bell, Building2, CalendarClock, Check, CircleDollarSign, Component, CreditCard, ListIcon,
  LogOut, Moon, PanelLeft, Search, Shield, SquareTerminal, Sun, UsersRound, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Ep3Logo } from '@/components/app/logo'
import { APP_INFO, MARKET_PATHS, NAV } from '@/data/config'
import { signOut } from '@/lib/session'
import { useTheme, type ThemePref } from '@/lib/theme'
import { toast } from '@/lib/toast'

const NAV_ICONS: Record<string, LucideIcon> = {
  building: Building2, users: UsersRound, card: CreditCard, group: Component, list: ListIcon, calendar: CalendarClock,
  search: Search, quote: CircleDollarSign, check: Check, terminal: SquareTerminal, bell: Bell, shield: Shield, seal: BadgeCheck,
}

const THEMES: [ThemePref, string, LucideIcon][] = [['light', 'Light', Sun], ['dark', 'Dark', Moon]]

export function licenseExpiry(raw: string) {
  const parts = String(raw).match(/^(\d{4})(\d{2})(\d{2})/)
  if (!parts) return raw
  const date = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])))
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function LicenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="alert-dialog">
        <div className="alert-dialog-header">
          <div className="alert-glyph"><BadgeCheck size={22} /></div>
          <DialogTitle>License</DialogTitle>
          <DialogDescription>{APP_INFO.client}</DialogDescription>
          <dl className="info-list">
            <div><dt>App Version</dt><dd className="mono">{APP_INFO.appVersion}</dd></div>
            <div><dt>Version</dt><dd>{APP_INFO.licenseVersion}</dd></div>
            <div><dt>Expires On</dt><dd>{licenseExpiry(APP_INFO.expires)}</dd></div>
          </dl>
        </div>
        <div className="alert-dialog-footer single">
          <Button autoFocus onClick={() => onOpenChange(false)}>OK</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AppSidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { pref, setPref } = useTheme()
  const [license, setLicense] = useState(false)
  const currentNav = MARKET_PATHS.includes(pathname) ? '/instruments' : '/firms'
  const toggleLabel = `${collapsed ? 'Expand' : 'Collapse'} Navigation`

  return (
    <nav className="sidebar" id="sidebar" aria-label="Main">
      <div className="side-head">
        <div className="brand">
          <Ep3Logo className="logo" />
          <div className="brand-text"><strong>Admin</strong><span>Connamara</span></div>
        </div>
        <Button variant="ghost" size="icon" className="side-toggle" aria-label={toggleLabel} title={toggleLabel} onClick={onToggle}>
          <PanelLeft size={18} />
        </Button>
      </div>
      <div className="side-scroll">
        {NAV.map(g => (
          <div className="side-group" key={g.label}>
            <div className="side-label">{g.label}</div>
            {g.items.map(([label, ic, href, act]) => {
              const Icon = NAV_ICONS[ic]
              if (href) {
                return (
                  <Link key={label} className="nav-item" to={href} aria-current={href === currentNav ? 'page' : undefined} title={label} onClick={onNavigate}>
                    <Icon size={18} /><span className="nav-text">{label}</span>
                  </Link>
                )
              }
              return (
                <button
                  key={label}
                  className="nav-item"
                  type="button"
                  title={label}
                  onClick={() => (act === 'license' ? setLicense(true) : toast(`${label} isn’t part of this prototype.`, { info: true }))}
                >
                  <Icon size={18} />
                  <span className="nav-text">
                    {label}
                    {act === 'license' && <small className="nav-sub">Expires {licenseExpiry(APP_INFO.expires)}</small>}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="side-foot">
        <div className="appearance">
          <div className="side-label" id="appearanceLabel">Appearance</div>
          <ToggleGroup type="single" className="theme-seg" aria-labelledby="appearanceLabel" value={pref} onValueChange={v => v && setPref(v as ThemePref)}>
            {THEMES.map(([value, label, Icon]) => (
              <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
                <Icon size={16} /><span>{label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <button className="btn-logoff" type="button" title="Log Off" onClick={() => { signOut(); navigate('/') }}>
          <LogOut size={18} /><span className="nav-text">Log Off</span>
        </button>
        <div className="side-info">
          <span>{APP_INFO.client}</span>
          <span className="mono">{APP_INFO.appVersion}</span>
        </div>
      </div>
      <LicenseDialog open={license} onOpenChange={setLicense} />
    </nav>
  )
}
