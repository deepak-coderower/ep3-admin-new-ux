import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ChevronUp, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Crumb, LargeTitle, PageHead, useTitle } from '@/components/app/page'
import { FieldRow, ReadRow } from '@/components/form/field-row'
import { FormDock } from '@/components/form/form-dock'
import { InfoTip } from '@/components/form/info-tip'
import { COLLECTIONS, SECTIONS, TYPES, isParticipant, type Field, type Firm } from '@/data/config'
import { makeFirm } from '@/data/seed'
import { clone, setPath, slug, visible, wait } from '@/lib/format'
import { createForm, focusFirstError, isDirty, useForm, useSaveShortcut, useUnsavedGuard, type FormModel } from '@/lib/form'
import { firmById, firms, hrefFor, persist } from '@/lib/firms'
import { toast } from '@/lib/toast'
import { CollectionTable } from '@/pages/firms/collection-table'
import { FirmHeader } from '@/pages/firms/firm-header'

const FIRM_FORM_ORDER = [
  'name', 'id', 'type', 'state',
  'applyCommissionsAsSpread', 'skipCommissionBalanceAdjustment', 'skipRiskAndCurrencyChecks', 'hasSponsoredDirectMarketAccess', 'isDisintermediated',
  'participantType', 'organizationType', 'legalEntityIdentifier', 'legalName', 'businessContactName', 'email', 'phoneNumber',
  'usTaxpayerIdentificationNumber', 'designatedSelfRegulatoryOrganization', 'designatedExaminingAuthority',
  'mainAddress1', 'mainAddress2', 'mainAddressCity', 'mainAddressState', 'mainAddressPostalCode', 'mainAddressCountryCode',
]

const firmFieldByKey = (key: string) => SECTIONS.flatMap(s => s.fields || []).find(x => x.k === key) as Field

/** Accepts ?type=clearingMember, ?type=clearing-member, ?type=Clearing%20Member … */
export function decodeTypeParam(value: string | null) {
  const clean = String(value || '').toLowerCase().replace(/[^a-z]/g, '')
  return Object.keys(TYPES).find(k => k.toLowerCase() === clean) || null
}

export function validateFirm(f: Firm, mode: 'create' | 'edit') {
  const e: Record<string, string> = {}
  if (mode === 'create' && !f.type) e.type = 'Choose a firm type.'
  if (!String(f.name || '').trim()) e.name = 'Enter a firm name.'
  if (mode === 'create') {
    if (!String(f.id || '').trim()) e.id = 'Enter a firm ID.'
    else if (firmById(f.id.trim())) e.id = 'Another firm already uses this ID. Enter a different one.'
  }
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter an email address like name@example.com.'
  return e
}

function FormCollapse({ form, sectionId, title, collection, refresh }: { form: FormModel; sectionId: string; title: string; collection: string; refresh: () => void }) {
  const rows: any[] = form.draft[collection] || []
  return (
    <Collapsible
      className="card form-collapse"
      open={form.open.has(sectionId)}
      onOpenChange={open => { if (open) form.open.add(sectionId); else form.open.delete(sectionId); refresh() }}
    >
      <CollapsibleTrigger className="form-collapse-trigger">
        <span className="section-title">{title}<InfoTip text={COLLECTIONS[collection].tip} /></span>
        <span className="form-collapse-meta">{rows.length ? <span className="count">{rows.length}</span> : null}<ChevronUp size={17} className="chevron" /></span>
      </CollapsibleTrigger>
      <CollapsibleContent className="form-collapse-body">
        <CollectionTable collection={collection} rows={rows} editable owner={{ target: form.draft, inForm: true, onDraftChange: refresh }} />
      </CollapsibleContent>
    </Collapsible>
  )
}

type Props = { mode: 'create' | 'edit'; source?: Firm; presetType?: string | null }

export function FirmForm({ mode, source, presetType: rawType }: Props) {
  const navigate = useNavigate()
  const preset = mode === 'create' ? decodeTypeParam(rawType ?? null) : null
  const [form, refresh] = useForm(() => createForm(mode, mode === 'create'
    ? makeFirm('', preset || '', { id: '' })
    : clone(source as Firm), { presetType: preset }))
  useUnsavedGuard(form)
  const creating = form.mode === 'create'
  const f = form.draft as Firm
  useTitle(creating ? 'New Firm' : `Edit ${form.original.name}`)

  const revalidate = (k: string) => {
    const next = validateFirm(form.draft, form.mode)
    if (next[k]) form.errors[k] = next[k]
    else delete form.errors[k]
  }

  const onChange = (k: string, value: any) => {
    setPath(form.draft, k, value)
    if (k === 'id') form.idTouched = true
    if (k === 'name' && creating && !form.idTouched) {
      form.draft.id = slug(value)
      delete form.errors.id
    }
    if (k === 'type') delete form.errors.type
    else if (form.errors[k]) revalidate(k)
    refresh()
  }

  const onBlur = (k: string) => {
    if (k !== 'email' && k !== 'id') return
    const next = validateFirm(form.draft, form.mode)
    if (next[k] && form.draft[k]) form.errors[k] = next[k]
    else delete form.errors[k]
    refresh()
  }

  const submit = async () => {
    if (form.saving) return
    if (!creating && !isDirty(form)) return
    if (typeof f.name === 'string') f.name = f.name.trim()
    if (creating) f.id = String(f.id || '').trim()
    form.errors = validateFirm(f, form.mode)
    if (Object.keys(form.errors).length) {
      refresh()
      focusFirstError(form.errors)
      return
    }
    form.saving = true
    refresh()
    await wait(450)
    const saved = clone(f)
    const list = firms()
    if (creating) list.unshift(saved)
    else list[list.indexOf(firmById(form.original.id) as Firm)] = saved
    persist()
    form.done = true
    navigate(hrefFor(saved.id))
    toast(creating ? `Created ${saved.name}.` : `Saved changes to ${saved.name}.`)
  }
  useSaveShortcut(submit)

  const rowFor = (x: Field) => {
    if (x.kind === 'static' || (!creating && x.createOnly)) return <ReadRow key={x.k} field={x} values={f} />
    if (x.kind === 'type') {
      if (!creating || form.presetType) {
        return <div className="row" key={x.k}><span className="row-label">Firm Type</span><span className="row-value">{TYPES[f.type].label}</span></div>
      }
      return (
        <FieldRow
          key={x.k}
          field={{ ...x, kind: 'select', req: true, blank: 'Choose a type', options: Object.entries(TYPES).map(([value, t]) => ({ value, label: t.label })), help: 'Can’t be changed after the firm is created.' }}
          values={f} errors={form.errors} onChange={onChange}
        />
      )
    }
    const riskWarn = x.k === 'skipRiskAndCurrencyChecks' && form.original.skipRiskAndCurrencyChecks && !f.skipRiskAndCurrencyChecks
      ? <div className="row-warn" id="riskWarn"><TriangleAlert size={15} /><span>After turning risk checks back on, restart the Position Risk Server. Until then, Pre-Trade Risk checks for this firm may be incorrect.</span></div>
      : null
    return <FieldRow key={x.k} field={x} values={f} errors={form.errors} onChange={onChange} onBlur={onBlur} extra={riskWarn} />
  }

  const clearing = SECTIONS.find(s => s.id === 'clearing')!
  const body = (
    <>
      <Card className="form-card">
        <div className="form-grid form-list">
          {FIRM_FORM_ORDER.map(firmFieldByKey).filter(x => visible(x, f)).map(rowFor)}
          {isParticipant(f) && (
            <>
              <div className="form-subhead"><h2 className="section-title">{clearing.title}<InfoTip text={clearing.tip} /></h2></div>
              {(clearing.fields || []).map(rowFor)}
            </>
          )}
        </div>
      </Card>
      {SECTIONS.filter(s => s.collection).map(s => (
        <FormCollapse key={s.id} form={form} sectionId={s.id} title={s.title} collection={s.collection!} refresh={refresh} />
      ))}
    </>
  )

  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit() }
  const backHref = creating ? '/firms' : hrefFor(f.id)

  if (creating) {
    return (
      <div className="page form-page">
        <Crumb to={backHref}>Firms</Crumb>
        <PageHead title={<LargeTitle>{form.presetType ? `New ${TYPES[form.presetType].label}` : 'New Firm'}</LargeTitle>} />
        <form id="firmForm" noValidate onSubmit={onSubmit}>
          <div className="form-stack">{body}</div>
          <FormDock form={form} saveLabel="Create Firm" backHref={backHref} />
        </form>
      </div>
    )
  }
  const live = firmById(form.original.id) as Firm
  return (
    <div className="detail-page">
      <FirmHeader f={live} tabPath="" editing />
      <div className="detail-scroll detail-form">
        <form id="firmForm" noValidate onSubmit={onSubmit}>
          <div className="form-stack">{body}</div>
          <FormDock form={form} saveLabel="Save Changes" backHref={backHref} />
        </form>
      </div>
    </div>
  )
}
