import { createContext, useContext } from 'react'

// Shared by ToastProvider (Toast.jsx) and the pages that show pop-ups.
export const ToastContext = createContext(null)

/**
 * Pop-up messages for the result of an action (saved, approved, failed…).
 * Each closes itself after a few seconds. State that must stay visible
 * (load errors, import failure reasons, status explanations) stays inline.
 *
 *   const toast = useToast()
 *   toast.success('Changes saved.')
 *   toast.error(error.message)
 */
export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>.')
  return toast
}
