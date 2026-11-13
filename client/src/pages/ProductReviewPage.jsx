import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import StatusBadge from '../components/common/StatusBadge.jsx'
import { Alert, Button, Card, Loading } from '../components/common/ui.jsx'
import FieldRow from '../components/review/FieldRow.jsx'
import RefreshReview from '../components/review/RefreshReview.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import {
  EDITABLE_FIELDS,
  FIELD_BY_NAME,
  FIELD_GROUPS,
  ORIGIN,
  REQUIRED_FIELDS,
  SCRAPED_FIELDS,
  fromFormValue,
  isEmpty,
  sameValue,
  toFormValues,
  toList,
} from '../utils/fields.js'
import { formatDateTime, hostOf } from '../utils/format.js'
import { PRODUCT_STATUS } from '../utils/status.js'

export default function ProductReviewPage() {
  const { productId } = useParams()
  const { data: product, error, loading, reload } = useAsync(() => api.getProduct(productId), [productId])
  // Lives here so it survives the editor remounting after a save.
  const [message, setMessage] = useState(null)

  if (loading && !product) return <Loading />
  if (error && !product) {
    return (
      <Alert tone="danger" title="Could not load this product">
        {error.message} <Link to="/products" className="underline">Back to products</Link>
      </Alert>
    )
  }

  // Remount the editor when the stored product changes, so the form resets cleanly.
  return (
    <ProductEditor
      key={`${product.id}-${product.updated_at}`}
      product={product}
      reload={reload}
      message={message}
      setMessage={setMessage}
    />
  )
}

function ProductEditor({ product, reload, message, setMessage }) {
  const navigate = useNavigate()
  const saved = useMemo(() => toFormValues(product), [product])
  const [values, setValues] = useState(saved)
  const [busy, setBusy] = useState(null)

  const sources = product.sources ?? []
  const pendingProposal = (product.update_proposals ?? []).find((p) => p.status === 'PENDING')
  const sourceUrl = latestImportUrl(product)

  // Only fields the admin actually changed are sent.
  const changes = useMemo(() => {
    const out = {}
    for (const field of EDITABLE_FIELDS) {
      const next = fromFormValue(field, values[field.name])
      const current = field.list ? toList(product[field.name]) : product[field.name]
      if (!sameValue(next ?? '', current ?? '')) out[field.name] = next
    }
    return out
  }, [values, product])
  const dirty = Object.keys(changes).length > 0

  const missing = REQUIRED_FIELDS.filter((name) => isEmpty(values[name]))
  const emptyScraped = SCRAPED_FIELDS.filter((f) => isEmpty(values[f.name]))
  const filledScraped = SCRAPED_FIELDS.length - emptyScraped.length

  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const onChange = (name, value) => setValues((v) => ({ ...v, [name]: value }))

  async function run(kind, action, successText) {
    setBusy(kind)
    setMessage(null)
    try {
      await action()
      await reload({ silent: true })
      if (successText) setMessage({ tone: 'success', text: successText })
    } catch (e) {
      setMessage({ tone: 'danger', text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const save = () => run('save', () => api.updateProduct(product.id, changes), 'Changes saved.')

  const approve = () =>
    run(
      'approve',
      async () => {
        if (dirty) await api.updateProduct(product.id, changes)
        await api.approveProduct(product.id)
      },
      'Approved. The product is now Active.',
    )

  const reject = () => {
    if (!window.confirm('Reject this product? It will move back to Draft and will not go live.')) return
    run(
      'reject',
      async () => {
        if (dirty) await api.updateProduct(product.id, changes)
        await api.rejectProduct(product.id)
      },
      'Rejected. The product is back in Draft.',
    )
  }

  async function refresh() {
    setBusy('refresh')
    setMessage(null)
    try {
      const batch = await api.createImport([sourceUrl])
      navigate(`/import?batch=${batch.id}`)
    } catch (e) {
      setMessage({ tone: 'danger', text: e.message })
      setBusy(null)
    }
  }

  const resolveProposal = async (proposalId, decisions) => {
    await api.reviewProposal(proposalId, decisions)
    setMessage({ tone: 'success', text: 'Refresh applied. Values you chose to keep were left untouched.' })
    await reload({ silent: true })
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-6">
        <Link to="/products" className="text-sm text-stone-500 hover:text-stone-900">← Products</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                {product.name || <span className="italic text-stone-400">Unnamed product</span>}
              </h1>
              <StatusBadge status={product.status} />
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {product.sku_id && <span className="font-mono">{product.sku_id}</span>}
              {product.sku_id && ' · '}
              Updated {formatDateTime(product.updated_at)}
              {sourceUrl && (
                <>
                  {' · '}
                  <a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:text-stone-900 hover:underline">
                    {hostOf(sourceUrl)} ↗
                  </a>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={refresh}
              busy={busy === 'refresh'}
              disabled={!sourceUrl || dirty || Boolean(pendingProposal) || Boolean(busy)}
              title={
                !sourceUrl ? 'No source URL on record'
                  : dirty ? 'Save or discard your edits first'
                  : pendingProposal ? 'Review the pending refresh first'
                  : 'Scrape the page again and compare'
              }
            >
              Re-scrape
            </Button>
            <Button variant="danger" onClick={reject} busy={busy === 'reject'} disabled={Boolean(busy)}>
              Reject
            </Button>
            <Button
              variant="approve"
              onClick={approve}
              busy={busy === 'approve'}
              disabled={missing.length > 0 || Boolean(busy) || product.status === PRODUCT_STATUS.ACTIVE && !dirty}
              title={missing.length > 0 ? 'Fill the required fields first' : undefined}
            >
              {product.status === PRODUCT_STATUS.ACTIVE ? 'Save & keep active' : dirty ? 'Save & approve' : 'Approve'}
            </Button>
          </div>
        </div>
      </div>

      {message && <Alert tone={message.tone} className="mb-6">{message.text}</Alert>}
      <StatusExplainer status={product.status} missing={missing} />

      {pendingProposal && (
        <RefreshReview
          product={product}
          proposal={pendingProposal}
          onResolve={resolveProposal}
          disabledReason={dirty ? 'Save or discard your edits before applying refreshed values.' : undefined}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        {/* Fields */}
        <div className="space-y-6">
          {FIELD_GROUPS.map((group) => (
            <Card key={group.title} className="px-5">
              <h2 className="border-b border-stone-100 py-3 text-sm font-semibold text-stone-900">{group.title}</h2>
              <div className="divide-y divide-stone-100">
                {group.fields.map((field) => (
                  <FieldRow
                    key={field.name}
                    field={field}
                    value={values[field.name]}
                    savedValue={product[field.name]}
                    sources={sources.filter((s) => s.field_name === field.name)}
                    onChange={onChange}
                    missingRequired={field.required && isEmpty(values[field.name])}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <ImagePreview url={values.image_url} alt={values.image_alt} />

          <Card className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Review checklist</h3>
            <p className="mt-2 text-sm text-stone-700">
              <span className="text-lg font-semibold tabular-nums text-stone-900">{filledScraped}</span>
              <span className="text-stone-400"> / {SCRAPED_FIELDS.length}</span> page fields filled
            </p>
            {missing.length > 0 && (
              <FieldLinks title="Required, still empty" tone="text-rose-700" names={missing} />
            )}
            {emptyScraped.some((f) => !f.required) && (
              <FieldLinks title="Not found on the page" tone="text-amber-700" names={emptyScraped.filter((f) => !f.required).map((f) => f.name)} />
            )}
            <FieldLinks
              title="Admin entry"
              tone="text-sky-700"
              names={EDITABLE_FIELDS.filter((f) => f.origin === ORIGIN.ADMIN && isEmpty(values[f.name])).map((f) => f.name)}
            />
          </Card>
        </aside>
      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm text-stone-600">
              {Object.keys(changes).length} unsaved change{Object.keys(changes).length === 1 ? '' : 's'}:{' '}
              <span className="text-stone-400">{Object.keys(changes).map((n) => FIELD_BY_NAME[n].label).join(', ')}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setValues(saved)} disabled={Boolean(busy)}>Discard</Button>
              <Button variant="primary" onClick={save} busy={busy === 'save'} disabled={Boolean(busy)}>Save changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function latestImportUrl(product) {
  const records = [...(product.import_records ?? [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  )
  return records[0]?.url ?? product.website ?? null
}

function StatusExplainer({ status, missing }) {
  const labels = missing.map((n) => FIELD_BY_NAME[n].label.toLowerCase()).join(', ')
  if (status === PRODUCT_STATUS.ACTIVE) {
    return <Alert tone="success" className="mb-6">This product is live. You approved it.</Alert>
  }
  if (missing.length > 0) {
    return (
      <Alert tone="warning" className="mb-6" title="Needs your input before it can be approved">
        The page did not provide: {labels}. Fill these in, then approve.
      </Alert>
    )
  }
  if (status === PRODUCT_STATUS.DRAFT) {
    return (
      <Alert tone="info" className="mb-6">
        Draft. Required fields are filled; check the values against their sources and approve when happy.
      </Alert>
    )
  }
  return (
    <Alert tone="info" className="mb-6">
      Check each value against the page evidence shown under it. Edit anything wrong, then approve or reject.
    </Alert>
  )
}

function FieldLinks({ title, names, tone }) {
  if (names.length === 0) return null
  return (
    <div className="mt-4">
      <p className={`text-xs font-medium ${tone}`}>{title}</p>
      <ul className="mt-1 space-y-0.5">
        {names.map((name) => (
          <li key={name}>
            <a href={`#field-${name}`} className="text-sm text-stone-600 hover:text-stone-900 hover:underline">
              {FIELD_BY_NAME[name].label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ImagePreview({ url, alt }) {
  const [failedUrl, setFailedUrl] = useState(null)
  if (!url) {
    return (
      <Card className="grid aspect-video place-items-center text-xs text-stone-400">No image found</Card>
    )
  }
  return (
    <Card className="overflow-hidden">
      {failedUrl === url ? (
        <div className="grid aspect-video place-items-center px-4 text-center text-xs text-stone-400">
          Image could not be loaded. Check the URL.
        </div>
      ) : (
        <img src={url} alt={alt || ''} onError={() => setFailedUrl(url)} className="aspect-video w-full bg-stone-100 object-contain" />
      )}
    </Card>
  )
}
