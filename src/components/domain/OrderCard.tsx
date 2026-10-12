import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  PackageCheck,
} from "lucide-react"
import { formatDate, formatLkr, formatTime } from "../../lib/format"
import type { Order, PaymentStatus, OrderStatus } from "../../types"
import StatusBadge from "../ui/StatusBadge"

function orderTone(status: OrderStatus) {
  if (status === "Completed") return "success" as const
  if (status === "Confirmed" || status === "In Progress")
    return "progress" as const
  if (status === "Cancelled") return "neutral" as const
  return "warning" as const
}

function paymentTone(status: PaymentStatus) {
  if (status === "Paid") return "success" as const
  if (status === "Part paid") return "progress" as const
  if (status === "Refunded") return "neutral" as const
  return "warning" as const
}

type OrderCardProps = {
  order: Order
  onClick: () => void
}

export default function OrderCard({ order, onClick }: OrderCardProps) {
  const totalQuantity = order.lines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  )
  const productSummary = order.lines
    .map((line) => `${line.quantity} × ${line.productName}`)
    .join(", ")

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-card border border-warm-border bg-white p-4 text-left shadow-subtle transition duration-ui hover:-translate-y-0.5 hover:border-sage-border hover:shadow-card active:translate-y-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/25"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-base font-semibold leading-snug text-cocoa">
          {order.customerName}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-muted"
          size={18}
        />
      </span>
      <span className="mt-1 flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
          {order.reference}
          {["Draft", "Cancelled", "Completed"].includes(order.status) ? (
            <StatusBadge tone={orderTone(order.status)}>
              {order.status}
            </StatusBadge>
          ) : null}
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-cocoa">
          {formatLkr(order.agreedPrice)}
        </span>
      </span>

      <span className="mt-3 block text-sm font-semibold leading-relaxed text-cocoa">
        {productSummary}
      </span>
      <span className="mt-1 block text-xs text-muted">
        {totalQuantity} {totalQuantity === 1 ? "product" : "products"}
      </span>

      <span className="mt-3 grid grid-cols-order-meta gap-3 rounded-control bg-ivory p-3">
        <span className="flex items-center gap-2 border-r border-warm-border pr-3 text-xs text-muted">
          <CalendarDays aria-hidden="true" size={15} className="text-sage" />
          <span>
            {formatDate(order.collectionDate)}
            <span className="mt-0.5 flex items-center gap-1 font-semibold text-cocoa">
              <Clock3 aria-hidden="true" size={12} />
              {formatTime(order.collectionTime)}
            </span>
          </span>
        </span>
        <span className="min-w-0 space-y-2">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-nav font-bold uppercase tracking-wide text-muted">
              <PackageCheck aria-hidden="true" size={12} />
              Prep
            </span>
            <span className="text-right text-xs font-semibold leading-tight text-cocoa">
              {order.preparationStatus}
            </span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-nav font-bold uppercase tracking-wide text-muted">
              <CircleDollarSign aria-hidden="true" size={12} />
              Paid
            </span>
            <span
              className={`text-xs font-semibold ${
                paymentTone(order.paymentStatus) === "success"
                  ? "text-success"
                  : paymentTone(order.paymentStatus) === "warning"
                    ? "text-warning"
                    : "text-sage-dark"
              }`}
            >
              {order.paymentStatus}
            </span>
          </span>
        </span>
      </span>
    </button>
  )
}
