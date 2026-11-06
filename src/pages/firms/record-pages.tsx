import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { KeyRound, Pencil } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Crumb, LargeTitle, NotFoundPage, PageHead, useTitle } from '@/components/app/page'
import { FieldRow, ReadRow } from '@/components/form/field-row'
import { FormDock } from '@/components/form/form-dock'
import { ENTITIES, type Firm } from '@/data/config'
import { clone, isEmpty, setPath, wait } from '@/lib/format'
import { createForm, focusFirstError, isDirty, requiredMessage, useForm, useSaveShortcut, useUnsavedGuard } from '@/lib/form'
import { entityBase, entityHref, entityRows, firmById, hrefFor, persist, serviceOf } from '@/lib/firms'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { deleteEntity, EntityTable, EntityToolbar } from '@/pages/firms/entity-table'

const backLabelFor = (kind: string, f: Firm, sid: string | null) => (kind === 'keys' ? `${sid} API Keys` : `${f.name} · ${ENTITIES[kind].plural}`)

function EntityView({ kind, f, sid, rec }: { kind: string; f: Firm; sid: string | null; rec: any }) {
  const navigate = useNavigate()
  const e = ENTITIES[kind]
  const name = e.title(rec)
  useTitle(name)
  const fields = e.fields(f, sid)
  return (
    <div className="page">
      <Crumb to={entityBase(kind, f, sid)}>{backLabelFor(kind, f, sid)}</Crumb>
      <PageHead title={<div className="firm-title"><LargeTitle>{name}</LargeTitle>{rec.state && <StatusBadge value={rec.state} />}</div>}>
        {!f.deleted && (
          <div className="head-acts">
            {kind === 'services' && <Button variant="secondary" asChild><Link to={entityHref(kind, f, sid, rec.id, 'keys')}><KeyRound size={17} />API Keys</Link></Button>}
            <Button variant="secondary" onClick={() => deleteEntity(kind, f, sid, rec.id, navigate)}>Delete</Button>
            <Button asChild><Link to={entityHref(kind, f, sid, rec.id, 'edit')}><Pencil size={17} />Edit {e.one}</Link></Button>
          </div>
        )}
      </PageHead>
      <Card>
        {fields.map(x => <ReadRow key={x.k} field={x} values={rec} />)}
        {kind === 'keys' && <ReadRow field={{ k: 'jti', label: 'Token ID', mono: true }} values={rec} />}
      </Card>
    </div>
  )
}

function EntityForm({ kind, f, sid, rec }: { kind: string; f: Firm; sid: string | null; rec: any | null }) {
  const navigate = useNavigate()
  const e = ENTITIES[kind]
  const fields = e.fields(f, sid)
  const [form, refresh] = useForm(() => createForm(rec ? 'edit' : 'create',
    rec ? clone(rec) : Object.fromEntries([['id', ''], ...fields.filter(x => x.def !== undefined).map(x => [x.k, x.def])]),
    { idTouched: true }))
  useUnsavedGuard(form)
  const creating = form.mode === 'create'
  const backHref = rec ? entityHref(kind, f, sid, rec.id) : entityBase(kind, f, sid)
  const backLabel = rec ? e.title(rec) : backLabelFor(kind, f, sid)
  useTitle(rec ? `Edit ${e.title(rec)}` : `New ${e.one}`)

  const validate = () => {
    const errors: Record<string, string> = {}
    fields.forEach(x => {
      const v = form.draft[x.k]
      if (x.req && !String(v ?? '').trim()) errors[x.k] = requiredMessage(x)
      if (x.inputType === 'number' && !isEmpty(v) && !(Number(v) >= 0)) errors[x.k] = `${x.label} must be 0 or more.`
    })
    if (creating && !errors.id && entityRows(kind, f, sid).some(r => r.id === String(form.draft.id).trim())) {
      errors.id = `Another ${e.one.toLowerCase()} already uses this ID. Enter a different one.`
    }
    return errors
  }

  const onChange = (k: string, value: any) => {
    setPath(form.draft, k, value)
    if (form.errors[k]) {
      const next = validate()
      if (next[k]) form.errors[k] = next[k]
      else delete form.errors[k]
    }
    refresh()
  }

  const onBlur = (k: string) => {
    if (k !== 'id') return
    const next = validate()
    if (next[k] && form.draft[k]) form.errors[k] = next[k]
    else delete form.errors[k]
    refresh()
  }

  const submit = async () => {
    if (form.saving || (!creating && !isDirty(form))) return
    const draft = form.draft
    if (creating) draft.id = String(draft.id || '').trim()
    form.errors = validate()
    if (Object.keys(form.errors).length) {
      refresh()
      focusFirstError(form.errors)
      return
    }
    form.saving = true
    refresh()
    await wait(350)
    const rows = entityRows(kind, f, sid)
    const saved = clone(draft)
    if (kind === 'keys' && creating) saved.jti = `${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}`
    if (creating) rows.push(saved)
    else rows[rows.findIndex(r => r.id === form.original.id)] = saved
    persist()
    form.done = true
    navigate(entityHref(kind, f, sid, saved.id))
    toast(creating ? `Created ${e.title(saved)}.` : `Saved changes to ${e.title(saved)}.`)
  }
  useSaveShortcut(submit)

  const onSubmit = (ev: FormEvent) => { ev.preventDefault(); submit() }
  return (
    <div className="page form-page">
      <Crumb to={backHref}>{backLabel}</Crumb>
      <PageHead title={rec ? `Edit ${e.one}` : (kind === 'keys' ? 'Create API Key' : `New ${e.one}`)} />
      <form id="firmForm" noValidate onSubmit={onSubmit}>
        <div className="form-stack">
          <Card className="form-card">
            <div className="form-grid form-list">
              {fields.map(x => (x.kind === 'static' || (!creating && x.createOnly)
                ? <ReadRow key={x.k} field={x} values={form.draft} />
                : <FieldRow key={x.k} field={x} values={form.draft} errors={form.errors} onChange={onChange} onBlur={onBlur} />))}
            </div>
          </Card>
        </div>
        <FormDock form={form} saveLabel={rec ? 'Save Changes' : `Create ${e.one}`} backHref={backHref} />
      </form>
    </div>
  )
}

const notFound = (id: string | null) => (
  <NotFoundPage title="Firm not found" message={`No firm has the ID “${id ?? ''}”.`} backTo="/firms" backLabel="Firms" allLabel="Show All Firms" />
)

/** /user, /account, /service, /api-key — view, ?mode=edit or ?mode=new. */
export function RecordPage({ kind }: { kind: 'users' | 'accounts' | 'services' | 'keys' }) {
  useStore()
  const [params] = useSearchParams()
  const firmId = params.get('firm') || params.get('id')
  const f = firmById(params.get('firm'))
  if (!f) return notFound(firmId)
  const sid = kind === 'keys' ? params.get('service') : null
  if (kind === 'keys' && !serviceOf(f, sid)) return notFound(sid)
  const mode = params.get('mode')
  if (f.deleted && (mode === 'new' || mode === 'edit')) return <Navigate to={entityBase(kind, f, sid)} replace />
  if (mode === 'new') return <EntityForm key={`new-${kind}`} kind={kind} f={f} sid={sid} rec={null} />
  const id = params.get('id')
  const rec = entityRows(kind, f, sid).find(r => r.id === id)
  if (!rec) return notFound(id)
  if (mode === 'edit') return <EntityForm key={`edit-${rec.id}`} kind={kind} f={f} sid={sid} rec={rec} />
  return <EntityView kind={kind} f={f} sid={sid} rec={rec} />
}

/** /api-keys?firm=…&service=… */
export function ApiKeysPage() {
  useStore()
  const [params] = useSearchParams()
  const f = firmById(params.get('firm'))
  const sid = params.get('service')
  const title = `${sid} API Keys`
  useTitle(title)
  if (!f) return notFound(params.get('firm'))
  if (!serviceOf(f, sid)) return notFound(sid)
  return (
    <div className="page">
      <Crumb to={hrefFor(f.id, 'services')}>{f.name} · Firm Services</Crumb>
      <PageHead title={title} />
      <EntityToolbar kind="keys" f={f} sid={sid} editable={!f.deleted} />
      <EntityTable kind="keys" f={f} sid={sid} editable={!f.deleted} />
    </div>
  )
}
