import type { Order, Payment, PaymentStatus, Refund } from "../types"

export const PAYMENT_METHOD_OPTIONS = [
  { value: "Cash", label: "Cash" },
  { value: "Online transaction", label: "Online transaction" },
  { value: "Other", label: "Other" },
] as const

export type FinancialAction = {
  type: "RECORD_PAYMENT"

  orderId: string

  orderReference: string

  payment: Payment
} | { type: "RECORD_REFUND"; refund: Refund }

export function isValidMoneyAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount > 0
}

export function isValidFinancialDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const date = new Date(`${value}T00:00:00.000Z`)

  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

export function validatePaymentEntry(
  amountInput: string,

  date: string,

  method: string,

  maximumAmount: number,
): string | null {
  const amount = Number(amountInput)

  if (!amountInput.trim() || !isValidMoneyAmount(amount))
    return "Enter a positive whole-LKR amount."

  if (amount > maximumAmount)
    return `The payment cannot exceed ${maximumAmount} LKR currently due.`

  if (!isValidFinancialDate(date)) return "Enter a valid payment date."

  if (!method.trim()) return "Choose a payment method."

  return null
}

export function validateRefundEntry(
  amountInput: string,

  date: string,

  reason: string,

  maximumAmount: number,
): string | null {
  const amount = Number(amountInput)

  if (!amountInput.trim() || !isValidMoneyAmount(amount))
    return "Enter a positive whole-LKR amount."

  if (amount > maximumAmount)
    return `The refund cannot exceed ${maximumAmount} LKR remaining for this payment.`

  if (!isValidFinancialDate(date)) return "Enter a valid refund date."

  if (!reason.trim()) return "Enter a reason for this refund."

  return null
}

export function financialActionFeedback(
  accepted: boolean,

  kind: "payment" | "refund",
): { kind: "success" | "error"; message: string } {
  if (!accepted) {
    return {
      kind: "error",

      message:
        kind === "payment"
          ? "Payment was not recorded. The order balance may have changed; review it and try again."
          : "Refund was not recorded. The refundable amount may have changed; review it and try again.",
    }
  }

  return {
    kind: "success",

    message:
      kind === "payment"
        ? "Payment recorded. Payments are separate from order revenue."
        : "Refund recorded. The original payment and refund history have been retained.",
  }
}

export function submitFinancialAction(
  action: FinancialAction,

  dispatchIfAccepted: (action: FinancialAction) => boolean,

  kind: "payment" | "refund",
) {
  const accepted = dispatchIfAccepted(action)

  return {
    accepted,

    feedback: financialActionFeedback(accepted, kind),
  }
}

function isValidPayment(payment: Payment): boolean {
  return (
    typeof payment.id === "string" &&
    payment.id.trim().length > 0 &&
    isValidFinancialDate(payment.date) &&
    typeof payment.method === "string" &&
    payment.method.trim().length > 0 &&
    isValidMoneyAmount(payment.amount)
  )
}

function validPaymentsById(order: Order): Map<string, Payment> {
  const payments = new Map<string, Payment>()

  for (const payment of order.payments) {
    if (!isValidPayment(payment) || payments.has(payment.id)) continue

    payments.set(payment.id, payment)
  }

  return payments
}

export function validPaymentRecords(order: Order): Payment[] {
  return [...validPaymentsById(order).values()]
}

export function validRefundRecordsForPayment(
  order: Order,

  refunds: Refund[],

  paymentId: string,
): Refund[] {
  const payment = validPaymentsById(order).get(paymentId)

  if (!payment) return []

  const seenIds = new Set<string>()

  const valid: Refund[] = []

  let total = 0

  for (const refund of refunds) {
    if (
      refund.orderId !== order.id ||
      refund.paymentId !== paymentId ||
      typeof refund.id !== "string" ||
      !refund.id.trim() ||
      seenIds.has(refund.id) ||
      typeof refund.date !== "string" ||
      !isValidFinancialDate(refund.date) ||
      typeof refund.reason !== "string" ||
      !refund.reason.trim() ||
      !isValidMoneyAmount(refund.amount) ||
      total + refund.amount > payment.amount
    ) {
      continue
    }

    seenIds.add(refund.id)

    total += refund.amount

    if (!Number.isSafeInteger(total)) return []

    valid.push(refund)
  }

  return valid
}

export function totalValidPayments(order: Order): number {
  let total = 0

  for (const payment of validPaymentRecords(order)) {
    total += payment.amount

    if (!Number.isSafeInteger(total)) return Number.NaN
  }

  return total
}

export function totalRefundsForPayment(
  order: Order,

  refunds: Refund[],

  paymentId: string,
): number {
  return validRefundRecordsForPayment(order, refunds, paymentId).reduce(
    (total, refund) => total + refund.amount,

    0,
  )
}

export function totalRefundsForOrder(order: Order, refunds: Refund[]): number {
  let total = 0

  for (const paymentId of validPaymentsById(order).keys()) {
    total += totalRefundsForPayment(order, refunds, paymentId)

    if (!Number.isSafeInteger(total)) return Number.NaN
  }

  return total
}

export function remainingRefundableAmount(
  order: Order,

  refunds: Refund[],

  paymentId: string,
): number {
  const payment = validPaymentsById(order).get(paymentId)

  if (!payment) return 0

  const refunded = totalRefundsForPayment(order, refunds, paymentId)

  return Number.isSafeInteger(refunded) ? payment.amount - refunded : Number.NaN
}

export function netRetainedPayments(order: Order, refunds: Refund[]): number {
  return totalValidPayments(order) - totalRefundsForOrder(order, refunds)
}

export function outstandingOrderBalance(
  order: Order,

  refunds: Refund[],
): number {
  return order.agreedPrice - netRetainedPayments(order, refunds)
}

export function derivePaymentStatus(
  order: Order,

  refunds: Refund[],
): PaymentStatus {
  const payments = totalValidPayments(order)

  const refunded = totalRefundsForOrder(order, refunds)

  const retained = payments - refunded

  if (payments > 0 && refunded === payments) return "Refunded"

  if (retained >= order.agreedPrice && order.agreedPrice > 0) return "Paid"

  if (retained > 0) return "Part paid"

  return "Unpaid"
}
