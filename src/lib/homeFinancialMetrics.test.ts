import { describe, expect, it } from "vitest"

import {
  createTestAppData,
  createTestOrder,
  createTestOrderLine,
} from "../test/fixtures"

import {
  getCurrentWeekPeriod,
  selectHomeFinancialMetrics,
} from "./homeFinancialMetrics"

describe("Home financial metrics", () => {
  it("defines the current week as Monday through Sunday in Colombo time", () => {
    expect(getCurrentWeekPeriod(new Date("2026-10-20T18:45:00.000Z"))).toEqual({
      startDate: "2026-10-19",

      endDate: "2026-10-25",
    })

    expect(getCurrentWeekPeriod(new Date("2026-10-25T18:45:00.000Z"))).toEqual({
      startDate: "2026-10-26",

      endDate: "2026-11-01",
    })
  })

  it("selects Home totals from current data and keeps collection sales separate from cash", () => {
    const line = createTestOrderLine("home-line")

    const collected = createTestOrder("home-collected", [line], {
      status: "Completed",

      collectedAt: "2026-10-20T06:00:00.000Z",

      agreedPrice: 12000,

      costSnapshot: {
        ingredients: 5000,

        packaging: 1000,

        labour: 2000,

        estimatedTotal: 8000,

        suggestedPrice: 19200,
      },

      payments: [
        {
          id: "home-payment",

          date: "2026-10-20",

          amount: 3000,

          method: "Cash",
        },
      ],
    })

    const data = createTestAppData({
      orders: [collected],

      expenses: [
        {
          id: "home-expense",

          amount: 500,

          paidDate: "2026-10-20",

          categoryId: "expense-category-other",

          description: "Cleaning supplies",

          attribution: { type: "shared" },

          createdAt: "2026-10-20T08:00:00.000Z",
        },
      ],
    })

    const metrics = selectHomeFinancialMetrics(
      data,

      new Date("2026-10-20T08:00:00.000Z"),
    )

    expect(metrics.sales.recognizedRevenueLkr).toBe(12000)

    expect(metrics.estimatedContribution).toMatchObject({
      estimatedCostLkr: 8000,

      estimatedContributionLkr: 4000,
    })

    expect(metrics.cashMovement).toMatchObject({
      paymentsReceivedLkr: 3000,

      refundsIssuedLkr: 0,

      netCustomerCashMovementLkr: 3000,
    })

    expect(metrics.balances).toMatchObject({
      outstandingLkr: 9000,

      customerCreditLkr: 0,
    })

    expect(metrics.expenses.totalLkr).toBe(500)
  })
})
