import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  Clock3,
  CreditCard,
  Flame,
  History,
  Pencil,
  ReceiptText,
  Repeat2,
  ShoppingBag,
  X,
} from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import CountdownBadge from "../components/ui/CountdownBadge"
import Dialog from "../components/ui/Dialog"
import Field from "../components/ui/Field"
import SelectField from "../components/ui/SelectField"
import StatusBadge from "../components/ui/StatusBadge"
import TextAreaField from "../components/ui/TextAreaField"
import { getBakeTargetMs, getCollectionTargetMs } from "../lib/countdown"
import {
  formatDate,
  formatLkr,
  formatQuantity,
  formatTime,
} from "../lib/format"
import {
  hasUnpurchasedShoppingItems,
  isUsageInPantry,
} from "../lib/inventory"
import {
  canCancelOrder,
  canCollectOrder,
  getOrderCancellationBlockReason,
  canRepeatOrder,
  getUnreadyOrderLines,
} from "../lib/orderLifecycle"
import {
  PAYMENT_METHOD_OPTIONS,
  derivePaymentStatus,
  netRetainedPayments,
  outstandingOrderBalance,
  remainingRefundableAmount,
  submitFinancialAction,
  totalRefundsForOrder,
  totalRefundsForPayment,
  totalValidPayments,
  validatePaymentEntry,
  validateRefundEntry,
} from "../lib/financials"
import { useAppState } from "../state/AppState"
import type { Order } from "../types"

function today() {
  return new Date().toISOString().slice(0, 10)
}

type OrderDetailScreenProps = {
  order: Order
  onBack: () => void
  onEditDraft: () => void
  onOpenShopping: () => void
  onOpenPreparation: (lineId: string) => void
  onRepeatCreated: (newOrderId: string) => void
  repeatNotice?: string | null
  openPaymentOnMount?: boolean
  onPaymentOpenedOnMount?: () => void
}

export default function OrderDetailScreen({
  order,
  onBack,
  onEditDraft,
  onOpenShopping,
  onOpenPreparation,
  onRepeatCreated,
  repeatNotice,
  openPaymentOnMount,
  onPaymentOpenedOnMount,
}: OrderDetailScreenProps) {
  const { state, dispatch, dispatchIfAccepted } = useAppState()
  const [confirmation, setConfirmation] =
    useState<"cancel" | "collect" | "repeat" | null>(null)
  const repeatSubmitting = useRef(false)
  const [financialDialog, setFinancialDialog] = useState<"payment" | {
    kind: "refund"
    paymentId: string
  } | null>(null)
  const [financialAmount, setFinancialAmount] = useState("")
  const [financialDate, setFinancialDate] = useState(today)
  const [financialMethod, setFinancialMethod] = useState("Cash")
  const [financialOtherMethod, setFinancialOtherMethod] = useState("")
  const [financialReason, setFinancialReason] = useState("")
  const [financialError, setFinancialError] = useState("")
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error"
    message: string
  } | null>(null)
  const paid = totalValidPayments(order)
  const refundsTotal = totalRefundsForOrder(order, state.refunds)
  const retained = netRetainedPayments(order, state.refunds)
  const balance = outstandingOrderBalance(order, state.refunds)
  const paymentStatus = derivePaymentStatus(order, state.refunds)
  const maxPayable = Math.max(0, balance)
  const selectedRefundPayment =
    financialDialog && typeof financialDialog === "object"
      ? order.payments.find(
          (payment) => payment.id === financialDialog.paymentId,
        )
      : undefined
  const selectedRefundedAmount = selectedRefundPayment
    ? totalRefundsForPayment(order, state.refunds, selectedRefundPayment.id)
    : 0
  const selectedRefundableAmount = selectedRefundPayment
    ? remainingRefundableAmount(order, state.refunds, selectedRefundPayment.id)
    : 0
  const cancellationBlockReason = getOrderCancellationBlockReason(state, order)
  const canCancel = canCancelOrder(state, order)
  const canCollect = canCollectOrder(state, order)
  const canRepeat = canRepeatOrder(order)

  const confirmLifecycleAction = () => {
    if (confirmation === null) return
    const actionKind = confirmation
    const accepted = dispatchIfAccepted(
      actionKind === "cancel"
        ? { type: "CANCEL_ORDER", orderId: order.id }
        : { type: "COLLECT_ORDER", orderId: order.id },
    )
    setConfirmation(null)
    if (actionKind === "collect" && accepted && balance > 0) {
      openFinancialDialog("payment", balance)
      setFeedback({
        kind: "success",
        message: "Order marked as collected. Record the remaining payment or cancel if paying later.",
      })
      return
    }
    setFeedback(
      accepted
        ? {
            kind: "success",
            message:
              actionKind === "cancel"
                ? "Order cancelled. Recorded payments have not been refunded."
                : "Order marked as collected.",
          }
        : {
            kind: "error",
            message:
              actionKind === "cancel"
                ? "Cancellation was not accepted. The order and its reservations remain unchanged."
                : "Collection was not accepted. The order remains unchanged.",
          },
    )
  }

  const confirmRepeatOrder = () => {
    if (repeatSubmitting.current || confirmation !== "repeat") return
    repeatSubmitting.current = true
    const newOrderId = `order-${crypto.randomUUID()}`
    const accepted = dispatchIfAccepted({
      type: "REPEAT_ORDER",
      orderId: order.id,
      newOrderId,
    })
    setConfirmation(null)
    if (accepted) {
      onRepeatCreated(newOrderId)
    } else {
      repeatSubmitting.current = false
      setFeedback({
        kind: "error",
        message:
          "A repeat draft could not be created. The source order was not changed.",
      })
    }
  }

  const openFinancialDialog = (
    dialog: "payment" | { kind: "refund"; paymentId: string },
    initialAmount?: number,
  ) => {
    setFinancialAmount(
      dialog === "payment"
        ? initialAmount !== undefined
          ? String(initialAmount)
          : maxPayable > 0
            ? String(maxPayable)
            : ""
        : "",
    )
    setFinancialDate(today())
    setFinancialMethod("Cash")
    setFinancialOtherMethod("")
    setFinancialReason("")
    setFinancialError("")
    setFeedback(null)
    setFinancialDialog(dialog)
  }

  useEffect(() => {
    if (!openPaymentOnMount) return
    if (order.status !== "Cancelled" && maxPayable > 0) {
      openFinancialDialog("payment", maxPayable)
    }
    onPaymentOpenedOnMount?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPaymentOnMount, order.id])

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const resolvedMethod =
      financialMethod === "Other"
        ? financialOtherMethod.trim() || "Other"
        : financialMethod
    const error = validatePaymentEntry(
      financialAmount,
      financialDate,
      resolvedMethod,
      maxPayable,
    )
    if (error) {
      setFinancialError(error)
      return
    }
    const submission = submitFinancialAction(
      {
        type: "RECORD_PAYMENT",
        orderId: order.id,
        orderReference: order.reference,
        payment: {
          id: `payment-${crypto.randomUUID()}`,
          date: financialDate,
          amount: Number(financialAmount),
          method: resolvedMethod,
        },
      },
      dispatchIfAccepted,
      "payment",
    )
    setFeedback(submission.accepted ? submission.feedback : null)
    setFinancialError(submission.accepted ? "" : submission.feedback.message)
    if (submission.accepted) setFinancialDialog(null)
  }

  const submitRefund = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRefundPayment) return
    const error = validateRefundEntry(
      financialAmount,
      financialDate,
      financialReason,
      selectedRefundableAmount,
    )
    if (error) {
      setFinancialError(error)
      return
    }
    const submission = submitFinancialAction(
      {
        type: "RECORD_REFUND",
        refund: {
          id: `refund-${crypto.randomUUID()}`,
          orderId: order.id,
          paymentId: selectedRefundPayment.id,
          date: financialDate,
          amount: Number(financialAmount),
          reason: financialReason.trim(),
        },
      },
      dispatchIfAccepted,
      "refund",
    )
    setFeedback(submission.accepted ? submission.feedback : null)
    setFinancialError(submission.accepted ? "" : submission.feedback.message)
    if (submission.accepted) setFinancialDialog(null)
  }

  return (
    <div className="pb-6">
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
                : order.status === "Cancelled"
                  ? "neutral"
                  : order.status === "Draft"
                    ? "warning"
                    : "progress"
            }
          >
            {order.status}
          </StatusBadge>
        }
      />

      {feedback ? (
        <p
          role={feedback.kind === "success" ? "status" : "alert"}
          className={`mt-4 rounded-control p-3 text-sm ${
            feedback.kind === "success"
              ? "bg-sage-soft text-sage-dark"
              : "bg-warning-soft text-cocoa"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
      {repeatNotice ? (
        <p
          role="status"
          className="mt-4 rounded-control bg-sage-soft p-3 text-sm text-sage-dark"
        >
          {repeatNotice} Opened as draft {order.reference}.
        </p>
      ) : null}

      {order.status !== "Draft" && order.status !== "Cancelled" ? (
        <Card className="mt-4">
          <div className="grid grid-cols-4 gap-1.5">
            {([
              { label: "Confirmed", done: true },
              {
                label: "Baking",
                done:
                  order.status === "In Progress" ||
                  order.status === "Completed" ||
                  order.preparationStatus === "In progress" ||
                  order.preparationStatus === "Ready",
              },
              {
                label: "Ready",
                done:
                  order.preparationStatus === "Ready" ||
                  order.status === "Completed",
              },
              { label: "Collected", done: order.status === "Completed" },
            ] as const).map((stage) => (
              <div key={stage.label} className="space-y-1.5">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    stage.done ? "bg-sage" : "bg-neutral-soft"
                  }`}
                />
                <div
                  className={`text-center text-[11px] font-semibold ${
                    stage.done ? "text-sage-dark" : "text-muted-light"
                  }`}
                >
                  {stage.label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {canCollect ? (
        <Card tone="sage" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-cocoa">
                Ready for pickup
              </p>
              {balance > 0 ? (
                <p className="mt-0.5 text-xs text-muted">
                  {formatLkr(balance)} balance due
                </p>
              ) : null}
            </div>
            <CheckCircle2
              aria-hidden="true"
              size={20}
              className="shrink-0 text-success"
            />
          </div>
          <Button
            fullWidth
            leadingIcon={<CheckCircle2 aria-hidden="true" size={17} />}
            onClick={() => {
              setFeedback(null)
              setConfirmation("collect")
            }}
          >
            Collected
          </Button>
        </Card>
      ) : null}

      <section className="mt-4" aria-label="Products and collection">
        <Card className="p-0">
          <div className="border-b border-warm-border bg-sage-soft/60 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarDays
                  aria-hidden="true"
                  size={17}
                  className="shrink-0 text-sage-dark"
                />
                <span className="text-sm font-semibold text-cocoa">
                  {formatDate(order.collectionDate)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-cocoa">
                  <Clock3 aria-hidden="true" size={13} className="text-muted" />
                  {formatTime(order.collectionTime)}
                </span>
                {order.status !== "Completed" &&
                order.status !== "Cancelled" ? (
                  <CountdownBadge
                    targetMs={getCollectionTargetMs(
                      order.collectionDate,
                      order.collectionTime,
                    )}
                  />
                ) : null}
              </div>
            </div>
            {order.instructions ? (
              <p className="mt-2 border-t border-sage-border/70 pt-2 text-xs leading-relaxed text-cocoa">
                {order.instructions}
              </p>
            ) : null}
          </div>

          <div className="divide-y divide-warm-border p-4">
            {order.lines.map((line) => {
              const prepRecord = state.preparationRecords.find(
                (record) =>
                  record.orderId === order.id && record.orderLineId === line.id,
              )
              const lineHasShortages = prepRecord
                ? hasUnpurchasedShoppingItems(order, prepRecord)
                : false
              const showChecklistOpen =
                prepRecord?.status === "Awaiting preparation" || lineHasShortages
              return (
                <div key={line.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-cocoa">
                        {line.productName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {line.variantName} · Qty {line.quantity} ·{" "}
                        {line.recipeSnapshot.name}
                      </p>
                      {prepRecord?.status === "In progress" ? (
                        <div className="mt-1.5">
                          <CountdownBadge
                            targetMs={getBakeTargetMs(
                              prepRecord.startedAt ?? prepRecord.updatedAt,
                              prepRecord.recipeSnapshot.preparationMinutes,
                            )}
                            prefix="Bake"
                            overdueLabel="Time up"
                            urgentThresholdMs={15 * 60_000}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {order.status !== "Draft" &&
                  order.status !== "Cancelled" &&
                  order.status !== "Completed" &&
                  prepRecord &&
                  prepRecord.status !== "Ready" ? (
                    showChecklistOpen ? (
                      <div className="mt-3 space-y-2 rounded-control border border-warm-border bg-ivory/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-cocoa">
                            Pantry checklist
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              dispatch({
                                type: "MARK_ALL_PANTRY_CHECKLIST",
                                preparationId: prepRecord.id,
                                inPantry: true,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-warm-border bg-white px-2.5 py-1 text-[11px] font-semibold text-cocoa hover:border-sage"
                          >
                            <CheckCheck
                              aria-hidden="true"
                              size={13}
                              className="text-success"
                            />
                            All ready
                          </button>
                        </div>
                        <div className="divide-y divide-warm-border/70">
                          {prepRecord.actualUsage.map((usage) => {
                            const inPantry = isUsageInPantry(
                              order,
                              prepRecord,
                              usage,
                            )
                            return (
                              <div
                                key={usage.inventoryId}
                                className="flex items-center justify-between gap-2 py-2 first:pt-1 last:pb-0"
                              >
                                <div className="min-w-0">
                                  <span className="block truncate text-xs font-medium text-cocoa">
                                    {usage.name}
                                  </span>
                                  <span className="block text-[11px] text-muted">
                                    {formatQuantity(
                                      usage.plannedQuantity,
                                      usage.unit,
                                    )}
                                  </span>
                                </div>
                                <div className="inline-flex shrink-0 rounded-full border border-warm-border bg-white p-0.5 text-[11px] font-semibold">
                                  <button
                                    type="button"
                                    aria-label={`${usage.name} in pantry`}
                                    onClick={() =>
                                      dispatch({
                                        type: "SET_PANTRY_CHECKLIST_ITEM",
                                        preparationId: prepRecord.id,
                                        inventoryId: usage.inventoryId,
                                        inPantry: true,
                                      })
                                    }
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition ${
                                      inPantry
                                        ? "bg-success text-white"
                                        : "text-muted hover:text-cocoa"
                                    }`}
                                  >
                                    <Check aria-hidden="true" size={11} />
                                    Have
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Add ${usage.name} to shopping list`}
                                    onClick={() =>
                                      dispatch({
                                        type: "SET_PANTRY_CHECKLIST_ITEM",
                                        preparationId: prepRecord.id,
                                        inventoryId: usage.inventoryId,
                                        inPantry: false,
                                        toBuyQuantity: usage.plannedQuantity,
                                      })
                                    }
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition ${
                                      !inPantry
                                        ? "bg-warning text-white"
                                        : "text-muted hover:text-cocoa"
                                    }`}
                                  >
                                    <ShoppingBag
                                      aria-hidden="true"
                                      size={11}
                                    />
                                    Buy
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <details className="mt-3 rounded-control border border-warm-border bg-ivory/60">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-cocoa">
                          <span className="inline-flex items-center gap-1.5">
                            <Check
                              aria-hidden="true"
                              size={13}
                              className="text-success"
                            />
                            Ingredients ready ({prepRecord.actualUsage.length})
                          </span>
                          <ChevronDown
                            aria-hidden="true"
                            size={14}
                            className="text-muted"
                          />
                        </summary>
                        <div className="divide-y divide-warm-border/70 border-t border-warm-border px-3 pb-2 pt-1">
                          {prepRecord.actualUsage.map((usage) => (
                            <div
                              key={usage.inventoryId}
                              className="flex items-center justify-between py-1.5 text-xs"
                            >
                              <span className="text-cocoa">{usage.name}</span>
                              <span className="text-muted">
                                {formatQuantity(
                                  usage.plannedQuantity,
                                  usage.unit,
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )
                  ) : null}

                  {order.status !== "Draft" &&
                  order.status !== "Cancelled" &&
                  order.status !== "Completed" ? (
                    lineHasShortages ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          fullWidth
                          size="compact"
                          variant="primary"
                          leadingIcon={
                            <ShoppingBag aria-hidden="true" size={14} />
                          }
                          onClick={onOpenShopping}
                        >
                          To buy
                        </Button>
                        <Button
                          fullWidth
                          size="compact"
                          variant="secondary"
                          leadingIcon={<ChefHat aria-hidden="true" size={14} />}
                          onClick={() => onOpenPreparation(line.id)}
                        >
                          Steps
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="mt-3"
                        fullWidth
                        size={
                          order.preparationStatus === "Ready" ||
                          prepRecord?.status === "Ready"
                            ? "compact"
                            : "default"
                        }
                        variant={
                          order.preparationStatus === "Ready" ||
                          prepRecord?.status === "Ready"
                            ? "secondary"
                            : "primary"
                        }
                        leadingIcon={
                          order.preparationStatus === "Ready" ||
                          prepRecord?.status === "Ready" ? (
                            <BookOpen aria-hidden="true" size={15} />
                          ) : (
                            <Flame aria-hidden="true" size={17} />
                          )
                        }
                        onClick={() => {
                          if (
                            prepRecord &&
                            prepRecord.status === "Awaiting preparation"
                          ) {
                            dispatchIfAccepted({
                              type: "START_PREPARATION",
                              preparationId: prepRecord.id,
                            })
                          }
                          onOpenPreparation(line.id)
                        }}
                      >
                        {order.preparationStatus === "Ready" ||
                        prepRecord?.status === "Ready"
                          ? "View prep"
                          : prepRecord?.status === "In progress"
                            ? "Bake"
                            : "Start bake"}
                      </Button>
                    )
                  ) : null}
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      <section className="mt-5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="text-base font-semibold text-cocoa">Payment</div>
          <StatusBadge
            tone={
              paymentStatus === "Paid"
                ? "success"
                : paymentStatus === "Unpaid" || paymentStatus === "Refunded"
                  ? "neutral"
                  : "warning"
            }
          >
            {paymentStatus}
          </StatusBadge>
        </div>
        <Card className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Total
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums text-cocoa">
                {formatLkr(order.agreedPrice)}
              </p>
            </div>
            <div className="border-x border-warm-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Paid
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums text-success">
                {formatLkr(paid)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Due
              </p>
              <p
                className={`mt-1 text-sm font-bold tabular-nums ${
                  balance > 0 ? "text-warning" : "text-success"
                }`}
              >
                {formatLkr(Math.max(0, balance))}
              </p>
            </div>
          </div>

          {refundsTotal > 0 ? (
            <div className="flex items-center justify-between border-t border-warm-border pt-2.5 text-xs text-muted">
              <span>Refunded</span>
              <span className="font-semibold tabular-nums text-warning">
                {formatLkr(refundsTotal)}
              </span>
            </div>
          ) : null}

          {order.status !== "Cancelled" && maxPayable > 0 ? (
            <Button
              fullWidth
              leadingIcon={<CreditCard aria-hidden="true" size={17} />}
              onClick={() => openFinancialDialog("payment")}
            >
              Add payment
            </Button>
          ) : null}
        </Card>

        <details className="mt-3 rounded-card border border-warm-border bg-white shadow-subtle">
          <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-cocoa">
            <span>Cost breakdown</span>
            <span className="inline-flex items-center gap-1.5 tabular-nums text-muted">
              {formatLkr(order.costSnapshot.estimatedTotal)}
              <ChevronDown aria-hidden="true" size={15} />
            </span>
          </summary>
          <div className="space-y-2 border-t border-warm-border px-4 py-3 text-sm text-muted">
            <div className="flex justify-between">
              <span>Ingredients</span>
              <span>{formatLkr(order.costSnapshot.ingredients)}</span>
            </div>
            <div className="flex justify-between">
              <span>Packaging</span>
              <span>{formatLkr(order.costSnapshot.packaging)}</span>
            </div>
            <div className="flex justify-between">
              <span>Labour</span>
              <span>{formatLkr(order.costSnapshot.labour)}</span>
            </div>
          </div>
        </details>

        {order.payments.length > 0 ? (
          <details className="mt-2.5 rounded-card border border-warm-border bg-white shadow-subtle">
            <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-cocoa">
              <span>Payments ({order.payments.length})</span>
              <ChevronDown
                aria-hidden="true"
                size={15}
                className="text-muted"
              />
            </summary>
            <div className="divide-y divide-warm-border border-t border-warm-border px-4">
              {order.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-cocoa">
                      {payment.method} · {formatLkr(payment.amount)}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(payment.date)}
                      {totalRefundsForPayment(order, state.refunds, payment.id) >
                      0
                        ? ` · Refunded ${formatLkr(
                            totalRefundsForPayment(
                              order,
                              state.refunds,
                              payment.id,
                            ),
                          )}`
                        : ""}
                    </p>
                  </div>
                  {remainingRefundableAmount(order, state.refunds, payment.id) >
                  0 ? (
                    <Button
                      size="compact"
                      variant="secondary"
                      onClick={() =>
                        openFinancialDialog({
                          kind: "refund",
                          paymentId: payment.id,
                        })
                      }
                    >
                      Refund
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <details className="mt-2.5 rounded-card border border-warm-border bg-white shadow-subtle">
          <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-cocoa">
            <span className="inline-flex items-center gap-2">
              <History aria-hidden="true" className="text-muted" size={16} />
              Order history
            </span>
            <ChevronDown aria-hidden="true" size={15} className="text-muted" />
          </summary>
          <p className="border-t border-warm-border px-4 py-3 text-xs leading-relaxed text-muted">
            Created {formatDate(order.createdAt.slice(0, 10))}
            {order.confirmedAt
              ? ` · Confirmed ${formatDate(order.confirmedAt.slice(0, 10))}`
              : " · Draft"}
          </p>
        </details>
      </section>

      {order.status === "Draft" ? (
        <div className="mt-5">
          <Button
            fullWidth
            leadingIcon={<Pencil aria-hidden="true" size={17} />}
            onClick={onEditDraft}
          >
            Edit draft
          </Button>
        </div>
      ) : null}

      {canRepeat || canCancel ? (
        <div className="mt-4 flex gap-2.5">
          {canRepeat ? (
            <Button
              fullWidth
              variant="secondary"
              leadingIcon={<Repeat2 aria-hidden="true" size={16} />}
              onClick={() => {
                setFeedback(null)
                setConfirmation("repeat")
              }}
            >
              Repeat
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              fullWidth
              variant="ghost"
              leadingIcon={<X aria-hidden="true" size={16} />}
              onClick={() => {
                setFeedback(null)
                setConfirmation("cancel")
              }}
            >
              Cancel order
            </Button>
          ) : null}
        </div>
      ) : null}

      {!canCancel && cancellationBlockReason ? (
        <p className="mt-3 text-center text-xs text-muted">
          {cancellationBlockReason}
        </p>
      ) : null}

      <Dialog
        open={financialDialog === "payment"}
        title="Record payment"
        description={`Order ${order.reference} · maximum currently payable ${formatLkr(maxPayable)}. Payments are not recognized as order revenue.`}
        onClose={() => setFinancialDialog(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setFinancialDialog(null)}
            >
              Cancel
            </Button>
            <Button type="submit" form="record-payment-form">
              Save
            </Button>
          </div>
        }
      >
        <form
          id="record-payment-form"
          className="space-y-4"
          onSubmit={submitPayment}
        >
          <Field
            label="Amount (LKR)"
            type="number"
            min="1"
            max={maxPayable}
            step="1"
            inputMode="numeric"
            required
            value={financialAmount}
            onChange={(event) => setFinancialAmount(event.target.value)}
            helperText={`Whole rupees only. Maximum payment: ${formatLkr(maxPayable)}.`}
          />
          <Field
            label="Payment date"
            type="date"
            required
            value={financialDate}
            onChange={(event) => setFinancialDate(event.target.value)}
          />
          <SelectField
            label="Payment method"
            value={financialMethod}
            options={[...PAYMENT_METHOD_OPTIONS]}
            onChange={(event) => {
              setFinancialMethod(event.target.value)
              if (event.target.value !== "Other") {
                setFinancialOtherMethod("")
              }
            }}
          />
          {financialMethod === "Other" ? (
            <Field
              label="Specify payment method (optional)"
              type="text"
              autoComplete="off"
              placeholder="Card, cheque, etc."
              value={financialOtherMethod}
              onChange={(event) => setFinancialOtherMethod(event.target.value)}
            />
          ) : null}
          {financialError ? (
            <p
              role="alert"
              className="rounded-control bg-warning-soft p-3 text-sm text-cocoa"
            >
              {financialError}
            </p>
          ) : null}
        </form>
      </Dialog>

      <Dialog
        open={
          financialDialog !== null &&
          typeof financialDialog === "object" &&
          financialDialog.kind === "refund"
        }
        title="Record refund"
        description={
          selectedRefundPayment
            ? `Refund against ${selectedRefundPayment.method} payment ${selectedRefundPayment.id}.`
            : "The selected payment is no longer available."
        }
        onClose={() => setFinancialDialog(null)}
        footer={
          selectedRefundPayment ? (
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setFinancialDialog(null)}
              >
                Cancel
              </Button>
              <Button type="submit" form="record-refund-form">
                Save Refund
              </Button>
            </div>
          ) : (
            <Button onClick={() => setFinancialDialog(null)}>Close</Button>
          )
        }
      >
        {selectedRefundPayment ? (
          <form
            id="record-refund-form"
            className="space-y-4"
            onSubmit={submitRefund}
          >
            <div className="rounded-control bg-ivory p-3 text-sm text-cocoa">
              <p>
                Original payment:{" "}
                <strong>{formatLkr(selectedRefundPayment.amount)}</strong>
              </p>
              <p className="mt-1">
                Previously refunded:{" "}
                <strong>{formatLkr(selectedRefundedAmount)}</strong>
              </p>
              <p className="mt-1">
                Remaining refundable:{" "}
                <strong>{formatLkr(selectedRefundableAmount)}</strong>
              </p>
            </div>
            {selectedRefundableAmount > 0 ? (
              <>
                <Field
                  label="Refund amount (LKR)"
                  type="number"
                  min="1"
                  max={selectedRefundableAmount}
                  step="1"
                  inputMode="numeric"
                  required
                  value={financialAmount}
                  onChange={(event) => setFinancialAmount(event.target.value)}
                  helperText={`Whole rupees only. Maximum refund: ${formatLkr(selectedRefundableAmount)}.`}
                />
                <Field
                  label="Refund date"
                  type="date"
                  required
                  value={financialDate}
                  onChange={(event) => setFinancialDate(event.target.value)}
                />
                <TextAreaField
                  label="Reason for refund"
                  required
                  value={financialReason}
                  onChange={(event) => setFinancialReason(event.target.value)}
                  helperText="This reason is retained with the refund history."
                />
              </>
            ) : (
              <p className="text-sm text-muted">
                This payment has been fully refunded.
              </p>
            )}
            {financialError ? (
              <p
                role="alert"
                className="rounded-control bg-warning-soft p-3 text-sm text-cocoa"
              >
                {financialError}
              </p>
            ) : null}
          </form>
        ) : null}
      </Dialog>

      <Dialog
        open={confirmation === "cancel"}
        title="Cancel this order?"
        description="The order details and history will be retained, and its remaining reservations will be released."
        onClose={() => setConfirmation(null)}
        footer={
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-warning">
              Recorded payments will not be automatically refunded. Preparation
              or stock consumption may make cancellation unavailable.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmation(null)}>
                Keep
              </Button>
              <Button onClick={confirmLifecycleAction}>Cancel order</Button>
            </div>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          No inventory movements will be reversed. If the reducer determines
          that cancellation is no longer safe, the order will remain unchanged.
        </p>
      </Dialog>

      <Dialog
        open={confirmation === "collect"}
        title="Record customer collection?"
        description="This marks the order as completed and collected."
        onClose={() => setConfirmation(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmation(null)}>
              Not yet
            </Button>
            <Button onClick={confirmLifecycleAction}>
              {balance > 0 ? "Collect & add payment" : "Collect"}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {balance > 0
            ? `${formatLkr(balance)} is still due. You will be taken straight to record the payment (or you can cancel if paying later).`
            : "Payment is already settled; collection will be recorded."}
        </p>
      </Dialog>

      <Dialog
        open={confirmation === "repeat"}
        title="Create a repeat draft?"
        description={`A new draft will be created from ${order.reference}. The original order and its history will remain unchanged.`}
        onClose={() => setConfirmation(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRepeatOrder}>Create draft</Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          The new order will start as an unreserved draft. It will not copy old
          payments, preparation progress, reservations, inventory movements,
          finished-stock transactions, or collected/completed status. Current
          recipe details and pricing are used where available; stock is checked
          when you confirm the draft.
        </p>
      </Dialog>
    </div>
  )
}
