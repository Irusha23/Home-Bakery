import { describe, expect, it } from "vitest"

import { selectReservedByItem } from "../lib/inventory"

import { createPreparationRecord } from "../lib/preparation"
import { calculateLineRequirements } from "../lib/orders"

import {
  createTestAppData,
  createTestInventoryItem,
  createTestOrder,
  createTestOrderLine,
  createTestPreparationRecord,
  createTestRecipeSnapshot,
  createTestStockRequirement,
} from "../test/fixtures"

import type {
  Expense,
  ExpenseAllocationVersion,
  ExpenseCategory,
  InventoryMovementType,
  PurchaseRecord,
  Recipe,
} from "../types"

import {
  makeReference,
  makeShoppingReference,
  migrateState,
  reducer,
} from "./AppState"

function createPurchase(
  overrides: Partial<PurchaseRecord> = {},
): PurchaseRecord {
  return {
    id: "purchase-test",
    inventoryId: "flour",
    purchasedQuantity: 2,
    purchasedUnit: "kg",
    usableQuantity: 1.8,
    usableUnit: "kg",
    usableBaseQuantity: 1800,
    totalPrice: 1500,
    date: "2026-10-12",
    note: "Purchase test",
    createdAt: "2026-10-12T10:00:00.000Z",
    ...overrides,
  }
}

function createExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense-reducer-test",
    amount: 12000,
    paidDate: "2026-10-12",
    categoryId: "expense-category-utilities",
    description: "October electricity bill",
    attribution: { type: "shared" },
    createdAt: "2026-10-12T08:00:00.000Z",
    ...overrides,
  }
}

function createExpenseAllocationVersion(
  expenseId: string,
  version: number,
  overrides: Partial<ExpenseAllocationVersion> = {},
): ExpenseAllocationVersion {
  return {
    id: `expense-allocation-version-${version}`,
    expenseId,
    version,
    createdAt: `2026-10-${String(12 + version).padStart(2, "0")}T08:00:00.000Z`,
    allocations: [
      {
        id: `expense-allocation-entry-${version}`,
        orderId: "expense-customer-order",
        amount: 4000,
      },
    ],
    ...overrides,
  }
}

function expectAtomicPurchaseRejection(
  state: ReturnType<typeof createTestAppData>,
  purchase: PurchaseRecord,
) {
  const before = structuredClone(state)
  const next = reducer(state, { type: "RECORD_PURCHASE", purchase })
  expect(next).toBe(state)
  expect(next).toEqual(before)
  expect(next.inventory).toEqual(before.inventory)
  expect(next.inventoryMovements).toEqual(before.inventoryMovements)
  expect(next.purchases).toEqual(before.purchases)
}

function expectAtomicAdjustmentRejection(
  state: ReturnType<typeof createTestAppData>,
  adjustment: {
    id: string
    inventoryId: string
    type: Extract<InventoryMovementType, "Correction" | "Spoilage" | "Damage" | "Other">
    quantityDelta: number
    date: string
    reason: string
  },
) {
  const before = structuredClone(state)
  const next = reducer(state, { type: "ADJUST_INVENTORY", adjustment })
  expect(next).toBe(state)
  expect(next).toEqual(before)
  expect(next.inventory).toEqual(before.inventory)
  expect(next.inventoryMovements).toEqual(before.inventoryMovements)
}

describe("expense reducer actions", () => {
  const customerOrder = createTestOrder(
    "expense-customer-order",
    [createTestOrderLine("expense-customer-line")],
    { customerId: "expense-customer", isQuickOrder: false },
  )
  const quickOrder = createTestOrder("expense-quick-order", [], {
    customerId: null,
    isQuickOrder: true,
  })

  it("records valid paid expenses without changing purchases or inventory", () => {
    const state = createTestAppData({
      orders: [customerOrder],
      purchases: [createPurchase()],
    })
    const expense = createExpense({
      attribution: { type: "direct", orderId: customerOrder.id },
    })

    const next = reducer(state, { type: "RECORD_EXPENSE", expense })

    expect(next.expenses).toEqual([expense])
    expect(next.expenses[0]).not.toBe(expense)
    expect(next.purchases).toBe(state.purchases)
    expect(next.inventory).toBe(state.inventory)
    expect(next.expenseAllocationHistories).toEqual([])
  })

  it.each([
    ["zero amount", { amount: 0 }],
    ["negative amount", { amount: -1 }],
    ["fractional amount", { amount: 10.5 }],
    ["non-finite amount", { amount: Number.POSITIVE_INFINITY }],
    ["unsafe amount", { amount: Number.MAX_SAFE_INTEGER + 1 }],
    ["invalid paid date", { paidDate: "2026-02-30" }],
    ["missing category", { categoryId: "missing-category" }],
    ["blank description", { description: "   " }],
    [
      "missing direct order",
      { attribution: { type: "direct", orderId: "missing-order" } as const },
    ],
  ])("rejects an expense with %s atomically", (_label, overrides) => {
    const state = createTestAppData({ orders: [customerOrder] })
    const before = structuredClone(state)
    const next = reducer(state, {
      type: "RECORD_EXPENSE",
      expense: createExpense(overrides),
    })
    expect(next).toBe(state)
    expect(next).toEqual(before)
  })

  it("rejects an invalid attribution discriminator atomically", () => {
    const state = createTestAppData({ orders: [customerOrder] })
    const expense = {
      ...createExpense(),
      attribution: { type: "unassigned" },
    } as unknown as Expense
    const next = reducer(state, { type: "RECORD_EXPENSE", expense })
    expect(next).toBe(state)
  })

  it("adds custom categories and rejects built-in, duplicate, and invalid categories", () => {
    const state = createTestAppData()
    const custom: ExpenseCategory = {
      id: "expense-category-delivery",
      name: "Delivery",
      source: "custom",
    }
    const added = reducer(state, {
      type: "ADD_EXPENSE_CATEGORY",
      category: custom,
    })
    expect(added.expenseCategories).toContainEqual(custom)

    for (const category of [
      custom,
      {
        id: "expense-category-utilities",
        name: "Utilities copy",
        source: "custom",
      },
      { id: "different-id", name: " delivery ", source: "custom" },
      { id: "blank-name", name: " ", source: "custom" },
      { id: "invalid-source", name: "Invalid source", source: "built-in" },
    ] as ExpenseCategory[]) {
      const before = structuredClone(added)
      const rejected = reducer(added, {
        type: "ADD_EXPENSE_CATEGORY",
        category,
      })
      expect(rejected).toBe(added)
      expect(rejected).toEqual(before)
    }
  })

  it("creates a valid first shared allocation version", () => {
    const expense = createExpense()
    const state = createTestAppData({
      orders: [customerOrder],
      expenses: [expense],
    })
    const version = createExpenseAllocationVersion(expense.id, 1)

    const next = reducer(state, {
      type: "ALLOCATE_SHARED_EXPENSE",
      version,
    })

    expect(next.expenseAllocationHistories).toEqual([
      { expenseId: expense.id, versions: [version] },
    ])
    expect(next.expenseAllocationHistories[0].versions[0]).not.toBe(version)
    expect(next.expenses).toBe(state.expenses)
  })

  it.each([
    [
      "direct expense",
      createExpense({
        attribution: { type: "direct", orderId: customerOrder.id },
      }),
      createExpenseAllocationVersion("expense-reducer-test", 1),
      [customerOrder],
    ],
    [
      "missing expense",
      createExpense(),
      createExpenseAllocationVersion("missing-expense", 1),
      [customerOrder],
    ],
    [
      "missing order",
      createExpense(),
      createExpenseAllocationVersion("expense-reducer-test", 1, {
        allocations: [
          { id: "missing-target", orderId: "not-an-order", amount: 1000 },
        ],
      }),
      [customerOrder],
    ],
    [
      "quick order",
      createExpense(),
      createExpenseAllocationVersion("expense-reducer-test", 1, {
        allocations: [
          { id: "quick-target", orderId: quickOrder.id, amount: 1000 },
        ],
      }),
      [quickOrder],
    ],
    [
      "fractional allocation amount",
      createExpense(),
      createExpenseAllocationVersion("expense-reducer-test", 1, {
        allocations: [
          {
            id: "fractional-allocation",
            orderId: customerOrder.id,
            amount: 1.5,
          },
        ],
      }),
      [customerOrder],
    ],
    [
      "negative allocation amount",
      createExpense(),
      createExpenseAllocationVersion("expense-reducer-test", 1, {
        allocations: [
          { id: "negative-allocation", orderId: customerOrder.id, amount: -1 },
        ],
      }),
      [customerOrder],
    ],
    [
      "unsafe allocation amount",
      createExpense(),
      createExpenseAllocationVersion("expense-reducer-test", 1, {
        allocations: [
          {
            id: "unsafe-allocation",
            orderId: customerOrder.id,
            amount: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
      }),
      [customerOrder],
    ],
    [
      "over-allocation",
      createExpense({ amount: 1000 }),
      createExpenseAllocationVersion("expense-reducer-test", 1, {
        allocations: [
          { id: "over-allocation", orderId: customerOrder.id, amount: 1001 },
        ],
      }),
      [customerOrder],
    ],
  ] as const)(
    "rejects allocation for %s without state changes",
    (_label, expense, version, orders) => {
      const state = createTestAppData({
        orders: [...orders],
        expenses: [expense],
      })
      const before = structuredClone(state)
      const next = reducer(state, { type: "ALLOCATE_SHARED_EXPENSE", version })
      expect(next).toBe(state)
      expect(next).toEqual(before)
    },
  )

  it("reallocates by appending one version and preserving the old version", () => {
    const expense = createExpense()
    const first = createExpenseAllocationVersion(expense.id, 1)
    const initial = createTestAppData({
      orders: [customerOrder],
      expenses: [expense],
      expenseAllocationHistories: [
        { expenseId: expense.id, versions: [first] },
      ],
    })
    const firstSnapshot = structuredClone(first)
    const second = createExpenseAllocationVersion(expense.id, 2, {
      allocations: [
        {
          id: "expense-allocation-entry-second",
          orderId: customerOrder.id,
          amount: 8000,
        },
      ],
    })

    const next = reducer(initial, {
      type: "ALLOCATE_SHARED_EXPENSE",
      version: second,
    })

    expect(next.expenseAllocationHistories).toHaveLength(1)
    expect(next.expenseAllocationHistories[0].versions).toEqual([first, second])
    expect(next.expenseAllocationHistories[0].versions[0]).toBe(first)
    expect(next.expenseAllocationHistories[0].versions[1]).not.toBe(second)
    expect(first).toEqual(firstSnapshot)
    expect(next.expenses).toBe(initial.expenses)
  })

  it("rejects skipped versions and duplicate historical IDs atomically", () => {
    const expense = createExpense()
    const first = createExpenseAllocationVersion(expense.id, 1)
    const state = createTestAppData({
      orders: [customerOrder],
      expenses: [expense],
      expenseAllocationHistories: [
        { expenseId: expense.id, versions: [first] },
      ],
    })
    const invalidVersions = [
      createExpenseAllocationVersion(expense.id, 3),
      createExpenseAllocationVersion(expense.id, 2, {
        id: first.id,
      }),
      createExpenseAllocationVersion(expense.id, 2, {
        allocations: [
          {
            id: first.allocations[0].id,
            orderId: customerOrder.id,
            amount: 1000,
          },
        ],
      }),
    ]
    for (const version of invalidVersions) {
      const before = structuredClone(state)
      const next = reducer(state, { type: "ALLOCATE_SHARED_EXPENSE", version })
      expect(next).toBe(state)
      expect(next).toEqual(before)
    }
  })
})

describe("application reducer business rules", () => {
  it("distinguishes purchased package quantity from usable quantity and weights average cost", () => {
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          physical: 1000,

          averageUnitCost: 0.4,
        }),
      ],
    })

    const next = reducer(state, {
      type: "RECORD_PURCHASE",

      purchase: {
        id: "purchase-flour",

        inventoryId: "flour",

        purchasedQuantity: 2,

        purchasedUnit: "kg",

        usableQuantity: 1.8,

        usableUnit: "kg",

        usableBaseQuantity: 1800,

        totalPrice: 1500,

        date: "2026-10-12",

        note: "2 kg bag; 1.8 kg usable",

        createdAt: "2026-10-12T10:00:00.000Z",
      },
    })

    expect(next.inventory[0].physical).toBe(2800)

    expect(next.purchases[0]).toMatchObject({
      purchasedQuantity: 2,

      purchasedUnit: "kg",

      usableQuantity: 1.8,

      usableUnit: "kg",

      usableBaseQuantity: 1800,

      totalPrice: 1500,
    })

    expect(next.inventory[0].averageUnitCost).toBeCloseTo(1900 / 2800, 12)

    expect(next.inventoryMovements[0]).toMatchObject({
      type: "Purchase",

      quantityDelta: 1800,

      balanceAfter: 2800,
    })
  })

  it("accepts compatible purchase units and preserves weighted-average cost", () => {
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          physical: 1000,
          averageUnitCost: 0.4,
        }),
      ],
    })
    const next = reducer(state, {
      type: "RECORD_PURCHASE",
      purchase: createPurchase({
        id: "purchase-compatible",
        purchasedQuantity: 2,
        usableQuantity: 1.5,
        usableBaseQuantity: 1500,
        totalPrice: 100,
      }),
    })

    expect(next.inventory[0]).toMatchObject({
      physical: 2500,
      averageUnitCost: 500 / 2500,
    })
    expect(next.purchases).toHaveLength(1)
    expect(next.inventoryMovements[0]).toMatchObject({
      id: "movement-purchase-compatible",
      type: "Purchase",
      quantityDelta: 1500,
      unit: "g",
      balanceAfter: 2500,
    })

    const volumeState = createTestAppData({
      inventory: [
        createTestInventoryItem({
          inventoryId: "milk",
          name: "Fresh milk",
          physical: 1000,
          unit: "ml",
          category: "ingredient",
          averageUnitCost: 0.04,
        }),
      ],
    })
    const volumePurchase = reducer(volumeState, {
      type: "RECORD_PURCHASE",
      purchase: createPurchase({
        id: "purchase-volume",
        inventoryId: "milk",
        purchasedQuantity: 2,
        purchasedUnit: "L",
        usableQuantity: 1.5,
        usableUnit: "L",
        usableBaseQuantity: 1500,
        totalPrice: 150,
      }),
    })
    expect(volumePurchase.inventory[0]).toMatchObject({
      physical: 2500,
      averageUnitCost: 190 / 2500,
    })
    expect(volumePurchase.inventoryMovements[0]).toMatchObject({
      quantityDelta: 1500,
      unit: "ml",
      balanceAfter: 2500,
    })
  })

  it("accepts valid packaging purchases using canonical unit quantities", () => {
    const packaging = createTestInventoryItem({
      inventoryId: "cake-box",
      name: "Cake box",
      physical: 4,
      unit: "unit",
      category: "packaging",
      averageUnitCost: 100,
    })
    const state = createTestAppData({ inventory: [packaging] })
    const purchase = createPurchase({
      id: "purchase-packaging",
      inventoryId: packaging.inventoryId,
      purchasedQuantity: 10,
      purchasedUnit: "unit",
      usableQuantity: 8,
      usableUnit: "unit",
      usableBaseQuantity: 8,
      totalPrice: 1600,
    })

    const next = reducer(state, { type: "RECORD_PURCHASE", purchase })

    expect(next.inventory[0]).toMatchObject({
      physical: 12,
      averageUnitCost: 2000 / 12,
    })
    expect(next.purchases).toEqual([purchase])
    expect(next.inventoryMovements[0]).toMatchObject({
      type: "Purchase",
      quantityDelta: 8,
      unit: "unit",
      balanceAfter: 12,
    })
  })

  it("rejects invalid purchase quantities, costs, dates, units and identifiers atomically", () => {
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          physical: 1000,
          averageUnitCost: 0.4,
        }),
      ],
      inventoryMovements: [
        {
          id: "movement-existing-movement",
          inventoryId: "flour",
          type: "Opening balance",
          quantityDelta: 1000,
          unit: "g",
          balanceAfter: 1000,
          date: "2026-10-01",
          reason: "Opening",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    })
    const invalidPurchases: PurchaseRecord[] = [
      ...[
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        0,
        -1,
      ].map((purchasedQuantity) =>
        createPurchase({
          id: `quantity-${String(purchasedQuantity)}`,
          purchasedQuantity,
        }),
      ),
      ...[
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        0,
        -1,
      ].map((usableQuantity) =>
        createPurchase({
          id: `usable-${String(usableQuantity)}`,
          usableQuantity,
          usableBaseQuantity: usableQuantity * 1000,
        }),
      ),
      ...[
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        0,
        -0.01,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
      ].map((totalPrice) =>
        createPurchase({ id: `cost-${String(totalPrice)}`, totalPrice }),
      ),
      createPurchase({
        id: "usable-exceeds-purchased",
        purchasedQuantity: 1,
        purchasedUnit: "kg",
        usableQuantity: 1001,
        usableUnit: "g",
        usableBaseQuantity: 1001,
      }),
      createPurchase({ id: "unit-mismatch-purchase", purchasedUnit: "L" }),
      createPurchase({ id: "unit-mismatch-usable", usableUnit: "L" }),
      createPurchase({
        id: "canonical-quantity-mismatch",
        usableBaseQuantity: 1799,
      }),
      createPurchase({ id: "invalid-date", date: "2026-02-30" }),
      createPurchase({ id: "invalid-date-shape", date: "12/10/2026" }),
      createPurchase({
        id: "invalid-created-at",
        createdAt: "not-a-timestamp",
      }),
      createPurchase({
        id: "invalid-created-at-date",
        createdAt: "2026-02-30T10:00:00.000Z",
      }),
      createPurchase({ id: "   " }),
      createPurchase({ id: "missing-inventory-id", inventoryId: " " }),
      createPurchase({ id: "duplicate-id" }),
      createPurchase({ id: "existing-movement" }),
      createPurchase({ id: "missing-inventory", inventoryId: "missing" }),
    ]
    const withDuplicate = {
      ...state,
      purchases: [createPurchase({ id: "duplicate-id" })],
    }

    for (const purchase of invalidPurchases) {
      expectAtomicPurchaseRejection(
        purchase.id === "duplicate-id" ? withDuplicate : state,
        purchase,
      )
    }
  })

  it("rejects overflow in purchase balance, prior value, and weighted-average cost atomically", () => {
    const cases = [
      createTestAppData({
        inventory: [createTestInventoryItem({ physical: Number.MAX_VALUE })],
      }),
      createTestAppData({
        inventory: [
          createTestInventoryItem({
            physical: Number.MAX_VALUE,
            averageUnitCost: 2,
          }),
        ],
      }),
      createTestAppData({
        inventory: [
          createTestInventoryItem({
            physical: 1,
            averageUnitCost: Number.MAX_VALUE,
          }),
        ],
      }),
    ]
    const purchases = [
      createPurchase({
        id: "overflow-balance",
        usableQuantity: Number.MAX_VALUE,
        usableUnit: "g",
        usableBaseQuantity: Number.MAX_VALUE,
      }),
      createPurchase({
        id: "overflow-prior-value",
        usableQuantity: 1,
        usableBaseQuantity: 1000,
        totalPrice: 1,
      }),
      createPurchase({
        id: "overflow-cost",
        usableQuantity: 1,
        usableBaseQuantity: 1,
        usableUnit: "g",
        totalPrice: Number.MAX_VALUE,
      }),
    ]

    cases.forEach((state, index) =>
      expectAtomicPurchaseRejection(state, purchases[index]),
    )
  })

  it("rejects malformed adjustments and invalid resulting balances atomically", () => {
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],
      inventoryMovements: [
        {
          id: "existing-adjustment",
          inventoryId: "flour",
          type: "Opening balance",
          quantityDelta: 1000,
          unit: "g",
          balanceAfter: 1000,
          date: "2026-10-01",
          reason: "Opening",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    })
    const invalidAdjustments = [
      ...[
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        0,
      ].map((quantityDelta) => ({
        id: `delta-${String(quantityDelta)}`,
        inventoryId: "flour",
        type: "Correction" as const,
        quantityDelta,
        date: "2026-10-12",
        reason: "Count correction",
      })),
      {
        id: "negative-result",
        inventoryId: "flour",
        type: "Correction" as const,
        quantityDelta: -1001,
        date: "2026-10-12",
        reason: "Over-adjustment",
      },
      {
        id: "missing-item",
        inventoryId: "missing",
        type: "Correction" as const,
        quantityDelta: 1,
        date: "2026-10-12",
        reason: "Missing item",
      },
      {
        id: "blank-reason",
        inventoryId: "flour",
        type: "Correction" as const,
        quantityDelta: 1,
        date: "2026-10-12",
        reason: "   ",
      },
      {
        id: "invalid-date",
        inventoryId: "flour",
        type: "Correction" as const,
        quantityDelta: 1,
        date: "2026-13-40",
        reason: "Invalid date",
      },
      {
        id: "existing-adjustment",
        inventoryId: "flour",
        type: "Correction" as const,
        quantityDelta: 1,
        date: "2026-10-12",
        reason: "Duplicate",
      },
    ]
    const withFinishedStock = {
      ...state,
      inventory: [
        ...state.inventory,
        createTestInventoryItem({
          inventoryId: "finished-cake",
          unit: "unit",
          category: "finished",
          physical: 4,
          unbatchedLegacyQuantity: 4,
        }),
      ],
    }
    invalidAdjustments.push({
      id: "finished-adjustment",
      inventoryId: "finished-cake",
      type: "Correction",
      quantityDelta: 1,
      date: "2026-10-12",
      reason: "Finished stock protection",
    })
    invalidAdjustments.push({
      id: "invalid-type",
      inventoryId: "flour",
      type: "Purchase" as never,
      quantityDelta: 1,
      date: "2026-10-12",
      reason: "Invalid movement category",
    })

    for (const adjustment of invalidAdjustments) {
      expectAtomicAdjustmentRejection(
        adjustment.id === "finished-adjustment" ? withFinishedStock : state,
        adjustment,
      )
    }

    const reservationState = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],
      orders: [
        createTestOrder("reserved-order", [], {
          status: "Confirmed",
          reservations: [
            createTestStockRequirement({
              inventoryId: "flour",
              reserved: 300,
            }),
          ],
        }),
      ],
    })
    expectAtomicAdjustmentRejection(reservationState, {
      id: "reserved-adjustment",
      inventoryId: "flour",
      type: "Correction",
      quantityDelta: -800,
      date: "2026-10-12",
      reason: "Would reduce stock below reservation",
    })

    const overflowState = createTestAppData({
      inventory: [createTestInventoryItem({ physical: Number.MAX_VALUE })],
    })
    expectAtomicAdjustmentRejection(overflowState, {
      id: "overflow-result",
      inventoryId: "flour",
      type: "Correction",
      quantityDelta: Number.MAX_VALUE,
      date: "2026-10-12",
      reason: "Overflow adjustment",
    })
  })

  it("rejects finished-stock purchases and generic adjustments but preserves raw stock adjustments", () => {
    const finished = createTestInventoryItem({
      inventoryId: "finished-cake",
      name: "Finished cake",
      unit: "unit",
      category: "finished",
      physical: 4,
      unbatchedLegacyQuantity: 4,
    })
    const ingredient = createTestInventoryItem({ physical: 1000 })
    const packaging = createTestInventoryItem({
      inventoryId: "box",
      name: "Cake box",
      unit: "unit",
      category: "packaging",
      physical: 5,
    })
    const state = createTestAppData({
      inventory: [finished, ingredient, packaging],
    })
    const purchase = {
      id: "purchase-finished",
      inventoryId: finished.inventoryId,
      purchasedQuantity: 1,
      purchasedUnit: "unit" as const,
      usableQuantity: 1,
      usableUnit: "unit" as const,
      usableBaseQuantity: 1,
      totalPrice: 500,
      date: "2026-10-12",
      note: "Must use production or reconciliation",
      createdAt: "2026-10-12T10:00:00.000Z",
    }

    expectAtomicPurchaseRejection(state, purchase)
    expectAtomicAdjustmentRejection(state, {
      id: "finished-adjustment",
      inventoryId: finished.inventoryId,
      type: "Correction",
      quantityDelta: 1,
      date: "2026-10-12",
      reason: "Unsafe generic finished adjustment",
    })

    const adjustedIngredient = reducer(state, {
      type: "ADJUST_INVENTORY",
      adjustment: {
        id: "ingredient-adjustment",
        inventoryId: ingredient.inventoryId,
        type: "Correction",
        quantityDelta: -100,
        date: "2026-10-12",
        reason: "Count correction",
      },
    })
    expect(
      adjustedIngredient.inventory.find(
        (item) => item.inventoryId === ingredient.inventoryId,
      )?.physical,
    ).toBe(900)
    expect(adjustedIngredient.inventoryMovements[0]).toMatchObject({
      inventoryId: ingredient.inventoryId,
      quantityDelta: -100,
      type: "Correction",
    })

    const adjustedPackaging = reducer(state, {
      type: "ADJUST_INVENTORY",
      adjustment: {
        id: "packaging-adjustment",
        inventoryId: packaging.inventoryId,
        type: "Damage",
        quantityDelta: -1,
        date: "2026-10-12",
        reason: "One box damaged",
      },
    })
    expect(
      adjustedPackaging.inventory.find(
        (item) => item.inventoryId === packaging.inventoryId,
      )?.physical,
    ).toBe(4)
  })

  it("normalizes legacy finished inventory to unbatched stock without fabricating batches", () => {
    const legacyFinished = {
      inventoryId: "finished-cake",
      name: "Finished cake",
      physical: 7,
      unit: "unit" as const,
      category: "finished" as const,
    }
    const migrated = migrateState(
      createTestAppData({ inventory: [legacyFinished] }),
    )

    expect(
      migrated.inventory.find((item) => item.inventoryId === "finished-cake"),
    ).toMatchObject({
      physical: 7,
      unbatchedLegacyQuantity: 7,
    })
    expect(
      migrated.finishedStockBatches.filter(
        (batch) => batch.inventoryId === "finished-cake",
      ),
    ).toEqual([])
  })

  it("derives migrated payment status and leaves unknown historical collection time unset", () => {
    const completed = createTestOrder(
      "legacy-completed-order",
      [createTestOrderLine("legacy-completed-line")],
      { status: "Completed", paymentStatus: "Paid" },
    )
    const migrated = migrateState(createTestAppData({ orders: [completed] }))

    expect(migrated.orders[0].paymentStatus).toBe("Unpaid")
    expect(migrated.orders[0].collectedAt).toBeNull()
    expect(migrated.refunds).toEqual([])
  })

  it("does not reserve stock for a draft order", () => {
    const line = createTestOrderLine("draft-line")

    const draft = createTestOrder("draft-order", [line], {
      status: "Draft",

      reservations: [
        createTestStockRequirement({
          lineId: line.id,

          reserved: 800,
        }),
      ],
    })

    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],
    })

    const next = reducer(state, { type: "UPSERT_DRAFT", payload: draft })

    expect(next.orders[0].reservations).toEqual([])

    expect(selectReservedByItem(next).has("flour")).toBe(false)
  })

  it("keeps a confirmed recipe snapshot unchanged when the reusable recipe is updated", () => {
    const snapshot = createTestRecipeSnapshot()

    const line = createTestOrderLine("confirmed-line", snapshot)

    const draft = createTestOrder("confirmed-order", [line])

    const reusableRecipe: Recipe = {
      ...snapshot,

      updatedAt: "2026-10-12T08:00:00.000Z",
    }

    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],

      recipes: [reusableRecipe],

      orders: [draft],
      extraStockPlans: [
        {
          id: "plan-snapshot",
          productId: snapshot.productId,
          variantId: snapshot.variantId,
          recipeId: snapshot.id,
          recipeSnapshot: structuredClone(snapshot),
          quantity: 2,
          bestBefore: "2026-10-20",
          createdAt: "2026-10-12T08:00:00.000Z",
          updatedAt: "2026-10-12T08:00:00.000Z",
        },
      ],
    })

    const confirmed = reducer(state, {
      type: "CONFIRM_ORDER",
      orderId: draft.id,
    })
    const confirmedOrder = confirmed.orders[0]
    const confirmedCostSnapshot = structuredClone(confirmedOrder.costSnapshot)
    const confirmedRecipeSnapshot = structuredClone(
      confirmedOrder.lines[0].recipeSnapshot,
    )

    const updatedRecipe = {
      ...reusableRecipe,

      version: 2,

      estimatedCost: 4000,

      ingredients: [{ ...reusableRecipe.ingredients[0], quantity: 800 }],

      updatedAt: "2026-10-12T09:00:00.000Z",
    }

    const next = reducer(confirmed, {
      type: "UPDATE_RECIPE",

      recipe: updatedRecipe,
    })

    expect(next.recipes[0]).toMatchObject({
      version: 2,

      estimatedCost: 4000,
    })

    expect(next.orders[0].lines[0].recipeSnapshot).toEqual(snapshot)
    expect(next.orders[0].lines[0].recipeSnapshot).toEqual(
      confirmedRecipeSnapshot,
    )
    expect(next.orders[0].costSnapshot).toEqual(confirmedCostSnapshot)
    expect(next.extraStockPlans[0].recipeSnapshot).toEqual(snapshot)
  })

  it("converts recipe quantities and saved reservations to inventory base units", () => {
    const recipeSnapshot = createTestRecipeSnapshot({
      ingredients: [
        {
          inventoryId: "flour",
          name: "All-purpose flour",
          quantity: 0.5,
          unit: "kg",
        },
      ],
    })
    const existingLine = createTestOrderLine("existing-line")
    const existingOrder = createTestOrder("existing-order", [existingLine], {
      status: "Confirmed",
      reservations: [
        createTestStockRequirement({
          reserved: 0.25,
          unit: "kg",
        }),
      ],
    })
    const targetOrder = createTestOrder("target-order", [
      createTestOrderLine("target-line", recipeSnapshot),
    ])
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],
      orders: [existingOrder, targetOrder],
    })

    const [requirement] = calculateLineRequirements(
      state,
      targetOrder.lines,
      targetOrder.id,
    )
    const confirmed = reducer(state, {
      type: "CONFIRM_ORDER",
      orderId: targetOrder.id,
    })
    const confirmedOrder = confirmed.orders.find(
      (order) => order.id === targetOrder.id,
    )!

    expect(requirement).toMatchObject({
      required: 500,
      availableAtConfirmation: 750,
      reserved: 500,
      shortage: 0,
      unit: "g",
    })
    expect(confirmedOrder.reservations[0]).toMatchObject({
      required: 500,
      reserved: 500,
      unit: "g",
    })
    expect(selectReservedByItem(confirmed).get("flour")).toBe(750)
    expect(
      confirmed.preparationRecords.find(
        (record) => record.orderId === targetOrder.id,
      )?.actualUsage[0],
    ).toMatchObject({
      plannedQuantity: 500,
      actualQuantity: 500,
      unit: "g",
    })
  })

  it("rejects incompatible recipe units without confirming or reserving stock", () => {
    const line = createTestOrderLine(
      "incompatible-line",
      createTestRecipeSnapshot({
        ingredients: [
          {
            inventoryId: "flour",
            name: "All-purpose flour",
            quantity: 1,
            unit: "L",
          },
        ],
      }),
    )
    const draft = createTestOrder("incompatible-order", [line])
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],
      orders: [draft],
    })

    expect(reducer(state, { type: "CONFIRM_ORDER", orderId: draft.id })).toBe(
      state,
    )
  })

  it("accepts only explicitly selected finished inventory for variant mapping", () => {
    const product = {
      id: "product-cake",
      name: "Chocolate cake",
      variants: [{ id: "cake-1kg", name: "1 kg cake", unitLabel: "cake" }],
    }
    const state = createTestAppData({
      products: [product],
      inventory: [
        createTestInventoryItem({
          inventoryId: "finished-cake",
          name: "Chocolate cake stock",
          physical: 4,
          unit: "unit",
          category: "finished",
        }),
        createTestInventoryItem({
          inventoryId: "flour",
          category: "ingredient",
        }),
        createTestInventoryItem({
          inventoryId: "finished-weight",
          unit: "g",
          category: "finished",
        }),
      ],
    })

    const mapped = reducer(state, {
      type: "SET_VARIANT_FINISHED_INVENTORY",
      productId: "product-cake",
      variantId: "cake-1kg",
      inventoryId: "finished-cake",
    })
    expect(mapped.products[0].variants[0].finishedInventoryId).toBe(
      "finished-cake",
    )
    expect(mapped.inventory).toEqual(state.inventory)
    expect(mapped.inventoryMovements).toEqual(state.inventoryMovements)

    const cleared = reducer(mapped, {
      type: "SET_VARIANT_FINISHED_INVENTORY",
      productId: "product-cake",
      variantId: "cake-1kg",
      inventoryId: null,
    })
    expect(cleared.products[0].variants[0].finishedInventoryId).toBeUndefined()

    for (const inventoryId of ["missing", "flour", "finished-weight"]) {
      expect(
        reducer(state, {
          type: "SET_VARIANT_FINISHED_INVENTORY",
          productId: "product-cake",
          variantId: "cake-1kg",
          inventoryId,
        }),
      ).toBe(state)
    }
    expect(
      reducer(state, {
        type: "SET_VARIANT_FINISHED_INVENTORY",
        productId: "missing-product",
        variantId: "cake-1kg",
        inventoryId: null,
      }),
    ).toBe(state)
  })

  it("rejects invalid expected output without changing reusable or snapshotted recipes", () => {
    const recipeSnapshot = createTestRecipeSnapshot()
    const recipe: Recipe = {
      ...recipeSnapshot,
      updatedAt: "2026-10-12T08:00:00.000Z",
    }
    const plan = {
      id: "plan-output",
      productId: recipe.productId,
      variantId: recipe.variantId,
      recipeId: recipe.id,
      recipeSnapshot,
      quantity: 1,
      bestBefore: "2026-10-20",
      createdAt: "2026-10-12T08:00:00.000Z",
      updatedAt: "2026-10-12T08:00:00.000Z",
    }
    const state = createTestAppData({
      recipes: [recipe],
      extraStockPlans: [plan],
    })

    for (const quantity of [0, 1.5]) {
      expect(
        reducer(state, {
          type: "UPDATE_RECIPE",
          recipe: {
            ...recipe,
            expectedOutput: { quantity, unit: "unit" },
          },
        }),
      ).toBe(state)
    }

    const updated = reducer(state, {
      type: "UPDATE_RECIPE",
      recipe: {
        ...recipe,
        version: 2,
        expectedOutput: { quantity: 12, unit: "unit" },
      },
    })
    expect(updated.recipes[0].expectedOutput).toEqual({
      quantity: 12,
      unit: "unit",
    })
    expect(updated.extraStockPlans[0].recipeSnapshot).toEqual(recipeSnapshot)

    const cleared = reducer(updated, {
      type: "UPDATE_RECIPE",
      recipe: { ...updated.recipes[0], expectedOutput: null, version: 3 },
    })
    expect(cleared.recipes[0].expectedOutput).toBeNull()
    expect(cleared.extraStockPlans[0].recipeSnapshot).toEqual(recipeSnapshot)
  })

  it("deducts actual preparation usage instead of planned usage", () => {
    const line = createTestOrderLine("line-actual")

    const order = createTestOrder("order-actual", [line], {
      status: "In Progress",

      preparationStatus: "In progress",

      reservations: [
        createTestStockRequirement({
          lineId: line.id,

          required: 500,

          reserved: 500,
        }),
      ],
    })

    const preparation = createTestPreparationRecord(order.id, line, {
      actualUsage: [
        {
          inventoryId: "flour",

          name: "All-purpose flour",

          plannedQuantity: 500,

          actualQuantity: 350,

          unit: "g",

          category: "ingredient",
        },
      ],
    })

    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],

      orders: [order],

      preparationRecords: [preparation],
    })

    const next = reducer(state, {
      type: "COMPLETE_PREPARATION",

      preparationId: preparation.id,
    })

    expect(next.inventory[0].physical).toBe(650)

    expect(next.inventoryMovements[0]).toMatchObject({
      quantityDelta: -350,

      balanceAfter: 650,
    })

    expect(next.preparationRecords[0].status).toBe("Ready")
    expect(next.orders[0].status).toBe("In Progress")
    expect(next.orders[0].preparationStatus).toBe("Ready")
  })

  it("converts compatible legacy preparation usage at completion without rewriting its snapshot", () => {
    const line = createTestOrderLine(
      "legacy-unit-line",
      createTestRecipeSnapshot({
        ingredients: [
          {
            inventoryId: "flour",
            name: "All-purpose flour",
            quantity: 0.5,
            unit: "kg",
          },
        ],
      }),
    )
    const order = createTestOrder("legacy-unit-order", [line], {
      status: "In Progress",
      preparationStatus: "In progress",
      reservations: [
        createTestStockRequirement({
          lineId: line.id,
          required: 0.5,
          reserved: 0.5,
          unit: "kg",
        }),
      ],
    })
    const preparation = createTestPreparationRecord(order.id, line)
    Object.assign(preparation.actualUsage[0], {
      plannedQuantity: 0.5,
      actualQuantity: 0.25,
      unit: "kg",
    })
    const frozenSnapshot = structuredClone(preparation.recipeSnapshot)
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          physical: 1000,
          averageUnitCost: 0.4,
        }),
      ],
      orders: [order],
      preparationRecords: [preparation],
    })

    const next = reducer(state, {
      type: "COMPLETE_PREPARATION",
      preparationId: preparation.id,
    })
    const completed = next.preparationRecords[0]

    expect(next.inventory[0].physical).toBe(750)
    expect(next.inventoryMovements[0]).toMatchObject({
      quantityDelta: -250,
      unit: "g",
      balanceAfter: 750,
    })
    expect(completed.actualCost).toBe(100)
    expect(completed.actualUsage[0]).toMatchObject({
      plannedQuantity: 500,
      actualQuantity: 250,
      unit: "g",
    })
    expect(completed.recipeSnapshot).toEqual(frozenSnapshot)

    const incompatible = structuredClone(state)
    Object.assign(incompatible.preparationRecords[0].actualUsage[0], {
      unit: "L",
    })
    expect(
      reducer(incompatible, {
        type: "COMPLETE_PREPARATION",
        preparationId: preparation.id,
      }),
    ).toBe(incompatible)
  })

  it("does not deduct stock again when completing an already completed preparation", () => {
    const line = createTestOrderLine("line-repeat")

    const order = createTestOrder("order-repeat", [line], {
      status: "In Progress",

      reservations: [
        createTestStockRequirement({
          lineId: line.id,

          required: 500,

          reserved: 500,
        }),
      ],
    })

    const preparation = createTestPreparationRecord(order.id, line)

    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],

      orders: [order],

      preparationRecords: [preparation],
    })

    const completed = reducer(state, {
      type: "COMPLETE_PREPARATION",

      preparationId: preparation.id,
    })

    const repeated = reducer(completed, {
      type: "COMPLETE_PREPARATION",

      preparationId: preparation.id,
    })

    expect(repeated).toBe(completed)

    expect(repeated.inventory[0].physical).toBe(500)

    expect(
      repeated.inventoryMovements.filter(
        (movement) => movement.type === "Preparation consumption",
      ),
    ).toHaveLength(1)
  })

  it("consumes only one product's stock and preserves sibling reservations", () => {
    const sharedRecipe = createTestRecipeSnapshot()

    const firstLine = createTestOrderLine("line-first", sharedRecipe)

    const secondLine = createTestOrderLine("line-second", sharedRecipe)

    const order = createTestOrder("multi-order", [firstLine, secondLine], {
      status: "In Progress",

      preparationStatus: "In progress",

      reservations: [
        createTestStockRequirement({
          lineId: firstLine.id,

          required: 400,

          reserved: 400,
        }),

        createTestStockRequirement({
          lineId: secondLine.id,

          required: 600,

          reserved: 600,
        }),
      ],
    })

    const firstPreparation = createPreparationRecord(
      createTestAppData({
        inventory: [createTestInventoryItem({ physical: 1200 })],
      }),
      order.id,

      firstLine,

      "In progress",
    )

    firstPreparation.actualUsage[0].plannedQuantity = 400

    firstPreparation.actualUsage[0].actualQuantity = 400

    const secondPreparation = createTestPreparationRecord(
      order.id,

      secondLine,

      {
        actualUsage: [
          {
            inventoryId: "flour",

            name: "All-purpose flour",

            plannedQuantity: 600,

            actualQuantity: 600,

            unit: "g",

            category: "ingredient",
          },
        ],
      },
    )

    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1200 })],

      orders: [order],

      preparationRecords: [firstPreparation, secondPreparation],
    })

    const next = reducer(state, {
      type: "COMPLETE_PREPARATION",

      preparationId: firstPreparation.id,
    })

    expect(next.inventory[0].physical).toBe(800)

    expect(next.orders[0].reservations).toEqual([
      expect.objectContaining({
        lineId: secondLine.id,

        reserved: 600,
      }),
    ])

    expect(
      next.preparationRecords.find(
        (record) => record.id === secondPreparation.id,
      )?.status,
    )

      .toBe("In progress")
  })

  it("cancels a draft while retaining its order data and history", () => {
    const line = createTestOrderLine("cancel-draft-line")
    const order = createTestOrder("cancel-draft", [line], {
      payments: [
        {
          id: "existing-payment",
          date: "2026-10-12",
          amount: 2500,
          method: "Cash",
        },
      ],
    })
    const record = createTestPreparationRecord(order.id, line)
    const state = createTestAppData({
      orders: [order],
      preparationRecords: [record],
    })

    const cancelled = reducer(state, {
      type: "CANCEL_ORDER",
      orderId: order.id,
    })

    expect(cancelled.orders[0]).toMatchObject({
      id: order.id,
      status: "Cancelled",
      preparationStatus: "Cancelled",
      lines: order.lines,
      payments: order.payments,
    })
    expect(cancelled.preparationRecords[0]).toMatchObject({
      id: record.id,
      status: "Cancelled",
      recipeSnapshot: record.recipeSnapshot,
    })
    expect(cancelled.inventoryMovements).toEqual([])
    expect(
      reducer(cancelled, { type: "CANCEL_ORDER", orderId: order.id }),
    ).toBe(cancelled)
  })

  it("cancels a confirmed order and releases only its own reservations", () => {
    const targetLine = createTestOrderLine("cancel-target-line")
    const otherLine = createTestOrderLine("cancel-other-line")
    const target = createTestOrder("cancel-target", [targetLine], {
      status: "Confirmed",
      preparationStatus: "Awaiting preparation",
      reservations: [
        createTestStockRequirement({
          lineId: targetLine.id,
          required: 400,
          reserved: 400,
        }),
      ],
      shortages: [
        createTestStockRequirement({
          lineId: targetLine.id,
          required: 500,
          reserved: 400,
          shortage: 100,
        }),
      ],
    })
    const other = createTestOrder("cancel-other", [otherLine], {
      status: "In Progress",
      reservations: [
        createTestStockRequirement({
          lineId: otherLine.id,
          required: 600,
          reserved: 600,
        }),
      ],
    })
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1500 })],
      orders: [target, other],
      preparationRecords: [createTestPreparationRecord(target.id, targetLine)],
    })

    const cancelled = reducer(state, {
      type: "CANCEL_ORDER",
      orderId: target.id,
    })

    expect(
      cancelled.orders.find((order) => order.id === target.id),
    ).toMatchObject({
      status: "Cancelled",
      reservations: [],
      shortages: [],
    })
    expect(
      cancelled.orders.find((order) => order.id === other.id)?.reservations,
    ).toEqual(other.reservations)
    expect(selectReservedByItem(cancelled).get("flour")).toBe(600)
    expect(cancelled.inventory[0].physical).toBe(1500)
    expect(cancelled.inventoryMovements).toEqual([])
  })

  it("rejects cancellation after a preparation has consumed raw stock", () => {
    const line = createTestOrderLine("unsafe-cancel-line")
    const order = createTestOrder("unsafe-cancel", [line], {
      status: "In Progress",
    })
    const preparation = createTestPreparationRecord(order.id, line, {
      status: "Ready",
      completedAt: "2026-10-12T09:00:00.000Z",
    })
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 5000 })],
      orders: [order],
      preparationRecords: [preparation],
      inventoryMovements: [
        {
          id: `movement-preparation-${preparation.id}-flour`,
          inventoryId: "flour",
          type: "Preparation consumption",
          quantityDelta: -500,
          unit: "g",
          balanceAfter: 4500,
          date: "2026-10-12",
          reason: order.reference,
          createdAt: "2026-10-12T09:00:00.000Z",
        },
      ],
    })

    expect(reducer(state, { type: "CANCEL_ORDER", orderId: order.id })).toBe(
      state,
    )
    expect(state.inventory[0].physical).toBe(5000)
  })

  it.each(["Completed", "Cancelled"] as const)(
    "rejects cancellation for an order already %s",
    (status) => {
      const order = createTestOrder(`already-${status}`, [], { status })
      const state = createTestAppData({ orders: [order] })

      expect(reducer(state, { type: "CANCEL_ORDER", orderId: order.id })).toBe(
        state,
      )
    },
  )

  it("requires all order lines to be prepared before collection", () => {
    const firstLine = createTestOrderLine("collection-line-1")
    const secondLine = createTestOrderLine("collection-line-2")
    const order = createTestOrder("collection-order", [firstLine, secondLine], {
      status: "In Progress",
      preparationStatus: "Ready",
    })
    const state = createTestAppData({
      orders: [order],
      preparationRecords: [
        createTestPreparationRecord(order.id, firstLine, { status: "Ready" }),
        createTestPreparationRecord(order.id, secondLine, {
          status: "In progress",
        }),
      ],
    })

    expect(reducer(state, { type: "COLLECT_ORDER", orderId: order.id })).toBe(
      state,
    )
  })

  it("allows collection with a remaining balance and rejects duplicate collection", () => {
    const line = createTestOrderLine("collect-ready-line")
    const order = createTestOrder("collect-ready", [line], {
      status: "In Progress",
      preparationStatus: "Ready",
      agreedPrice: 12000,
      payments: [
        {
          id: "partial-payment",
          date: "2026-10-12",
          amount: 3000,
          method: "Cash",
        },
      ],
    })
    const state = createTestAppData({
      orders: [order],
      preparationRecords: [
        createTestPreparationRecord(order.id, line, { status: "Ready" }),
      ],
    })

    const collected = reducer(state, {
      type: "COLLECT_ORDER",
      orderId: order.id,
    })

    expect(collected.orders[0]).toMatchObject({
      status: "Completed",
      preparationStatus: "Completed",
      agreedPrice: 12000,
      payments: order.payments,
    })
    expect(collected.orders[0].collectedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
    )
    expect(
      reducer(collected, { type: "COLLECT_ORDER", orderId: order.id }),
    ).toBe(collected)
  })

  it("records partial and exact-balance payments and derives payment status", () => {
    const order = createTestOrder("payment-order", [
      createTestOrderLine("payment-line"),
    ])
    const state = createTestAppData({ orders: [order] })
    const partial = reducer(state, {
      type: "RECORD_PAYMENT",
      orderId: order.id,
      orderReference: order.reference,
      payment: {
        id: "payment-partial",
        date: "2026-10-12",
        amount: 3500,
        method: "Cash",
      },
    })

    expect(partial.orders[0].payments).toHaveLength(1)
    expect(partial.orders[0].paymentStatus).toBe("Part paid")
    expect(partial.orders[0].status).toBe("Draft")

    const settled = reducer(partial, {
      type: "RECORD_PAYMENT",
      orderId: order.id,
      orderReference: order.reference,
      payment: {
        id: "payment-final",
        date: "2026-10-13",
        amount: 8500,
        method: "Bank transfer",
      },
    })

    expect(settled.orders[0].paymentStatus).toBe("Paid")
    expect(settled.orders[0].payments.map((entry) => entry.amount)).toEqual([
      3500, 8500,
    ])
    expect(settled.refunds).toEqual([])

    const fullyPaid = reducer(state, {
      type: "RECORD_PAYMENT",
      orderId: order.id,
      orderReference: order.reference,
      payment: {
        id: "payment-full",
        date: "2026-10-12",
        amount: order.agreedPrice,
        method: "Cash",
      },
    })
    expect(fullyPaid.orders[0].paymentStatus).toBe("Paid")
  })

  it("rejects invalid, excessive, duplicate and misaddressed payments atomically", () => {
    const order = createTestOrder("payment-reject", [
      createTestOrderLine("payment-reject-line"),
    ])
    const state = createTestAppData({ orders: [order] })
    const invalidAmounts = [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      12001,
    ]
    for (const [index, amount] of invalidAmounts.entries()) {
      const before = structuredClone(state)
      const next = reducer(state, {
        type: "RECORD_PAYMENT",
        orderId: order.id,
        orderReference: order.reference,
        payment: {
          id: `invalid-payment-${index}`,
          date: "2026-10-12",
          amount,
          method: "Cash",
        },
      })
      expect(next).toBe(state)
      expect(next).toEqual(before)
    }

    const invalidActions = [
      {
        type: "RECORD_PAYMENT" as const,
        orderId: "missing-order",
        orderReference: order.reference,
        payment: {
          id: "missing-order-payment",
          date: "2026-10-12",
          amount: 1,
          method: "Cash",
        },
      },
      {
        type: "RECORD_PAYMENT" as const,
        orderId: order.id,
        orderReference: "US-9999",
        payment: {
          id: "wrong-reference-payment",
          date: "2026-10-12",
          amount: 1,
          method: "Cash",
        },
      },
      {
        type: "RECORD_PAYMENT" as const,
        orderId: order.id,
        orderReference: order.reference,
        payment: {
          id: "bad-date-payment",
          date: "2026-02-30",
          amount: 1,
          method: "Cash",
        },
      },
      {
        type: "RECORD_PAYMENT" as const,
        orderId: order.id,
        orderReference: order.reference,
        payment: {
          id: "empty-method-payment",
          date: "2026-10-12",
          amount: 1,
          method: "  ",
        },
      },
    ]
    for (const action of invalidActions) {
      expect(reducer(state, action)).toBe(state)
      expect(reducer(state, action)).toEqual(state)
    }

    const alreadyPaid = {
      ...order,
      payments: [
        {
          id: "full-payment",
          date: "2026-10-12",
          amount: 12000,
          method: "Cash",
        },
      ],
    }
    const paidState = createTestAppData({ orders: [alreadyPaid] })
    const noBalance = reducer(paidState, {
      type: "RECORD_PAYMENT",
      orderId: order.id,
      orderReference: order.reference,
      payment: {
        id: "payment-after-full",
        date: "2026-10-12",
        amount: 1,
        method: "Cash",
      },
    })
    expect(noBalance).toBe(paidState)
    const duplicateState = reducer(paidState, {
      type: "RECORD_PAYMENT",
      orderId: order.id,
      orderReference: order.reference,
      payment: {
        id: "full-payment",
        date: "2026-10-12",
        amount: 1,
        method: "Cash",
      },
    })
    expect(duplicateState).toBe(paidState)

    const cancelled = createTestAppData({
      orders: [{ ...order, status: "Cancelled" }],
    })
    expect(
      reducer(cancelled, {
        type: "RECORD_PAYMENT",
        orderId: order.id,
        orderReference: order.reference,
        payment: {
          id: "cancelled-payment",
          date: "2026-10-12",
          amount: 1,
          method: "Cash",
        },
      }),
    ).toBe(cancelled)
  })

  it("records partial and full refunds without changing original payments", () => {
    const payment = {
      id: "refundable-payment",
      date: "2026-10-12",
      amount: 9000,
      method: "Cash",
    }
    const order = createTestOrder(
      "refund-order",
      [createTestOrderLine("refund-line")],
      { payments: [payment] },
    )
    const state = createTestAppData({ orders: [order] })
    const partial = reducer(state, {
      type: "RECORD_REFUND",
      refund: {
        id: "refund-part-1",
        orderId: order.id,
        paymentId: payment.id,
        date: "2026-10-13",
        amount: 4000,
        reason: "Customer requested a partial refund",
      },
    })

    expect(partial.orders[0].payments).toEqual([payment])
    expect(partial.refunds).toHaveLength(1)
    expect(partial.orders[0].paymentStatus).toBe("Part paid")

    const full = reducer(partial, {
      type: "RECORD_REFUND",
      refund: {
        id: "refund-part-2",
        orderId: order.id,
        paymentId: payment.id,
        date: "2026-10-14",
        amount: 5000,
        reason: "Remaining amount returned",
      },
    })
    expect(full.orders[0].payments).toEqual([payment])
    expect(full.refunds).toHaveLength(2)
    expect(full.refunds[0]).toEqual(partial.refunds[0])
    expect(full.orders[0].paymentStatus).toBe("Refunded")
    expect(full.orders[0].status).toBe(order.status)

    const oneStepFullRefund = reducer(state, {
      type: "RECORD_REFUND",
      refund: {
        id: "refund-full",
        orderId: order.id,
        paymentId: payment.id,
        date: "2026-10-15",
        amount: payment.amount,
        reason: "Full refund requested",
      },
    })
    expect(oneStepFullRefund.refunds).toHaveLength(1)
    expect(oneStepFullRefund.orders[0].paymentStatus).toBe("Refunded")
  })

  it("rejects invalid, mislinked, duplicate and excessive refunds atomically", () => {
    const payment = {
      id: "refund-source-payment",
      date: "2026-10-12",
      amount: 6000,
      method: "Cash",
    }
    const order = createTestOrder(
      "refund-reject-order",
      [createTestOrderLine("refund-reject-line")],
      { payments: [payment] },
    )
    const state = createTestAppData({ orders: [order] })
    const firstRefund = {
      id: "existing-refund",
      orderId: order.id,
      paymentId: payment.id,
      date: "2026-10-13",
      amount: 3000,
      reason: "Partial return",
    }
    const withRefund = { ...state, refunds: [firstRefund] }
    const invalidRefunds = [
      { ...firstRefund, id: "over-by-one", amount: 3001 },
      { ...firstRefund, id: "fractional-refund", amount: 1.5 },
      { ...firstRefund, id: "zero-refund", amount: 0 },
      { ...firstRefund, id: "bad-date-refund", date: "2026-02-30", amount: 1 },
      { ...firstRefund, id: "empty-reason-refund", reason: " ", amount: 1 },
      { ...firstRefund, amount: 1 },
      {
        ...firstRefund,
        id: "missing-payment-refund",
        paymentId: "missing",
        amount: 1,
      },
      {
        ...firstRefund,
        id: "wrong-order-refund",
        orderId: "another-order",
        amount: 1,
      },
    ]
    for (const refund of invalidRefunds) {
      const before = structuredClone(withRefund)
      const next = reducer(withRefund, { type: "RECORD_REFUND", refund })
      expect(next).toBe(withRefund)
      expect(next).toEqual(before)
    }

    const wrongOrder = createTestOrder("different-refund-order", [
      createTestOrderLine("different-refund-line"),
    ])
    const mismatched = createTestAppData({
      orders: [order, { ...wrongOrder, payments: [] }],
    })
    expect(
      reducer(mismatched, {
        type: "RECORD_REFUND",
        refund: {
          ...firstRefund,
          orderId: wrongOrder.id,
          id: "mismatched-order-refund",
          amount: 1,
        },
      }),
    ).toBe(mismatched)
  })

  it("does not issue refunds when an order is cancelled", () => {
    const line = createTestOrderLine("cancel-refund-line")
    const order = createTestOrder("cancel-refund-order", [line], {
      payments: [
        {
          id: "cancelled-order-payment",
          date: "2026-10-12",
          amount: 1000,
          method: "Cash",
        },
      ],
    })
    const state = createTestAppData({ orders: [order] })
    const cancelled = reducer(state, {
      type: "CANCEL_ORDER",
      orderId: order.id,
    })

    expect(cancelled.orders[0].payments).toEqual(order.payments)
    expect(cancelled.refunds).toEqual([])
  })

  it("creates a repeat draft with unique lines, current recipe pricing, and no copied lifecycle records", () => {
    const oldSnapshot = createTestRecipeSnapshot({
      estimatedCost: 2500,
      ingredients: [
        {
          inventoryId: "flour",
          name: "All-purpose flour",
          quantity: 500,
          unit: "g",
        },
      ],
    })
    const currentRecipe = {
      ...oldSnapshot,
      version: 2,
      estimatedCost: 4000,
      ingredients: [
        {
          inventoryId: "flour",
          name: "All-purpose flour",
          quantity: 700,
          unit: "g" as const,
        },
      ],
      updatedAt: "2026-10-12T10:00:00.000Z",
    }
    const sourceLine = createTestOrderLine("repeat-source-line", oldSnapshot, {
      quantity: 3,
    })
    const source = createTestOrder("repeat-source", [sourceLine], {
      customerId: "repeat-customer",
      customerName: "Repeat customer",
      status: "Completed",
      preparationStatus: "Completed",
      paymentStatus: "Paid",
      cancellationFee: 1500,
      payments: [
        {
          id: "repeat-payment",
          date: "2026-10-12",
          amount: 12000,
          method: "Cash",
        },
      ],
    })
    const record = createTestPreparationRecord(source.id, sourceLine, {
      status: "Ready",
      actualUsage: [
        {
          inventoryId: "flour",
          name: "All-purpose flour",
          plannedQuantity: 1500,
          actualQuantity: 1400,
          unit: "g",
          category: "ingredient",
        },
      ],
    })
    const state = createTestAppData({
      customers: [
        { id: "repeat-customer", name: "Repeat customer", phone: "0770000000" },
      ],
      recipes: [currentRecipe],
      orders: [source],
      preparationRecords: [record],
      inventory: [createTestInventoryItem({ physical: 3600 })],
      inventoryMovements: [
        {
          id: "source-consumption",
          inventoryId: "flour",
          type: "Preparation consumption",
          quantityDelta: -1400,
          unit: "g",
          balanceAfter: 3600,
          date: "2026-10-12",
          reason: "Source order",
          createdAt: "2026-10-12T10:00:00.000Z",
        },
      ],
    })

    const repeated = reducer(state, {
      type: "REPEAT_ORDER",
      orderId: source.id,
      newOrderId: "repeat-generated-order",
    })
    const draft = repeated.orders[0]

    expect(draft).toMatchObject({
      customerId: source.customerId,
      customerName: source.customerName,
      status: "Draft",
      preparationStatus: "Not started",
      paymentStatus: "Unpaid",
      agreedPrice: 21850,
      reservations: [],
      shortages: [],
      payments: [],
      confirmedAt: null,
    })
    expect(draft.id).toBe("repeat-generated-order")
    expect(draft.cancellationFee).toBeUndefined()
    expect(draft.id).not.toBe(source.id)
    expect(draft.reference).not.toBe(source.reference)
    expect(draft.status).toBe("Draft")
    expect(draft.lines[0]).toMatchObject({
      productId: sourceLine.productId,
      variantId: sourceLine.variantId,
      quantity: 3,
      recipeId: currentRecipe.id,
      recipeSnapshot: {
        id: currentRecipe.id,
        version: currentRecipe.version,
        estimatedCost: currentRecipe.estimatedCost,
      },
    })
    expect(draft.lines[0].id).not.toBe(sourceLine.id)
    expect(repeated.preparationRecords).toEqual([record])
    expect(repeated.inventoryMovements).toEqual(state.inventoryMovements)
    expect(repeated.finishedStockTransactions).toEqual(
      state.finishedStockTransactions,
    )
    expect(selectReservedByItem(repeated).size).toBe(0)
    expect(repeated.orders[1]).toEqual(source)
    expect(
      reducer(state, {
        type: "REPEAT_ORDER",
        orderId: source.id,
        newOrderId: source.id,
      }),
    ).toBe(state)
  })

  it("rejects missing and ineligible repeat-order sources without changing state", () => {
    const draft = createTestOrder("repeat-ineligible", [
      createTestOrderLine("repeat-ineligible-line"),
    ])
    const state = createTestAppData({ orders: [draft] })

    expect(
      reducer(state, {
        type: "REPEAT_ORDER",
        orderId: "missing",
        newOrderId: "repeat-missing",
      }),
    ).toBe(state)
    expect(
      reducer(state, {
        type: "REPEAT_ORDER",
        orderId: draft.id,
        newOrderId: "repeat-from-draft",
      }),
    ).toBe(state)
  })

  it("updates app settings with validation and records backup exports", () => {
    const state = createTestAppData()

    const updated = reducer(state, {
      type: "UPDATE_SETTINGS",
      patch: {
        businessName: "Udeni's Artisan Bakehouse",
        defaultLabourRatePerHour: 850,
        defaultPricingMode: "markup",
        priceRoundingStep: 100,
      },
    })
    expect(updated.settings.businessName).toBe("Udeni's Artisan Bakehouse")
    expect(updated.settings.defaultLabourRatePerHour).toBe(850)
    expect(updated.settings.defaultPricingMode).toBe("markup")
    expect(updated.settings.priceRoundingStep).toBe(100)

    expect(
      reducer(updated, {
        type: "UPDATE_SETTINGS",
        patch: { businessName: "   " },
      }),
    ).toBe(updated)
    expect(
      reducer(updated, {
        type: "UPDATE_SETTINGS",
        patch: { defaultMarginPercent: 100 },
      }),
    ).toBe(updated)

    const exported = reducer(updated, {
      type: "RECORD_BACKUP_EXPORT",
      exportedAt: "2026-04-12T10:15:00.000Z",
    })
    expect(exported.settings.lastBackupAt).toBe("2026-04-12T10:15:00.000Z")
    expect(exported.settings.backupReminderSnoozedUntil).toBeNull()
  })

  it("creates, confirms, and records a deposit sequentially on a brand-new order", () => {
    const initial = createTestAppData({
      customers: [{ id: "cust-1", name: "Nadeesha", phone: "0771234567" }],
      inventory: [
        createTestInventoryItem({
          inventoryId: "flour",
          name: "Flour",
          unit: "g",
          category: "ingredient",
        }),
      ],
    })
    const orderId = "order-new-with-deposit"
    const expectedReference = makeReference(initial.orders)
    const line = createTestOrderLine(
      "line-deposit",
      createTestRecipeSnapshot({
        ingredients: [{ inventoryId: "flour", name: "Flour", quantity: 500, unit: "g" }],
        packaging: [],
      }),
    )

    const drafted = reducer(initial, {
      type: "UPSERT_DRAFT",
      payload: {
        id: orderId,
        customerId: initial.customers[0].id,
        customerName: initial.customers[0].name,
        isQuickOrder: false,
        collectionDate: "2026-11-20",
        collectionTime: "15:00",
        instructions: "",
        lines: [line],
        agreedPrice: 12000,
        costSnapshot: {
          ingredients: 4000,
          packaging: 500,
          labour: 1000,
          estimatedTotal: 5500,
          suggestedPrice: 12000,
          pricingMode: "margin",
        },
      },
    })
    expect(drafted.orders[0].reference).toBe(expectedReference)
    expect(drafted.orders[0].status).toBe("Draft")

    const confirmed = reducer(drafted, {
      type: "CONFIRM_ORDER",
      orderId,
    })
    expect(confirmed.orders[0].status).toBe("Confirmed")

    const paid = reducer(confirmed, {
      type: "RECORD_PAYMENT",
      orderId,
      orderReference: expectedReference,
      payment: {
        id: "pay-deposit-1",
        date: "2026-11-18",
        amount: 4000,
        method: "Cash",
        note: "Order deposit",
      },
    })
    expect(paid.orders[0].payments).toHaveLength(1)
    expect(paid.orders[0].payments[0].amount).toBe(4000)
    expect(paid.orders[0].paymentStatus).toBe("Part paid")
  })

  it("records a cancellation fee on a cancelled order up to retained payments", () => {
    const order = createTestOrder("cancel-fee-test", [createTestOrderLine("l-1")], {
      status: "Cancelled",
      agreedPrice: 7500,
      payments: [{ id: "p-1", date: "2026-10-01", amount: 7500, method: "Cash" }],
    })
    const state = createTestAppData({
      orders: [order],
      refunds: [
        {
          id: "r-1",
          orderId: order.id,
          paymentId: "p-1",
          date: "2026-10-02",
          amount: 6500,
          reason: "Partial refund",
        },
      ],
    })

    const settled = reducer(state, {
      type: "SET_CANCELLATION_FEE",
      orderId: order.id,
      fee: 1000,
    })
    expect(settled.orders[0].cancellationFee).toBe(1000)

    expect(
      reducer(state, {
        type: "SET_CANCELLATION_FEE",
        orderId: order.id,
        fee: 1500,
      }),
    ).toBe(state)
  })

  it("saves completed shopping trips with sequential SHP references", () => {
    const initial = createTestAppData()
    const firstRef = makeShoppingReference(initial.shoppingTrips ?? [])
    expect(firstRef).toBe("SHP-1001")

    const withFirst = reducer(initial, {
      type: "ADD_SHOPPING_TRIP",
      trip: {
        id: "trip-1",
        reference: firstRef,
        date: "2026-11-24",
        createdAt: "2026-11-24T11:30:00.000Z",
        totalSpent: 1085,
        expenseId: "exp-1",
        items: [
          {
            inventoryId: "flour",
            name: "All-purpose flour",
            category: "ingredient",
            quantity: 870,
            unit: "g",
            estimatedCost: 278,
            orders: [
              {
                orderId: "order-1",
                reference: "US-1008",
                customerName: "Nadeesha Perera",
                quantity: 150,
              },
            ],
          },
        ],
      },
    })

    expect(withFirst.shoppingTrips).toHaveLength(1)
    expect(makeShoppingReference(withFirst.shoppingTrips ?? [])).toBe(
      "SHP-1002",
    )

    // Rejects duplicate trip IDs
    expect(
      reducer(withFirst, {
        type: "ADD_SHOPPING_TRIP",
        trip: withFirst.shoppingTrips![0],
      }),
    ).toBe(withFirst)
  })

  it("deducts pantry stock up to zero on FINISH_PREPARATION_SIMPLE and appends movement", () => {
    const line = createTestOrderLine("simple-line")
    const order = createTestOrder("simple-order", [line], {
      status: "In Progress",
      preparationStatus: "In progress",
    })
    const prep = createTestPreparationRecord(order.id, line, {
      status: "In progress",
      completedSteps: line.recipeSnapshot.instructions.map((_, i) => i),
      actualUsage: [
        {
          inventoryId: "flour",
          name: "All-purpose flour",
          plannedQuantity: 500,
          actualQuantity: 500,
          unit: "g",
          category: "ingredient",
          inPantry: true,
        },
      ],
    })
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({ physical: 300, averageUnitCost: 0.4 }),
      ],
      orders: [order],
      preparationRecords: [prep],
    })

    const next = reducer(state, {
      type: "FINISH_PREPARATION_SIMPLE",
      preparationId: prep.id,
    })

    expect(next.inventory[0].physical).toBe(0)
    expect(next.inventoryMovements[0]).toMatchObject({
      type: "Preparation consumption",
      quantityDelta: -300,
      balanceAfter: 0,
    })
    expect(next.preparationRecords[0].status).toBe("Ready")
  })

  it("enforces cancellation refund cap, supports atomic RECORD_REFUNDS, and scopes shopping selection cleanup", () => {
    const order = createTestOrder("cancelled-refund-cap", [createTestOrderLine("l1")], {
      status: "Cancelled",
      agreedPrice: 5000,
      cancellationFee: 1000,
      payments: [
        { id: "p1", date: "2026-10-01", amount: 2000, method: "Cash" },
        { id: "p2", date: "2026-10-02", amount: 1500, method: "Bank transfer" },
      ],
    })
    const state = createTestAppData({ orders: [order] })

    // Remaining refundable after Rs. 1000 cancellation fee is 2500
    expect(
      reducer(state, {
        type: "RECORD_REFUNDS",
        refunds: [
          {
            id: "r1",
            orderId: order.id,
            paymentId: "p1",
            date: "2026-10-03",
            amount: 2000,
            reason: "Cancel refund",
          },
          {
            id: "r2",
            orderId: order.id,
            paymentId: "p2",
            date: "2026-10-03",
            amount: 1000, // exceeds cap (2000 + 1000 = 3000 > 2500)
            reason: "Cancel refund",
          },
        ],
      }),
    ).toBe(state)

    const refunded = reducer(state, {
      type: "RECORD_REFUNDS",
      refunds: [
        {
          id: "r1",
          orderId: order.id,
          paymentId: "p1",
          date: "2026-10-03",
          amount: 2000,
          reason: "Cancel refund",
        },
        {
          id: "r2",
          orderId: order.id,
          paymentId: "p2",
          date: "2026-10-03",
          amount: 500,
          reason: "Cancel refund",
        },
      ],
    })
    expect(refunded.refunds).toHaveLength(2)

    // SET_PANTRY_CHECKLIST_ITEM preserves shoppingSelections when another order still needs the item
    const lA = createTestOrderLine("la")
    const lB = createTestOrderLine("lb")
    const oA = createTestOrder("oA", [lA], { status: "Confirmed" })
    const oB = createTestOrder("oB", [lB], { status: "Confirmed" })
    const pA = createTestPreparationRecord(oA.id, lA, {
      actualUsage: [
        {
          inventoryId: "flour",
          name: "Flour",
          plannedQuantity: 500,
          actualQuantity: 500,
          unit: "g",
          category: "ingredient",
          inPantry: false,
          toBuyQuantity: 500,
        },
      ],
    })
    const pB = createTestPreparationRecord(oB.id, lB, {
      actualUsage: [
        {
          inventoryId: "flour",
          name: "Flour",
          plannedQuantity: 500,
          actualQuantity: 500,
          unit: "g",
          category: "ingredient",
          inPantry: false,
          toBuyQuantity: 500,
        },
      ],
    })
    const multiState = createTestAppData({
      inventory: [createTestInventoryItem({ inventoryId: "flour" })],
      orders: [oA, oB],
      preparationRecords: [pA, pB],
      shoppingSelections: { flour: 1200 },
    })
    const afterOneInPantry = reducer(multiState, {
      type: "SET_PANTRY_CHECKLIST_ITEM",
      preparationId: pA.id,
      inventoryId: "flour",
      inPantry: true,
    })
    expect(afterOneInPantry.shoppingSelections.flour).toBe(1200)
  })
})
