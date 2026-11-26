import { useEffect, useId, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  DIALOG_SPRING,
  dialogVariants,
  REDUCED_MOTION_TRANSITION,
} from "../../lib/motion"
import { useBodyScrollLock } from "../../lib/useBodyScrollLock"
import { useBackHandler } from "../../lib/backStack"
import Button, { IconButton } from "./Button"

type DialogProps = {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

export default function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: DialogProps) {
  const reducedMotion = useReducedMotion()
  const titleId = useId()

  useBodyScrollLock(open)
  useBackHandler(onClose, open)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  const dialogTree = (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : { duration: 0.22 }
            }
            className="fixed inset-0 touch-none bg-cocoa/25 backdrop-blur-overlay"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            variants={reducedMotion ? undefined : dialogVariants}
            initial={reducedMotion ? { opacity: 0 } : "initial"}
            animate={reducedMotion ? { opacity: 1 } : "animate"}
            exit={reducedMotion ? { opacity: 0 } : "exit"}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : DIALOG_SPRING
            }
            className="relative z-10 flex max-h-[85dvh] w-full max-w-[32rem] flex-col overflow-hidden rounded-sheet border border-warm-border bg-white p-5 shadow-dialog"
          >
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div>
                <div
                  id={titleId}
                  className="text-xl font-semibold tracking-tight text-cocoa"
                >
                  {title}
                </div>
                {description ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              <IconButton label="Close dialog" onClick={onClose}>
                <X aria-hidden="true" size={19} />
              </IconButton>
            </div>
            <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
              {children}
            </div>
            {footer ? (
              <div className="mt-5 shrink-0">{footer}</div>
            ) : (
              <Button className="mt-5 shrink-0" fullWidth onClick={onClose}>
                Got it
              </Button>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )

  return typeof document !== "undefined"
    ? createPortal(dialogTree, document.body)
    : dialogTree
}
