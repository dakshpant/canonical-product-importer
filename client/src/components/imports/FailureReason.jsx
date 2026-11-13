import { parseError } from '../../utils/status.js'

/** Shows "CODE: message" from an ImportRecord with a plain-English next step. */
export default function FailureReason({ errorMessage, compact = false }) {
  const error = parseError(errorMessage)
  if (!error) return null

  return (
    <div className="text-sm">
      <p className="text-rose-700">
        {error.code && (
          <code className="mr-2 rounded bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] text-rose-700 ring-1 ring-inset ring-rose-200">
            {error.code}
          </code>
        )}
        {error.hint ?? error.message}
      </p>
      {!compact && error.hint && error.message && (
        <p className="mt-1 wrap-break-word text-xs text-stone-500">{error.message}</p>
      )}
    </div>
  )
}
