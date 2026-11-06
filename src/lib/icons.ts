import {
  BadgeCheck, Bell, Building2, CalendarCheck, Check, CircleDollarSign, CreditCard, Octagon, Pause, Play,
  ListIcon, RotateCcw, Search, Shield, SquareTerminal, Trash2, TriangleAlert, UsersRound, CircleDot, X, type LucideIcon,
} from 'lucide-react'

/** Maps the prototype's sprite icon names to lucide icons. */
export const ICONS: Record<string, LucideIcon> = {
  building: Building2,
  users: UsersRound,
  card: CreditCard,
  group: CircleDot,
  list: ListIcon,
  calendar: CalendarCheck,
  search: Search,
  quote: CircleDollarSign,
  check: Check,
  terminal: SquareTerminal,
  bell: Bell,
  shield: Shield,
  seal: BadgeCheck,
  trash: Trash2,
  restore: RotateCcw,
  pause: Pause,
  play: Play,
  stop: Octagon,
  warn: TriangleAlert,
  x: X,
}
