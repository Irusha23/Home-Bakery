import { useEffect, useState, type ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

type LargeTitleHeaderProps = {
  title: string
  subtitle?: string
  eyebrow?: string
  onBack?: () => void
  backLabel?: string
  trailing?: ReactNode
}

export default function LargeTitleHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel = "Back",
  trailing,
}: LargeTitleHeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 28)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className="mb-4">
      <div
        className={`sticky top-0 z-20 -mx-4 flex min-h-12 items-center justify-between gap-2 px-4 py-2 transition-colors duration-200 ${
          scrolled
            ? "border-b border-warm-border/80 bg-ivory/88 backdrop-blur-nav"
            : "bg-transparent"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="inline-flex min-h-touch items-center gap-1.5 rounded-full px-2 -ml-2 text-sm font-semibold text-sage-dark transition hover:bg-sage-soft active:scale-button focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30"
            >
              <ArrowLeft aria-hidden="true" size={18} />
              <span>{backLabel}</span>
            </button>
          ) : eyebrow ? (
            <span className="truncate text-[11px] font-semibold uppercase tracking-section text-muted">
              {eyebrow}
            </span>
          ) : null}
        </div>

        <span
          aria-hidden={!scrolled}
          className={`truncate text-sm font-semibold text-cocoa transition-opacity duration-200 ${
            scrolled ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {title}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>
      </div>

      <div className="pt-1">
        <h1 className="text-[2rem] font-semibold leading-[1.08] tracking-tight text-cocoa">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {subtitle}
          </p>
        ) : null}
      </div>
    </header>
  )
}
