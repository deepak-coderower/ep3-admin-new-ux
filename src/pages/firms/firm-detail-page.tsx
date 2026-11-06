import { Navigate, useSearchParams } from 'react-router'
import { Pause, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Banner, NotFoundPage, useTitle } from '@/components/app/page'
import { SectionRail } from '@/components/app/section-rail'
import { ReadRow } from '@/components/form/field-row'
import { InfoTip } from '@/components/form/info-tip'
import { SECTIONS, TABS, type Firm } from '@/data/config'
import { toggleSuspend } from '@/lib/firm-actions'
import { firmById, hrefFor } from '@/lib/firms'
import { visible } from '@/lib/format'
import { useStore } from '@/lib/store'
import { CollectionTable } from '@/pages/firms/collection-table'
import { FirmHeader } from '@/pages/firms/firm-header'
import { AccountsTab, AssociationsTab, EntityTab, LimitsTab } from '@/pages/firms/firm-tabs'
import { FirmForm } from '@/pages/firms/firm-form'

export const sectionsFor = (f: Firm) => SECTIONS.filter(s => s.collection || (s.fields || []).some(x => visible(x, f)))

function FirmProfile({ f }: { f: Firm }) {
  const sections = sectionsFor(f)
  return (
    <div className="split">
      <SectionRail sections={sections} />
      <div className="sections">
        {sections.map(s => (
          <section className="section" id={`sec-${s.id}`} key={s.id}>
            {s.collection
              ? <CollectionTable collection={s.collection} rows={f[s.collection] || []} editable={false} heading />
              : (
                <>
                  <div className="section-head"><h2 className="section-title">{s.title}<InfoTip text={s.tip} /></h2></div>
                  <Card>{(s.fields || []).filter(x => visible(x, f)).map(x => <ReadRow key={x.k} field={x} values={f} />)}</Card>
                </>
              )}
          </section>
        ))}
      </div>
    </div>
  )
}

function TabBody({ f, tab }: { f: Firm; tab: string }) {
  switch (tab) {
    case 'users': return <EntityTab kind="users" f={f} />
    case 'services': return <EntityTab kind="services" f={f} />
    case 'accounts': return <AccountsTab f={f} />
    case 'position-limits': return <LimitsTab f={f} />
    case 'association': return <AssociationsTab key={f.id} f={f} />
    default: return <FirmProfile f={f} />
  }
}

function FirmDetail({ f, tabPath }: { f: Firm; tabPath: string }) {
  useTitle(f.name)
  const tabs = TABS.filter(t => t.when(f))
  const tab = tabs.find(t => t.path === tabPath) || tabs[0]
  return (
    <div className="detail-page">
      <FirmHeader f={f} tabPath={tab.path} editing={false} />
      <div className="detail-scroll">
        {f.deleted && <Banner tone="bad" icon={<Trash2 size={18} />}><span>This firm is deleted, so its details are read-only.</span></Banner>}
        {f.state === 'suspended' && !f.deleted && (
          <Banner tone="warn" icon={<Pause size={18} />}>
            <span>This firm is suspended.</span>
            <Button variant="tint" size="sm" onClick={() => toggleSuspend(f.id)}>Activate Firm</Button>
          </Banner>
        )}
        <TabBody key={tab.path} f={f} tab={tab.path} />
      </div>
    </div>
  )
}

const firmNotFound = (id: string | null) => (
  <NotFoundPage title="Firm not found" message={`No firm has the ID “${id ?? ''}”.`} backTo="/firms" backLabel="Firms" allLabel="Show All Firms" />
)

/** /firm?id=…&tab=… */
export function FirmDetailPage() {
  useStore()
  const [params] = useSearchParams()
  const id = params.get('id')
  const f = firmById(id)
  if (!f) return firmNotFound(id)
  return <FirmDetail f={f} tabPath={params.get('tab') || ''} />
}

/** /firm-edit?id=… */
export function FirmEditPage() {
  useStore()
  const [params] = useSearchParams()
  const id = params.get('id')
  const f = firmById(id)
  if (!f) return firmNotFound(id)
  if (f.deleted) return <Navigate to={hrefFor(f.id)} replace />
  return <FirmForm key={f.id} mode="edit" source={f} />
}

/** /firm-new?type=… */
export function FirmNewPage() {
  const [params] = useSearchParams()
  const type = params.get('type')
  return <FirmForm key={type || ''} mode="create" presetType={type} />
}
