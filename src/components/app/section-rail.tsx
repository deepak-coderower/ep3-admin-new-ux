import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Sticky section navigation that highlights the section in view (scroll-spy)
 * inside the nearest `.detail-scroll` container.
 */
export function SectionRail({ sections }: { sections: { id: string; title: string }[] }) {
  const [current, setCurrent] = useState(sections[0] ? `sec-${sections[0].id}` : '')
  const lock = useRef(0)
  const ref = useRef<HTMLElement>(null)
  const key = sections.map(s => s.id).join('|')

  useEffect(() => {
    const scroller = ref.current?.closest('.detail-scroll') as HTMLElement | null
    if (!scroller) return
    const update = () => {
      if (Date.now() < lock.current) return
      const els = sections.map(s => document.getElementById(`sec-${s.id}`)).filter(Boolean) as HTMLElement[]
      if (!els.length) return
      const line = scroller.getBoundingClientRect().top + 60
      let on = els[0]
      els.forEach(s => { if (s.getBoundingClientRect().top <= line) on = s })
      if (scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) on = els[els.length - 1]
      setCurrent(on.id)
    }
    scroller.addEventListener('scroll', update, { passive: true })
    update()
    return () => scroller.removeEventListener('scroll', update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const jump = (id: string) => {
    lock.current = Date.now() + 800
    setCurrent(id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <aside className="rail" ref={ref}>
      <nav className="rail-nav" aria-label="Sections">
        {sections.map(s => (
          <button key={s.id} type="button" className={cn(current === `sec-${s.id}` && 'on')} onClick={() => jump(`sec-${s.id}`)}>{s.title}</button>
        ))}
      </nav>
    </aside>
  )
}
