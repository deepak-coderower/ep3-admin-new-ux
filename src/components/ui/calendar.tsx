import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function Calendar({ className, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      data-slot="calendar"
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      className={cn('calendar', className)}
      classNames={{
        months: 'calendar-months',
        month: 'calendar-month',
        nav: 'calendar-nav',
        button_previous: 'btn btn-ghost btn-icon-sm calendar-nav-btn',
        button_next: 'btn btn-ghost btn-icon-sm calendar-nav-btn',
        month_caption: 'calendar-caption',
        dropdowns: 'calendar-dropdowns',
        dropdown_root: 'calendar-dropdown-root',
        dropdown: 'calendar-dropdown',
        caption_label: 'calendar-caption-label',
        month_grid: 'calendar-grid',
        weekdays: 'calendar-weekdays',
        weekday: 'calendar-weekday',
        week: 'calendar-week',
        day: 'calendar-day',
        day_button: 'calendar-day-button',
        selected: 'is-selected',
        today: 'is-today',
        outside: 'is-outside',
        disabled: 'is-disabled',
        hidden: 'is-hidden',
      }}
      components={{
        Chevron: ({ orientation }) => (orientation === 'left' ? <ChevronLeftIcon size={16} /> : <ChevronRightIcon size={16} />),
      }}
      {...props}
    />
  )
}

export { Calendar }
