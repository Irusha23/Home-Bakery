import type { ReactNode } from "react"
import { AlertTriangle, Check, Circle, Clock3 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { REDUCED_MOTION_TRANSITION, SPRING_ELASTIC } from "../../lib/motion"

type StatusTone = "success" | "warning" | "neutral" | "progress"

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-neutral-soft text-muted",
  progress: "bg-sage-soft text-sage-dark",
}

const icons: Record<StatusTone, ReactNode> = {
  success: <Check aria-hidden="true" size={12} strokeWidth={2.5} />,
  warning: <AlertTriangle aria-hidden="true" size={12} strokeWidth={2.25} />,
  neutral: <Circle aria-hidden="true" size={8} fill="currentColor" />,
  progress: <Clock3 aria-hidden="true" size={12} strokeWidth={2.25} />,
}

type StatusBadgeProps = {
  children: ReactNode
  tone?: StatusTone
}

export default function StatusBadge({
  children,
  tone = "neutral",
}: StatusBadgeProps) {
  const reducedMotion = useReducedMotion()

  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ease-out ${toneClasses[tone]}`}
    >
      <motion.span
        key={tone}
        initial={reducedMotion ? { opacity: 0.4 } : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_ELASTIC}
        className="inline-flex items-center"
      >
        {icons[tone]}
      </motion.span>
      {children}
    </span>
  )
}
