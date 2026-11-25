import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import {
  REDUCED_MOTION_TRANSITION,
  SPRING_MICRO,
  SPRING_NUDGE,
} from "../../lib/motion"
import { TouchRippleLayer, useTouchRipple } from "./TouchRipple"

type StepperProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  large?: boolean
  onChange: (value: number) => void
}

function roundStep(value: number, step: number) {
  if (Number.isInteger(step)) return Math.round(value)
  const precision = Math.max(1, String(step).split(".")[1]?.length ?? 2)
  return Number(value.toFixed(precision))
}

export default function Stepper({
  label,
  value,
  min = 0,
  max,
  step = 1,
  unit,
  large = false,
  onChange,
}: StepperProps) {
  const reducedMotion = useReducedMotion()
  const decRipple = useTouchRipple()
  const incRipple = useTouchRipple()
  const [boundHit, setBoundHit] = useState<{ dir: -1 | 1; count: number } | null>(
    null,
  )

  const canDecrease = value > min
  const canIncrease = max === undefined || value < max
  const buttonSize = large ? "size-12" : "size-10"

  const update = (delta: number) => {
    const next = roundStep(value + delta, step)
    const clampedMin = Math.max(min, next)
    const clamped = max !== undefined ? Math.min(max, clampedMin) : clampedMin
    onChange(clamped)
  }

  return (
    <div
      className={`inline-flex items-center rounded-control border border-warm-border bg-white p-1 transition-colors duration-200 ${
        large ? "min-h-kitchen-touch" : "min-h-touch"
      }`}
      aria-label={label}
    >
      <motion.button
        type="button"
        aria-label={`Decrease ${label}`}
        aria-disabled={!canDecrease || undefined}
        onPointerDown={decRipple.triggerRipple}
        onClick={() => {
          if (!canDecrease) {
            setBoundHit((prev) => ({ dir: -1, count: (prev?.count ?? 0) + 1 }))
            return
          }
          update(-step)
        }}
        whileTap={reducedMotion ? undefined : { scale: 0.92 }}
        animate={
          boundHit?.dir === -1
            ? reducedMotion
              ? { opacity: [0.35, 0.65, 0.35] }
              : { x: [0, -4, 2, 0] }
            : { x: 0, opacity: canDecrease ? 1 : 0.35 }
        }
        transition={
          boundHit?.dir === -1
            ? SPRING_NUDGE
            : reducedMotion
              ? REDUCED_MOTION_TRANSITION
              : SPRING_MICRO
        }
        className={`relative inline-flex ${buttonSize} items-center justify-center rounded-control text-cocoa transition-colors duration-200 hover:bg-sage-soft hover:text-sage-dark ${
          !canDecrease ? "cursor-not-allowed opacity-35" : ""
        }`}
      >
        <TouchRippleLayer
          ripples={decRipple.ripples}
          onDone={decRipple.removeRipple}
        />
        <Minus aria-hidden="true" size={large ? 20 : 17} />
      </motion.button>

      <motion.output
        key={value}
        aria-live="polite"
        initial={reducedMotion ? { opacity: 0.6 } : { scale: 0.9, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO}
        className={`min-w-14 px-2 text-center font-semibold tabular-nums text-cocoa ${
          large ? "text-base" : "text-sm"
        }`}
      >
        {value}
        {unit ? ` ${unit}` : ""}
      </motion.output>

      <motion.button
        type="button"
        aria-label={`Increase ${label}`}
        aria-disabled={!canIncrease || undefined}
        onPointerDown={incRipple.triggerRipple}
        onClick={() => {
          if (!canIncrease) {
            setBoundHit((prev) => ({ dir: 1, count: (prev?.count ?? 0) + 1 }))
            return
          }
          update(step)
        }}
        whileTap={reducedMotion ? undefined : { scale: 0.92 }}
        animate={
          boundHit?.dir === 1
            ? reducedMotion
              ? { opacity: [0.35, 0.65, 0.35] }
              : { x: [0, 4, -2, 0] }
            : { x: 0, opacity: canIncrease ? 1 : 0.35 }
        }
        transition={
          boundHit?.dir === 1
            ? SPRING_NUDGE
            : reducedMotion
              ? REDUCED_MOTION_TRANSITION
              : SPRING_MICRO
        }
        className={`relative inline-flex ${buttonSize} items-center justify-center rounded-control text-cocoa transition-colors duration-200 hover:bg-sage-soft hover:text-sage-dark ${
          !canIncrease ? "cursor-not-allowed opacity-35" : ""
        }`}
      >
        <TouchRippleLayer
          ripples={incRipple.ripples}
          onDone={incRipple.removeRipple}
        />
        <Plus aria-hidden="true" size={large ? 20 : 17} />
      </motion.button>
    </div>
  )
}
