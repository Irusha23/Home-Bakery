import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  REDUCED_MOTION_TRANSITION,
  SPRING_MICRO,
  SPRING_PANEL,
} from "../../lib/motion"
import { TouchRippleLayer, useTouchRipple } from "./TouchRipple"

type DisclosureProps = {
  title: string
  trailing?: ReactNode
  leadingIcon?: ReactNode
  defaultOpen?: boolean
  compact?: boolean
  children: ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Physics-driven expandable card section replacing static HTML <details>.
 */
export default function Disclosure({
  title,
  trailing,
  leadingIcon,
  defaultOpen = false,
  compact = false,
  children,
  className = "",
  contentClassName,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const reducedMotion = useReducedMotion()
  const { ripples, triggerRipple, removeRipple } = useTouchRipple()

  const resolvedContentClass =
    contentClassName ??
    (compact
      ? "border-t border-warm-border px-3 pb-2 pt-1"
      : "border-t border-warm-border px-4 py-3")

  return (
    <div
      className={`overflow-hidden border border-warm-border transition-[background-color,border-color,box-shadow] duration-200 ${
        compact
          ? "rounded-control bg-ivory/60"
          : "rounded-card bg-white shadow-subtle"
      } ${className}`.trim()}
    >
      <motion.button
        type="button"
        aria-expanded={open}
        onPointerDown={triggerRipple}
        onClick={() => setOpen((prev) => !prev)}
        whileTap={reducedMotion ? undefined : { scale: 0.99 }}
        transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO}
        className={`relative flex w-full items-center justify-between gap-3 text-left text-cocoa transition-colors duration-200 hover:bg-ivory/60 active:bg-sage-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage/30 ${
          compact
            ? "px-3 py-2 text-xs font-medium"
            : "min-h-touch px-4 text-sm font-semibold"
        }`}
      >
        <TouchRippleLayer ripples={ripples} onDone={removeRipple} tone="dark" />
        <span className="relative z-10 inline-flex min-w-0 items-center gap-1.5">
          {leadingIcon}
          <span className="truncate">{title}</span>
        </span>
        <span className="relative z-10 inline-flex shrink-0 items-center gap-1.5">
          {trailing}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_PANEL}
            className="inline-flex text-muted"
            aria-hidden="true"
          >
            <ChevronDown size={compact ? 14 : 15} />
          </motion.span>
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={
              reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
            }
            animate={
              reducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }
            }
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_PANEL
            }
            className="origin-top overflow-hidden"
          >
            <div className={resolvedContentClass}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
