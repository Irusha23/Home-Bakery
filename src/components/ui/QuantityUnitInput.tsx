import { useId } from "react"
import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { REDUCED_MOTION_TRANSITION, SPRING_MICRO } from "../../lib/motion"
import { sanitizeNumericDraft } from "../../lib/quantityInput"
import type { Unit } from "../../types"

type QuantityUnitInputProps = {
  value: string
  onValueChange: (next: string) => void
  onBlur?: () => void
  unit: Unit
  units: Unit[]
  onUnitChange: (nextUnit: Unit) => void
  size?: "compact" | "default"
  label?: string
  hideLabel?: boolean
  ariaLabel?: string
  helperText?: string
  error?: string
  placeholder?: string
  allowDecimal?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Minimalistic joined numeric input + measurement unit dropdown (`[ 150 | g ▾ ]`).
 * Keeps raw string drafts so users can always backspace to empty and retype freely.
 */
export default function QuantityUnitInput({
  value,
  onValueChange,
  onBlur,
  unit,
  units,
  onUnitChange,
  size = "default",
  label,
  hideLabel = false,
  ariaLabel,
  helperText,
  error,
  placeholder = "0",
  allowDecimal = true,
  disabled = false,
  className = "",
}: QuantityUnitInputProps) {
  const reducedMotion = useReducedMotion()
  const inputId = useId()
  const message = error ?? helperText
  const availableUnits = units.length > 0 ? units : [unit]
  const hasMultipleUnits = availableUnits.length > 1
  const isCompact = size === "compact"
  const accessibleName = ariaLabel ?? label ?? "Quantity"

  return (
    <div className={`block ${className}`.trim()}>
      {label ? (
        <label
          htmlFor={inputId}
          className={
            hideLabel ? "sr-only" : "mb-2 block text-sm font-semibold text-cocoa"
          }
        >
          {label}
        </label>
      ) : null}

      <div
        onPointerDown={(event) => event.stopPropagation()}
        className={`flex items-stretch overflow-hidden rounded-control border bg-white transition-[border-color,box-shadow,background-color] duration-200 ease-out focus-within:ring-3 ${
          disabled ? "bg-neutral-soft text-muted" : ""
        } ${
          error
            ? "border-error focus-within:border-error focus-within:ring-error/15"
            : "border-warm-border focus-within:border-sage focus-within:ring-sage/15"
        } ${isCompact ? "h-9" : "min-h-touch"}`}
      >
        <input
          id={inputId}
          type="text"
          inputMode={allowDecimal ? "decimal" : "numeric"}
          autoComplete="off"
          aria-label={label && !hideLabel ? undefined : accessibleName}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) =>
            onValueChange(sanitizeNumericDraft(event.target.value, allowDecimal))
          }
          onBlur={onBlur}
          className={`min-w-0 flex-1 bg-transparent text-cocoa outline-none placeholder:text-muted-light disabled:cursor-not-allowed ${
            isCompact
              ? "px-2.5 text-right text-xs font-semibold tabular-nums"
              : "px-3.5 text-base tabular-nums"
          }`}
        />

        {hasMultipleUnits ? (
          <div className="relative flex shrink-0 items-center border-l border-warm-border bg-ivory/40">
            <select
              aria-label={`${accessibleName} unit`}
              disabled={disabled}
              value={unit}
              onChange={(event) => onUnitChange(event.target.value as Unit)}
              className={`h-full cursor-pointer appearance-none bg-transparent font-semibold text-cocoa outline-none disabled:cursor-not-allowed ${
                isCompact ? "pl-2.5 pr-6 text-xs" : "pl-3 pr-7 text-sm"
              }`}
            >
              {availableUnits.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              size={isCompact ? 13 : 15}
              className={`pointer-events-none absolute text-muted ${
                isCompact ? "right-1.5" : "right-2"
              }`}
            />
          </div>
        ) : (
          <span
            aria-label={`${accessibleName} unit: ${unit}`}
            className={`flex shrink-0 items-center border-l border-warm-border bg-ivory/40 font-semibold text-muted ${
              isCompact ? "px-2.5 text-xs" : "px-3 text-sm"
            }`}
          >
            {unit}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {message ? (
          <motion.span
            key={error ? `err-${error}` : `help-${message}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO}
            className={`mt-1.5 block origin-top text-xs leading-relaxed transition-colors duration-200 ${
              error ? "text-error" : "text-muted"
            }`}
          >
            {message}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
