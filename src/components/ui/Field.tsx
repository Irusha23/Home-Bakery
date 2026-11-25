import { Search } from "lucide-react"
import type { InputHTMLAttributes } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { REDUCED_MOTION_TRANSITION, SPRING_MICRO } from "../../lib/motion"

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  helperText?: string
  error?: string
  hideLabel?: boolean
  isSearch?: boolean
}

export default function Field({
  label,
  helperText,
  error,
  hideLabel = false,
  isSearch = false,
  className = "",
  id,
  ...props
}: FieldProps) {
  const reducedMotion = useReducedMotion()
  const fieldId = id ?? label.toLowerCase().replace(/ /g, "-")
  const message = error ?? helperText

  return (
    <label className="block" htmlFor={fieldId}>
      <span
        className={
          hideLabel ? "sr-only" : "mb-2 block text-sm font-semibold text-cocoa"
        }
      >
        {label}
      </span>
      <span className="relative block">
        {isSearch ? (
          <Search
            aria-hidden="true"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors duration-200"
            size={19}
          />
        ) : null}
        <input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          className={`min-h-touch w-full rounded-control border bg-white px-4 text-base text-cocoa outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out placeholder:text-muted-light focus:ring-3 disabled:cursor-not-allowed disabled:bg-neutral-soft ${
            error
              ? "border-error focus:border-error focus:ring-error/15"
              : "border-warm-border focus:border-sage focus:ring-sage/15"
          } ${isSearch ? "pl-11" : ""} ${className}`}
          {...props}
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
