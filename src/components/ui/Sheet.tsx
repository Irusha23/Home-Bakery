import { useEffect, useId, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "motion/react"
import { REDUCED_MOTION_TRANSITION, SPRING_SHEET } from "../../lib/motion"
import { useBackHandler } from "../../lib/backStack"
import { useBodyScrollLock } from "../../lib/useBodyScrollLock"
import { IconButton } from "./Button"

type SheetProps = {
  open: boolean
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  maxHeightClass?: string
}

export default function Sheet({
  open,
  title,
  subtitle,
  children,
  footer,
  onClose,
  maxHeightClass = "max-h-[90dvh]",
}: SheetProps) {
  const titleId = useId()
  const reducedMotion = useReducedMotion()
  const dragControls = useDragControls()

  useBodyScrollLock(open)
  useBackHandler(onClose, open)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, onClose])

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 96 || info.velocity.y > 520) {
      onClose()
    }
  }

  const sheetTree = (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : { duration: 0.24 }
            }
            className="fixed inset-0 touch-none bg-cocoa/30 backdrop-blur-overlay"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={
              reducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0.96 }
            }
            animate={{ y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0.9 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_SHEET
            }
            drag={reducedMotion ? false : "y"}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.45 }}
            onDragEnd={handleDragEnd}
            className={`relative z-10 flex w-full max-w-dialog flex-col overflow-hidden rounded-t-sheet border border-warm-border bg-white shadow-sheet sm:rounded-sheet ${maxHeightClass}`}
          >
            <div
              onPointerDown={(event) => {
                if (reducedMotion) return
                if (
                  event.target instanceof Element &&
                  event.target.closest("button, a, input, select, textarea")
                ) {
                  return
                }
                dragControls.start(event)
              }}
              className="touch-none select-none"
            >
              <div className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-10 rounded-full bg-warm-border"
                />
              </div>

              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-warm-border/70 px-5 pb-3.5 pt-2 sm:pt-4">
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="text-lg font-semibold tracking-tight text-cocoa"
                  >
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="mt-0.5 text-sm leading-snug text-muted">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <IconButton label={`Close ${title}`} onClick={onClose}>
                  <X aria-hidden="true" size={18} />
                </IconButton>
              </div>
            </div>

            <div
              style={{ touchAction: "pan-y" }}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-5 py-4 [-webkit-overflow-scrolling:touch]"
            >
              {children}
            </div>

            {footer ? (
              <div className="pb-safe-bottom shrink-0 border-t border-warm-border/70 bg-ivory/70 px-5 pt-3">
                {footer}
              </div>
            ) : (
              <div className="pb-safe-bottom shrink-0 sm:hidden" />
            )}
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  )

  return typeof document !== "undefined"
    ? createPortal(sheetTree, document.body)
    : sheetTree
}
