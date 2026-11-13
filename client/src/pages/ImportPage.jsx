import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Alert, Button, Card, Loading, PageHeader } from '../components/common/ui.jsx'
import BatchProgress from '../components/imports/BatchProgress.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { api } from '../services/api.js'
import { plural } from '../utils/format.js'
import { BATCH_DONE } from '../utils/status.js'

const POLL_MS = 2000

function parseUrls(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export default function ImportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const batchId = searchParams.get('batch')

  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const urls = useMemo(() => parseUrls(text), [text])

  async function handleSubmit(event) {
    event.preventDefault()
    if (urls.length === 0) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const batch = await api.createImport(urls)
      setText('')
      setSearchParams({ batch: batch.id })
    } catch (error) {
      setSubmitError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Import products"
        description="Paste product page URLs. The server reads each page and prepares a draft for your review. Nothing goes live until you approve it."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="urls" className="mb-1.5 block text-sm font-medium text-stone-800">
                Product URLs
              </label>
              <textarea
                id="urls"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                spellCheck={false}
                placeholder={'https://vendor.com/product-a\nhttps://vendor.com/product-b'}
                className="block w-full resize-y rounded-md border-0 bg-white px-3 py-2 font-mono text-[13px] text-stone-800 ring-1 ring-inset ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-stone-800 focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-stone-500">One URL per line. Public pages only; robots.txt is respected.</p>
            </div>

            {submitError && <Alert tone="danger">{submitError}</Alert>}

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-stone-500">{urls.length > 0 ? plural(urls.length, 'URL') : 'No URLs yet'}</span>
              <Button type="submit" variant="primary" busy={submitting} disabled={urls.length === 0}>
                Start import
              </Button>
            </div>
          </form>
        </Card>

        <div>
          {batchId ? (
            <LiveBatch batchId={batchId} />
          ) : (
            <div className="grid h-full min-h-48 place-items-center rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
              Progress for each URL will appear here once you start an import.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function LiveBatch({ batchId }) {
  const { data: batch, error, loading } = useAsync(() => api.getImport(batchId), [batchId], {
    pollMs: POLL_MS,
    shouldPoll: (data) => !data || !BATCH_DONE.includes(data.status),
  })

  if (loading && !batch) return <Loading label="Starting import…" />
  if (error && !batch) return <Alert tone="danger" title="Could not load import progress">{error.message}</Alert>
  return (
    <div className="space-y-3">
      {error && <Alert tone="warning">Lost connection to the server, retrying…</Alert>}
      <BatchProgress batch={batch} />
    </div>
  )
}
