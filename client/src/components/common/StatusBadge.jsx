import { statusMeta, toneClass } from '../../utils/status.js'

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass(tone)} ${className}`}
    >
      {children}
    </span>
  )
}

export default function StatusBadge({ status }) {
  const meta = statusMeta(status)
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}
    >
      {status === 'PROCESSING' && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {meta.label}
    </span>
  )
}
