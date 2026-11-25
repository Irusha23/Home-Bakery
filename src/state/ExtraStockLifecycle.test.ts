import { describe, expect, it } from "vitest"

import {
  createTestAppData,
  createTestInventoryItem,
  createTestOrder,
  createTestOrderLine,
  createTestRecipeSnapshot,
  createTestStockRequirement,
} from "../test/fixtures"

import type { AppData, ExtraStockPlan, Product } from "../types"

import { reducer } from "./AppState"

function createPlan(overrides: Partial<ExtraStockPlan> = {}): ExtraStockPlan {
  return {
    id: "extra-plan-cake",

    productId: "product-cake",

    variantId: "cake-1kg",

    recipeId: "recipe-chocolate",

    recipeSnapshot: createTestRecipeSnapshot({
      expectedOutput: { quantity: 1, unit: "unit" },

      ingredients: [
        {
          inventoryId: "flour",

          name: "All-purpose flour",

          quantity: 500,

          unit: "g",
        },
      ],

      packaging: [
        {
          inventoryId: "cake-box",

          name: "Cake box",

          quantity: 1,

          unit: "unit",
        },
      ],
    }),

    quantity: 2,

    bestBefore: "2026-10-20",

    createdAt: "2026-10-12T08:00:00.000Z",

    updatedAt: "2026-10-12T08:00:00.000Z",

    ...overrides,
  }
}

function createProduct(
  finishedInventoryId: string | undefined = "finished-cake",

  variants: Product["variants"] = [
    {
      id: "cake-1kg",

      name: "1 kg cake",

      unitLabel: "cake",

      ...(finishedInventoryId ? { finishedInventoryId } : {}),
    },
  ],
): Product {
  return { id: "product-cake", name: "Chocolate cake", variants }
}

function createExtraStockState(overrides: Partial<AppData> = {}): AppData {
  const line = createTestOrderLine("customer-line")

  const order = createTestOrder("customer-order", [line], {
    status: "Confirmed",

    reservations: [
      createTestStockRequirement({
        inventoryId: "flour",

        lineId: line.id,

        reserved: 400,
      }),
    ],
  })

  return createTestAppData({
    products: [createProduct()],

    inventory: [
      createTestInventoryItem({ physical: 5000 }),

      createTestInventoryItem({
        inventoryId: "cake-box",

        name: "Cake box",

        physical: 12,

        unit: "unit",

        category: "packaging",
      }),

      createTestInventoryItem({
        inventoryId: "finished-cake",

        name: "Finished chocolate cake",

        physical: 3,

        unit: "unit",

        category: "finished",

        unbatchedLegacyQuantity: 3,
      }),
    ],

    orders: [order],

    extraStockPlans: [createPlan()],

    inventoryMovements: [
      {
        id: "opening-flour",

        inventoryId: "flour",

        type: "Opening balance",

        quantityDelta: 5000,

        unit: "g",

        balanceAfter: 5000,

        date: "2026-10-01",

        reason: "Opening balance",

        createdAt: "2026-10-01T08:00:00.000Z",
      },
    ],

    ...overrides,
  })
}

function start(state: AppData, preparationId: string) {
  return reducer(state, {
    type: "START_EXTRA_STOCK_PREPARATION",

    planId: "extra-plan-cake",

    preparationId,
  })
}

describe("extra-stock preparation start", () => {
  it("creates an independent preparation without changing stock, movements or reservations", () => {
    const state = createExtraStockState()

    const before = structuredClone(state)

    const next = start(state, "extra-preparation-1")

    expect(next.extraStockPreparations).toHaveLength(1)

    expect(next.extraStockPreparations[0]).toMatchObject({
      id: "extra-preparation-1",

      planId: "extra-plan-cake",

      productId: "product-cake",

      variantId: "cake-1kg",

      finishedInventoryId: "finished-cake",

      plannedBatches: 2,

      status: "In progress",

      completedSteps: [],

      completedAt: null,
    })

    expect(next.extraStockPreparations[0].recipeSnapshot).toEqual(
      before.extraStockPlans[0].recipeSnapshot,
    )

    expect(next.extraStockPreparations[0].startedAt).toBeTruthy()

    expect(next.extraStockPreparations[0].updatedAt).toBe(
      next.extraStockPreparations[0].startedAt,
    )

    expect(next.extraStockPreparations[0].actualUsage).toEqual([
      {
        inventoryId: "flour",

        name: "All-purpose flour",

        plannedQuantity: 1000,

        actualQuantity: 1000,

        unit: "g",

        category: "ingredient",
      },

      {
        inventoryId: "cake-box",

        name: "Cake box",

        plannedQuantity: 2,

        actualQuantity: 2,

        unit: "unit",

        category: "packaging",
      },
    ])

    expect(next.inventory).toEqual(before.inventory)

    expect(next.inventoryMovements).toEqual(before.inventoryMovements)

    expect(next.orders).toEqual(before.orders)

    expect(next.extraStockPlans).toEqual(before.extraStockPlans)

    expect(next.finishedStockBatches).toEqual(before.finishedStockBatches)
  })

  it("creates separate preparation identities when the reusable plan is started again", () => {
    const state = createExtraStockState()

    const first = start(state, "extra-preparation-1")

    const second = start(first, "extra-preparation-2")

    expect(second.extraStockPreparations.map((record) => record.id)).toEqual([
      "extra-preparation-2",

      "extra-preparation-1",
    ])

    expect(second.extraStockPreparations[1]).toEqual(
      first.extraStockPreparations[0],
    )

    expect(second.extraStockPlans).toEqual(state.extraStockPlans)
  })

  it("initializes compatible extra-stock usage in inventory base units", () => {
    const state = createExtraStockState({
      extraStockPlans: [
        createPlan({
          recipeSnapshot: createTestRecipeSnapshot({
            expectedOutput: { quantity: 1, unit: "unit" },

            ingredients: [
              {
                inventoryId: "flour",

                name: "All-purpose flour",

                quantity: 0.5,

                unit: "kg",
              },
            ],
          }),
        }),
      ],
    })

    const started = start(state, "canonical-preparation")

    const usage = started.extraStockPreparations[0].actualUsage[0]

    expect(usage).toMatchObject({
      plannedQuantity: 1000,

      actualQuantity: 1000,

      unit: "g",
    })

    const incompatibleState = createExtraStockState({
      extraStockPlans: [
        createPlan({
          recipeSnapshot: createTestRecipeSnapshot({
            expectedOutput: { quantity: 1, unit: "unit" },

            ingredients: [
              {
                inventoryId: "flour",

                name: "All-purpose flour",

                quantity: 0.5,

                unit: "L",
              },
            ],
          }),
        }),
      ],
    })

    expect(start(incompatibleState, "incompatible-preparation")).toBe(
      incompatibleState,
    )
  })

  it("rejects missing plan, product, variant, invalid mapping and invalid expected output without state changes", () => {
    const validState = createExtraStockState()

    const validPlan = validState.extraStockPlans[0]

    const productWithoutMapping = createProduct("")

    const invalidStates: AppData[] = [
      { ...validState, extraStockPlans: [] },

      { ...validState, products: [] },

      {
        ...validState,

        products: [createProduct(undefined, [])],
      },

      {
        ...validState,

        products: [productWithoutMapping],
      },

      {
        ...validState,

        products: [createProduct("missing-finished-item")],
      },

      {
        ...validState,

        inventory: validState.inventory.map((item) =>
          item.inventoryId === "finished-cake"
            ? { ...item, category: "ingredient" as const }
            : item,
        ),
      },

      {
        ...validState,

        extraStockPlans: [
          createPlan({
            recipeSnapshot: createTestRecipeSnapshot({
              expectedOutput: null,
            }),
          }),
        ],
      },

      {
        ...validState,

        extraStockPlans: [
          createPlan({
            recipeSnapshot: createTestRecipeSnapshot({
              expectedOutput: { quantity: 0, unit: "unit" },
            }),
          }),
        ],
      },

      {
        ...validState,

        extraStockPlans: [
          createPlan({
            recipeSnapshot: createTestRecipeSnapshot({
              expectedOutput: { quantity: 1.5, unit: "unit" },
            }),
          }),
        ],
      },

      {
        ...validState,

        extraStockPlans: [createPlan({ quantity: 0 })],
      },
    ]

    for (const invalidState of invalidStates) {
      expect(start(invalidState, "rejected-preparation")).toBe(invalidState)
    }

    const duplicateIdState = {
      ...validState,

      extraStockPreparations: [
        {
          id: "already-used",

          planId: validPlan.id,

          productId: validPlan.productId,

          variantId: validPlan.variantId,

          finishedInventoryId: "finished-cake",

          recipeSnapshot: validPlan.recipeSnapshot,

          plannedBatches: validPlan.quantity,

          status: "In progress" as const,

          actualUsage: [],

          completedSteps: [],

          startedAt: "2026-10-12T08:00:00.000Z",

          completedAt: null,

          actualCost: null,

          updatedAt: "2026-10-12T08:00:00.000Z",
        },
      ],
    }

    expect(start(duplicateIdState, "already-used")).toBe(duplicateIdState)
  })
})

function actualUsageFor(
  state: AppData,

  quantities: number[] = [700, 1],
) {
  const preparation = state.extraStockPreparations[0]

  return preparation.actualUsage.map((usage, index) => ({
    ...usage,

    actualQuantity: quantities[index],
  }))
}

function complete(
  state: AppData,

  actualUsage = actualUsageFor(state),

  usableOutputQuantity = 2,

  preparationId = "extra-preparation-1",
) {
  return reducer(state, {
    type: "COMPLETE_EXTRA_STOCK_PREPARATION",

    preparationId,

    actualUsage,

    usableOutputQuantity,
  })
}

function createCompletedBatchState() {
  const state = createExtraStockState({
    inventory: [
      createTestInventoryItem({
        physical: 5000,

        averageUnitCost: 0.32,
      }),

      createTestInventoryItem({
        inventoryId: "cake-box",

        name: "Cake box",

        physical: 12,

        unit: "unit",

        category: "packaging",

        averageUnitCost: 220,
      }),

      createTestInventoryItem({
        inventoryId: "finished-cake",

        name: "Finished chocolate cake",

        physical: 3,

        unit: "unit",

        category: "finished",

        unbatchedLegacyQuantity: 3,
      }),
    ],
  })

  return complete(start(state, "extra-preparation-1"))
}

describe("extra-stock preparation completion", () => {
  it("deducts actual usage, records movements and creates a linked batch with actual cost", () => {
    const started = start(
      createExtraStockState({
        inventory: [
          createTestInventoryItem({
            physical: 5000,

            averageUnitCost: 0.32,
          }),

          createTestInventoryItem({
            inventoryId: "cake-box",

            name: "Cake box",

            physical: 12,

            unit: "unit",

            category: "packaging",

            averageUnitCost: 220,
          }),

          createTestInventoryItem({
            inventoryId: "finished-cake",

            name: "Finished chocolate cake",

            physical: 3,

            unit: "unit",

            category: "finished",

            unbatchedLegacyQuantity: 3,
          }),
        ],
      }),

      "extra-preparation-1",
    )

    const next = complete(started)

    const preparation = next.extraStockPreparations[0]

    const batch = next.finishedStockBatches[0]

    expect(
      next.inventory.find((item) => item.inventoryId === "flour")?.physical,
    ).toBe(4300)

    expect(
      next.inventory.find((item) => item.inventoryId === "cake-box")?.physical,
    ).toBe(11)

    expect(
      next.inventory.find((item) => item.inventoryId === "finished-cake")
        ?.physical,
    ).toBe(5)

    expect(
      next.inventory.find(
        (item) => item.inventoryId === "finished-cake",
      )?.unbatchedLegacyQuantity,
    ).toBe(3)

    expect(next.inventoryMovements).toHaveLength(4)

    expect(next.inventoryMovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inventoryId: "flour",

          type: "Preparation consumption",

          quantityDelta: -700,

          balanceAfter: 4300,
        }),

        expect.objectContaining({
          inventoryId: "cake-box",

          type: "Preparation consumption",

          quantityDelta: -1,

          balanceAfter: 11,
        }),

        expect.objectContaining({
          inventoryId: "finished-cake",

          type: "Production",

          quantityDelta: 2,

          balanceAfter: 5,
        }),
      ]),
    )

    expect(preparation).toMatchObject({
      id: "extra-preparation-1",

      planId: "extra-plan-cake",

      status: "Ready",

      completedSteps: [],

      actualCost: 444,
    })

    expect(preparation.completedAt).toBeTruthy()

    expect(preparation.updatedAt).toBe(preparation.completedAt)

    expect(
      preparation.actualUsage.map((usage) => usage.actualQuantity),
    ).toEqual([
      700,

      1,
    ])

    expect(batch).toMatchObject({
      id: "finished-batch-extra-preparation-1",

      source: "production",

      preparationId: "extra-preparation-1",

      planId: "extra-plan-cake",

      productId: "product-cake",

      variantId: "cake-1kg",

      inventoryId: "finished-cake",

      producedQuantity: 2,

      remainingQuantity: 2,

      bestBefore: "2026-10-20",

      actualTotalCost: 444,

      actualUnitCost: 222,
    })

    if (batch.source !== "production")
      throw new Error("Expected production batch.")

    expect(batch.preparedAt).toBeTruthy()

    expect(
      next.inventory.find((item) => item.inventoryId === "finished-cake")
        ?.physical,
    ).toBe(
      (next.inventory.find((item) => item.inventoryId === "finished-cake")
        ?.unbatchedLegacyQuantity ?? 0) +
        next.finishedStockBatches

          .filter((item) => item.inventoryId === "finished-cake")

          .reduce((sum, item) => sum + item.remainingQuantity, 0),
    )

    expect(next.orders).toEqual(started.orders)

    expect(next.extraStockPlans).toEqual(started.extraStockPlans)
  })

  it("deducts canonical actual usage and costs it in the inventory base unit", () => {
    const state = createExtraStockState({
      inventory: [
        createTestInventoryItem({
          physical: 5000,

          averageUnitCost: 0.32,
        }),

        createTestInventoryItem({
          inventoryId: "cake-box",

          name: "Cake box",

          physical: 12,

          unit: "unit",

          category: "packaging",

          averageUnitCost: 220,
        }),

        createTestInventoryItem({
          inventoryId: "finished-cake",

          name: "Finished chocolate cake",

          physical: 3,

          unit: "unit",

          category: "finished",

          unbatchedLegacyQuantity: 3,
        }),
      ],

      extraStockPlans: [
        createPlan({
          recipeSnapshot: createTestRecipeSnapshot({
            expectedOutput: { quantity: 1, unit: "unit" },

            ingredients: [
              {
                inventoryId: "flour",

                name: "All-purpose flour",

                quantity: 0.5,

                unit: "kg",
              },
            ],

            packaging: [
              {
                inventoryId: "cake-box",

                name: "Cake box",

                quantity: 1,

                unit: "unit",
              },
            ],
          }),
        }),
      ],
    })

    const started = start(state, "canonical-completion")

    const completed = complete(
      started,

      actualUsageFor(started, [250, 1]),

      2,

      "canonical-completion",
    )

    expect(
      completed.inventory.find((item) => item.inventoryId === "flour")
        ?.physical,
    ).toBe(4750)

    expect(completed.inventoryMovements).toContainEqual(
      expect.objectContaining({
        inventoryId: "flour",

        quantityDelta: -250,

        unit: "g",
      }),
    )

    expect(completed.extraStockPreparations[0].actualUsage[0]).toMatchObject({
      plannedQuantity: 1000,

      actualQuantity: 250,

      unit: "g",
    })

    expect(completed.extraStockPreparations[0].actualCost).toBe(300)

    const batch = completed.finishedStockBatches[0]

    if (batch.source !== "production")
      throw new Error("Expected a production batch.")

    expect(batch.actualTotalCost).toBe(300)
  })

  it("rejects insufficient unreserved stock without partial changes", () => {
    const started = start(
      createExtraStockState({
        inventory: [
          createTestInventoryItem({ physical: 900 }),

          createTestInventoryItem({
            inventoryId: "cake-box",

            name: "Cake box",

            physical: 12,

            unit: "unit",

            category: "packaging",
          }),

          createTestInventoryItem({
            inventoryId: "finished-cake",

            name: "Finished chocolate cake",

            physical: 3,

            unit: "unit",

            category: "finished",

            unbatchedLegacyQuantity: 3,
          }),
        ],
      }),

      "extra-preparation-1",
    )

    const before = structuredClone(started)

    expect(complete(started)).toBe(started)

    expect(started).toEqual(before)
  })

  it("rejects invalid output or usage without partial changes", () => {
    const started = start(createExtraStockState(), "extra-preparation-1")

    const validUsage = actualUsageFor(started)

    const invalidCases = [
      { actualUsage: validUsage, usableOutputQuantity: 0 },

      { actualUsage: validUsage, usableOutputQuantity: 1.5 },

      {
        actualUsage: validUsage.map((usage, index) =>
          index === 0 ? { ...usage, actualQuantity: -1 } : usage,
        ),

        usableOutputQuantity: 2,
      },

      {
        actualUsage: validUsage.map((usage, index) =>
          index === 0 ? { ...usage, actualQuantity: Number.NaN } : usage,
        ),

        usableOutputQuantity: 2,
      },

      {
        actualUsage: validUsage.slice(0, 1),

        usableOutputQuantity: 2,
      },

      {
        actualUsage: validUsage.map((usage, index) =>
          index === 1 ? { ...usage, actualQuantity: 1.5 } : usage,
        ),

        usableOutputQuantity: 2,
      },
    ]

    for (const invalid of invalidCases) {
      expect(
        complete(started, invalid.actualUsage, invalid.usableOutputQuantity),
      ).toBe(started)
    }
  })

  it("rejects missing and already completed preparations and is idempotent", () => {
    const started = start(createExtraStockState(), "extra-preparation-1")

    expect(complete(started, actualUsageFor(started), 2, "missing-preparation"))

      .toBe(started)

    const completed = complete(started)

    expect(complete(completed)).toBe(completed)

    expect(completed.extraStockPreparations).toHaveLength(1)

    expect(completed.finishedStockBatches).toHaveLength(1)

    expect(
      completed.inventoryMovements.filter(
        (movement) =>
          movement.type === "Preparation consumption" ||
          movement.type === "Production",
      ),
    ).toHaveLength(3)
  })
})

describe("finished-stock sales and write-offs", () => {
  it("records a batch sale at actual batch cost without changing raw stock or reservations", () => {
    const firstCompleted = createCompletedBatchState()

    const secondStarted = start(firstCompleted, "extra-preparation-2")

    const completed = complete(
      secondStarted,

      actualUsageFor(secondStarted, [200, 1]),

      1,

      "extra-preparation-2",
    )

    const rawInventory = completed.inventory.filter(
      (item) => item.category !== "finished",
    )

    const reservations = completed.orders.map((order) => order.reservations)

    const sold = reducer(completed, {
      type: "SELL_FINISHED_STOCK",

      transactionId: "finished-sale-1",

      batchId: "finished-batch-extra-preparation-1",

      quantity: 1,
    })

    const finishedInventory = sold.inventory.find(
      (item) => item.inventoryId === "finished-cake",
    )

    expect(
      sold.finishedStockBatches.find(
        (batch) => batch.id === "finished-batch-extra-preparation-1",
      ),
    ).toMatchObject({
      remainingQuantity: 1,
    })

    expect(
      sold.finishedStockBatches.find(
        (batch) => batch.id === "finished-batch-extra-preparation-2",
      ),
    ).toMatchObject({
      remainingQuantity: 1,
    })

    expect(
      sold.inventory.find((item) => item.inventoryId === "finished-cake"),
    ).toMatchObject({
      physical: 5,

      unbatchedLegacyQuantity: 3,
    })

    expect(sold.finishedStockTransactions[0]).toMatchObject({
      id: "finished-sale-1",

      type: "sale",

      batchId: "finished-batch-extra-preparation-1",

      inventoryId: "finished-cake",

      quantity: 1,

      unitCost: 222,

      totalCost: 222,
    })

    expect(sold.finishedStockTransactions[0].occurredAt).toBeTruthy()

    expect(sold.inventoryMovements[0]).toMatchObject({
      id: "movement-finished-sale-finished-sale-1",

      inventoryId: "finished-cake",

      type: "Finished stock sale",

      quantityDelta: -1,

      balanceAfter: 5,
    })

    expect(sold.inventoryMovements[0].createdAt).toBe(
      sold.finishedStockTransactions[0].occurredAt,
    )

    expect(
      sold.inventory.filter((item) => item.category !== "finished"),
    ).toEqual(rawInventory)

    expect(sold.orders.map((order) => order.reservations)).toEqual(
      reservations,
    )

    expect(finishedInventory?.physical).toBe(
      (finishedInventory?.unbatchedLegacyQuantity ?? 0) +
        sold.finishedStockBatches

          .filter((batch) => batch.inventoryId === "finished-cake")

          .reduce((sum, batch) => sum + batch.remainingQuantity, 0),
    )
  })

  it("records a reasoned write-off at batch cost using a distinct movement", () => {
    const completed = createCompletedBatchState()

    const writtenOff = reducer(completed, {
      type: "WRITE_OFF_FINISHED_STOCK",

      transactionId: "finished-write-off-1",

      batchId: "finished-batch-extra-preparation-1",

      quantity: 1,

      reason: "Damaged during storage",
    })

    expect(writtenOff.finishedStockBatches[0].remainingQuantity).toBe(1)

    expect(
      writtenOff.inventory.find((item) => item.inventoryId === "finished-cake"),
    ).toMatchObject({
      physical: 4,

      unbatchedLegacyQuantity: 3,
    })

    expect(writtenOff.finishedStockTransactions[0]).toMatchObject({
      id: "finished-write-off-1",

      type: "write-off",

      batchId: "finished-batch-extra-preparation-1",

      inventoryId: "finished-cake",

      quantity: 1,

      reason: "Damaged during storage",

      unitCost: 222,

      totalCost: 222,
    })

    expect(writtenOff.inventoryMovements[0]).toMatchObject({
      id: "movement-finished-write-off-finished-write-off-1",

      inventoryId: "finished-cake",

      type: "Finished stock write-off",

      quantityDelta: -1,

      balanceAfter: 4,

      reason: "Damaged during storage",
    })
  })

  describe("legacy finished-stock reconciliation", () => {
    function reconcile(
      state: AppData,

      overrides: Partial<{
        batchId: string

        inventoryId: string

        quantity: number

        unitCost: number

        reason: string
      }> = {},
    ) {
      return reducer(state, {
        type: "RECONCILE_LEGACY_FINISHED_STOCK",

        batchId: "legacy-batch-1",

        inventoryId: "finished-cake",

        quantity: 2,

        unitCost: 1450,

        reason: "Counted and costed during stocktake",

        ...overrides,
      })
    }

    it("partially reconciles legacy stock without changing aggregate quantity", () => {
      const state = createExtraStockState()

      const beforeMovements = state.inventoryMovements

      const next = reconcile(state)

      expect(
        next.inventory.find((item) => item.inventoryId === "finished-cake"),
      ).toMatchObject({
        physical: 3,

        unbatchedLegacyQuantity: 1,
      })

      expect(next.finishedStockBatches[0]).toEqual(
        expect.objectContaining({
          id: "legacy-batch-1",

          source: "legacy-opening",

          inventoryId: "finished-cake",

          reconciledQuantity: 2,

          remainingQuantity: 2,

          reconciliationReason: "Counted and costed during stocktake",

          unitCost: 1450,
        }),
      )

      const batch = next.finishedStockBatches[0]

      if (batch.source !== "legacy-opening")
        throw new Error("Expected reconciled legacy batch.")

      expect(batch.reconciledAt).toBeTruthy()

      expect(next.inventoryMovements).toEqual(beforeMovements)

      expect(next.finishedStockTransactions).toEqual(
        state.finishedStockTransactions,
      )
    })

    it("fully reconciles remaining legacy stock and supports subsequent sale and write-off", () => {
      const state = createExtraStockState()

      const reconciled = reconcile(state, {
        batchId: "legacy-batch-full",

        quantity: 3,

        unitCost: 875,

        reason: "Opening legacy stock count",
      })

      expect(
        reconciled.inventory.find(
          (item) => item.inventoryId === "finished-cake",
        ),
      ).toMatchObject({
        physical: 3,

        unbatchedLegacyQuantity: 0,
      })

      const sold = reducer(reconciled, {
        type: "SELL_FINISHED_STOCK",

        transactionId: "legacy-sale-1",

        batchId: "legacy-batch-full",

        quantity: 1,
      })

      expect(sold.finishedStockTransactions[0]).toMatchObject({
        type: "sale",

        batchId: "legacy-batch-full",

        unitCost: 875,

        totalCost: 875,
      })

      expect(
        sold.inventory.find((item) => item.inventoryId === "finished-cake"),
      ).toMatchObject({
        physical: 2,

        unbatchedLegacyQuantity: 0,
      })

      const writtenOff = reducer(sold, {
        type: "WRITE_OFF_FINISHED_STOCK",

        transactionId: "legacy-writeoff-1",

        batchId: "legacy-batch-full",

        quantity: 1,

        reason: "Expired",
      })

      expect(writtenOff.finishedStockTransactions[0]).toMatchObject({
        type: "write-off",

        batchId: "legacy-batch-full",

        unitCost: 875,

        totalCost: 875,
      })

      expect(
        writtenOff.inventory.find(
          (item) => item.inventoryId === "finished-cake",
        ),
      ).toMatchObject({
        physical: 1,

        unbatchedLegacyQuantity: 0,
      })

      expect(writtenOff.finishedStockBatches[0].remainingQuantity).toBe(1)
    })

    it("rejects invalid input, missing inventory and invariant violations atomically", () => {
      const state = createExtraStockState()

      const invalid = [
        reconcile(state, { quantity: 0 }),

        reconcile(state, { quantity: -1 }),

        reconcile(state, { quantity: 1.5 }),

        reconcile(state, { quantity: 4 }),

        reconcile(state, { unitCost: -1 }),

        reconcile(state, { unitCost: Number.NaN }),

        reconcile(state, { unitCost: Number.POSITIVE_INFINITY }),

        reconcile(state, { reason: "   " }),

        reconcile(state, { batchId: "" }),

        reconcile(state, { inventoryId: "missing-inventory" }),
      ]

      for (const result of invalid) expect(result).toBe(state)

      const inconsistent = {
        ...state,

        inventory: state.inventory.map((item) =>
          item.inventoryId === "finished-cake"
            ? { ...item, physical: 4 }
            : item,
        ),
      }

      expect(reconcile(inconsistent)).toBe(inconsistent)

      const wrongCategory = {
        ...state,

        inventory: state.inventory.map((item) =>
          item.inventoryId === "finished-cake"
            ? { ...item, category: "ingredient" as const }
            : item,
        ),
      }

      expect(reconcile(wrongCategory)).toBe(wrongCategory)
    })

    it("preserves unfinished legacy stock and rejects reused batch identities", () => {
      const partiallyReconciled = reconcile(createExtraStockState())

      expect(
        partiallyReconciled.inventory.find(
          (item) => item.inventoryId === "finished-cake",
        )?.unbatchedLegacyQuantity,
      ).toBe(1)

      expect(
        reconcile(partiallyReconciled, {
          batchId: "legacy-batch-1",

          quantity: 1,
        }),
      ).toBe(partiallyReconciled)
    })

    it("accepts an explicitly supplied zero unit cost", () => {
      const state = createExtraStockState()

      const reconciled = reconcile(state, {
        batchId: "legacy-zero-cost",

        quantity: 1,

        unitCost: 0,
      })

      expect(reconciled.finishedStockBatches[0]).toMatchObject({
        id: "legacy-zero-cost",

        source: "legacy-opening",

        unitCost: 0,

        remainingQuantity: 1,
      })

      expect(
        reconciled.inventory.find(
          (item) => item.inventoryId === "finished-cake",
        ),
      ).toMatchObject({
        physical: 3,

        unbatchedLegacyQuantity: 2,
      })
    })
  })

  it("rejects invalid batch, inventory, quantity and reason atomically", () => {
    const completed = createCompletedBatchState()

    const rawInventory = completed.inventory.filter(
      (item) => item.category !== "finished",
    )

    const invalidSaleActions = [
      {
        type: "SELL_FINISHED_STOCK" as const,

        transactionId: "missing-batch-sale",

        batchId: "missing-batch",

        quantity: 1,
      },

      ...[0, -1, 1.5, Number.NaN, 3].map((quantity, index) => ({
        type: "SELL_FINISHED_STOCK" as const,

        transactionId: `invalid-sale-${index}`,

        batchId: "finished-batch-extra-preparation-1",

        quantity,
      })),
    ]

    for (const action of invalidSaleActions) {
      expect(reducer(completed, action)).toBe(completed)
    }

    const missingInventory = {
      ...completed,

      inventory: completed.inventory.filter(
        (item) => item.inventoryId !== "finished-cake",
      ),
    }

    expect(
      reducer(missingInventory, {
        type: "SELL_FINISHED_STOCK",

        transactionId: "missing-inventory-sale",

        batchId: "finished-batch-extra-preparation-1",

        quantity: 1,
      }),
    ).toBe(missingInventory)

    expect(
      reducer(completed, {
        type: "WRITE_OFF_FINISHED_STOCK",

        transactionId: "blank-reason-write-off",

        batchId: "finished-batch-extra-preparation-1",

        quantity: 1,

        reason: "   ",
      }),
    ).toBe(completed)

    expect(
      reducer(completed, {
        type: "WRITE_OFF_FINISHED_STOCK",

        transactionId: "excess-write-off",

        batchId: "finished-batch-extra-preparation-1",

        quantity: 3,

        reason: "Spoilage",
      }),
    ).toBe(completed)

    expect(completed.finishedStockTransactions).toEqual([])

    expect(completed.finishedStockBatches[0].remainingQuantity).toBe(2)

    expect(
      completed.inventory.filter((item) => item.category !== "finished"),
    ).toEqual(rawInventory)
  })

  it("cannot repeat a transaction ID or reuse its movement ID", () => {
    const completed = createCompletedBatchState()

    const sold = reducer(completed, {
      type: "SELL_FINISHED_STOCK",

      transactionId: "unique-sale",

      batchId: "finished-batch-extra-preparation-1",

      quantity: 1,
    })

    expect(
      reducer(sold, {
        type: "SELL_FINISHED_STOCK",

        transactionId: "unique-sale",

        batchId: "finished-batch-extra-preparation-1",

        quantity: 1,
      }),
    ).toBe(sold)

    expect(
      sold.finishedStockTransactions.filter(
        (transaction) => transaction.id === "unique-sale",
      ),
    ).toHaveLength(1)

    expect(
      sold.inventoryMovements.filter(
        (movement) => movement.id === "movement-finished-sale-unique-sale",
      ),
    ).toHaveLength(1)
  })

  it("records optional selling price, payment method, and customer on finished-stock sales and rejects invalid prices", () => {
    const completed = createCompletedBatchState()

    const baseWithCustomer = {
      ...completed,

      customers: [
        {
          id: "cust-walkin",

          name: "Nimali Perera",

          phone: "0771234567",

          notes: "",
        },
      ],
    }

    const rejected = reducer(baseWithCustomer, {
      type: "SELL_FINISHED_STOCK",

      transactionId: "bad-price-sale",

      batchId: "finished-batch-extra-preparation-1",

      quantity: 1,

      sellingPrice: -100,
    })

    expect(rejected).toBe(baseWithCustomer)

    const accepted = reducer(baseWithCustomer, {
      type: "SELL_FINISHED_STOCK",

      transactionId: "priced-sale-1",

      batchId: "finished-batch-extra-preparation-1",

      quantity: 1,

      sellingPrice: 3200,

      paymentMethod: "Bank transfer",

      customerId: "cust-walkin",
    })

    expect(accepted.finishedStockTransactions[0]).toMatchObject({
      id: "priced-sale-1",

      type: "sale",

      quantity: 1,

      sellingPrice: 3200,

      paymentMethod: "Bank transfer",

      customerId: "cust-walkin",

      customerName: "Nimali Perera",
    })
  })
})
