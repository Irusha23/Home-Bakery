import { describe, expect, it } from "vitest"

import { createTestAppData, createTestInventoryItem } from "../test/fixtures"

import type { ExtraStockPlan, Product } from "../types"

import { getExtraStockPlanEligibilityIssues } from "./extraStockEligibility"

const plan: ExtraStockPlan = {
  id: "plan-cake",

  productId: "cake",

  variantId: "large",

  recipeId: "recipe-cake",

  recipeSnapshot: {
    id: "recipe-cake",

    name: "Chocolate cake",

    productId: "cake",

    variantId: "large",

    version: 2,

    yield: 1,

    yieldLabel: "A cake",

    expectedOutput: { quantity: 1, unit: "unit" },

    preparationMinutes: 60,

    ingredients: [],

    packaging: [],

    instructions: ["Bake"],

    estimatedCost: 5000,
  },

  quantity: 2,

  bestBefore: "",

  createdAt: "2026-10-12T08:00:00.000Z",

  updatedAt: "2026-10-12T08:00:00.000Z",
}

const product: Product = {
  id: "cake",

  name: "Chocolate cake",

  variants: [
    {
      id: "large",

      name: "Large",

      unitLabel: "cake",

      finishedInventoryId: "finished-cake",
    },
  ],
}

function eligibleState() {
  return createTestAppData({
    products: [structuredClone(product)],

    inventory: [
      createTestInventoryItem({
        inventoryId: "finished-cake",

        name: "Chocolate cake",

        unit: "unit",

        category: "finished",
      }),
    ],
  })
}

describe("extra-stock plan eligibility", () => {
  it("accepts a plan with an existing product, explicit unit mapping, typed output and whole-batch quantity", () => {
    expect(
      getExtraStockPlanEligibilityIssues(eligibleState(), plan),
    ).toEqual([])
  })

  it("explains each missing or invalid eligibility configuration", () => {
    const state = eligibleState()

    state.products[0].variants[0].finishedInventoryId = "missing"

    state.inventory[0].unit = "g"

    const issues = getExtraStockPlanEligibilityIssues(
      {
        ...state,

        products: [],
      },

      {
        ...plan,

        quantity: 1.5,

        recipeSnapshot: {
          ...plan.recipeSnapshot,

          expectedOutput: null,
        },
      },
    )

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("product"),

        expect.stringContaining("variant"),

        expect.stringContaining("finished inventory"),

        expect.stringContaining("expected output"),

        expect.stringContaining("positive whole number"),
      ]),
    )
  })

  it("rejects a mapped inventory item that is not finished unit stock", () => {
    const state = eligibleState()

    state.inventory[0].category = "ingredient"

    expect(getExtraStockPlanEligibilityIssues(state, plan)).toEqual([
      "The variant must map to finished inventory measured in units. Update the mapping in Recipes.",
    ])
  })

  it("rejects recipe units incompatible with their ingredient inventory", () => {
    const state = eligibleState()

    state.inventory.push(
      createTestInventoryItem({
        inventoryId: "flour",

        name: "All-purpose flour",

        unit: "g",

        category: "ingredient",
      }),
    )

    const planWithVolume = {
      ...plan,

      recipeSnapshot: {
        ...plan.recipeSnapshot,

        ingredients: [
          {
            inventoryId: "flour",

            name: "All-purpose flour",

            quantity: 1,

            unit: "L" as const,
          },
        ],
      },
    }

    expect(
      getExtraStockPlanEligibilityIssues(state, planWithVolume),
    ).toContain(
      "All-purpose flour uses L, incompatible with inventory unit g or plan quantity.",
    )
  })
})
