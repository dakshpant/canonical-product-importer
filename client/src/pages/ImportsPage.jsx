import { Link } from 'react-router'

import StatusBadge from '../components/common/StatusBadge.jsx'
import { Alert, Card, EmptyState, Loading, PageHeader } from '../components/common/ui.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import { formatDateTime } from '../utils/format.js'

export default function ImportsPage() {
  const { data: batches, error, loading } = useAsync(() => api.listImports(), [])

  return (
    <>
      <PageHeader
        title="Import history"
        description="Every import you have run, with how many URLs succeeded or failed."
        actions={
          <Link to="/import" className="rounded-md bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700">
            New import
          </Link>
        }
      />

      {loading && !batches ? (
        <Loading />
      ) : error ? (
        <Alert tone="danger" title="Could not load imports">{error.message}</Alert>
      ) : (
        <Card className="overflow-hidden">
          {batches.length === 0 ? (
            <EmptyState title="No imports yet">
              <Link to="/import" className="underline underline-offset-4">Start your first import</Link>
            </EmptyState>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Started</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">URLs</th>
                  <th className="px-5 py-2.5 text-right font-medium">Finished</th>
                  <th className="px-5 py-2.5 text-right font-medium">Failed</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3 text-stone-700">{formatDateTime(batch.created_at)}</td>
                    <td className="px-5 py-3"><StatusBadge status={batch.status} /></td>
                    <td className="px-5 py-3 text-right tabular-nums">{batch.total_urls}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{batch.completed_urls}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${batch.failed_urls > 0 ? 'text-rose-600' : 'text-stone-400'}`}>
                      {batch.failed_urls}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/imports/${batch.id}`} className="font-medium text-stone-700 hover:text-stone-900">
                        Summary →
                      </Link>
                    </td>
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
