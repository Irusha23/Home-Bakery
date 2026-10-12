import type { SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"

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
  const fieldId = id ?? label.toLowerCase().replaceAll(" ", "-")

  return (
    <label className="block" htmlFor={fieldId}>
      <span className="mb-2 block text-sm font-semibold text-cocoa">
        {label}
      </span>
      <span className="relative block">
        <select
          id={fieldId}
          className={`min-h-touch w-full appearance-none rounded-control border bg-white px-4 pr-10 text-base text-cocoa outline-none transition duration-ui focus:ring-3 ${
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
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
          size={18}
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
