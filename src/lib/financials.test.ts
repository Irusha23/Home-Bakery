import { describe, expect, it } from "vitest"

import {
  allocateOrderRefunds,
  derivePaymentStatus,
  financialActionFeedback,
  isValidMoneyAmount,
  netRetainedPayments,
  outstandingOrderBalance,
  pendingCancellationRefund,
  remainingRefundableAmount,
  submitFinancialAction,
  totalRefundsForOrder,
  totalRefundsForPayment,
  totalValidPayments,
  validatePaymentEntry,
  validateRefundEntry,
} from "./financials"

import { createTestOrder, createTestOrderLine } from "../test/fixtures"

import type { Refund } from "../types"

const payment = {
  id: "payment-1",

  date: "2026-10-12",

  amount: 7000,

  method: "Cash",
}

const refunds: Refund[] = [
  {
    id: "refund-1",

    orderId: "finance-order",

    paymentId: payment.id,

    date: "2026-10-13",

    amount: 2000,

    reason: "Customer returned one item",
  },
]

describe("order financial calculations", () => {
  const order = createTestOrder(
    "finance-order",

    [createTestOrderLine("finance-line")],

    { agreedPrice: 10000, payments: [payment] },
  )

  it("calculates gross payments, refunds, net retained payments and balance", () => {
    expect(totalValidPayments(order)).toBe(7000)

    expect(totalRefundsForPayment(order, refunds, payment.id)).toBe(2000)

    expect(totalRefundsForOrder(order, refunds)).toBe(2000)

    expect(netRetainedPayments(order, refunds)).toBe(5000)

    expect(outstandingOrderBalance(order, refunds)).toBe(5000)

    expect(remainingRefundableAmount(order, refunds, payment.id)).toBe(5000)
  })

  describe("financial entry form validation and feedback", () => {
    it("accepts valid whole-LKR partial and full payment entries", () => {
      expect(isValidMoneyAmount(2500)).toBe(true)

      expect(
        validatePaymentEntry("2500", "2026-10-13", "Cash", 7000),
      ).toBeNull()

      expect(
        validatePaymentEntry("7000", "2026-10-13", "Bank transfer", 7000),
      ).toBeNull()
    })

    it.each(["", "0", "-1", "1.5", "7001", "Infinity", "9007199254740992"])(
      "rejects invalid or over-limit payment amount %s",

      (amount) => {
        expect(
          validatePaymentEntry(amount, "2026-10-13", "Cash", 7000),
        ).not.toBeNull()
      },
    )

    it("rejects invalid payment date and blank method", () => {
      expect(validatePaymentEntry("100", "2026-02-30", "Cash", 7000)).toContain(
        "date",
      )

      expect(validatePaymentEntry("100", "2026-10-13", " ", 7000)).toContain(
        "method",
      )
    })

    it("accepts valid partial and full refund entries within remaining refundable limit", () => {
      expect(
        validateRefundEntry("1000", "2026-10-13", "Partial return", 5000),
      ).toBeNull()

      expect(
        validateRefundEntry("5000", "2026-10-13", "Full remainder", 5000),
      ).toBeNull()
    })

    it("rejects refund amount over the remainder, invalid date and missing reason", () => {
      expect(
        validateRefundEntry("5001", "2026-10-13", "Reason", 5000),
      ).toContain(
        "cannot exceed",
      )

      expect(
        validateRefundEntry("100", "2026-02-30", "Reason", 5000),
      ).toContain(
        "date",
      )

      expect(validateRefundEntry("100", "2026-10-13", "  ", 5000)).toContain(
        "reason",
      )

      expect(
        validateRefundEntry("1.5", "2026-10-13", "Reason", 5000),
      ).toContain(
        "whole-LKR",
      )
    })

    it("reports success only for accepted actions and explicit errors for rejected actions", () => {
      expect(financialActionFeedback(true, "payment").kind).toBe("success")

      expect(financialActionFeedback(true, "refund").kind).toBe("success")

      expect(financialActionFeedback(false, "payment")).toMatchObject({
        kind: "error",

        message: expect.stringContaining("not recorded"),
      })

      expect(financialActionFeedback(false, "refund")).toMatchObject({
        kind: "error",

        message: expect.stringContaining("not recorded"),
      })
    })

    it("submits payment and refund actions through the acceptance callback", () => {
      const paymentAction = {
        type: "RECORD_PAYMENT" as const,

        orderId: "finance-order",

        orderReference: "US-2001",

        payment,
      }

      const refundAction = {
        type: "RECORD_REFUND" as const,

        refund: refunds[0],
      }

      const acceptedActions: unknown[] = []

      const accepted = submitFinancialAction(
        paymentAction,

        (action) => {
          acceptedActions.push(action)

          return true
        },

        "payment",
      )

      const rejected = submitFinancialAction(
        refundAction,

        (action) => {
          acceptedActions.push(action)

          return false
        },

        "refund",
      )

      expect(acceptedActions).toEqual([paymentAction, refundAction])

      expect(accepted).toMatchObject({
        accepted: true,

        feedback: { kind: "success" },
      })

      expect(rejected).toMatchObject({
        accepted: false,

        feedback: { kind: "error" },
      })
    })
  })

  it.each([
    ["Unpaid", [], [], "Unpaid"],

    ["part paid", [payment], refunds, "Part paid"],

    [
      "Paid",

      [{ ...payment, amount: 10000 }],

      [],

      "Paid",
    ],

    [
      "fully refunded",

      [payment],

      [{ ...refunds[0], amount: payment.amount }],

      "Refunded",
    ],
  ] as const)(
    "derives the %s status from payment history",
    (_label, payments, refundHistory, expected) => {
      const candidate = createTestOrder(
        "finance-order",

        [createTestOrderLine("finance-line")],

        { agreedPrice: 10000, payments: [...payments] },
      )

      expect(derivePaymentStatus(candidate, [...refundHistory])).toBe(expected)
    },
  )

  it("ignores invalid and duplicate payment and refund entries", () => {
    const invalidPaymentOrder = {
      ...order,

      payments: [
        payment,

        { ...payment },

        { ...payment, id: "fractional", amount: 0.5 },
      ],
    }

    const invalidRefunds = [
      ...refunds,

      { ...refunds[0] },

      { ...refunds[0], id: "over-refund", amount: 6000 },
    ]

    expect(totalValidPayments(invalidPaymentOrder)).toBe(7000)

    expect(totalRefundsForOrder(invalidPaymentOrder, invalidRefunds)).toBe(
      2000,
    )
  })

  it("allocates order-level refunds across multiple payments up to retained balance", () => {
    const multiOrder = createTestOrder(
      "multi-pay-order",
      [createTestOrderLine("line-1")],
      {
        status: "Cancelled",
        agreedPrice: 12000,
        payments: [
          { id: "p-1", date: "2026-10-01", amount: 3000, method: "Cash" },
          { id: "p-2", date: "2026-10-05", amount: 5000, method: "Online transaction" },
        ],
      },
    )

    const partial = allocateOrderRefunds(
      multiOrder,
      [],
      4500,
      "2026-10-10",
      "Customer collected partial refund",
    )
    expect(partial).toHaveLength(2)
    expect(partial?.[0]).toMatchObject({ paymentId: "p-1", amount: 3000 })
    expect(partial?.[1]).toMatchObject({ paymentId: "p-2", amount: 1500 })

    expect(
      allocateOrderRefunds(multiOrder, [], 9000, "2026-10-10", "Too much"),
    ).toBeNull()
  })

  it("computes pending cancellation refund after deducting cancellation fee", () => {
    const cancelledOrder = createTestOrder(
      "cancel-fee-order",
      [createTestOrderLine("line-1")],
      {
        status: "Cancelled",
        agreedPrice: 7500,
        payments: [{ id: "p-1", date: "2026-10-01", amount: 7500, method: "Cash" }],
        cancellationFee: 1000,
      },
    )
    const partialRefund: Refund[] = [
      {
        id: "ref-1",
        orderId: "cancel-fee-order",
        paymentId: "p-1",
        date: "2026-10-03",
        amount: 6500,
        reason: "Customer refund",
      },
    ]
    expect(pendingCancellationRefund(cancelledOrder, [])).toBe(6500)
    expect(pendingCancellationRefund(cancelledOrder, partialRefund)).toBe(0)
  })
})
