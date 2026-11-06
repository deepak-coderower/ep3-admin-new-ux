import type { ReactNode } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export type MenuAction = {
  label: string
  icon: LucideIcon
  run: () => void
  danger?: boolean
  disabled?: boolean
  /** Why the item is disabled (shown as a tooltip). */
  reason?: string
}
export type MenuEntry = MenuAction | '-'

/** "⋯" button that opens a dropdown of actions. */
export function ActionMenu({ items, label, variant = 'ghost', size = 'icon' }: { items: MenuEntry[]; label: string; variant?: 'ghost' | 'secondary'; size?: 'icon' | 'icon-sm' }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} aria-label={label} title="More"><MoreHorizontal size={18} /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map((it, i) => (it === '-'
          ? <DropdownMenuSeparator key={i} />
          : (
            <DropdownMenuItem key={it.label} variant={it.danger ? 'destructive' : 'default'} disabled={it.disabled} title={it.disabled ? it.reason : undefined} onSelect={() => it.run()}>
              <it.icon size={17} /><span>{it.label}</span>
            </DropdownMenuItem>
          )))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Right-click menu around a table row. */
export function RowContextMenu({ items, children }: { items: MenuEntry[]; children: ReactNode }) {
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((it, i) => (it === '-'
          ? <ContextMenuSeparator key={i} />
          : (
            <ContextMenuItem key={it.label} variant={it.danger ? 'destructive' : 'default'} disabled={it.disabled} title={it.disabled ? it.reason : undefined} onSelect={() => it.run()}>
              <it.icon size={17} /><span>{it.label}</span>
            </ContextMenuItem>
          )))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
