// Small presentational building blocks shared by every page.

const BUTTON_VARIANTS = {
  primary: 'bg-stone-900 text-white hover:bg-stone-700 disabled:bg-stone-300',
  secondary:
    'bg-white text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  approve: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-200',
  danger:
    'bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 disabled:text-rose-300',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:text-stone-300',
}

export function Button({ variant = 'secondary', className = '', busy = false, children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy && <Spinner className="size-3.5" />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'size-4' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  )
}

export function Card({ className = '', children }) {
  return <section className={`rounded-lg border border-stone-200 bg-white ${className}`}>{children}</section>
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const ALERT_TONES = {
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
}

export function Alert({ tone = 'info', title, children, className = '' }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-sm ${ALERT_TONES[tone]} ${className}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-1 opacity-90' : ''}>{children}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 py-16 text-sm text-stone-500 justify-center">
      <Spinner /> {label}
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-stone-700">{title}</p>
      {children && <div className="mt-1 text-sm text-stone-500">{children}</div>}
    </div>
  )
}

export function ProgressBar({ value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-stone-800 transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}
