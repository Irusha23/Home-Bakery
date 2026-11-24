import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"

type GroupedListProps = {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function GroupedList({
  title,
  action,
  children,
  className = "",
}: GroupedListProps) {
  return (
    <section className={className}>
      {title || action ? (
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          {title ? (
            <h2 className="text-[11px] font-semibold uppercase tracking-section text-muted">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <div className="divide-y divide-warm-border/75 overflow-hidden rounded-grouped border border-warm-border bg-white shadow-grouped">
        {children}
      </div>
    </section>
  )
}

type ListRowProps = {
  title: string
  subtitle?: string
  value?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  showChevron?: boolean
  onClick?: () => void
  tone?: "default" | "danger" | "sage"
  className?: string
}

export function ListRow({
  title,
  subtitle,
  value,
  leading,
  trailing,
  showChevron = false,
  onClick,
  tone = "default",
  className = "",
}: ListRowProps) {
  const titleToneClass =
    tone === "danger"
      ? "text-error"
      : tone === "sage"
        ? "text-sage-dark"
        : "text-cocoa"

  const content = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1 text-left">
        <div className={`line-clamp-2 text-sm font-semibold leading-snug ${titleToneClass}`}>
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">
            {subtitle}
          </div>
        ) : null}
      </div>
      {value !== undefined && value !== null ? (
        <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-cocoa">
          {value}
        </div>
      ) : null}
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
      {showChevron ? (
        <ChevronRight
          aria-hidden="true"
          size={17}
          className="shrink-0 text-muted-light"
        />
      ) : null}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-touch w-full items-center gap-3 px-4 py-3 transition duration-ui ease-out hover:bg-ivory/70 active:scale-[0.99] active:bg-sage-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage/35 ${className}`}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={`flex min-h-touch items-center gap-3 px-4 py-3 ${className}`}
    >
      {content}
    </div>
  )
}
