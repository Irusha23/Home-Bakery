import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Check, Info, AlertTriangle } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { INSTANT_TRANSITION, PILL_SPRING } from "../../lib/motion"

type ToastTone = "success" | "info" | "warning"

export type ToastOptions = {
  message: string
  tone?: ToastTone
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}

type ActiveToast = ToastOptions & {
  id: string
}

type ToastContextValue = {
  showToast: (options: ToastOptions | string) => void
  dismissToast: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null)
  const reducedMotion = useReducedMotion()

  const dismissToast = useCallback(() => {
    setToast(null)
  }, [])

  const showToast = useCallback((input: ToastOptions | string) => {
    const options: ToastOptions =
      typeof input === "string" ? { message: input } : input
    setToast({
      ...options,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const ms = toast.durationMs ?? (toast.onAction ? 4500 : 2800)
    const timer = window.setTimeout(() => {
      setToast(null)
    }, ms)
    return () => window.clearTimeout(timer)
  }, [toast])

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
      >
        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 14, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 8, scale: 0.96 }
              }
              transition={reducedMotion ? INSTANT_TRANSITION : PILL_SPRING}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-full border border-warm-border bg-cocoa px-4 py-2.5 text-sm text-white shadow-dialog"
            >
              {toast.tone === "warning" ? (
                <AlertTriangle
                  aria-hidden="true"
                  size={16}
                  className="shrink-0 text-warning-border"
                />
              ) : toast.tone === "info" ? (
                <Info
                  aria-hidden="true"
                  size={16}
                  className="shrink-0 text-sage-soft"
                />
              ) : (
                <Check
                  aria-hidden="true"
                  size={16}
                  className="shrink-0 text-sage-soft"
                />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">
                {toast.message}
              </span>
              {toast.actionLabel && toast.onAction ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.()
                    setToast(null)
                  }}
                  className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/25"
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      showToast: () => {},
      dismissToast: () => {},
    }
  }
  return ctx
}
