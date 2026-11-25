import { Check } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  REDUCED_MOTION_TRANSITION,
  SPRING_ELASTIC,
  SPRING_MICRO,
} from "../../lib/motion"
import { TouchRippleLayer, useTouchRipple } from "./TouchRipple"

type CheckboxFieldProps = {
  checked: boolean
  label: string
  description?: string
  onChange: (checked: boolean) => void
}

export default function CheckboxField({
  checked,
  label,
  description,
  onChange,
}: CheckboxFieldProps) {
  const reducedMotion = useReducedMotion()
  const { ripples, triggerRipple, removeRipple } = useTouchRipple()

  return (
    <motion.label
      onPointerDown={triggerRipple}
      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
      transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO}
      className={`relative flex min-h-touch cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors duration-200 ease-out ${
        checked
          ? "border-sage-border bg-sage-soft/50"
          : "border-warm-border bg-white hover:bg-ivory/60"
      }`}
    >
      <TouchRippleLayer ripples={ripples} onDone={removeRipple} tone="dark" />
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <motion.span
        aria-hidden="true"
        animate={{ scale: checked && !reducedMotion ? [0.92, 1.06, 1] : 1 }}
        transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_ELASTIC}
        className={`relative z-10 mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${
          checked
            ? "border-sage bg-sage text-white"
            : "border-sage-border bg-white text-transparent"
        }`}
      >
        <AnimatePresence>
          {checked ? (
            <motion.span
              key="check"
              initial={
                reducedMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }
              }
              animate={{ scale: 1, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
              transition={
                reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_ELASTIC
              }
              className="inline-flex"
            >
              <Check size={13} strokeWidth={2.75} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.span>
      <span className="relative z-10">
        <span className="block text-sm font-semibold text-cocoa">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {description}
          </span>
        ) : null}
      </span>
    </motion.label>
  )
}
