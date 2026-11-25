import { useId } from "react"
import { motion, useReducedMotion } from "motion/react"
import { INSTANT_TRANSITION, PILL_SPRING } from "../../lib/motion"

type Segment<T extends string,> = {
  value: T
  label: string
}

type SegmentedControlProps<T extends string,> = {
  label: string
  value: T
  segments: Segment<T>[]
  onChange: (value: T) => void
}

export default function SegmentedControl<T extends string>({
  label,
  value,
  segments,
  onChange,
}: SegmentedControlProps<T>) {
  const layoutId = useId()
  const reducedMotion = useReducedMotion()

  return (
    <div
      className="scrollbar-hidden inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-warm-border bg-neutral-soft/75 p-1"
      role="group"
      aria-label={label}
    >
      {segments.map((segment) => {
        const isActive = segment.value === value
        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(segment.value)}
            className={`relative min-h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors duration-ui focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/25 ${
              isActive ? "text-white" : "text-muted hover:text-cocoa"
            }`}
          >
            {isActive ? (
              <motion.span
                layoutId={`segment-pill-${layoutId}`}
                transition={reducedMotion ? INSTANT_TRANSITION : PILL_SPRING}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-sage shadow-subtle"
              />
            ) : null}
            <span className="relative z-10">{segment.label}</span>
          </button>
        )
      })}
    </div>
  )
}
