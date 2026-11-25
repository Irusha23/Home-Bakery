import { describe, expect, it } from "vitest"
import {
  calculatePriceMetricsAtSellingPrice,
  calculateSuggestedPrice,
  estimateRecipeMaterialCost,
  fromDisplayUnitPrice,
  getDisplayPriceUnitLabel,
  resolveRecipeSellingPrice,
  toDisplayUnitPrice,
} from "./pricing"
import { calculateCostSnapshot } from "./orders"
import { selectManualShoppingList } from "./inventory"
import { reducer } from "../state/AppState"
import {
  createTestAppData,
  createTestInventoryItem,
  createTestOrder,
  createTestOrderLine,
  createTestPreparationRecord,
  createTestRecipeSnapshot,
} from "../test/fixtures"

describe("pricing calculations", () => {
  it("computes margin pricing accurately and matches ADR reference case", () => {
    const exact = calculateSuggestedPrice(1000, {
      mode: "margin",
      marginPercent: 30,
      markupPercent: 50,
      roundingStep: 1,
    })
    expect(exact.valid).toBe(true)
    if (exact.valid) {
      expect(exact.rawSuggestedPrice).toBeCloseTo(1428.57, 2)
      expect(exact.suggestedPrice).toBe(1429)
    }

    const rounded50 = calculateSuggestedPrice(1000, {
      mode: "margin",
      marginPercent: 30,
      markupPercent: 50,
      roundingStep: 50,
    })
    expect(rounded50.valid).toBe(true)
    if (rounded50.valid) {
      expect(rounded50.suggestedPrice).toBe(1450)
    }
  })

  it("computes markup pricing accurately and matches ADR reference case", () => {
    const result = calculateSuggestedPrice(1000, {
      mode: "markup",
      marginPercent: 30,
      markupPercent: 30,
      roundingStep: 50,
    })
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.rawSuggestedPrice).toBe(1300)
      expect(result.suggestedPrice).toBe(1300)
      expect(result.profitAtSuggested).toBe(300)
    }
  })

  it("rejects margin >= 100% or negative margin/markup", () => {
    const atHundred = calculateSuggestedPrice(1000, {
      mode: "margin",
      marginPercent: 100,
      markupPercent: 30,
      roundingStep: 50,
    })
    expect(atHundred.valid).toBe(false)

    const overHundred = calculateSuggestedPrice(1000, {
      mode: "margin",
      marginPercent: 120,
      markupPercent: 30,
      roundingStep: 50,
    })
    expect(overHundred.valid).toBe(false)

    const negMarkup = calculateSuggestedPrice(1000, {
      mode: "markup",
      marginPercent: 30,
      markupPercent: -5,
      roundingStep: 50,
    })
    expect(negMarkup.valid).toBe(false)
  })

  it("computes live recipe cost from inventory averageUnitCost and labour rate", () => {
    const inventory = [
      createTestInventoryItem({
        inventoryId: "flour",
        name: "All-purpose flour",
        unit: "g",
        category: "ingredient",
        averageUnitCost: 0.42, // Rs. 420 / kg
      }),
      createTestInventoryItem({
        inventoryId: "box",
        name: "Cake box",
        unit: "unit",
        category: "packaging",
        averageUnitCost: 250,
      }),
    ]
    const breakdown = estimateRecipeMaterialCost(
      {
        ingredients: [
          {
            inventoryId: "flour",
            name: "All-purpose flour",
            quantity: 1,
            unit: "kg",
          },
          {
            inventoryId: "vanilla",
            name: "Vanilla extract",
            quantity: 10,
            unit: "ml",
          },
        ],
        packaging: [
          { inventoryId: "box", name: "Cake box", quantity: 1, unit: "unit" },
        ],
        preparationMinutes: 90,
      },
      inventory,
      600,
    )

    expect(breakdown.hasLivePricing).toBe(true)
    expect(breakdown.ingredientsCost).toBe(420)
    expect(breakdown.packagingCost).toBe(250)
    expect(breakdown.labourCost).toBe(900)
    expect(breakdown.totalCost).toBe(1570)
    expect(breakdown.unpricedItems).toEqual(["Vanilla extract"])

    const metrics = calculatePriceMetricsAtSellingPrice(1570, 3000)
    expect(metrics.profitLkr).toBe(1430)
    expect(metrics.marginPercent).toBeCloseTo(47.7, 1)
  })

  it("converts between display unit price (per kg / L / unit) and base unit cost and updates all recipes", () => {
    expect(getDisplayPriceUnitLabel("g")).toBe("kg")
    expect(getDisplayPriceUnitLabel("ml")).toBe("L")
    expect(getDisplayPriceUnitLabel("unit")).toBe("unit")

    const baseCost = fromDisplayUnitPrice(450, "g")
    expect(baseCost).toBeCloseTo(0.45, 5)
    expect(toDisplayUnitPrice(baseCost, "g")).toBe(450)

    const recipeA = {
      ...createTestRecipeSnapshot({
        id: "r-a",
        preparationMinutes: 60,
        ingredients: [
          {
            inventoryId: "flour",
            name: "All-purpose flour",
            quantity: 1,
            unit: "kg",
          },
        ],
        packaging: [],
        estimatedCost: 1000,
      }),
      updatedAt: "2026-04-12T10:00:00.000Z",
    }
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          inventoryId: "flour",
          name: "All-purpose flour",
          unit: "g",
          averageUnitCost: 0.4,
        }),
      ],
      recipes: [recipeA],
    })

    const next = reducer(state, {
      type: "UPDATE_INVENTORY_ITEM",
      inventoryId: "flour",
      patch: { averageUnitCost: fromDisplayUnitPrice(500, "g") },
    })

    // 1 kg @ Rs. 500/kg + 1 hr labour @ default rate (600) = 1100
    expect(next.recipes[0].estimatedCost).toBe(
      500 + state.settings.defaultLabourRatePerHour,
    )
  })

  it("drives shopping list from manual pantry checklist and clears items when marked bought", () => {
    const line = createTestOrderLine("line-1")
    const order = createTestOrder("order-1", [line], { status: "Confirmed" })
    const prep = createTestPreparationRecord(order.id, line, {
      status: "Awaiting preparation",
    })
    const state = createTestAppData({
      inventory: [createTestInventoryItem({ inventoryId: "flour", unit: "g" })],
      orders: [order],
      preparationRecords: [prep],
    })

    // Initially no shortages -> shopping list is empty
    expect(selectManualShoppingList(state)).toHaveLength(0)

    // User marks flour as "Need to buy" with custom partial quantity 350g
    const afterPantryCheck = reducer(state, {
      type: "SET_PANTRY_CHECKLIST_ITEM",
      preparationId: prep.id,
      inventoryId: "flour",
      inPantry: false,
      toBuyQuantity: 350,
    })

    // While flour is still marked for purchase, baking cannot be started or marked ready
    expect(
      reducer(afterPantryCheck, {
        type: "START_PREPARATION",
        preparationId: prep.id,
      }),
    ).toBe(afterPantryCheck)
    expect(
      reducer(afterPantryCheck, {
        type: "FINISH_PREPARATION_SIMPLE",
        preparationId: prep.id,
      }),
    ).toBe(afterPantryCheck)

    const shoppingItems = selectManualShoppingList(afterPantryCheck)
    expect(shoppingItems).toHaveLength(1)
    expect(shoppingItems[0]).toMatchObject({
      inventoryId: "flour",
      neededQuantity: 350,
      boughtQuantity: 350,
      checked: false,
    })

    // User marks item bought at store and updates bought quantity to 500g
    const afterShopCheck = reducer(afterPantryCheck, {
      type: "UPDATE_SHOPPING_CHECKLIST_ITEM",
      inventoryId: "flour",
      checked: true,
      boughtQuantity: 500,
    })
    expect(selectManualShoppingList(afterShopCheck)[0]).toMatchObject({
      checked: true,
      boughtQuantity: 500,
    })

    // User finishes shopping -> item moves to pantry and shopping list clears
    const afterShopDone = reducer(afterShopCheck, {
      type: "COMPLETE_SHOPPING_CHECKLIST",
    })
    expect(selectManualShoppingList(afterShopDone)).toHaveLength(0)

    // User can also add a standalone item directly to the shopping list
    const withExtraItem = reducer(afterShopDone, {
      type: "SET_PURCHASE_QUANTITY",
      inventoryId: "flour",
      quantity: 1000,
    })
    expect(selectManualShoppingList(withExtraItem)).toMatchObject([
      {
        inventoryId: "flour",
        neededQuantity: 1000,
        boughtQuantity: 1000,
        isManualExtra: true,
      },
    ])
    const afterExtraDone = reducer(withExtraItem, {
      type: "COMPLETE_SHOPPING_CHECKLIST",
      extraInventoryIds: ["flour"],
    })
    expect(selectManualShoppingList(afterExtraDone)).toHaveLength(0)

    // Must click Start baking before Mark bake ready is allowed
    expect(
      reducer(afterShopDone, {
        type: "FINISH_PREPARATION_SIMPLE",
        preparationId: prep.id,
      }),
    ).toBe(afterShopDone)

    const afterStart = reducer(afterShopDone, {
      type: "START_PREPARATION",
      preparationId: prep.id,
    })
    expect(afterStart.preparationRecords[0].status).toBe("In progress")

    // Cannot mark bake ready until all baking steps are checked
    expect(
      reducer(afterStart, {
        type: "FINISH_PREPARATION_SIMPLE",
        preparationId: prep.id,
      }),
    ).toBe(afterStart)

    let afterSteps = afterStart
    for (
      let i = 0;
      i < afterStart.preparationRecords[0].recipeSnapshot.instructions.length;
      i++
    ) {
      afterSteps = reducer(afterSteps, {
        type: "TOGGLE_PREPARATION_STEP",
        preparationId: prep.id,
        stepIndex: i,
      })
    }

    // User marks bake ready once all baking steps are checked
    const afterReady = reducer(afterSteps, {
      type: "FINISH_PREPARATION_SIMPLE",
      preparationId: prep.id,
    })
    expect(afterReady.preparationRecords[0].status).toBe("Ready")
    expect(afterReady.orders[0].preparationStatus).toBe("Ready")
  })

  it("sums minimal total quantity across orders marked Buy and calculates ingredient & total prices", () => {
    const line1 = createTestOrderLine("l1", undefined, { quantity: 1 })
    const line2 = createTestOrderLine("l2", undefined, { quantity: 1 })
    const order1 = createTestOrder("o1", [line1], {
      status: "Confirmed",
      customerName: "Nadeesha",
    })
    const order2 = createTestOrder("o2", [line2], {
      status: "Confirmed",
      customerName: "Ayesha",
    })
    const prep1 = createTestPreparationRecord(order1.id, line1)
    const prep2 = createTestPreparationRecord(order2.id, line2)
    // Fixtures use 500 g flour per line
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          inventoryId: "flour",
          unit: "g",
          averageUnitCost: 0.42, // Rs. 420 / kg
        }),
      ],
      orders: [order1, order2],
      preparationRecords: [prep1, prep2],
    })

    // Mark flour Buy on order1 only (order2 still has flour in pantry)
    const oneOrderShort = reducer(state, {
      type: "SET_PANTRY_CHECKLIST_ITEM",
      preparationId: prep1.id,
      inventoryId: "flour",
      inPantry: false,
      toBuyQuantity: 500,
    })
    expect(selectManualShoppingList(oneOrderShort)[0]).toMatchObject({
      neededQuantity: 500,
      boughtQuantity: 500,
      estimatedCost: 210, // 500 * 0.42
    })

    // Mark flour Buy on order2 as well -> minimal total is 1000 g @ Rs. 420/kg = Rs. 420
    const bothOrdersShort = reducer(oneOrderShort, {
      type: "SET_PANTRY_CHECKLIST_ITEM",
      preparationId: prep2.id,
      inventoryId: "flour",
      inPantry: false,
      toBuyQuantity: 500,
    })
    expect(selectManualShoppingList(bothOrdersShort)).toHaveLength(1)
    expect(selectManualShoppingList(bothOrdersShort)[0]).toMatchObject({
      neededQuantity: 1000,
      boughtQuantity: 1000,
      estimatedCost: 420,
    })

    // Editing Qty to buy to 1500 g updates calculated price to Rs. 630 while keeping minimal needed at 1000 g
    const editedQty = reducer(bothOrdersShort, {
      type: "UPDATE_SHOPPING_CHECKLIST_ITEM",
      inventoryId: "flour",
      checked: false,
      boughtQuantity: 1500,
    })
    expect(selectManualShoppingList(editedQty)[0]).toMatchObject({
      neededQuantity: 1000,
      boughtQuantity: 1500,
      estimatedCost: 630,
    })
  })

  it("avoids IEEE 754 float overshoot when rounding prices to currency steps", () => {
    const result = calculateSuggestedPrice(605, {
      mode: "margin",
      marginPercent: 45,
      markupPercent: 100,
      roundingStep: 50,
    })
    // 605 / 0.55 = 1100 exactly mathematically, even though float division yields 1100.0000000000002
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.suggestedPrice).toBe(1100)
    }
  })

  it("prices recipes accurately using tsp/tbsp dry and liquid ml/cup conversions", () => {
    const inventory = [
      createTestInventoryItem({
        inventoryId: "cocoa",
        name: "Cocoa powder",
        unit: "g",
        averageUnitCost: 4, // Rs. 4000 / kg
      }),
      createTestInventoryItem({
        inventoryId: "milk",
        name: "Fresh milk",
        unit: "ml",
        averageUnitCost: 0.6, // Rs. 600 / L
      }),
    ]
    const breakdown = estimateRecipeMaterialCost(
      {
        ingredients: [
          // 4 tsp cocoa * 2.5g = 10g @ Rs.4/g = Rs.40
          { inventoryId: "cocoa", name: "Cocoa powder", quantity: 4, unit: "tsp" },
          // 1 cup milk = 250ml @ Rs.0.6/ml = Rs.150
          { inventoryId: "milk", name: "Fresh milk", quantity: 1, unit: "cup" },
        ],
        packaging: [],
        preparationMinutes: 0,
      },
      inventory,
      0,
    )
    expect(breakdown.ingredientsCost).toBe(190)
    expect(breakdown.hasCompletePricing).toBe(true)
  })

  it("keeps saved recipe selling price while updating live cost & margin, and uses saved price in orders", () => {
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          inventoryId: "flour",
          name: "Flour",
          unit: "g",
          averageUnitCost: 0.4, // Rs. 400 / kg
        }),
      ],
    })
    const recipeSnapshot = createTestRecipeSnapshot({
      ingredients: [{ inventoryId: "flour", name: "Flour", quantity: 1000, unit: "g" }],
      packaging: [],
      preparationMinutes: 60, // Rs. 600 labour @ 600/hr -> base cost 1000
      estimatedCost: 1000,
      sellingPrice: 2500,
      pricing: {
        mode: "margin",
        marginPercent: 50,
        markupPercent: 100,
        labourRatePerHour: 800, // cost = 400 + 800 = 1200
        roundingStep: 50,
      },
    })

    // Resolved recipe price honours saved sellingPrice (2500) & custom labour rate (800 -> cost 1200)
    const resolved = resolveRecipeSellingPrice(recipeSnapshot, state.inventory, state.settings)
    expect(resolved.source).toBe("saved")
    expect(resolved.sellingPrice).toBe(2500)
    expect(resolved.effectiveCost).toBe(1200)
    expect(resolved.profitLkr).toBe(1300)

    // When ingredient price rises later, saved sellingPrice stays 2500 while cost/profit update live
    const updatedInventory = [
      { ...state.inventory[0], averageUnitCost: 0.5 }, // cost = 500 + 800 = 1300
    ]
    const afterFlourHike = resolveRecipeSellingPrice(
      recipeSnapshot,
      updatedInventory,
      state.settings,
    )
    expect(afterFlourHike.sellingPrice).toBe(2500)
    expect(afterFlourHike.effectiveCost).toBe(1300)
    expect(afterFlourHike.profitLkr).toBe(1200)

    // New orders use saved recipe sellingPrice * qty cleanly
    const orderCost = calculateCostSnapshot(
      [createTestOrderLine("l-saved", recipeSnapshot, { quantity: 2 })],
      state,
    )
    expect(orderCost.estimatedTotal).toBe(2400)
    expect(orderCost.suggestedPrice).toBe(5000)
  })
})
