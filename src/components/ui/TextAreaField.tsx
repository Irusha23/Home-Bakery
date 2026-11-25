import { useId, type TextareaHTMLAttributes } from "react"

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  helperText?: string
  error?: string
}

export default function TextAreaField({
  label,
  helperText,
  error,
  id,
  className = "",
  ...props
}: TextAreaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <label className="block" htmlFor={fieldId}>
      <span className="mb-2 block text-sm font-semibold text-cocoa">
        {label}
      </span>
      <textarea
        id={fieldId}
        className={`min-h-textarea w-full resize-y rounded-control border bg-white px-4 py-3 text-base leading-relaxed text-cocoa outline-none transition duration-ui placeholder:text-muted-light focus:ring-3 ${
          error
            ? "border-error focus:border-error focus:ring-error/15"
            : "border-warm-border focus:border-sage focus:ring-sage/15"
        } ${className}`}
        {...props}
      />
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
