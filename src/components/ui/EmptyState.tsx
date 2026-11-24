import type { ReactNode } from "react"
import Button from "./Button"
import Illustration, { type IllustrationName } from "./Illustration"

type EmptyStateProps = {
  icon?: ReactNode
  illustration?: IllustrationName
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  icon,
  illustration,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-card border border-dashed border-warm-border bg-white/80 px-5 py-8 text-center">
      {illustration ? (
        <Illustration name={illustration} size="md" />
      ) : icon ? (
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-sage-soft text-sage-dark">
          {icon}
        </div>
      ) : null}
      <h3 className="mt-3 text-base font-semibold text-cocoa">{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-muted">
        {description}
      </p>
      {actionLabel && onAction ? (
        <Button className="mt-4" size="compact" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
