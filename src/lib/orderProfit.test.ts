import { describe, expect, it } from "vitest"
import { calculateOrderProfit } from "./orderProfit"
import type { AppData, Expense, Order, ShoppingTripRecord } from "../types"

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    reference: "US-1001",
    customerId: "cust-1",
    customerName: "Ayesha Fernando",
    isQuickOrder: false,
    collectionDate: "2026-11-24",
    collectionTime: "15:00",
    instructions: "",
    status: "Completed",
    preparationStatus: "Ready",
    paymentStatus: "Paid",
    agreedPrice: 10000,
    payments: [
      {
        id: "pay-1",
        date: "2026-11-24",
        amount: 10000,
        method: "Cash",
      },
    ],
    lines: [],
    costSnapshot: {
      ingredients: 4000,
      packaging: 500,
      labour: 1500,
      estimatedTotal: 6000,
      suggestedPrice: 10000,
    },
    reservations: [],
    shortages: [],
    createdAt: "2026-11-20T09:00:00.000Z",
    updatedAt: "2026-11-24T10:00:00.000Z",
    confirmedAt: "2026-11-20T09:05:00.000Z",
    ...overrides,
  }
}

function makeState(
  order: Order,
  overrides: Partial<
    Pick<
      AppData,
      "refunds" | "expenses" | "expenseAllocationHistories" | "shoppingTrips" | "orders"
    >
  > = {},
) {
  return {
    orders: [order],
    refunds: [],
    expenses: [],
    expenseAllocationHistories: [],
    shoppingTrips: [],
    ...overrides,
  }
}

describe("calculateOrderProfit", () => {
  it("calculates profit using agreed price and recipe cost including labour", () => {
    const order = makeOrder()
    const result = calculateOrderProfit(order, makeState(order))

    expect(result.incomeLkr).toBe(10000)
    expect(result.recipeCostLkr).toBe(6000)
    expect(result.extraExpensesLkr).toBe(0)
    expect(result.totalCostLkr).toBe(6000)
    expect(result.profitLkr).toBe(4000)
    expect(result.marginPercent).toBe(40)
  })

  it("includes direct expenses and allocated shared expenses for the order", () => {
    const order = makeOrder()
    const directExpense: Expense = {
      id: "exp-direct",
      paidDate: "2026-11-23",
      categoryId: "cat-1",
      amount: 650,
      description: "Custom cake topper",
      attribution: { type: "direct", orderId: order.id },
      createdAt: "2026-11-23T10:00:00.000Z",
    }
    const sharedExpense: Expense = {
      id: "exp-shared",
      paidDate: "2026-11-23",
      categoryId: "cat-2",
      amount: 1000,
      description: "Delivery fuel",
      attribution: { type: "shared" },
      createdAt: "2026-11-23T11:00:00.000Z",
    }
    const result = calculateOrderProfit(
      order,
      makeState(order, {
        expenses: [directExpense, sharedExpense],
        expenseAllocationHistories: [
          {
            expenseId: sharedExpense.id,
            versions: [
              {
                id: "ver-1",
                expenseId: sharedExpense.id,
                version: 1,
                createdAt: "2026-11-23T12:00:00.000Z",
                allocations: [
                  { id: "alloc-1", orderId: order.id, amount: 350 },
                ],
              },
            ],
          },
        ],
      }),
    )

    expect(result.extraExpensesLkr).toBe(1000)
    expect(result.extraExpenseItems).toHaveLength(2)
    expect(result.totalCostLkr).toBe(7000)
    expect(result.profitLkr).toBe(3000)
    expect(result.marginPercent).toBe(30)
  })

  it("excludes auto-recorded shopping trip expenses to avoid double counting ingredients", () => {
    const order = makeOrder()
    const shoppingExpense: Expense = {
      id: "exp-shop",
      paidDate: "2026-11-23",
      categoryId: "cat-shop",
      amount: 3200,
      description: "Shopping trip · 3 items",
      attribution: { type: "direct", orderId: order.id },
      createdAt: "2026-11-23T10:00:00.000Z",
    }
    const trip: ShoppingTripRecord = {
      id: "trip-1",
      reference: "SHP-1001",
      date: "2026-11-23",
      createdAt: "2026-11-23T10:00:00.000Z",
      totalSpent: 3200,
      expenseId: shoppingExpense.id,
      items: [],
    }
    const result = calculateOrderProfit(
      order,
      makeState(order, {
        expenses: [shoppingExpense],
        shoppingTrips: [trip],
      }),
    )

    expect(result.extraExpensesLkr).toBe(0)
    expect(result.extraExpenseItems).toEqual([])
    expect(result.profitLkr).toBe(4000)
  })

  it("uses cancellation fee as income with zero recipe cost for cancelled orders", () => {
    const order = makeOrder({
      status: "Cancelled",
      agreedPrice: 10000,
      cancellationFee: 500,
      payments: [
        { id: "pay-1", date: "2026-11-21", amount: 3000, method: "Cash" },
      ],
    })
    const result = calculateOrderProfit(
      order,
      makeState(order, {
        refunds: [
          {
            id: "ref-1",
            orderId: order.id,
            paymentId: "pay-1",
            date: "2026-11-22",
            amount: 1000,
            reason: "Partial refund",
          },
        ],
      }),
    )

    expect(result.collectedLkr).toBe(2000)
    expect(result.incomeLkr).toBe(500)
    expect(result.recipeCostLkr).toBe(0)
    expect(result.profitLkr).toBe(500)
  })

  it("returns negative profit when expenses exceed income", () => {
    const order = makeOrder({
      agreedPrice: 5000,
    })
    const result = calculateOrderProfit(order, makeState(order))

    expect(result.profitLkr).toBe(-1000)
    expect(result.marginPercent).toBe(-20)
  })
})
