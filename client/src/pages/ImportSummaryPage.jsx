import { Link, useParams } from 'react-router'

import StatusBadge, { Badge } from '../components/common/StatusBadge.jsx'
import { Alert, Card, Loading, PageHeader, Spinner } from '../components/common/ui.jsx'
import FailureReason from '../components/imports/FailureReason.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import { FIELD_BY_NAME, SCRAPED_FIELDS, isEmpty } from '../utils/fields.js'
import { formatDateTime, plural } from '../utils/format.js'
import { BATCH_DONE } from '../utils/status.js'

const POLL_MS = 3000

// extracted_data is { product, sources, review, extraction } (see extraction.service.js).
function summarise(record) {
  const data = record.extracted_data ?? {}
  const product = data.product ?? {}
  const filled = SCRAPED_FIELDS.filter((f) => !isEmpty(product[f.name])).length
  return {
    filled,
    missingRequired: data.review?.missing_required_fields ?? [],
    discarded: data.review?.discarded ?? [],
    isRefresh: Boolean(record.update_proposal),
  }
}

export default function ImportSummaryPage() {
  const { batchId } = useParams()
  const { data: batch, error, loading } = useAsync(() => api.getImport(batchId), [batchId], {
    pollMs: POLL_MS,
    shouldPoll: (data) => !data || !BATCH_DONE.includes(data.status),
  })

  if (loading && !batch) return <Loading />
  if (error && !batch) return <Alert tone="danger" title="Could not load this import">{error.message}</Alert>

  const records = batch.records ?? []
  const groups = {
    FAILED: records.filter((r) => r.status === 'FAILED'),
    PARTIAL: records.filter((r) => r.status === 'PARTIAL'),
    SUCCESS: records.filter((r) => r.status === 'SUCCESS'),
    PENDING: records.filter((r) => r.status === 'PENDING' || r.status === 'PROCESSING'),
  }
  const running = !BATCH_DONE.includes(batch.status)

  return (
    <>
      <PageHeader
        title="Import summary"
        description={`Started ${formatDateTime(batch.created_at)} · ${plural(batch.total_urls, 'URL')}`}
        actions={<StatusBadge status={batch.status} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Succeeded" value={groups.SUCCESS.length} tone="text-emerald-700" />
        <Stat label="Partly filled" value={groups.PARTIAL.length} tone="text-amber-700" />
        <Stat label="Failed" value={groups.FAILED.length} tone="text-rose-700" />
        <Stat label="Still running" value={groups.PENDING.length} tone="text-stone-700" />
      </div>

      {running && (
        <Alert tone="info" className="mb-6">
          <span className="flex items-center gap-2">
            <Spinner className="size-3" /> This import is still running. The page updates by itself.
          </span>
        </Alert>
      )}

      <div className="space-y-6">
        <Section title="Failed" hint="Nothing was saved for these URLs. Fix the cause or enter the product by hand." records={groups.FAILED}>
          {(record) => (
            <>
              <FailureReason errorMessage={record.error_message} />
              {record.attempts > 1 && <p className="mt-1 text-xs text-stone-500">Tried {record.attempts} times.</p>}
            </>
          )}
        </Section>

        <Section title="Partly filled" hint="Saved as Draft. Some required fields were not on the page and need your input." records={groups.PARTIAL}>
          {(record) => <RecordDetails record={record} />}
        </Section>

        <Section title="Succeeded" hint="All required fields found. Waiting for your review." records={groups.SUCCESS}>
          {(record) => <RecordDetails record={record} />}
        </Section>

        {groups.PENDING.length > 0 && (
          <Section title="Still running" records={groups.PENDING}>
            {(record) => <StatusBadge status={record.status} />}
          </Section>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, tone }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </Card>
  )
}

function Section({ title, hint, records, children }) {
  if (records.length === 0) return null
  return (
    <Card>
      <div className="border-b border-stone-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-stone-900">
          {title} <span className="font-normal text-stone-400">({records.length})</span>
        </h2>
        {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
      </div>
      <ul className="divide-y divide-stone-100">
        {records.map((record) => (
          <li key={record.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <a
                href={record.url}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-mono text-[13px] text-stone-700 hover:text-stone-900 hover:underline"
                title={record.url}
              >
                {record.url || '(empty)'}
              </a>
              {children(record)}
            </div>
            {record.product_id && (
              <Link
                to={`/products/${record.product_id}`}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-50"
              >
                Review
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function RecordDetails({ record }) {
  const { filled, missingRequired, discarded, isRefresh } = summarise(record)
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
      {isRefresh && <Badge tone="info">Refresh of an existing product</Badge>}
      <span>
        {filled} of {SCRAPED_FIELDS.length} page fields filled
      </span>
      {missingRequired.length > 0 && (
        <Badge tone="warning">Missing: {missingRequired.map((f) => FIELD_BY_NAME[f]?.label ?? f).join(', ')}</Badge>
      )}
      {discarded.length > 0 && (
        <span className="text-stone-500" title={discarded.map((d) => `${d.field}: ${d.reason}`).join('\n')}>
          · {plural(discarded.length, 'value')} dropped for lack of evidence
        </span>
      )}
    </div>
  )
}
