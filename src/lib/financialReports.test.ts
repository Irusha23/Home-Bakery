import { describe, expect, it } from "vitest"

import {
  selectActualMaterialCostByCollectedOrderCohort,
  selectActualMaterialCostByCompletionDate,
  selectCollectedSales,
  selectCustomerBalances,
  selectCustomerCashMovement,
  selectExpenseBreakdown,
  selectExpenseAllocationsAsKnownAt,
  selectFinishedStockCosts,
  selectLatestExpenseAllocations,
  selectOrderExpenseAttribution,
  selectRecordedExpenseValue,
  selectRecordedPurchaseValue,
  selectEstimatedContribution,
} from "./financialReports"

import { BUILT_IN_EXPENSE_CATEGORIES } from "./expenses"

import {
  createTestOrder,
  createTestOrderLine,
  createTestPreparationRecord,
} from "../test/fixtures"

import type {
  Expense,
  ExpenseAllocationHistory,
  FinishedStockTransaction,
  Order,
  PurchaseRecord,
} from "../types"

const period = { startDate: "2026-10-20", endDate: "2026-10-20" }

const expenseCategories = structuredClone(BUILT_IN_EXPENSE_CATEGORIES)

function collectedOrder(
  id: string,

  collectedAt: string,

  overrides: Partial<Order> = {},
): Order {
  return createTestOrder(id, [createTestOrderLine(`${id}-line`)], {
    status: "Completed",

    collectedAt,

    ...overrides,
  })
}

function sharedExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-1",

    amount: 12000,

    paidDate: "2026-10-20",

    categoryId: "expense-category-utilities",

    description: "Electricity bill",

    attribution: { type: "shared" },

    createdAt: "2026-10-20T08:00:00.000Z",

    ...overrides,
  }
}

function directExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    ...sharedExpense(),
    id: "direct-expense",
    amount: 2500,
    categoryId: "expense-category-other",
    description: "Delivery charge",
    attribution: { type: "direct", orderId: "customer-order" },
    ...overrides,
  }
}

function allocationHistory(): ExpenseAllocationHistory {
  return {
    expenseId: "expense-1",

    versions: [
      {
        id: "allocation-version-1",

        expenseId: "expense-1",

        version: 1,

        createdAt: "2026-10-20T03:00:00.000Z",

        allocations: [
          { id: "allocation-1", orderId: "customer-order", amount: 4000 },
        ],
      },

      {
        id: "allocation-version-2",

        expenseId: "expense-1",

        version: 2,

        createdAt: "2026-10-20T08:00:00.000Z",

        allocations: [
          { id: "allocation-2", orderId: "customer-order", amount: 7000 },
        ],
      },
    ],
  }
}

describe("financial reporting selectors", () => {
  it("uses inclusive Colombo calendar-day timestamp boundaries", () => {
    const orders = [
      collectedOrder("at-start", "2026-10-19T18:30:00.000Z", {
        agreedPrice: 1000,
      }),

      collectedOrder("before-start", "2026-10-19T18:29:59.999Z", {
        agreedPrice: 2000,
      }),

      collectedOrder("at-end", "2026-10-20T18:29:59.999Z", {
        agreedPrice: 3000,
      }),

      collectedOrder("after-end", "2026-10-20T18:30:00.000Z", {
        agreedPrice: 4000,
      }),
    ]

    expect(selectCollectedSales(orders, period)).toMatchObject({
      recognizedRevenueLkr: 4000,

      collectedOrderCount: 2,

      complete: true,
    })
  })

  it("recognizes collected unpaid orders as revenue and keeps legacy collections undated", () => {
    const unpaid = collectedOrder(
      "unpaid-collected",
      "2026-10-20T06:00:00.000Z",
      {
        agreedPrice: 12500,

        payments: [],
      },
    )

    const legacy = createTestOrder("legacy-collected", [], {
      status: "Completed",

      agreedPrice: 7000,

      collectedAt: null,
    })

    const cancelled = createTestOrder("cancelled", [], {
      status: "Cancelled",

      agreedPrice: 9000,
    })

    expect(
      selectCollectedSales([unpaid, legacy, cancelled], period),
    ).toMatchObject({
      recognizedRevenueLkr: 12500,

      collectedOrderCount: 1,

      undatedLegacyCollections: { count: 1, valueLkr: 7000 },

      complete: true,
    })

    expect(
      selectCustomerCashMovement([unpaid, legacy, cancelled], [], period),
    ).toMatchObject({
      paymentsReceivedLkr: 0,

      refundsIssuedLkr: 0,

      netCustomerCashMovementLkr: 0,
    })
  })

  it("reports payments and refunds by their separate dates", () => {
    const order = createTestOrder("cash-order", [], {
      payments: [
        { id: "payment-1", date: "2026-10-19", amount: 8000, method: "Cash" },

        { id: "payment-2", date: "2026-10-20", amount: 3000, method: "Bank" },
      ],
    })

    const refunds = [
      {
        id: "refund-1",

        orderId: order.id,

        paymentId: "payment-1",

        date: "2026-10-20",

        amount: 2000,

        reason: "Partial refund",
      },
    ]

    expect(selectCustomerCashMovement([order], refunds, period)).toMatchObject({
      paymentsReceivedLkr: 3000,

      refundsIssuedLkr: 2000,

      netCustomerCashMovementLkr: 1000,

      paymentCount: 1,

      refundCount: 1,

      complete: true,
    })
  })

  it("floors outstanding balances at zero, reports customer credit, and excludes cancellations", () => {
    const due = createTestOrder("due", [], {
      status: "Completed",

      agreedPrice: 10000,

      payments: [
        { id: "due-payment", date: "2026-10-20", amount: 3000, method: "Cash" },
      ],
    })

    const credit = createTestOrder("credit", [], {
      agreedPrice: 5000,

      payments: [
        {
          id: "credit-payment",
          date: "2026-10-20",
          amount: 7000,
          method: "Cash",
        },
      ],
    })

    const cancelled = createTestOrder("cancelled-balance", [], {
      status: "Cancelled",

      agreedPrice: 4000,
    })

    const balances = selectCustomerBalances([due, credit, cancelled], [])

    expect(balances).toMatchObject({
      outstandingLkr: 7000,

      customerCreditLkr: 2000,

      receivableOrderCount: 1,

      creditOrderCount: 1,

      complete: true,
    })
  })

  it("counts paid expenses once and does not use allocation history as extra expense value", () => {
    const expense = sharedExpense()

    const result = selectRecordedExpenseValue(
      [expense],

      expenseCategories,

      [],

      period,
    )

    expect(result).toMatchObject({
      totalLkr: 12000,

      recordCount: 1,

      complete: true,
    })

    expect(
      selectRecordedExpenseValue(
        [expense, { ...expense, id: "outside", paidDate: "2026-10-19" }],

        expenseCategories,

        [],

        period,
      ).totalLkr,
    ).toBe(12000)
  })

  it("includes both endpoints for date-only reporting periods", () => {
    const fromStart = sharedExpense({
      id: "expense-start",

      amount: 1000,

      paidDate: "2026-10-19",
    })

    const fromEnd = sharedExpense({
      id: "expense-end",

      amount: 2000,

      paidDate: "2026-10-20",
    })

    const afterEnd = sharedExpense({
      id: "expense-after",

      amount: 4000,

      paidDate: "2026-10-21",
    })

    expect(
      selectRecordedExpenseValue(
        [fromStart, fromEnd, afterEnd],

        expenseCategories,

        [],

        { startDate: "2026-10-19", endDate: "2026-10-20" },
      ),
    ).toMatchObject({ totalLkr: 3000, recordCount: 2, complete: true })
  })

  it("reports purchase value separately from operating expenses", () => {
    const purchase: PurchaseRecord = {
      id: "purchase-1",

      inventoryId: "flour",

      purchasedQuantity: 10,

      purchasedUnit: "kg",

      usableQuantity: 9.5,

      usableUnit: "kg",

      usableBaseQuantity: 9500,

      totalPrice: 5200,

      date: "2026-10-20",

      note: "Flour purchase",

      createdAt: "2026-10-20T08:00:00.000Z",
    }

    expect(selectRecordedPurchaseValue([purchase], period)).toMatchObject({
      totalLkr: 5200,

      recordCount: 1,

      complete: true,
    })

    expect(
      selectRecordedExpenseValue([], expenseCategories, [], period).totalLkr,
    ).toBe(0)
  })

  it("uses frozen estimated cost snapshots for collected-order contribution", () => {
    const order = collectedOrder("frozen-cost", "2026-10-20T06:00:00.000Z", {
      agreedPrice: 14000,

      costSnapshot: {
        ingredients: 7000,

        packaging: 1000,

        labour: 2000,

        estimatedTotal: 10000,

        suggestedPrice: 24000,
      },
    })

    const changedRecipe = {
      ...order,

      lines: order.lines.map((line) => ({
        ...line,

        recipeSnapshot: { ...line.recipeSnapshot, estimatedCost: 99000 },
      })),
    }

    expect(selectEstimatedContribution([changedRecipe], period)).toMatchObject({
      estimatedCostLkr: 10000,

      estimatedContributionLkr: 4000,

      collectedOrderCount: 1,

      complete: true,
    })
  })

  it("reports missing actual preparation cost as incomplete instead of zero", () => {
    const line = createTestOrderLine("actual-line")

    const missingCost = createTestPreparationRecord("actual-order", line, {
      status: "Ready",

      completedAt: "2026-10-20T06:00:00.000Z",

      actualCost: null,
    })

    const eventReport = selectActualMaterialCostByCompletionDate(
      [missingCost],

      period,
    )

    expect(eventReport).toMatchObject({
      actualMaterialCost: null,

      preparationCount: 1,

      complete: false,
    })

    expect(eventReport.issues.join(" ")).toContain(
      "no valid actual material cost",
    )
  })

  it("supports actual material cost by completion date and collected-order cohort", () => {
    const order = collectedOrder("cohort-order", "2026-10-20T06:00:00.000Z")

    const line = order.lines[0]

    const record = createTestPreparationRecord(order.id, line, {
      status: "Ready",

      completedAt: "2026-10-18T06:00:00.000Z",

      actualCost: 321.75,
    })

    expect(
      selectActualMaterialCostByCompletionDate([record], period),
    ).toMatchObject({
      actualMaterialCost: 0,

      preparationCount: 0,

      complete: true,
    })

    expect(
      selectActualMaterialCostByCollectedOrderCohort(
        [order],

        [record],

        period,
      ),
    ).toMatchObject({
      actualMaterialCost: 321.75,

      preparationCount: 1,

      complete: true,
    })

    expect(
      selectActualMaterialCostByCollectedOrderCohort([order], [], period),
    ).toMatchObject({
      actualMaterialCost: null,

      preparationCount: 0,

      complete: false,
    })
  })

  it("keeps finished-stock cost of sales separate from write-off cost", () => {
    const transactions: FinishedStockTransaction[] = [
      {
        id: "sale-1",

        type: "sale",

        batchId: "batch-1",

        inventoryId: "finished-cake",

        quantity: 2,

        occurredAt: "2026-10-20T06:00:00.000Z",

        unitCost: 350.5,

        totalCost: 701,
      },

      {
        id: "write-off-1",

        type: "write-off",

        batchId: "batch-2",

        inventoryId: "finished-cake",

        quantity: 1,

        occurredAt: "2026-10-20T07:00:00.000Z",

        reason: "Damaged",

        unitCost: 200.25,

        totalCost: 200.25,
      },
    ]

    expect(selectFinishedStockCosts(transactions, period)).toMatchObject({
      costOfStockSold: 701,

      writeOffCost: 200.25,

      soldTransactionCount: 1,

      writeOffTransactionCount: 1,

      complete: true,
    })
  })

  it("selects only the latest applicable allocation version", () => {
    const expense = sharedExpense()

    const history = allocationHistory()

    const customerOrder = createTestOrder("customer-order", [], {
      customerId: "customer-1",

      isQuickOrder: false,

      status: "Completed",
    })

    const latest = selectLatestExpenseAllocations(
      [expense],

      [history],

      [customerOrder],
    )

    const asKnownAt = selectExpenseAllocationsAsKnownAt(
      [expense],

      [history],

      [customerOrder],

      "2026-10-20T05:00:00.000Z",
    )

    expect(latest.entries[0]).toMatchObject({
      version: { version: 2 },

      allocatedAmountLkr: 7000,

      unallocatedBalanceLkr: 5000,
    })

    expect(asKnownAt.entries[0]).toMatchObject({
      version: { version: 1 },

      allocatedAmountLkr: 4000,

      unallocatedBalanceLkr: 8000,
    })

    expect(latest.complete).toBe(true)

    expect(asKnownAt.complete).toBe(true)
  })

  it("groups valid paid expenses by category and attribution without counting allocations", () => {
    const customerOrder = createTestOrder("customer-order", [], {
      customerId: "customer-1",
      isQuickOrder: false,
      status: "Completed",
    })
    const report = selectExpenseBreakdown(
      [
        sharedExpense({ amount: 12000 }),
        directExpense(),
        sharedExpense({
          id: "outside-period",
          amount: 8000,
          paidDate: "2026-10-21",
        }),
      ],
      expenseCategories,
      [customerOrder],
      period,
    )

    expect(report).toMatchObject({
      totalLkr: 14500,
      expenseCount: 2,
      byAttribution: {
        direct: { totalLkr: 2500, expenseCount: 1 },
        shared: { totalLkr: 12000, expenseCount: 1 },
      },
      complete: true,
    })
    expect(report.byCategory).toEqual([
      {
        categoryId: "expense-category-other",
        categoryName: "Other",
        totalLkr: 2500,
        expenseCount: 1,
      },
      {
        categoryId: "expense-category-utilities",
        categoryName: "Utilities",
        totalLkr: 12000,
        expenseCount: 1,
      },
    ])
  })

  it("reports empty expense periods as complete zero totals", () => {
    expect(
      selectExpenseBreakdown([], expenseCategories, [], period),
    ).toMatchObject({
      totalLkr: 0,
      expenseCount: 0,
      byCategory: [],
      byAttribution: {
        direct: { totalLkr: 0, expenseCount: 0 },
        shared: { totalLkr: 0, expenseCount: 0 },
      },
      complete: true,
    })
  })

  it("marks malformed expenses incomplete whether they fall inside or outside the selected period", () => {
    const valid = sharedExpense({ id: "valid", amount: 12000 })
    const malformedInside = sharedExpense({
      id: "malformed-inside",
      amount: 0,
    })
    const malformedOutside = sharedExpense({
      id: "malformed-outside",
      amount: 0,
      paidDate: "2026-10-21",
    })

    const insideReport = selectExpenseBreakdown(
      [valid, malformedInside],
      expenseCategories,
      [],
      period,
    )
    const outsideReport = selectExpenseBreakdown(
      [valid, malformedOutside],
      expenseCategories,
      [],
      period,
    )

    expect(insideReport).toMatchObject({
      totalLkr: 12000,
      expenseCount: 1,
      complete: false,
    })
    expect(outsideReport).toMatchObject({
      totalLkr: 12000,
      expenseCount: 1,
      complete: false,
    })
    expect(insideReport.issues.join(" ")).toContain("malformed-inside")
    expect(outsideReport.issues.join(" ")).toContain("malformed-outside")
  })

  it("selects one allocation version for order attribution and separates source expenses from attributed amounts", () => {
    const expense = sharedExpense()
    const direct = directExpense()
    const customerOrder = createTestOrder("customer-order", [], {
      customerId: "customer-1",
      isQuickOrder: false,
      status: "Completed",
    })
    const expenses = [expense, direct]
    const histories = [allocationHistory()]
    const latest = selectOrderExpenseAttribution(
      expenses,
      histories,
      expenseCategories,
      [customerOrder],
      period,
      { type: "latest" },
    )
    const asKnownAt = selectOrderExpenseAttribution(
      expenses,
      histories,
      expenseCategories,
      [customerOrder],
      period,
      { type: "as-known-at", timestamp: "2026-10-20T05:00:00.000Z" },
    )

    expect(latest).toMatchObject({
      sourceExpenseTotalLkr: 14500,
      directExpenseTotalLkr: 2500,
      sharedAllocatedTotalLkr: 7000,
      unallocatedSharedExpenseTotalLkr: 5000,
      complete: true,
      orders: [
        {
          orderId: "customer-order",
          directExpenseLkr: 2500,
          sharedAllocatedLkr: 7000,
          totalAttributedLkr: 9500,
        },
      ],
    })
    expect(asKnownAt).toMatchObject({
      sourceExpenseTotalLkr: 14500,
      sharedAllocatedTotalLkr: 4000,
      unallocatedSharedExpenseTotalLkr: 8000,
      orders: [{ sharedAllocatedLkr: 4000, totalAttributedLkr: 6500 }],
      complete: true,
    })
  })

  it("reports entirely unallocated shared expenses and rejects ineligible allocation targets", () => {
    const expense = sharedExpense()
    const unallocated = selectOrderExpenseAttribution(
      [expense],
      [],
      expenseCategories,
      [],
      period,
      { type: "latest" },
    )
    expect(unallocated).toMatchObject({
      sourceExpenseTotalLkr: 12000,
      sharedAllocatedTotalLkr: 0,
      unallocatedSharedExpenseTotalLkr: 12000,
      complete: true,
    })

    const cancelledOrder = createTestOrder("customer-order", [], {
      customerId: "customer-1",
      isQuickOrder: false,
      status: "Cancelled",
    })
    const invalid = selectOrderExpenseAttribution(
      [expense],
      [allocationHistory()],
      expenseCategories,
      [cancelledOrder],
      period,
      { type: "latest" },
    )
    expect(invalid.complete).toBe(false)
    expect(invalid.sharedAllocatedTotalLkr).toBeNull()
    expect(invalid.unallocatedSharedExpenseTotalLkr).toBeNull()
    expect(invalid.issues.join(" ")).toContain("cancelled")

    const missingTarget = selectOrderExpenseAttribution(
      [expense],
      [allocationHistory()],
      expenseCategories,
      [],
      period,
      { type: "latest" },
    )
    expect(missingTarget.complete).toBe(false)
    expect(missingTarget.sharedAllocatedTotalLkr).toBeNull()
    expect(missingTarget.issues.join(" ")).toContain("existing customer order")

    const quickOrder = createTestOrder("customer-order", [], {
      customerId: null,
      isQuickOrder: true,
      status: "Completed",
    })
    const ineligibleTarget = selectOrderExpenseAttribution(
      [expense],
      [allocationHistory()],
      expenseCategories,
      [quickOrder],
      period,
      { type: "latest" },
    )
    expect(ineligibleTarget.complete).toBe(false)
    expect(ineligibleTarget.sharedAllocatedTotalLkr).toBeNull()
    expect(ineligibleTarget.issues.join(" ")).toContain(
      "existing customer order",
    )
  })

  it("rejects allocations exceeding the source expense and preserves unknown totals", () => {
    const expense = sharedExpense({ amount: 6000 })
    const customerOrder = createTestOrder("customer-order", [], {
      customerId: "customer-1",
      isQuickOrder: false,
      status: "Completed",
    })
    const history = allocationHistory()
    const overallocated = {
      ...history,
      versions: [
        {
          ...history.versions[0],
          allocations: [
            { id: "allocation-over", orderId: "customer-order", amount: 7000 },
          ],
        },
      ],
    }
    const report = selectOrderExpenseAttribution(
      [expense],
      [overallocated],
      expenseCategories,
      [customerOrder],
      period,
      { type: "latest" },
    )
    expect(report.complete).toBe(false)
    expect(report.sharedAllocatedTotalLkr).toBeNull()
    expect(report.unallocatedSharedExpenseTotalLkr).toBeNull()
    expect(report.issues.join(" ")).toContain("cannot exceed")
  })

  it("marks expense attribution totals unknown when whole-LKR aggregation overflows", () => {
    const report = selectOrderExpenseAttribution(
      [
        sharedExpense({
          id: "maximum-expense",
          amount: Number.MAX_SAFE_INTEGER,
        }),
        sharedExpense({ id: "one-lkr-expense", amount: 1 }),
      ],
      [],
      expenseCategories,
      [],
      period,
      { type: "latest" },
    )
    expect(report.complete).toBe(false)
    expect(report.sourceExpenseTotalLkr).toBeNull()
    expect(report.sharedAllocatedTotalLkr).toBe(0)
    expect(report.unallocatedSharedExpenseTotalLkr).toBeNull()
    expect(report.issues.join(" ")).toContain("safe whole-LKR range")
  })

  it("marks invalid dates, malformed amounts, and unsafe aggregations incomplete", () => {
    const invalidExpense = sharedExpense({ amount: 1.5 })

    const invalidPeriod = selectRecordedExpenseValue(
      [sharedExpense()],

      expenseCategories,

      [],

      {
        startDate: "2026-10-21",

        endDate: "2026-10-20",
      },
    )

    const overflow = selectRecordedExpenseValue(
      [
        sharedExpense({ id: "max-1", amount: Number.MAX_SAFE_INTEGER }),

        sharedExpense({ id: "max-2", amount: 1 }),
      ],

      expenseCategories,

      [],

      period,
    )

    expect(
      selectRecordedExpenseValue(
        [invalidExpense],

        expenseCategories,

        [],

        period,
      ),
    ).toMatchObject({ totalLkr: 0, complete: false })

    expect(invalidPeriod).toMatchObject({ totalLkr: null, complete: false })

    expect(overflow).toMatchObject({ totalLkr: null, complete: false })

    expect(overflow.issues.join(" ")).toContain("safe whole-LKR range")
  })
})
