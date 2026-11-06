import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  BadgeCheck, Bell, Building2, CalendarClock, Check, CircleDollarSign, Component, CreditCard, ListIcon,
  LogOut, Menu, Moon, Search, Shield, SquareTerminal, Sun, UsersRound, X, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

/** Light / Dark pill switch with a sliding thumb; stacks vertically inside the collapsed rail. */
function ThemeSwitch({ vertical }: { vertical: boolean }) {
  const { pref, setPref } = useTheme()
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Appearance" data-orientation={vertical ? 'vertical' : 'horizontal'} data-value={pref}>
      <span className="theme-switch-thumb" aria-hidden="true" />
      {THEMES.map(([value, label, Icon]) => (
        <RailTip key={value} label={label} show={vertical}>
          <button type="button" role="radio" aria-checked={pref === value} aria-label={label} className="theme-switch-item" data-theme-value={value} onClick={() => setPref(value)}>
            <Icon size={16} strokeWidth={2.2} />
            {!vertical && <span>{label}</span>}
          </button>
        </RailTip>
      ))}
    </div>
  )
}

/** In the collapsed rail every control gets a tooltip with its name, shown to the right. */
function RailTip({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  if (!show) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Icon rail (64px). The menu button expands it over the page with labels;
 * on phones it slides in as a drawer.
 */
export function AppSidebar({ open, onToggle, onNavigate }: { open: boolean; onToggle: () => void; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [license, setLicense] = useState(false)
  const currentNav = MARKET_PATHS.includes(pathname) ? '/instruments' : '/firms'
  const rail = !open
  const toggleLabel = open ? 'Collapse Navigation' : 'Expand Navigation'

  return (
    <nav className="sidebar" id="sidebar" aria-label="Main" data-open={open || undefined}>
      <div className="side-head">
        <button type="button" className="side-toggle" aria-label={toggleLabel} title={toggleLabel} aria-expanded={open} onClick={onToggle}>
          {open ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>
      <Link className="side-brand" to="/firms" onClick={onNavigate} aria-label="EP3 Admin home">
        <Ep3Logo className="logo" />
        <span className="brand-name">EP3 Admin</span>
      </Link>

      <div className="side-scroll">
        {NAV.map(g => (
          <div className="side-group" key={g.label}>
            <div className="side-label">{g.label}</div>
            {g.items.map(([label, ic, href, act]) => {
              const Icon = NAV_ICONS[ic]
              const content = (
                <>
                  <Icon className="nav-icon" />
                  <span className="nav-text">
                    {label}
                    {act === 'license' && <small className="nav-sub">Expires {licenseExpiry(APP_INFO.expires)}</small>}
                  </span>
                </>
              )
              return (
                <RailTip key={label} label={label} show={rail}>
                  {href
                    ? <Link className="nav-item" to={href} aria-current={href === currentNav ? 'page' : undefined} aria-label={rail ? label : undefined} onClick={onNavigate}>{content}</Link>
                    : (
                      <button
                        className="nav-item"
                        type="button"
                        aria-label={rail ? label : undefined}
                        onClick={() => (act === 'license' ? setLicense(true) : toast(`${label} isn’t part of this prototype.`, { info: true }))}
                      >
                        {content}
                      </button>
                    )}
                </RailTip>
              )
            })}
          </div>
        ))}
      </div>

      <div className="side-foot">
        <ThemeSwitch vertical={rail} />

        <RailTip label={`${APP_INFO.appVersion} · ${APP_INFO.client}`} show={rail}>
          <div className="side-info" tabIndex={rail ? 0 : undefined}>
            {open
              ? (
                <>
                  <span><span className="side-info-key">Version:</span> <span className="side-info-value mono">{APP_INFO.appVersion}</span></span>
                  <span><span className="side-info-key">Env:</span> <span className="side-info-value">{APP_INFO.client}</span></span>
                </>
              )
              : (
                <>
                  <span className="side-info-value">{APP_INFO.appVersion.split('-')[0]}</span>
                  <span className="side-info-value">admin</span>
                </>
              )}
          </div>
        </RailTip>

        <RailTip label="Log Off" show={rail}>
          <button className="nav-item btn-logoff" type="button" aria-label={rail ? 'Log Off' : undefined} onClick={() => { signOut(); navigate('/') }}>
            <LogOut className="nav-icon" /><span className="nav-text">Log Off</span>
          </button>
        </RailTip>
      </div>
      <LicenseDialog open={license} onOpenChange={setLicense} />
    </nav>
  )
}
