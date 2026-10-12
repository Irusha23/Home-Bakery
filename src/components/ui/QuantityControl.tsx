import { Minus, Plus } from "lucide-react"

type QuantityControlProps = {
  label: string
  value: number
  min?: number
  onChange: (value: number) => void
}

export default function QuantityControl({
  label,
  value,
  min = 0,
  onChange,
}: QuantityControlProps) {
  return (
    <div
      className="inline-flex min-h-touch items-center rounded-control border border-warm-border bg-white p-1"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        className="inline-flex size-9 items-center justify-center rounded-control text-muted transition hover:bg-sage-soft hover:text-sage-dark disabled:opacity-35"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus aria-hidden="true" size={17} />
      </button>
      <output
        className="min-w-10 text-center text-sm font-semibold tabular-nums text-cocoa"
        aria-live="polite"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        className="inline-flex size-9 items-center justify-center rounded-control text-muted transition hover:bg-sage-soft hover:text-sage-dark"
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden="true" size={17} />
      </button>
    </div>
  )
}
