import { describe, expect, it } from "vitest"
import {
  createTestAppData,
  createTestOrder,
  createTestOrderLine,
} from "../test/fixtures"
import {
  computeSpendStatus,
  getMonthPeriod,
  selectMonthlyBudgetReport,
} from "./budget"

describe("budget selectors", () => {
  it("computes the Colombo calendar month bounds accurately", () => {
    const period = getMonthPeriod(new Date("2026-02-15T12:00:00.000Z"))
    expect(period).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    })
  })

  it("flags 80% warning and over-limit statuses accurately", () => {
    expect(computeSpendStatus(7999, 10000).status).toBe("on-track")
    expect(computeSpendStatus(8000, 10000).status).toBe("warning")
    expect(computeSpendStatus(10001, 10000).status).toBe("over")
  })

  it("calculates monthly sales progress, category spend, and over-limit alerts", () => {
    const order = createTestOrder("order-1", [createTestOrderLine("line-1")], {
      status: "Completed",
      agreedPrice: 40000,
      collectedAt: "2026-10-12T10:00:00.000Z",
      costSnapshot: {
        ingredients: 12000,
        packaging: 2000,
        labour: 0,
        estimatedTotal: 14000,
        suggestedPrice: 20000,
      },
    })
    const state = createTestAppData({
      orders: [order],
      purchases: [
        {
          id: "pur-1",
          inventoryId: "flour",
          purchasedQuantity: 10000,
          purchasedUnit: "g",
          usableQuantity: 10000,
          usableUnit: "g",
          usableBaseQuantity: 10000,
          totalPrice: 22000,
          date: "2026-10-10",
          note: "",
          createdAt: "2026-10-10T08:00:00.000Z",
        },
      ],
      expenses: [
        {
          id: "exp-1",
          amount: 12000,
          paidDate: "2026-10-14",
          categoryId: "expense-category-utilities",
          description: "Gas & electricity",
          attribution: { type: "shared" },
          createdAt: "2026-10-14T08:00:00.000Z",
        },
      ],
      budgetPlan: {
        monthlySalesTarget: 80000,
        monthlyProfitTarget: 30000,
        ingredientSpendLimit: 20000,
        categoryLimits: {
          "expense-category-utilities": 10000,
        },
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    })

    const report = selectMonthlyBudgetReport(
      state,
      new Date("2026-10-20T09:00:00.000Z"),
    )

    expect(report.sales.actual).toBe(40000)
    expect(report.sales.progressPct).toBe(50)
    expect(report.profit.actual).toBe(14000)
    expect(report.ingredientSpend.status).toBe("over")
    expect(report.overLimitAlerts).toHaveLength(2)
    expect(report.overLimitAlerts.map((a) => a.overBy)).toEqual([2000, 2000])
  })

  it("counts shopping-trip expenses in ingredient spend without double-deducting them from profit overhead", () => {
    const order = createTestOrder("order-trip", [createTestOrderLine("line-1")], {
      status: "Completed",
      agreedPrice: 20000,
      collectedAt: "2026-10-12T10:00:00.000Z",
      costSnapshot: {
        ingredients: 6000,
        packaging: 1000,
        labour: 0,
        estimatedTotal: 7000,
        suggestedPrice: 15000,
      },
    })
    const state = createTestAppData({
      orders: [order],
      expenses: [
        {
          id: "exp-trip-1",
          amount: 4500,
          paidDate: "2026-10-11",
          categoryId: "expense-category-packaging-other",
          description: "Market run",
          attribution: { type: "shared" },
          createdAt: "2026-10-11T08:00:00.000Z",
        },
        {
          id: "exp-overhead-1",
          amount: 2000,
          paidDate: "2026-10-14",
          categoryId: "expense-category-utilities",
          description: "Gas",
          attribution: { type: "shared" },
          createdAt: "2026-10-14T08:00:00.000Z",
        },
      ],
      shoppingTrips: [
        {
          id: "trip-1",
          reference: "SHP-1001",
          date: "2026-10-11",
          createdAt: "2026-10-11T08:00:00.000Z",
          totalSpent: 4500,
          expenseId: "exp-trip-1",
          items: [],
        },
      ],
    })

    const report = selectMonthlyBudgetReport(
      state,
      new Date("2026-10-20T09:00:00.000Z"),
    )
    expect(report.ingredientSpend.spent).toBe(4500)
    // Profit: 20000 sales - 7000 COGS - 2000 non-ingredient overhead = 11000 (4500 shopping expense not double-subtracted)
    expect(report.profit.actual).toBe(11000)
  })
})
