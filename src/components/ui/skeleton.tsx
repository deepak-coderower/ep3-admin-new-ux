import * as React from 'react'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="skeleton" className={cn('skeleton', className)} {...props} />
}

export { Skeleton }
