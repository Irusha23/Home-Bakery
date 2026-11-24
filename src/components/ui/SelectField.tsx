import type { SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { REDUCED_MOTION_TRANSITION, SPRING_MICRO } from "../../lib/motion"

type Option = {
  value: string
  label: string
  disabled?: boolean
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: Option[]
  helperText?: string
  error?: string
}

export default function SelectField({
  label,
  options,
  helperText,
  error,
  id,
  className = "",
  ...props
}: SelectFieldProps) {
  const reducedMotion = useReducedMotion()
  const fieldId = id ?? label.toLowerCase().replace(/ /g, "-")
  const message = error ?? helperText

  return (
    <label className="block" htmlFor={fieldId}>
      <span className="mb-2 block text-sm font-semibold text-cocoa">
        {label}
      </span>
      <span className="relative block">
        <select
          id={fieldId}
          className={`min-h-touch w-full appearance-none rounded-control border bg-white px-4 pr-10 text-base text-cocoa outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out focus:ring-3 ${
            error
              ? "border-error focus:border-error focus:ring-error/15"
              : "border-warm-border focus:border-sage focus:ring-sage/15"
          } ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-transform duration-200"
          size={18}
        />
      </span>
      <AnimatePresence initial={false}>
        {message ? (
          <motion.span
            key={error ? `err-${error}` : `help-${message}`}
            initial={
              reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO
            }
            className={`mt-1.5 block origin-top text-xs leading-relaxed transition-colors duration-200 ${
              error ? "text-error" : "text-muted"
            }`}
          >
            {message}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </label>
  )
}
