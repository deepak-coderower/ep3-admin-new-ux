import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * The (?) help icon next to a label or section title. A span rather than a button
 * so it can sit inside other buttons (e.g. a collapsible section header).
 */
export function InfoTip({ text }: { text?: string }) {
  if (!text) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="info-tip"
          role="img"
          tabIndex={0}
          aria-label={text}
          onClick={e => { e.preventDefault(); e.stopPropagation() }}
        >
          <CircleHelp size={15} />
        </span>
      </TooltipTrigger>
      <TooltipContent className="tooltip-wide">{text}</TooltipContent>
    </Tooltip>
  )
}
