import { formatLkr } from "../../lib/format"

type MoneyTextProps = {
  amount: number
  signed?: boolean
  className?: string
}

export default function MoneyText({
  amount,
  signed = false,
  className = "",
}: MoneyTextProps) {
  const prefix = signed && amount > 0 ? "+" : ""
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatLkr(amount)}
    </span>
  )
}
