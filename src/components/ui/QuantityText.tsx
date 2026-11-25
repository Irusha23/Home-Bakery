import { formatQuantity } from "../../lib/format"
import type { Unit } from "../../types"

type QuantityTextProps = {
  quantity: number
  unit: Unit
  className?: string
}

export default function QuantityText({
  quantity,
  unit,
  className = "",
}: QuantityTextProps) {
  return (
    <span className={`tabular-nums ${className}`}>
      {formatQuantity(quantity, unit)}
    </span>
  )
}
