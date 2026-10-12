import type { HTMLAttributes, ReactNode } from "react"

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  tone?: "default" | "sage" | "warning"
}

const toneClasses = {
  default: "border-warm-border bg-white",
  sage: "border-sage-border bg-sage-soft",
  warning: "border-warning-border bg-warning-soft",
}

export default function Card({
  children,
  className = "",
  tone = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-card border p-4 shadow-subtle ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
