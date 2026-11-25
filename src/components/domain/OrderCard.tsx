import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Flame,
  RotateCcw,
  ShoppingBag,
} from "lucide-react"
import { getCollectionTargetMs } from "../../lib/countdown"
import { formatDate, formatLkr, formatTime } from "../../lib/format"
import type { Order, OrderStatus, PaymentStatus } from "../../types"
import CountdownBadge from "../ui/CountdownBadge"
import ItemThumbnail from "../ui/ItemThumbnail"
import StatusBadge from "../ui/StatusBadge"

function quickActionIcon(label: string) {
  if (label === "Confirm") return <Check aria-hidden="true" size={14} />
  if (label === "Collected") return <CheckCircle2 aria-hidden="true" size={14} />
  if (label === "Add payment") return <CreditCard aria-hidden="true" size={14} />
  if (label === "Record refund") return <RotateCcw aria-hidden="true" size={14} />
  if (label === "To buy") return <ShoppingBag aria-hidden="true" size={14} />
  return <Flame aria-hidden="true" size={14} />
}

function orderTone(status: OrderStatus, prepStatus: Order["preparationStatus"]) {
  if (status === "Completed") return "success" as const
  if (status === "Cancelled") return "neutral" as const
  if (status === "Draft") return "warning" as const
  if (prepStatus === "Ready") return "success" as const
  return "progress" as const
}

function orderLabel(status: OrderStatus, prepStatus: Order["preparationStatus"]) {
  if (status === "Confirmed" || status === "In Progress") {
    if (prepStatus === "Ready") return "Ready"
    if (prepStatus === "In progress") return "Preparing"
    return "Confirmed"
  }
  return status
}

function paymentTone(status: PaymentStatus) {
  if (status === "Paid") return "success" as const
  if (status === "Part paid") return "progress" as const
  if (status === "Refunded") return "neutral" as const
  return "warning" as const
}

type OrderCardProps = {
  order: Order
  thumbnailImage?: string
  balanceDue?: number
  retainedAmount?: number
  profitLkr?: number
  quickActionLabel?: string
  onQuickAction?: () => void
  onClick: () => void
}

export default function OrderCard({
  order,
  thumbnailImage,
  balanceDue,
  retainedAmount,
  profitLkr,
  quickActionLabel,
  onQuickAction,
  onClick,
}: OrderCardProps) {
  const productSummary = order.lines
    .map((line) => `${line.quantity} × ${line.productName}`)
    .join(", ")

  const statusText = orderLabel(order.status, order.preparationStatus)

  return (
    <div className="rounded-card border border-warm-border bg-white shadow-subtle transition duration-ui ease-out hover:border-sage-border hover:shadow-card">
      <button
        type="button"
        onClick={onClick}
        className="w-full p-4 text-left transition-transform duration-ui ease-out active:scale-[0.988] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ItemThumbnail
              image={thumbnailImage}
              alt={order.customerName}
              size="sm"
            />
            <div className="min-w-0">
              <div className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-cocoa">
                {order.customerName}
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">
                {productSummary || "No items yet"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="text-right">
              <span className="block text-sm font-bold tabular-nums text-cocoa">
                {formatLkr(order.agreedPrice)}
              </span>
              {balanceDue !== undefined &&
              balanceDue > 0 &&
              order.status !== "Draft" &&
              order.status !== "Cancelled" ? (
                <span className="block text-[11px] font-semibold tabular-nums text-warning">
                  Due {formatLkr(balanceDue)}
                </span>
              ) : order.status === "Cancelled" &&
                retainedAmount !== undefined &&
                retainedAmount > 0 ? (
                <span className="block text-[11px] font-semibold tabular-nums text-warning">
                  Held {formatLkr(retainedAmount)}
                </span>
              ) : order.status === "Completed" && profitLkr !== undefined ? (
                <span
                  className={`block text-[11px] font-semibold tabular-nums ${
                    profitLkr >= 0 ? "text-success" : "text-error"
                  }`}
                >
                  Profit {profitLkr >= 0 ? "+" : "−"}
                  {formatLkr(Math.abs(profitLkr))}
                </span>
              ) : null}
            </div>
            <ChevronRight aria-hidden="true" size={16} className="text-muted" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-warm-border/70 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <CalendarDays aria-hidden="true" size={13} className="text-sage" />
              <span>
                {formatDate(order.collectionDate)} · {formatTime(order.collectionTime)}
              </span>
            </span>
            {order.status !== "Completed" && order.status !== "Cancelled" ? (
              <CountdownBadge
                targetMs={getCollectionTargetMs(
                  order.collectionDate,
                  order.collectionTime,
                )}
              />
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge tone={orderTone(order.status, order.preparationStatus)}>
              {statusText}
            </StatusBadge>
            {order.status !== "Draft" &&
            (order.status !== "Cancelled" || order.payments.length > 0) ? (
              order.status === "Cancelled" &&
              retainedAmount === 0 &&
              order.paymentStatus !== "Refunded" ? (
                <StatusBadge tone="success">Settled</StatusBadge>
              ) : (
                <StatusBadge tone={paymentTone(order.paymentStatus)}>
                  {order.paymentStatus}
                </StatusBadge>
              )
            ) : null}
          </div>
        </div>
      </button>

      {quickActionLabel && onQuickAction ? (
        <div className="border-t border-warm-border/70 px-4 py-2.5">
          <button
            type="button"
            onClick={onQuickAction}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-control bg-sage-soft px-3 py-2 text-center text-xs font-semibold text-cocoa transition hover:bg-sage hover:text-white active:scale-button"
          >
            {quickActionIcon(quickActionLabel)}
            <span>{quickActionLabel}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
