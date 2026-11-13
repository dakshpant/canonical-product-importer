import { Link } from 'react-router'

import { plural } from '../../utils/format.js'
import { BATCH_DONE } from '../../utils/status.js'
import StatusBadge from '../common/StatusBadge.jsx'
import { Card, ProgressBar, Spinner } from '../common/ui.jsx'
import FailureReason from './FailureReason.jsx'

/** Live per-URL progress for one batch. */
export default function BatchProgress({ batch }) {
  const records = batch.records ?? []
  const done = BATCH_DONE.includes(batch.status)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={batch.status} />
          <p className="text-sm text-stone-600">
            {batch.completed_urls} of {plural(batch.total_urls, 'URL')} finished
            {batch.failed_urls > 0 && <span className="text-rose-600"> · {batch.failed_urls} failed</span>}
          </p>
        </div>
        {done ? (
          <Link to={`/imports/${batch.id}`} className="text-sm font-medium text-stone-900 underline-offset-4 hover:underline">
            View import summary →
          </Link>
        ) : (
          <span className="flex items-center gap-2 text-xs text-stone-500">
            <Spinner className="size-3" /> URLs are processed one at a time
          </span>
        )}
      </div>

      <div className="px-5 pt-4">
        <ProgressBar value={batch.completed_urls} total={batch.total_urls} />
      </div>

      <ul className="divide-y divide-stone-100 px-5 py-2">
        {records.map((record) => (
          <li key={record.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[13px] text-stone-700" title={record.url}>
                {record.url || '(empty)'}
              </p>
              {record.status === 'FAILED' && (
                <div className="mt-1">
                  <FailureReason errorMessage={record.error_message} compact />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {record.product_id && (
                <Link to={`/products/${record.product_id}`} className="text-xs font-medium text-stone-600 hover:text-stone-900">
                  Review
                </Link>
              )}
              <StatusBadge status={record.status} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
