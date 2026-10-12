import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"
import Button, { IconButton } from "./Button"

type DialogProps = {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

export default function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: DialogProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/25 p-3 backdrop-blur-overlay sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-dialog rounded-sheet border border-warm-border bg-white p-5 shadow-dialog motion-safe:animate-dialog-in"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              id="dialog-title"
              className="text-xl font-semibold tracking-tight text-cocoa"
            >
              {title}
            </div>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X aria-hidden="true" size={19} />
          </IconButton>
        </div>
        <div className="mt-5">{children}</div>
        {footer ? (
          <div className="mt-5">{footer}</div>
        ) : (
          <Button className="mt-5" fullWidth onClick={onClose}>
            Got it
          </Button>
        )}
      </div>
    </div>
  )
}
