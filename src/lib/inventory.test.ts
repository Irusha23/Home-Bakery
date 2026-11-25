import { describe, expect, it } from "vitest"

import {
  selectAvailableInventory,
  selectReservedByItem,
  selectShoppingRequirements,
  toBaseQuantity,
  toInventoryBaseQuantity,
} from "./inventory"

import {
  createTestAppData,
  createTestInventoryItem,
  createTestOrder,
  createTestOrderLine,
  createTestStockRequirement,
} from "../test/fixtures"

describe("inventory calculations", () => {
  it("subtracts reservations from confirmed and in-progress orders only", () => {
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 6000 })],

      orders: [
        createTestOrder("confirmed", [], {
          status: "Confirmed",

          reservations: [
            createTestStockRequirement({ reserved: 1200 }),

            createTestStockRequirement({ reserved: 300 }),
          ],
        }),

        createTestOrder("in-progress", [], {
          status: "In Progress",

          reservations: [createTestStockRequirement({ reserved: 700 })],
        }),

        createTestOrder("draft", [], {
          status: "Draft",

          reservations: [createTestStockRequirement({ reserved: 900 })],
        }),

        createTestOrder("completed", [], {
          status: "Completed",

          reservations: [createTestStockRequirement({ reserved: 800 })],
        }),

        createTestOrder("cancelled", [], {
          status: "Cancelled",

          reservations: [createTestStockRequirement({ reserved: 600 })],
        }),
      ],
    })

    expect(selectReservedByItem(state).get("flour")).toBe(2200)

    expect(selectAvailableInventory(state, "flour")).toEqual({
      physical: 6000,

      reserved: 2200,

      available: 3800,
    })
  })

  it("consolidates matching shopping shortages without counting reserved stock as available", () => {
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 5500 })],

      orders: [
        createTestOrder(
          "order-one",

          [createTestOrderLine("line-one")],

          {
            status: "Confirmed",

            reservations: [createTestStockRequirement({ reserved: 2500 })],

            shortages: [
              createTestStockRequirement({
                required: 2800,

                reserved: 2500,

                shortage: 300,

                lineId: "line-one",
              }),
            ],
          },
        ),

        createTestOrder(
          "order-two",

          [createTestOrderLine("line-two")],

          {
            status: "In Progress",

            reservations: [createTestStockRequirement({ reserved: 2500 })],

            shortages: [
              createTestStockRequirement({
                required: 3000,

                reserved: 2500,

                shortage: 500,

                lineId: "line-two",
              }),
            ],
          },
        ),
      ],
    })

    const [requirement] = selectShoppingRequirements(state)

    expect(requirement).toMatchObject({
      inventoryId: "flour",
      required: 800,
      reserved: 5000,
      available: 500,
      shortage: 300,
      suggestedPurchase: 1000,
    })

    expect(requirement.sources).toHaveLength(2)
  })

  it("converts compatible metric units and rejects incompatible or negative quantities", () => {
    expect(toBaseQuantity(1.25, "kg", "g")).toBe(1250)

    expect(toBaseQuantity(0.75, "L", "ml")).toBe(750)

    expect(toBaseQuantity(6, "unit", "unit")).toBe(6)

    expect(toBaseQuantity(1, "ml", "g")).toBeNaN()

    expect(toBaseQuantity(-1, "kg", "g")).toBeNaN()
    expect(toBaseQuantity(Number.MAX_VALUE, "kg", "g")).toBeNaN()
    expect(
      toInventoryBaseQuantity(
        320,
        "g",
        createTestInventoryItem({ physical: 1000 }),
      ),
    ).toBe(320)
  })

  it("aggregates extra-stock and order demand in each inventory item's base unit", () => {
    const recipeSnapshot = createTestOrderLine("line").recipeSnapshot
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 100 })],
      orders: [
        createTestOrder("order-kg", [], {
          status: "Confirmed",
          shortages: [
            createTestStockRequirement({
              required: 250,
              shortage: 0.25,
              unit: "kg",
            }),
          ],
        }),
      ],
      extraStockPlans: [
        {
          id: "plan-kg",
          productId: recipeSnapshot.productId,
          variantId: recipeSnapshot.variantId,
          recipeId: recipeSnapshot.id,
          recipeSnapshot: {
            ...recipeSnapshot,
            ingredients: [
              {
                inventoryId: "flour",
                name: "All-purpose flour",
                quantity: 0.5,
                unit: "kg",
              },
            ],
          },
          quantity: 2,
          bestBefore: "2026-10-20",
          createdAt: "2026-10-12T08:00:00.000Z",
          updatedAt: "2026-10-12T08:00:00.000Z",
        },
      ],
    })

    const [requirement] = selectShoppingRequirements(state)

    expect(requirement).toMatchObject({
      unit: "g",
      required: 1250,
      physical: 100,
      available: 100,
      shortage: 1150,
    })
    expect(requirement.sources.map((source) => source.quantity)).toEqual([
      250, 1000,
    ])
    expect(requirement.unitErrors).toEqual([])
  })

  it("converts litre-based recipe demand to millilitres for shopping", () => {
    const snapshot = createTestOrderLine("volume-line").recipeSnapshot
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          inventoryId: "milk",
          name: "Fresh milk",
          physical: 100,
          unit: "ml",
          category: "ingredient",
        }),
      ],
      extraStockPlans: [
        {
          id: "volume-plan",
          productId: snapshot.productId,
          variantId: snapshot.variantId,
          recipeId: snapshot.id,
          recipeSnapshot: {
            ...snapshot,
            ingredients: [
              {
                inventoryId: "milk",
                name: "Fresh milk",
                quantity: 0.75,
                unit: "L",
              },
            ],
          },
          quantity: 1,
          bestBefore: "2026-10-20",
          createdAt: "2026-10-12T08:00:00.000Z",
          updatedAt: "2026-10-12T08:00:00.000Z",
        },
      ],
    })

    const [requirement] = selectShoppingRequirements(state)

    expect(requirement).toMatchObject({
      inventoryId: "milk",
      unit: "ml",
      required: 750,
      shortage: 650,
    })
  })

  it("marks incompatible shopping demand and reservations instead of guessing units", () => {
    const recipeSnapshot = createTestOrderLine("line").recipeSnapshot
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ physical: 1000 })],
      orders: [
        createTestOrder("order-volume", [], {
          status: "Confirmed",
          reservations: [
            createTestStockRequirement({
              reserved: 1,
              unit: "L",
            }),
          ],
        }),
      ],
      extraStockPlans: [
        {
          id: "plan-volume",
          productId: recipeSnapshot.productId,
          variantId: recipeSnapshot.variantId,
          recipeId: recipeSnapshot.id,
          recipeSnapshot: {
            ...recipeSnapshot,
            ingredients: [
              {
                inventoryId: "flour",
                name: "All-purpose flour",
                quantity: 1,
                unit: "L",
              },
            ],
          },
          quantity: 1,
          bestBefore: "2026-10-20",
          createdAt: "2026-10-12T08:00:00.000Z",
          updatedAt: "2026-10-12T08:00:00.000Z",
        },
      ],
    })

    expect(selectReservedByItem(state).get("flour")).toBeNaN()
    const [requirement] = selectShoppingRequirements(state)
    expect(requirement.unitErrors).toHaveLength(2)
    expect(requirement.required).toBeNaN()
    expect(requirement.shortage).toBeNaN()
  })
})
