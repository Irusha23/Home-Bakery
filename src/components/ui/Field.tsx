import { Search } from "lucide-react"
import type { InputHTMLAttributes } from "react"

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
  const fieldId = id ?? label.toLowerCase().replace(/ /g, "-")

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
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            size={19}
          />
        ) : null}
        <input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          className={`min-h-touch w-full rounded-control border bg-white px-4 text-base text-cocoa outline-none transition duration-ui placeholder:text-muted-light focus:ring-3 disabled:cursor-not-allowed disabled:bg-neutral-soft ${
            error
              ? "border-error focus:border-error focus:ring-error/15"
              : "border-warm-border focus:border-sage focus:ring-sage/15"
          } ${isSearch ? "pl-11" : ""} ${className}`}
          {...props}
        />
      </span>
      {error || helperText ? (
        <span
          className={`mt-1.5 block text-xs leading-relaxed ${
            error ? "text-error" : "text-muted"
          }`}
        >
          {error ?? helperText}
        </span>
      ) : null}
    </label>
  )
}
