import { useCallback, useState, type PointerEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { createId } from "../../lib/id"
import { REDUCED_MOTION_TRANSITION, SPRING_PANEL } from "../../lib/motion"

export type TouchRippleItem = {
  id: string
  x: number
  y: number
  size: number
}

export function useTouchRipple() {
  const [ripples, setRipples] = useState<TouchRippleItem[]>([])

  const triggerRipple = useCallback((event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const hasPoint = event.clientX !== 0 || event.clientY !== 0
    const x = hasPoint ? event.clientX - rect.left : rect.width / 2
    const y = hasPoint ? event.clientY - rect.top : rect.height / 2
    const size = Math.max(rect.width, rect.height) * 1.4
    const id = createId("ripple")

    setRipples((prev) => [...prev.slice(-3), { id, x, y, size }])
  }, [])

  const removeRipple = useCallback((id: string) => {
    setRipples((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return { ripples, triggerRipple, removeRipple }
}

type TouchRippleLayerProps = {
  ripples: TouchRippleItem[]
  onDone: (id: string) => void
  tone?: "light" | "dark"
}

/**
 * Contact-point ripple acknowledging every press within <16 ms.
 * Falls back to a gentle opacity pulse when reduced motion is enabled.
 */
export function TouchRippleLayer({
  ripples,
  onDone,
  tone = "dark",
}: TouchRippleLayerProps) {
  const reducedMotion = useReducedMotion()
  const fillClass = tone === "light" ? "bg-white" : "bg-cocoa"

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { scale: 0, opacity: 0.24 }
            }
            animate={
              reducedMotion
                ? { opacity: [0, 0.14, 0] }
                : { scale: 2, opacity: 0 }
            }
            exit={{ opacity: 0 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_PANEL
            }
            onAnimationComplete={() => onDone(ripple.id)}
            style={
              reducedMotion
                ? { inset: 0 }
                : {
                    width: ripple.size,
                    height: ripple.size,
                    left: ripple.x - ripple.size / 2,
                    top: ripple.y - ripple.size / 2,
                  }
            }
            className={`pointer-events-none absolute rounded-full ${fillClass}`}
          />
        ))}
      </AnimatePresence>
    </span>
  )
}
