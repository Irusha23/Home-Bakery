import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  DISCLOSURE_TRANSITION,
  INSTANT_TRANSITION,
  TACTILE_SPRING,
} from "../../lib/motion"

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
 * Animated iOS-style expandable card section replacing static HTML <details>.
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

  const resolvedContentClass =
    contentClassName ??
    (compact
      ? "border-t border-warm-border px-3 pb-2 pt-1"
      : "border-t border-warm-border px-4 py-3")

  return (
    <div
      className={`overflow-hidden border border-warm-border ${
        compact
          ? "rounded-control bg-ivory/60"
          : "rounded-card bg-white shadow-subtle"
      } ${className}`.trim()}
    >
      <motion.button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        whileTap={reducedMotion ? undefined : { scale: 0.99 }}
        transition={TACTILE_SPRING}
        className={`flex w-full items-center justify-between gap-3 text-left text-cocoa transition-colors duration-ui hover:bg-ivory/60 active:bg-sage-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage/30 ${
          compact
            ? "px-3 py-2 text-xs font-medium"
            : "min-h-touch px-4 text-sm font-semibold"
        }`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {leadingIcon}
          <span className="truncate">{title}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          {trailing}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={
              reducedMotion ? INSTANT_TRANSITION : DISCLOSURE_TRANSITION
            }
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
              reducedMotion ? INSTANT_TRANSITION : DISCLOSURE_TRANSITION
            }
            className="overflow-hidden"
          >
            <div className={resolvedContentClass}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
