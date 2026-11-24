import Card from "../ui/Card"
import ItemThumbnail from "../ui/ItemThumbnail"
import Sheet from "../ui/Sheet"
import { formatDate, formatLkr, formatQuantity } from "../../lib/format"
import { useAppState } from "../../state/AppState"
import type { ShoppingTripRecord } from "../../types"

type ShoppingReceiptSheetProps = {
  trip: ShoppingTripRecord | null
  onClose: () => void
}

export default function ShoppingReceiptSheet({
  trip,
  onClose,
}: ShoppingReceiptSheetProps) {
  const { state } = useAppState()
  if (!trip) return null

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Shopping invoice · ${trip.reference}`}
      subtitle={formatDate(trip.date)}
    >
      <div className="space-y-4">
        <Card tone="sage" className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted">
              {trip.items.length}{" "}
              {trip.items.length === 1 ? "item" : "items"} bought
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-cocoa">
              {trip.totalSpent !== null
                ? formatLkr(trip.totalSpent)
                : "No expense recorded"}
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-cocoa">
            {trip.reference}
          </span>
        </Card>

        <div className="divide-y divide-warm-border rounded-card border border-warm-border bg-white">
          {trip.items.map((item) => {
            const invItem = state.inventory.find(
              (inv) => inv.inventoryId === item.inventoryId,
            )
            return (
            <div key={item.inventoryId} className="space-y-1.5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ItemThumbnail
                    image={invItem?.image}
                    alt={item.name}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-cocoa">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatQuantity(item.quantity, item.unit)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-cocoa">
                  {item.estimatedCost !== null
                    ? formatLkr(item.estimatedCost)
                    : "—"}
                </span>
              </div>
              {item.orders.length > 0 ? (
                <div className="space-y-0.5 pt-0.5">
                  {item.orders.map((order) => (
                    <div
                      key={order.orderId}
                      className="flex items-center justify-between gap-2 text-xs text-muted"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="size-1 shrink-0 rounded-full bg-muted-light"
                        />
                        <span>
                          {order.customerName} · {order.reference}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatQuantity(order.quantity, item.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}
