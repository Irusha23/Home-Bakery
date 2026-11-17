import { useEffect, useState } from "react"
import { Timer } from "lucide-react"
import { formatCountdown } from "../../lib/countdown"

type CountdownBadgeProps = {
  targetMs: number | null
  prefix?: string
  overdueLabel?: string
  urgentThresholdMs?: number
  className?: string
}

export default function CountdownBadge({
  targetMs,
  prefix,
  overdueLabel = "Overdue",
  urgentThresholdMs = 3 * 3_600_000,
  className = "",
}: CountdownBadgeProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (targetMs === null) return
    setNow(Date.now())
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [targetMs])

  if (targetMs === null) return null

  const diffMs = targetMs - now
  const { text, overdue } = formatCountdown(diffMs)
  const urgent = !overdue && diffMs <= urgentThresholdMs

  const toneClass = overdue
    ? "bg-warning-soft text-error"
    : urgent
      ? "bg-warning-soft text-warning"
      : "bg-sage-soft text-sage-dark"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${toneClass} ${className}`}
    >
      <Timer aria-hidden="true" size={12} className="shrink-0" />
      <span>
        {overdue
          ? `${overdueLabel} ${text}`
          : prefix
            ? `${prefix} ${text}`
            : text}
      </span>
    </span>
  )
}
