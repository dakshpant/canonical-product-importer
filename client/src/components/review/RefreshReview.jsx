import { useMemo, useState } from 'react'

import { SCRAPED_FIELDS, formatValue, isEmpty, sameValue, toList } from '../../utils/fields.js'
import { formatDateTime } from '../../utils/format.js'
import { Badge } from '../common/StatusBadge.jsx'
import { Alert, Button, Card } from '../common/ui.jsx'
import { EvidenceQuote } from './Evidence.jsx'

/**
 * Compare a refresh proposal with the live product, field by field.
 * - Blank new values are never offered: the current value is always kept.
 * - Unchanged values are not shown.
 * - Default choice: keep the current value, unless the field is empty today.
 */
export default function RefreshReview({ product, proposal, onResolve, disabledReason }) {
  // Evidence for the new values: sent with the proposal, or else the product's
  // sources that came from the re-scrape that created this proposal.
  const proposedSources =
    proposal.sources ??
    (product.sources ?? []).filter((s) => s.import_record_id === proposal.import_record_id)

  const { changed, notFound, unchanged } = useMemo(() => {
    const proposed = proposal.proposed_data?.product ?? proposal.proposed_data ?? {}
    const out = { changed: [], notFound: [], unchanged: [] }
    for (const field of SCRAPED_FIELDS) {
      const current = field.list ? toList(product[field.name]) : product[field.name]
      const next = field.list ? toList(proposed[field.name]) : proposed[field.name]
      if (isEmpty(next)) out.notFound.push(field)
      else if (sameValue(current, next)) out.unchanged.push(field)
      else out.changed.push({ field, current, next })
    }
    return out
  }, [product, proposal])

  const [choices, setChoices] = useState(() =>
    Object.fromEntries(changed.map(({ field, current }) => [field.name, isEmpty(current) ? 'proposed' : 'current'])),
  )
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const takeNewCount = Object.values(choices).filter((c) => c === 'proposed').length

  async function submit(decisions, kind) {
    setBusy(kind)
    setError(null)
    try {
      await onResolve(proposal.id, decisions)
    } catch (e) {
      setError(e.message)
      setBusy(null)
    }
  }

  const keepAll = Object.fromEntries(changed.map(({ field }) => [field.name, 'current']))

  return (
    <Card className="mb-6 border-sky-200">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-100 bg-sky-50/60 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Refreshed values waiting for you</h2>
          <p className="mt-0.5 text-xs text-stone-600">
            Re-scraped {formatDateTime(proposal.created_at)}. Choose which value to keep for each changed field.
            Nothing changes until you apply.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge tone="info">{changed.length} changed</Badge>
          <Badge tone="neutral">{unchanged.length} unchanged</Badge>
          {notFound.length > 0 && <Badge tone="neutral">{notFound.length} not found, kept</Badge>}
        </div>
      </div>

      {changed.length === 0 ? (
        <p className="px-5 py-4 text-sm text-stone-600">The page has not changed in any field the app can read.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          <div className="hidden grid-cols-[10rem_1fr_1fr] gap-4 px-5 py-2 text-xs font-medium text-stone-500 md:grid">
            <span>Field</span>
            <span>Current value</span>
            <span>Newly scraped</span>
          </div>
          {changed.map(({ field, current, next }) => {
            const choice = choices[field.name]
            const evidence = proposedSources.filter((s) => s.field_name === field.name).slice(0, 1)
            return (
              <fieldset key={field.name} className="grid gap-3 px-5 py-4 md:grid-cols-[10rem_1fr_1fr] md:gap-4">
                <legend className="sr-only">{field.label}</legend>
                <p className="text-sm font-medium text-stone-800">{field.label}</p>
                <Choice
                  name={field.name}
                  checked={choice === 'current'}
                  onSelect={() => setChoices((c) => ({ ...c, [field.name]: 'current' }))}
                  label="Keep current"
                  value={current}
                />
                <Choice
                  name={field.name}
                  checked={choice === 'proposed'}
                  onSelect={() => setChoices((c) => ({ ...c, [field.name]: 'proposed' }))}
                  label="Use new"
                  value={next}
                  evidence={evidence[0]}
                />
              </fieldset>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-3">
        <p className="text-xs text-stone-500">
          {disabledReason ?? `${takeNewCount} new value${takeNewCount === 1 ? '' : 's'} will be applied. Blank results never replace existing data.`}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => submit(keepAll, 'discard')} busy={busy === 'discard'} disabled={Boolean(busy) || Boolean(disabledReason)}>
            Keep all current
          </Button>
          {changed.length > 0 && (
            <Button variant="primary" onClick={() => submit(choices, 'apply')} busy={busy === 'apply'} disabled={Boolean(busy) || Boolean(disabledReason)}>
              Apply choices
            </Button>
          )}
        </div>
      </div>
      {error && <Alert tone="danger" className="mx-5 mb-4">{error}</Alert>}
    </Card>
  )
}

function Choice({ name, checked, onSelect, label, value, evidence }) {
  return (
    <div
      className={`rounded-md p-3 ring-inset transition-colors ${
        checked ? 'bg-white ring-2 ring-stone-800' : 'bg-stone-50 ring-1 ring-stone-200 hover:ring-stone-300'
      }`}
    >
      <label className="block cursor-pointer">
        <span className="flex items-center gap-2 text-xs font-medium text-stone-500">
          <input type="radio" name={`choice-${name}`} checked={checked} onChange={onSelect} className="accent-stone-800" />
          {label}
        </span>
        <span className="mt-1.5 block wrap-break-word text-sm text-stone-800">
          {isEmpty(value) ? <span className="italic text-stone-400">Empty</span> : <span className="line-clamp-4">{formatValue(value)}</span>}
        </span>
      </label>
      {evidence && (
        <div className="mt-2">
          <EvidenceQuote source={evidence} />
        </div>
      )}
    </div>
  )
}
