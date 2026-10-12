import type { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost"
type ButtonSize = "default" | "compact"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-sage text-white shadow-button hover:bg-sage-dark active:scale-button",
  secondary:
    "border border-warm-border bg-white text-cocoa hover:bg-ivory active:scale-button",
  soft: "bg-sage-soft text-sage-dark hover:bg-sage-soft-strong active:scale-button",
  ghost: "bg-transparent text-cocoa hover:bg-sage-soft active:scale-button",
}

const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-touch rounded-control px-5 py-3 text-sm",
  compact: "min-h-touch rounded-control px-3 py-2 text-sm",
}

export default function Button({
  children,
  className = "",
  leadingIcon,
  trailingIcon,
  variant = "primary",
  size = "default",
  fullWidth = false,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition duration-ui ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30 disabled:pointer-events-none disabled:opacity-45 ${variantClasses[variant]} ${sizeClasses[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
}

export function IconButton({
  label,
  children,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex size-touch shrink-0 items-center justify-center rounded-full border border-warm-border bg-white text-cocoa shadow-subtle transition duration-ui hover:bg-sage-soft active:scale-button focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
