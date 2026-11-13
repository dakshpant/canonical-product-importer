import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ToastContext } from './toast-context.js'

const DURATION_MS = 3000

const TONES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
}

let nextId = 1

/** Holds the pop-ups and renders them top right, above the page. */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const toast = useMemo(() => {
    const show = (tone) => (text) => setToasts((list) => [...list, { id: nextId++, tone, text: String(text) }])
    return { success: show('success'), error: show('danger'), info: show('info') }
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Closes itself after DURATION_MS. Hovering pauses the timer so a long
// message can be read; the × closes it straight away.
function ToastItem({ toast, onDismiss }) {
  const remaining = useRef(DURATION_MS)
  const startedAt = useRef(0)
  const timer = useRef(null)

  const start = useCallback(() => {
    startedAt.current = Date.now()
    timer.current = setTimeout(() => onDismiss(toast.id), remaining.current)
  }, [onDismiss, toast.id])

  const pause = () => {
    clearTimeout(timer.current)
    remaining.current = Math.max(500, remaining.current - (Date.now() - startedAt.current))
  }

  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
  }, [start])

  const isError = toast.tone === 'danger'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      onMouseEnter={pause}
      onMouseLeave={start}
      className={`pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${TONES[toast.tone] ?? TONES.info}`}
    >
      <p className="min-w-0 flex-1 break-words">{toast.text}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close"
        className="-mr-1 shrink-0 rounded px-1 leading-none opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </div>
  )
}
