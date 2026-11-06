import { useTitle, PageHead } from '@/components/app/page'

export function MarketPlaceholder() {
  useTitle('Instruments')
  return <div className="page"><PageHead title="Instruments" /></div>
}
