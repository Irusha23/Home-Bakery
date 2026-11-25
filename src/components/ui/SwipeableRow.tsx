import type { ReactNode } from "react"
import { Trash2 } from "lucide-react"
import {
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react"
import { SHEET_SPRING } from "../../lib/motion"

type SwipeableRowProps = {
  children: ReactNode
  onAction: () => void
  actionLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * iOS-style swipe-left row with directional lock so vertical sheet/page
 * scrolling stays unaffected.
 */
export default function SwipeableRow({
  children,
  onAction,
  actionLabel = "Clear",
  disabled = false,
  className = "",
}: SwipeableRowProps) {
  const reducedMotion = useReducedMotion()
  const dragControls = useDragControls()
  const x = useMotionValue(0)
  const pillOpacity = useTransform(x, [-90, -24, 0], [1, 0.75, 0])
  const pillScale = useTransform(x, [-90, -24, 0], [1, 0.92, 0.85])

  if (disabled || reducedMotion) {
    return <div className={className}>{children}</div>
  }

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x < -88 || info.velocity.x < -450) {
      onAction()
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-card ${className}`.trim()}>
      <motion.div
        aria-hidden="true"
        style={{ opacity: pillOpacity, scale: pillScale }}
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose px-3 py-1.5 text-xs font-semibold text-white shadow-subtle">
          <Trash2 size={13} />
          <span>{actionLabel}</span>
        </span>
      </motion.div>

      <motion.div
        style={{ x, touchAction: "pan-y" }}
        drag="x"
        dragControls={dragControls}
        dragListener={false}
        dragDirectionLock
        dragConstraints={{ left: -112, right: 0 }}
        dragElastic={{ left: 0.2, right: 0.04 }}
        dragSnapToOrigin
        transition={SHEET_SPRING}
        onDragEnd={handleDragEnd}
        onPointerDown={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("input, select, textarea")
          ) {
            return
          }
          dragControls.start(event)
        }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  )
}
