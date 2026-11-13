import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import StatusBadge, { Badge } from '../components/common/StatusBadge.jsx'
import { Alert, Card, EmptyState, Loading, PageHeader } from '../components/common/ui.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import { FIELD_BY_NAME, missingRequired } from '../utils/fields.js'
import { formatDateTime, hostOf } from '../utils/format.js'
import { PRODUCT_STATUS } from '../utils/status.js'

const FILTERS = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'all', label: 'All' },
  { key: PRODUCT_STATUS.DRAFT, label: 'Draft' },
  { key: PRODUCT_STATUS.UNDER_REVIEW, label: 'Under review' },
  { key: PRODUCT_STATUS.ACTIVE, label: 'Active' },
]

// Why a product needs the admin, most important first.
function attentionReasons(product) {
  const reasons = []
  const missing = missingRequired(product)
  if (missing.length > 0) {
    reasons.push({ tone: 'warning', text: `Missing ${missing.map((f) => FIELD_BY_NAME[f].label.toLowerCase()).join(', ')}` })
  }
  if (product.pending_proposals > 0) reasons.push({ tone: 'info', text: 'Refreshed values to review' })
  if (product.status === PRODUCT_STATUS.UNDER_REVIEW && missing.length === 0) {
    reasons.push({ tone: 'neutral', text: 'Ready for approval' })
  }
  return reasons
}

function matches(product, filter) {
  if (filter === 'all') return true
  if (filter === 'attention') return product.status !== PRODUCT_STATUS.ACTIVE || product.pending_proposals > 0
  return product.status === filter
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = searchParams.get('status') ?? 'attention'
  const [query, setQuery] = useState('')

  const { data: products, error, loading } = useAsync(() => api.listProducts(), [])

  const counts = useMemo(() => {
    const out = {}
    for (const f of FILTERS) out[f.key] = (products ?? []).filter((p) => matches(p, f.key)).length
    return out
  }, [products])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (products ?? [])
      .filter((p) => matches(p, filter))
      .filter((p) => !q || [p.name, p.category, p.website, p.sku_id].some((v) => v?.toLowerCase().includes(q)))
  }, [products, filter, query])

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything imported so far. Only products you approve become Active."
        actions={
          <Link to="/import" className="rounded-md bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700">
            Import URLs
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-stone-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setSearchParams(f.key === 'attention' ? {} : { status: f.key })}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === f.key ? 'bg-white font-medium text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {f.label}
              {products && <span className="ml-1.5 tabular-nums text-stone-400">{counts[f.key]}</span>}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, category, SKU…"
          className="w-full rounded-md border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-stone-800 focus:outline-none sm:w-64"
        />
      </div>

      {loading && !products ? (
        <Loading />
      ) : error ? (
        <Alert tone="danger" title="Could not load products">{error.message}</Alert>
      ) : (
        <Card className="overflow-x-auto">
          {visible.length === 0 ? (
            <EmptyState title={products.length === 0 ? 'No products yet' : 'Nothing here'}>
              {products.length === 0 ? (
                <Link to="/import" className="underline underline-offset-4">Import some product URLs</Link>
              ) : filter === 'attention' ? (
                'All caught up. Every product has been reviewed.'
              ) : (
                'No products match this filter.'
              )}
            </EmptyState>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-5 py-2.5 font-medium">Category</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Attention</th>
                  <th className="px-5 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="cursor-pointer hover:bg-stone-50"
                  >
                    <td className="px-5 py-3">
                      <Link to={`/products/${product.id}`} className="font-medium text-stone-900" onClick={(e) => e.stopPropagation()}>
                        {product.name || <span className="italic text-stone-400">Unnamed product</span>}
                      </Link>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {product.sku_id && <span className="font-mono">{product.sku_id}</span>}
                        {product.sku_id && product.website && ' · '}
                        {product.website && hostOf(product.website)}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-stone-600">{product.category || <span className="text-stone-300">—</span>}</td>
                    <td className="px-5 py-3"><StatusBadge status={product.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {attentionReasons(product).map((r) => (
                          <Badge key={r.text} tone={r.tone}>{r.text}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-stone-500">{formatDateTime(product.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  )
}
