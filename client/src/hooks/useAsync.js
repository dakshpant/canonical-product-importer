import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Load data with loading/error state.
 * - reload() refetches.
 * - pollMs: refetch on an interval while shouldPoll(data) is true.
 */
export function useAsync(loader, deps = [], { pollMs, shouldPoll } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const run = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await loaderRef.current()
      setState({ data, error: null, loading: false })
      return data
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }))
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer

    async function tick(first) {
      const data = await run({ silent: !first })
      if (cancelled) return
      if (pollMs && (!shouldPoll || shouldPoll(data))) {
        timer = setTimeout(() => tick(false), pollMs)
      }
    }

    tick(true)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) }
}
