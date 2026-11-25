import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import {
  REDUCED_MOTION_TRANSITION,
  SPRING_MICRO,
  SPRING_NUDGE,
} from "../../lib/motion"
import { TouchRippleLayer, useTouchRipple } from "./TouchRipple"

type QuantityControlProps = {
  label: string
  value: number
  min?: number
  onChange: (value: number) => void
}

export default function QuantityControl({
  label,
  value,
  min = 0,
  onChange,
}: QuantityControlProps) {
  const reducedMotion = useReducedMotion()
  const decRipple = useTouchRipple()
  const incRipple = useTouchRipple()
  const [minNudge, setMinNudge] = useState(0)
  const canDecrease = value > min

  return (
    <div
      className="inline-flex min-h-touch items-center rounded-control border border-warm-border bg-white p-1 transition-colors duration-200"
      aria-label={label}
    >
      <motion.button
        type="button"
        aria-label={`Decrease ${label}`}
        aria-disabled={!canDecrease || undefined}
        onPointerDown={decRipple.triggerRipple}
        onClick={() => {
          if (!canDecrease) {
            setMinNudge((c) => c + 1)
            return
          }
          onChange(Math.max(min, value - 1))
        }}
        whileTap={reducedMotion ? undefined : { scale: 0.92 }}
        animate={
          !canDecrease && minNudge > 0
            ? reducedMotion
              ? { opacity: [0.35, 0.65, 0.35] }
              : { x: [0, -4, 2, 0], opacity: 0.35 }
            : { x: 0, opacity: canDecrease ? 1 : 0.35 }
        }
        onAnimationComplete={() => {
          if (minNudge > 0) setMinNudge(0)
        }}
        transition={
          !canDecrease && minNudge > 0
            ? SPRING_NUDGE
            : reducedMotion
              ? REDUCED_MOTION_TRANSITION
              : SPRING_MICRO
        }
        className={`relative inline-flex size-9 items-center justify-center rounded-control text-muted transition-colors duration-200 hover:bg-sage-soft hover:text-sage-dark ${
          !canDecrease ? "cursor-not-allowed" : ""
        }`}
      >
        <TouchRippleLayer
          ripples={decRipple.ripples}
          onDone={decRipple.removeRipple}
        />
        <Minus aria-hidden="true" size={17} />
      </motion.button>

      <motion.output
        key={value}
        initial={reducedMotion ? { opacity: 0.6 } : { scale: 0.9, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO}
        className="min-w-10 text-center text-sm font-semibold tabular-nums text-cocoa"
        aria-live="polite"
      >
        {value}
      </motion.output>

      <motion.button
        type="button"
        aria-label={`Increase ${label}`}
        onPointerDown={incRipple.triggerRipple}
        onClick={() => onChange(value + 1)}
        whileTap={reducedMotion ? undefined : { scale: 0.92 }}
        transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO}
        className="relative inline-flex size-9 items-center justify-center rounded-control text-muted transition-colors duration-200 hover:bg-sage-soft hover:text-sage-dark"
      >
        <TouchRippleLayer
          ripples={incRipple.ripples}
          onDone={incRipple.removeRipple}
        />
        <Plus aria-hidden="true" size={17} />
      </motion.button>
    </div>
  )
}
