import { AlertTriangle, Check, Circle, Clock3 } from "lucide-react"
import type { ReactNode } from "react"

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
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {icons[tone]}
      {children}
    </span>
  )
}
