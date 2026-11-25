import { describe, expect, expectTypeOf, it } from "vitest"

import {
  appendAllocationVersion,
  selectAllocationVersionAsKnownAt,
  selectLatestAllocationVersion,
  totalAllocationAmount,
  unallocatedExpenseBalance,
  validateAllocationHistory,
  validateAllocationVersion,
  validateExpense,
  validateExpenseCategory,
  validateNewAllocationVersion,
} from "./expenses"

import { createTestOrder, createTestOrderLine } from "../test/fixtures"

import type {
  Expense,
  ExpenseAllocation,
  ExpenseAllocationVersion,
  ExpenseCategory,
  Order,
  PurchaseRecord,
} from "../types"

const categories: ExpenseCategory[] = [
  { id: "utilities", name: "Utilities", source: "built-in" },

  { id: "custom-delivery", name: "Delivery", source: "custom" },
]

const customerOrder = createTestOrder(
  "customer-order-1",

  [createTestOrderLine("customer-order-line")],

  { customerId: "customer-1", isQuickOrder: false },
)

const secondCustomerOrder = createTestOrder(
  "customer-order-2",

  [createTestOrderLine("customer-order-line-2")],

  { customerId: "customer-2", isQuickOrder: false },
)

const quickOrder = createTestOrder("quick-order", [], {
  customerId: null,

  isQuickOrder: true,
})

const orders: Order[] = [customerOrder, secondCustomerOrder, quickOrder]

function createExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-1",

    amount: 12000,

    paidDate: "2026-10-12",

    categoryId: "utilities",

    description: "October electricity bill",

    attribution: { type: "shared" },

    createdAt: "2026-10-12T08:00:00.000Z",

    ...overrides,
  }
}

function createVersion(
  version: number,

  overrides: Partial<ExpenseAllocationVersion> = {},
): ExpenseAllocationVersion {
  return {
    id: `allocation-version-${version}`,

    expenseId: "expense-1",

    version,

    createdAt: `2026-10-${String(12 + version).padStart(2, "0")}T08:00:00.000Z`,

    allocations: [
      {
        id: `allocation-${version}-1`,

        orderId: customerOrder.id,

        amount: 4000,
      },
    ],

    ...overrides,
  }
}

describe("expense domain validation", () => {
  it.each(categories)(
    "accepts a valid expense referencing a $source category",

    (category) => {
      expect(
        validateExpense(
          createExpense({ categoryId: category.id }),
          categories,
          orders,
        ),
      )

        .toMatchObject({ valid: true, issues: [] })

      expect(validateExpenseCategory(category)).toMatchObject({
        valid: true,

        issues: [],
      })
    },
  )

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])(
    "rejects invalid whole-LKR expense amount %s",

    (amount) => {
      expect(
        validateExpense(createExpense({ amount }), categories, orders).valid,
      ).toBe(false)
    },
  )

  it.each(["", "2026-02-30", "12-10-2026", "2026-10-12T00:00:00.000Z"])(
    "rejects invalid paid date %s",

    (paidDate) => {
      expect(
        validateExpense(createExpense({ paidDate }), categories, orders).issues,
      ).toContain("Enter a valid date when the expense was paid.")
    },
  )

  it("rejects missing category references and required description text", () => {
    const invalid = validateExpense(
      createExpense({ categoryId: "unknown", description: "  " }),

      categories,

      orders,
    )

    expect(invalid.valid).toBe(false)

    expect(invalid.issues).toContain(
      "Expense category must reference exactly one category.",
    )

    expect(invalid.issues).toContain("Expense description is required.")

    expect(
      validateExpense(
        createExpense(),

        [...categories, { ...categories[0] }],

        orders,
      ).issues,
    ).toContain("Expense category must reference exactly one category.")
  })

  it("requires direct expenses to point to an existing order", () => {
    const valid = createExpense({
      attribution: { type: "direct", orderId: customerOrder.id },
    })

    expect(validateExpense(valid, categories, orders).valid).toBe(true)

    expect(
      validateExpense(
        { ...valid, attribution: { type: "direct", orderId: "missing" } },

        categories,

        orders,
      ).valid,
    ).toBe(false)
  })

  it("keeps purchase records and estimated labour outside the expense model", () => {
    expectTypeOf<PurchaseRecord>().not.toMatchTypeOf<Expense>()

    expectTypeOf<Order["costSnapshot"]>().not.toMatchTypeOf<Expense>()
  })
})

describe("shared expense allocation versions", () => {
  const expense = createExpense()

  it("accepts the first valid allocation version and an equal-total allocation", () => {
    const version = createVersion(1, {
      allocations: [
        { id: "allocation-1a", orderId: customerOrder.id, amount: 7000 },

        { id: "allocation-1b", orderId: secondCustomerOrder.id, amount: 5000 },
      ],
    })

    expect(validateAllocationVersion(expense, version, orders).valid).toBe(true)

    expect(totalAllocationAmount(version)).toBe(12000)

    expect(unallocatedExpenseBalance(expense, version)).toBe(0)
  })

  it("calculates partial and unallocated balances without persisting a balance", () => {
    const version = createVersion(1, {
      allocations: [
        { id: "allocation-partial", orderId: customerOrder.id, amount: 4500 },
      ],
    })

    expect(validateAllocationVersion(expense, version, orders).valid).toBe(true)

    expect(unallocatedExpenseBalance(expense, version)).toBe(7500)

    expect(Object.keys(version)).not.toContain("unallocatedBalance")
  })

  it("rejects allocations exceeding the expense by one rupee", () => {
    const version = createVersion(1, {
      allocations: [
        {
          id: "allocation-too-much-a",
          orderId: customerOrder.id,
          amount: 6000,
        },

        {
          id: "allocation-too-much-b",

          orderId: secondCustomerOrder.id,

          amount: 6001,
        },
      ],
    })

    expect(validateAllocationVersion(expense, version, orders)).toMatchObject({
      valid: false,

      issues: expect.arrayContaining([
        "Allocation total cannot exceed the shared expense.",
      ]),
    })

    expect(unallocatedExpenseBalance(expense, version)).toBe(Number.NaN)
  })

  it("rejects duplicate entry IDs, duplicate order targets, and invalid amounts", () => {
    const duplicateId: ExpenseAllocation[] = [
      { id: "same-id", orderId: customerOrder.id, amount: 1000 },

      { id: "same-id", orderId: secondCustomerOrder.id, amount: 1000 },
    ]

    const duplicateOrder: ExpenseAllocation[] = [
      { id: "entry-a", orderId: customerOrder.id, amount: 1000 },

      { id: "entry-b", orderId: customerOrder.id, amount: 1000 },
    ]

    const invalidAmount: ExpenseAllocation[] = [
      { id: "entry-zero", orderId: customerOrder.id, amount: 0 },
    ]

    const fractionalAmount: ExpenseAllocation[] = [
      { id: "entry-fraction", orderId: customerOrder.id, amount: 1.5 },
    ]

    for (const [allocations, expectedIssue] of [
      [duplicateId, "Allocation entry IDs must be unique within a version."],

      [
        duplicateOrder,
        "An order can appear only once in an allocation version.",
      ],

      [invalidAmount, "Allocation amount must be a positive whole-LKR amount."],

      [
        fractionalAmount,
        "Allocation amount must be a positive whole-LKR amount.",
      ],
    ] as const) {
      expect(
        validateAllocationVersion(
          expense,

          createVersion(1, { allocations: [...allocations] }),

          orders,
        ).issues,
      ).toContain(expectedIssue)
    }
  })

  it("rejects absent, quick-order, or non-customer allocation targets", () => {
    const badTargets = ["missing-order", quickOrder.id]

    for (const orderId of badTargets) {
      const version = createVersion(1, {
        allocations: [{ id: `entry-${orderId}`, orderId, amount: 1000 }],
      })

      expect(
        validateAllocationVersion(expense, version, orders).issues,
      ).toContain(
        "Each allocation target must be an existing customer order.",
      )
    }
  })

  it("rejects allocation versions for direct expenses", () => {
    const directExpense = createExpense({
      attribution: { type: "direct", orderId: customerOrder.id },
    })

    expect(
      validateAllocationVersion(directExpense, createVersion(1), orders).issues,
    ).toContain("Only shared expenses can have allocation versions.")
  })

  it("requires sequential version numbers and unique version and entry IDs", () => {
    const first = createVersion(1)

    const next = createVersion(2, {
      id: first.id,

      allocations: [
        {
          id: first.allocations[0].id,

          orderId: secondCustomerOrder.id,

          amount: 2000,
        },
      ],
    })

    expect(
      validateAllocationHistory(expense, [first, next], orders).issues,
    ).toEqual(
      expect.arrayContaining([
        "Allocation version IDs must be unique.",

        "Allocation entry IDs must be unique across versions.",
      ]),
    )

    expect(
      validateAllocationHistory(expense, [createVersion(2)], orders).issues,
    )

      .toContain("Allocation versions must be sequential starting at 1.")

    expect(
      validateNewAllocationVersion(expense, [first], createVersion(3), orders)
        .valid,
    )

      .toBe(false)
  })

  it("appends a sequential reallocation without changing previous history", () => {
    const first = createVersion(1)

    const snapshot = structuredClone(first)

    const next = createVersion(2, {
      allocations: [
        {
          id: "allocation-2-1",

          orderId: secondCustomerOrder.id,

          amount: 6000,
        },
      ],
    })

    const appended = appendAllocationVersion(expense, [first], next, orders)

    expect(appended.valid).toBe(true)

    if (!appended.valid) return

    expect(appended.versions).toEqual([first, next])

    expect(appended.versions[0]).toBe(first)

    expect(first).toEqual(snapshot)
  })

  it("rejects invalid new versions without repairing or mutating inputs", () => {
    const previous = [createVersion(1)]

    const previousSnapshot = structuredClone(previous)

    const invalid = createVersion(3, {
      allocations: [{ id: "bad-entry", orderId: customerOrder.id, amount: 0 }],
    })

    const result = appendAllocationVersion(expense, previous, invalid, orders)

    expect(result.valid).toBe(false)

    expect(previous).toEqual(previousSnapshot)

    expect(invalid.allocations[0].amount).toBe(0)
  })

  it("selects only the latest version for current totals and the applicable historical version", () => {
    const first = createVersion(1)

    const second = createVersion(2, {
      allocations: [
        {
          id: "allocation-2-1",

          orderId: secondCustomerOrder.id,

          amount: 9000,
        },
      ],
    })

    const latest = selectLatestAllocationVersion(
      expense,
      [first, second],
      orders,
    )

    const knownAfterFirst = selectAllocationVersionAsKnownAt(
      expense,

      [first, second],

      orders,

      "2026-10-13T12:00:00.000Z",
    )

    const knownBeforeFirst = selectAllocationVersionAsKnownAt(
      expense,

      [first, second],

      orders,

      "2026-10-12T08:00:00.000Z",
    )

    expect(latest).toMatchObject({ valid: true, version: second })

    expect(knownAfterFirst).toMatchObject({ valid: true, version: first })

    expect(knownBeforeFirst).toMatchObject({ valid: true, version: null })

    if (latest.valid && latest.version)
      expect(totalAllocationAmount(latest.version)).toBe(9000)

    expect(unallocatedExpenseBalance(expense, second)).toBe(3000)
  })

  it("rejects backward version timestamps and invalid reporting timestamps", () => {
    const first = createVersion(1, { createdAt: "2026-10-20T08:00:00.000Z" })

    const second = createVersion(2, { createdAt: "2026-10-19T08:00:00.000Z" })

    expect(validateAllocationHistory(expense, [first, second], orders).issues)

      .toContain("Allocation version timestamps cannot go backwards.")

    expect(
      selectAllocationVersionAsKnownAt(expense, [first], orders, "not-a-date"),
    ).toMatchObject({ valid: false })
  })
})
