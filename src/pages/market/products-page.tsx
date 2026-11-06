// Products list, product view and product form. Ported from products.js (+ product handlers in market-events.js).
import { useReducer, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pager, SortHead, pageSlice, sortedBy, toggleSort, type ListState } from '@/components/app/list-controls'
import { Crumb, EmptyState, LargeTitle, useTitle } from '@/components/app/page'
import { SectionRail } from '@/components/app/section-rail'
import { MarketFormPage, SectionsRead, createMarketForm, revealFormErrors, validateSections } from '@/components/market/market-form'
import { MarketNotFound, ModuleHead } from '@/components/market/module-head'
import { IT, LIMIT_GROUPS } from '@/data/market-config'
import { SYNC_GROUPS, productSections } from '@/data/market-sections'
import { blankMarketValues } from '@/data/market-seed'
import { ask } from '@/lib/dialogs'
import { isDirty, useForm, type FormModel } from '@/lib/form'
import { clone, wait } from '@/lib/format'
import { instNewHref, market, productById, productHref, saveMarket } from '@/lib/market'
import { readListState, saveListState } from '@/lib/storage'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'

// ---------- List ----------

const LIST_KEY = 'productList'
const newListState = (): ListState => ({ sort: 'id', dir: 1, page: 0, size: 10, ...readListState(LIST_KEY) })

/** The prototype sorts by the raw product property named by the sort key. */
const productSort = (state: ListState) => ({ [state.sort]: (p: any) => p[state.sort] })

function AddProductButton() {
  return <Button asChild><Link to="/product?mode=new"><Plus size={18} />Add New Product</Link></Button>
}

/** /products */
export function ProductsPage() {
  useTitle('Products')
  useStore()
  const navigate = useNavigate()
  const [list] = useState(newListState)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const refresh = () => { saveListState(LIST_KEY, list); bump() }
  const onSort = (key: string) => { toggleSort(list, key); refresh() }

  saveListState(LIST_KEY, list)
  const rows = sortedBy(list, market().products, productSort(list))
  const pageRows = pageSlice(list, rows)

  return (
    <div className="detail-page">
      <ModuleHead active="products" actions={<AddProductButton />} />
      <div className="detail-scroll">
        <Card id="productResults" aria-label="Products">
          {!rows.length ? (
            <EmptyState title="No products yet" text="Add a product to start creating instruments."><AddProductButton /></EmptyState>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead state={list} sortKey="id" label="Name ID" onSort={onSort} />
                    <SortHead state={list} sortKey="description" label="Product Description" className="hide-compact" onSort={onSort} />
                    <SortHead state={list} sortKey="clearingHouse" label="Clearing House" className="hide-compact" onSort={onSort} />
                    <TableHead className="acts"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map(p => {
                    const href = productHref(p.id)
                    return (
                      <TableRow
                        key={p.id}
                        className="row-link"
                        tabIndex={0}
                        onClick={e => { if (!(e.target as HTMLElement).closest('a, button, input, select')) navigate(href) }}
                        onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(href) }}
                      >
                        <TableCell>
                          <Link className="cell-strong mono" to={href}>{p.id}</Link>
                          <span className="cell-secondary show-compact">{p.description}</span>
                        </TableCell>
                        <TableCell className="hide-compact">{p.description}</TableCell>
                        <TableCell className="hide-compact">{p.clearingHouse}</TableCell>
                        <TableCell className="acts">
                          <Button variant="ghost" size="icon" asChild><Link to={href} aria-label={`View ${p.id}`} title="View"><Eye size={18} /></Link></Button>
                          <Button variant="ghost" size="icon" asChild><Link to={productHref(p.id, 'edit')} aria-label={`Edit ${p.id}`} title="Edit"><Pencil size={17} /></Link></Button>
                          <Button variant="ghost" size="icon" asChild><Link to={productHref(p.id, 'copy')} aria-label={`Copy ${p.id}`} title="Copy"><Copy size={17} /></Link></Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Pager state={list} total={rows.length} onChange={refresh} />
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

// ---------- View ----------

function ProductView({ p }: { p: any }) {
  useTitle(p.id)
  const sections = productSections(p)
  const children = market().instruments.filter(i => i.productId === p.id).length
  return (
    <div className="detail-page">
      <div className="detail-head detail-head-plain">
        <Crumb to="/products">Products</Crumb>
        <header className="firm-head">
          <div>
            <div className="firm-title"><LargeTitle>{p.id}</LargeTitle></div>
            <div className="firm-meta"><span>{p.type}</span><span>·</span><span>{children} instrument{children === 1 ? '' : 's'}</span></div>
          </div>
          <div className="head-acts">
            <Button variant="secondary" asChild><Link to={instNewHref(p.id)}><Plus size={17} />Create Instrument</Link></Button>
            <Button variant="secondary" asChild><Link to={productHref(p.id, 'copy')}><Copy size={17} />Copy</Link></Button>
            <Button asChild><Link to={productHref(p.id, 'edit')}><Pencil size={17} />Edit Product</Link></Button>
          </div>
        </header>
      </div>
      <div className="detail-scroll">
        <div className="split">
          <SectionRail sections={sections} />
          <div className="sections"><SectionsRead sections={sections} values={p} /></div>
        </div>
      </div>
    </div>
  )
}

// ---------- Form ----------

const finite = (v: any, k: string) => v[k] !== '' && v[k] !== undefined && Number.isFinite(Number(v[k]))

/** Low/high limit checks (the prototype's validateLimits in instrument-pages.js). */
export function validateLimits(v: any) {
  const e: Record<string, string> = {}
  if (v.nonTradable) return e
  LIMIT_GROUPS.forEach(g => {
    const [lowSet, low] = g.low
    const [highSet, high] = g.high
    if (v[lowSet] && !finite(v, low)) e[low] = 'Low limit is required.'
    if (v[highSet] && !finite(v, high)) e[high] = 'High limit is required.'
    if (v[lowSet] && v[highSet] && finite(v, low) && finite(v, high) && Number(v[low]) >= Number(v[high])) e[low] = 'Low limit must be less than High Limit.'
    if (g.low[1] === 'lowPriceLimit' && v[highSet] && finite(v, high) && Number(v[high]) <= 0) e[high] = 'High limit must be greater than 0.'
  })
  return e
}

/** Sub type rows, checked only while creating (the prototype's validateSubTypes in instrument-pages.js). */
export function validateSubTypes(v: any, form: FormModel) {
  const e: Record<string, string> = {}
  if (form.mode !== 'create') return e
  ;(v.subTypes || []).forEach((row: any, i: number) => {
    if (!String(row.symbol || '').trim()) e[`subTypes.${i}.symbol`] = 'Sub Type Name is required.'
    if (!row.opposingSide) e[`subTypes.${i}.opposingSide`] = 'Opposing Side is required.'
    ;['buyPriceIncrement', 'sellPriceIncrement', 'buyScale', 'sellScale', 'buyQuantityRatio', 'sellQuantityRatio'].forEach(key => {
      if (row[key] !== '' && row[key] !== undefined && row[key] !== null && !Number.isFinite(Number(row[key]))) e[`subTypes.${i}.${key}`] = 'Must be a number.'
    })
  })
  return e
}

export function validateProduct(v: any, form: FormModel) {
  const e = validateSections(productSections(v), v, form)
  if (form.mode === 'create') {
    const id = String(v.id || '').trim()
    if (id && productById(id)) e.id = 'Another product already uses this ID. Enter a different one.'
  }
  Object.assign(e, validateLimits(v), validateSubTypes(v, form))
  return e
}

/** Copies the selected Sync groups from the saved product to its instruments (except terminated ones). */
export function syncChildInstruments(saved: any, flags: Record<string, boolean>) {
  const keys = Object.entries(SYNC_GROUPS).filter(([flag]) => flags[flag]).flatMap(([, list]) => list)
  const children = market().instruments.filter(i => i.productId === saved.id && i.state !== 'Terminated')
  children.forEach(i => keys.forEach(k => { i[k] = clone(saved[k] ?? '') }))
  return children.length
}

type ProductMode = 'new' | 'edit' | 'copy'

/** The prototype's startProductForm draft for each mode. */
function startDraft(mode: ProductMode, source?: any) {
  if (mode === 'new') return { ...blankMarketValues(), id: '', type: IT.DEFAULT, description: '', categoryLevels: [] }
  if (mode === 'edit') return clone(source)
  return { ...clone(source), id: '' }
}

function ProductForm({ mode, source }: { mode: ProductMode; source?: any }) {
  const navigate = useNavigate()
  const editing = mode === 'edit'
  const [form, refresh] = useForm(() => createMarketForm(editing ? 'edit' : 'create', startDraft(mode, source), productSections))
  const title = editing ? 'Edit Product' : 'Create Product'
  const originalId = form.original.id

  async function submitProduct() {
    const v = form.draft
    const creating = form.mode === 'create'
    const andCreate = form.saveAndCreate
    form.saveAndCreate = false
    if (!creating && !andCreate && !isDirty(form)) return
    v.id = String(v.id || '').trim()
    form.errors = validateProduct(v, form)
    if (Object.keys(form.errors).length) {
      revealFormErrors(form, productSections(v), refresh)
      return
    }
    refresh()
    const flags = Object.fromEntries(Object.keys(SYNC_GROUPS).map(k => [k, !!v[k]]))
    const syncing = Object.values(flags).some(Boolean)
    if (creating || syncing) {
      const ok = await ask(creating
        ? { title: 'Add this product?', text: `This creates the product ${v.id}.`, confirm: 'Add Product', glyph: 'check' }
        : { title: 'Apply to all instruments?', text: `This saves ${v.id} and updates the selected settings on its instruments, except terminated ones.`, confirm: 'Save and Apply', glyph: 'warn' })
      if (!ok) return
    }
    form.saving = true
    refresh()
    await wait(350)
    const saved = clone(v)
    Object.keys(SYNC_GROUPS).forEach(k => delete saved[k])
    const m = market()
    if (creating) m.products.unshift(saved)
    else m.products[m.products.findIndex(p => p.id === originalId)] = saved
    const synced = syncing ? syncChildInstruments(saved, flags) : 0
    form.done = true
    navigate(andCreate ? instNewHref(saved.id) : '/products')
    saveMarket()
    toast(syncing ? `Product saved and ${synced} instrument${synced === 1 ? '' : 's'} updated.` : 'Product successfully saved.')
  }

  async function removeProduct() {
    const id = originalId
    const ok = await ask({ title: `Remove ${id}?`, text: 'This permanently removes the product. Its instruments stay in the list.', confirm: 'Remove Product', danger: true, glyph: 'trash' })
    if (!ok) return
    const m = market()
    m.products = m.products.filter(p => p.id !== id)
    form.done = true
    navigate('/products')
    saveMarket()
    toast('Product deleted.')
  }

  const saveAndCreate = () => {
    if (form.saving) return
    form.saveAndCreate = true
    submitProduct()
  }

  return (
    <MarketFormPage
      form={form}
      refresh={refresh}
      sections={productSections}
      validate={validateProduct}
      onSubmit={submitProduct}
      title={title}
      crumb={editing ? { href: productHref(originalId), label: originalId } : { href: '/products', label: 'Products' }}
      backHref={editing ? productHref(originalId) : '/products'}
      saveLabel="Save"
      extra={(
        <>
          <Button variant="secondary" type="button" data-act="product-save-create" onClick={saveAndCreate}>Save and Create an Instrument</Button>
          {editing && <Button variant="secondary" type="button" className="btn-danger-soft" data-act="product-remove" onClick={removeProduct}><Trash2 size={16} />Remove Product</Button>}
        </>
      )}
    />
  )
}

/** /product?id=…[&mode=edit|copy] and /product?mode=new */
export function ProductPage() {
  useStore()
  const [params] = useSearchParams()
  const mode = params.get('mode')
  const id = params.get('id')
  if (mode === 'new') return <ProductForm key="new" mode="new" />
  const product = productById(id)
  if (!product) return <MarketNotFound title="Product not found" id={id} href="/products" label="Products" />
  if (mode === 'edit' || mode === 'copy') return <ProductForm key={`${mode}:${id}`} mode={mode} source={product} />
  return <ProductView p={product} />
}
