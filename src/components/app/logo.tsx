import { useId } from 'react'

export function Ep3Logo({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const disc = `ep3-disc-${uid}`
  const clip = `ep3-clip-${uid}`
  const p = 'M82 50h21c12 0 19 7.500 19 17 0 10-7 17-19 17H93v14H82zm11 10v14h9c6 0 9-3 9-7s-3-7-9-7z'
  return (
    <svg className={className} viewBox="30 24 164 96" role="img" aria-label="EP3">
      <defs>
        <linearGradient id={disc} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2B9BD8" />
          <stop offset="1" stopColor="#123A93" />
        </linearGradient>
        <clipPath id={clip}><circle cx="146" cy="72" r="44" /></clipPath>
      </defs>
      <path fill="#8BC53F" d="M34 50h36v10H45v9h22v9.500H45V88h26v10H34z" />
      <path fill="#8BC53F" fillRule="evenodd" d={p} />
      <circle cx="146" cy="72" r="44" fill={`url(#${disc})`} />
      <path clipPath={`url(#${clip})`} fill="#fff" fillRule="evenodd" d={p} />
      <path fill="none" stroke="#fff" strokeWidth="10" d="M132 55h28l-15 15c13-1 18 7 18 12 0 9-8 14-17 14-7 0-13-2-17-7" />
    </svg>
  )
}
