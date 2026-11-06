import { Link, useNavigate } from 'react-router'
import { Copy, Pencil, RotateCcw } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ActionMenu } from '@/components/app/action-menu'
import { Crumb, LargeTitle } from '@/components/app/page'
import { TABS, TYPES, type Firm } from '@/data/config'
import { cancelOrders, firmMenuItems, restoreFirm } from '@/lib/firm-actions'
import { hrefFor } from '@/lib/firms'
import { toast } from '@/lib/toast'
import { firmStateLabel } from '@/pages/firms/firms-list-page'

async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    toast('Copied Firm ID.')
  } catch {
    toast('Couldn’t copy. Select the ID and copy it manually.', { info: true })
  }
}

/** Crumb, title, state, actions and tab bar shared by the firm detail and edit pages. */
export function FirmHeader({ f, tabPath, editing }: { f: Firm; tabPath: string; editing: boolean }) {
  const navigate = useNavigate()
  const tabs = TABS.filter(t => t.when(f))
  return (
    <div className="detail-head">
      <Crumb to="/firms">Firms</Crumb>
      <header className="firm-head">
        <div>
          <div className="firm-title">
            <LargeTitle>{f.name}</LargeTitle>
            <StatusBadge value={firmStateLabel(f)} />
          </div>
          <div className="firm-meta">
            <span>{TYPES[f.type].label}</span>
            <button className="copy mono" type="button" aria-label={`Copy Firm ID ${f.id}`} title="Copy Firm ID" onClick={() => copyId(f.id)}>
              {f.id}<Copy size={14} />
            </button>
          </div>
        </div>
        <div className="head-acts">
          {f.deleted
            ? <Button onClick={() => restoreFirm(f.id)}><RotateCcw size={17} />Restore Firm</Button>
            : (
              <>
                <Button variant="secondary" onClick={() => cancelOrders(f.id)}>Cancel All Orders</Button>
                {!editing && (
                  <>
                    <Button asChild><Link to={hrefFor(f.id, 'edit')}><Pencil size={17} />Edit Firm</Link></Button>
                    <ActionMenu variant="secondary" label="More actions" items={firmMenuItems(f, true, navigate)} />
                  </>
                )}
              </>
            )}
        </div>
      </header>
      {tabs.length > 1 && (
        <nav className="tabs" aria-label="Firm sections">
          {tabs.map(x => <Link key={x.path} to={hrefFor(f.id, x.path)} aria-current={x.path === tabPath ? 'page' : undefined}>{x.label}</Link>)}
        </nav>
      )}
    </div>
  )
}
