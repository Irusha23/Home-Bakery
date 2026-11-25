import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { useIsPresent } from "motion/react"
import { useBackHandler } from "../lib/backStack"
import { IconButton } from "./ui/Button"

type ScreenHeaderProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
  icon?: ReactNode
  onBack?: () => void
  backLabel?: string
  compact?: boolean
}

export default function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
  icon,
  onBack,
  backLabel = "Go back",
  compact = false,
}: ScreenHeaderProps) {
  const isPresent = useIsPresent()
  useBackHandler(onBack, Boolean(onBack) && isPresent)

  return (
    <header
      className={`screen-header border-b border-warm-border/75 ${
        compact ? "pb-3" : "pb-4"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {onBack ? (
          <IconButton label={backLabel} onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={19} />
          </IconButton>
        ) : icon ? (
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-card bg-sage-soft text-sage-dark">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="truncate text-nav font-bold uppercase tracking-section text-sage-dark">
              {eyebrow}
            </p>
          ) : null}
          <div
            className={`line-clamp-2 font-semibold tracking-tight text-cocoa ${
              compact ? "text-xl" : onBack ? "text-title" : "text-screen-title"
            }`}
          >
            {title}
          </div>
          {subtitle ? (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  )
}
