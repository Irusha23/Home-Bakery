import { describe, expect, it } from "vitest"

import {
  compatibleUnits,
  convertInventoryUnitQuantity,
  fromBaseQuantity,
  getDefaultGramsPerTsp,
  isStockTracked,
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

  it("supports tsp/tbsp/cup and tsp<->g/ml conversions with culinary defaults and per-ingredient overrides", () => {
    expect(compatibleUnits("g")).toEqual(["g", "kg", "tsp", "tbsp"])
    expect(compatibleUnits("ml")).toEqual(["ml", "L", "tsp", "tbsp", "cup"])
    expect(compatibleUnits("unit")).toEqual(["unit"])

    expect(getDefaultGramsPerTsp("All-purpose flour")).toBe(3)
    expect(getDefaultGramsPerTsp("Cocoa powder")).toBe(2.5)
    expect(getDefaultGramsPerTsp("Fine salt")).toBe(6)
    expect(getDefaultGramsPerTsp("Baking powder")).toBe(4)

    const flour = createTestInventoryItem({ name: "All-purpose flour", unit: "g" })
    expect(toInventoryBaseQuantity(2, "tsp", flour)).toBe(6)
    expect(toInventoryBaseQuantity(1, "tbsp", flour)).toBe(9)
    expect(convertInventoryUnitQuantity(12, "g", "tsp", flour)).toBe(4)

    const denseButter = createTestInventoryItem({
      inventoryId: "butter",
      name: "Butter",
      unit: "g",
      gramsPerTsp: 4.5,
    })
    expect(toInventoryBaseQuantity(2, "tsp", denseButter)).toBe(9)
    expect(fromBaseQuantity(13.5, "tsp", "g", { gramsPerTsp: 4.5 })).toBe(3)

    const vanilla = createTestInventoryItem({
      inventoryId: "vanilla",
      name: "Vanilla essence",
      unit: "ml",
    })
    expect(toInventoryBaseQuantity(2, "tsp", vanilla)).toBe(10)
    expect(toInventoryBaseQuantity(1, "tbsp", vanilla)).toBe(15)
    expect(toInventoryBaseQuantity(0.5, "cup", vanilla)).toBe(125)
    expect(convertInventoryUnitQuantity(250, "ml", "cup", vanilla)).toBe(1)

    const customEssence = createTestInventoryItem({
      inventoryId: "custom-oil",
      name: "Oil",
      unit: "ml",
      mlPerTsp: 4,
    })
    expect(toInventoryBaseQuantity(3, "tsp", customEssence)).toBe(12)
    expect(toInventoryBaseQuantity(1, "tbsp", customEssence)).toBe(12)

    expect(
      isStockTracked(
        createTestInventoryItem({ physical: 0, trackStock: false }),
      ),
    ).toBe(false)
    expect(
      isStockTracked(
        createTestInventoryItem({ physical: 0, trackStock: true }),
      ),
    ).toBe(true)
  })
})
