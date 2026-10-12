import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  CreditCard,
  History,
  PackageCheck,
  Pencil,
  ReceiptText,
  WalletCards,
} from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import StatusBadge from "../components/ui/StatusBadge"
import {
  formatDate,
  formatLkr,
  formatQuantity,
  formatTime,
} from "../lib/format"
import type { Order } from "../types"

type OrderDetailScreenProps = {
  order: Order
  onBack: () => void
  onEditDraft: () => void
  onOpenShopping: () => void
  onOpenPreparation: (lineId: string) => void
}

export default function OrderDetailScreen({
  order,
  onBack,
  onEditDraft,
  onOpenShopping,
  onOpenPreparation,
}: OrderDetailScreenProps) {
  const paid = order.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const balance = order.agreedPrice - paid

  return (
    <div className="px-page pb-6">
      <ScreenHeader
        eyebrow={order.reference}
        title={order.customerName}
        onBack={onBack}
        backLabel="Back to orders"
        action={
          <StatusBadge
            tone={
              order.status === "Completed"
                ? "success"
                : order.status === "Draft"
                  ? "warning"
                  : "progress"
            }
          >
            {order.status}
          </StatusBadge>
        }
      />

      <section className="mt-4" aria-label="Products and collection">
        <Card className="p-0">
          <div className="space-y-4 p-4">
            {order.lines.map((line) => (
              <div key={line.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-cocoa">
                      {line.productName}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {line.variantName} · Quantity {line.quantity}
                    </p>
                  </div>
                  <StatusBadge tone="neutral">
                    Recipe v{line.recipeSnapshot.version}
                  </StatusBadge>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-control bg-ivory px-3 py-2 text-xs text-muted">
                  <ReceiptText
                    aria-hidden="true"
                    className="shrink-0 text-sage"
                    size={14}
                  />
                  <span className="truncate">{line.recipeSnapshot.name}</span>
                </div>
                {order.status !== "Draft" &&
                order.status !== "Cancelled" &&
                order.status !== "Completed" ? (
                  <Button
                    className="mt-3"
                    fullWidth
                    size="compact"
                    variant="secondary"
                    onClick={() => onOpenPreparation(line.id)}
                  >
                    {order.preparationStatus === "Ready"
                      ? "View preparation"
                      : "Open preparation"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="border-t border-warm-border bg-sage-soft/70 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-white text-sage-dark">
                <CalendarDays aria-hidden="true" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cocoa">
                  {formatDate(order.collectionDate)}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <Clock3 aria-hidden="true" size={13} />
                  {formatTime(order.collectionTime)}
                </p>
              </div>
              <span className="text-xs font-semibold text-sage-dark">
                Collection
              </span>
            </div>
            {order.instructions ? (
              <p className="mt-3 border-t border-sage-border pt-3 text-sm leading-relaxed text-cocoa">
                {order.instructions}
              </p>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="mt-4" aria-label="Order status">
        <Card className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-nav font-bold uppercase tracking-wide text-muted">
              <PackageCheck aria-hidden="true" size={14} />
              Preparation
            </div>
            <p className="mt-2 text-sm font-semibold text-cocoa">
              {order.preparationStatus}
            </p>
          </div>
          <div className="border-l border-warm-border pl-4">
            <div className="flex items-center gap-1.5 text-nav font-bold uppercase tracking-wide text-muted">
              <WalletCards aria-hidden="true" size={14} />
              Payment
            </div>
            <p className="mt-2 text-sm font-semibold text-cocoa">
              {order.paymentStatus}
            </p>
          </div>
        </Card>
      </section>

      {order.shortages.length > 0 ? (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-semibold text-cocoa">Shortages</div>
            <Button size="compact" variant="soft" onClick={onOpenShopping}>
              Open Shopping
            </Button>
          </div>
          <Card tone="warning" className="divide-y divide-warning-border p-0">
            <div className="flex items-center gap-2 p-4">
              <AlertTriangle
                aria-hidden="true"
                className="text-warning"
                size={18}
              />
              <p className="text-xs font-medium text-cocoa">
                Confirmed for the future Shopping plan
              </p>
            </div>
            {order.shortages.map((shortage) => (
              <div
                key={shortage.inventoryId}
                className="flex items-center justify-between gap-3 p-4 text-sm"
              >
                <span className="font-medium text-cocoa">{shortage.name}</span>
                <span className="font-semibold text-warning">
                  −{formatQuantity(shortage.shortage, shortage.unit)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <section className="mt-5">
        <div className="mb-3 text-lg font-semibold text-cocoa">Financials</div>
        <Card>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-nav font-bold uppercase tracking-wide text-muted">
                Price
              </p>
              <p className="mt-2 text-sm font-bold tabular-nums text-cocoa">
                {formatLkr(order.agreedPrice)}
              </p>
            </div>
            <div className="border-x border-warm-border">
              <p className="text-nav font-bold uppercase tracking-wide text-muted">
                Paid
              </p>
              <p className="mt-2 text-sm font-bold tabular-nums text-success">
                {formatLkr(paid)}
              </p>
            </div>
            <div>
              <p className="text-nav font-bold uppercase tracking-wide text-muted">
                Balance
              </p>
              <p
                className={`mt-2 text-sm font-bold tabular-nums ${
                  balance > 0 ? "text-warning" : "text-success"
                }`}
              >
                {formatLkr(Math.max(0, balance))}
              </p>
            </div>
          </div>
        </Card>

        <details className="mt-3 rounded-card border border-warm-border bg-white shadow-subtle">
          <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-cocoa">
            Cost breakdown
            <span className="tabular-nums text-muted">
              {formatLkr(order.costSnapshot.estimatedTotal)}
            </span>
          </summary>
          <div className="space-y-2.5 border-t border-warm-border px-4 py-3 text-sm text-muted">
            <div className="flex justify-between">
              <span>Ingredients</span>
              <span>{formatLkr(order.costSnapshot.ingredients)}</span>
            </div>
            <div className="flex justify-between">
              <span>Packaging</span>
              <span>{formatLkr(order.costSnapshot.packaging)}</span>
            </div>
            <div className="flex justify-between">
              <span>Labour allowance</span>
              <span>{formatLkr(order.costSnapshot.labour)}</span>
            </div>
            <p className="border-t border-warm-border pt-3 text-xs leading-relaxed">
              This initial estimate is frozen for the confirmed order.
            </p>
          </div>
        </details>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold text-cocoa">Payments</div>
          <StatusBadge tone={balance <= 0 ? "success" : "warning"}>
            {balance <= 0 ? "Settled" : `${formatLkr(balance)} due`}
          </StatusBadge>
        </div>
        <Card>
          {order.payments.length ? (
            <div className="space-y-3">
              {order.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-control bg-success-soft text-success">
                      <CreditCard aria-hidden="true" size={17} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-cocoa">
                        {payment.method}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDate(payment.date)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-success">
                    {formatLkr(payment.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <ReceiptText
                aria-hidden="true"
                className="text-muted-light"
                size={22}
              />
              <div>
                <p className="text-sm font-semibold text-cocoa">
                  No payments recorded
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Recording remains in the Finances phase.
                </p>
              </div>
            </div>
          )}
        </Card>
      </section>

      <details className="mt-5 rounded-card border border-warm-border bg-white shadow-subtle">
        <summary className="flex min-h-touch cursor-pointer list-none items-center gap-3 px-4 text-sm font-semibold text-cocoa">
          <History aria-hidden="true" className="text-sage" size={17} />
          Order history
        </summary>
        <p className="border-t border-warm-border px-4 py-3 text-xs leading-relaxed text-muted">
          Created {formatDate(order.createdAt.slice(0, 10))}
          {order.confirmedAt
            ? ` · Confirmed ${formatDate(order.confirmedAt.slice(0, 10))}`
            : " · Not yet confirmed"}
        </p>
      </details>

      {order.status === "Draft" ? (
        <div className="mt-5">
          <Button
            fullWidth
            leadingIcon={<Pencil aria-hidden="true" size={17} />}
            onClick={onEditDraft}
          >
            Continue draft
          </Button>
        </div>
      ) : null}
    </div>
  )
}
