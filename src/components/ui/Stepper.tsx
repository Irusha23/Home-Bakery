import { Minus, Plus } from "lucide-react"

type StepperProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  large?: boolean
  onChange: (value: number) => void
}

function roundStep(value: number, step: number) {
  if (Number.isInteger(step)) return Math.round(value)
  const precision = Math.max(1, String(step).split(".")[1]?.length ?? 2)
  return Number(value.toFixed(precision))
}

export default function Stepper({
  label,
  value,
  min = 0,
  max,
  step = 1,
  unit,
  large = false,
  onChange,
}: StepperProps) {
  const canDecrease = value > min
  const canIncrease = max === undefined || value < max
  const buttonSize = large ? "size-12" : "size-10"

  const update = (delta: number) => {
    const next = roundStep(value + delta, step)
    const clampedMin = Math.max(min, next)
    const clamped = max !== undefined ? Math.min(max, clampedMin) : clampedMin
    onChange(clamped)
  }

  return (
    <div
      className={`inline-flex items-center rounded-control border border-warm-border bg-white p-1 ${
        large ? "min-h-kitchen-touch" : "min-h-touch"
      }`}
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={!canDecrease}
        onClick={() => update(-step)}
        className={`inline-flex ${buttonSize} items-center justify-center rounded-control text-cocoa transition hover:bg-sage-soft hover:text-sage-dark active:scale-button disabled:opacity-30`}
      >
        <Minus aria-hidden="true" size={large ? 20 : 17} />
      </button>
      <output
        aria-live="polite"
        className={`min-w-14 px-2 text-center font-semibold tabular-nums text-cocoa ${
          large ? "text-base" : "text-sm"
        }`}
      >
        {value}
        {unit ? ` ${unit}` : ""}
      </output>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={!canIncrease}
        onClick={() => update(step)}
        className={`inline-flex ${buttonSize} items-center justify-center rounded-control text-cocoa transition hover:bg-sage-soft hover:text-sage-dark active:scale-button disabled:opacity-30`}
      >
        <Plus aria-hidden="true" size={large ? 20 : 17} />
      </button>
    </div>
  )
}
