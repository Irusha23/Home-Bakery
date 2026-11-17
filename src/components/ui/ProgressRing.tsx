import { motion, useReducedMotion } from "motion/react"
import { INSTANT_TRANSITION, IOS_TRANSITION } from "../../lib/motion"

type ProgressRingProps = {
  progress: number
  size?: number
  strokeWidth?: number
  tone?: "sage" | "warning" | "error" | "success"
  label?: string
  sublabel?: string
}

const strokeColors = {
  sage: "stroke-sage",
  success: "stroke-success",
  warning: "stroke-warning",
  error: "stroke-error",
}

export default function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 6,
  tone = "sage",
  label,
  sublabel,
}: ProgressRingProps) {
  const reducedMotion = useReducedMotion()
  const clamped = Math.max(0, Math.min(progress, 1))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-neutral-soft"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={reducedMotion ? INSTANT_TRANSITION : IOS_TRANSITION}
          className={strokeColors[tone]}
        />
      </svg>
      {label ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold tabular-nums leading-none text-cocoa">
            {label}
          </span>
          {sublabel ? (
            <span className="mt-0.5 text-[10px] leading-none text-muted">
              {sublabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
