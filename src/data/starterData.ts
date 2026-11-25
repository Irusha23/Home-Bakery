import { BUILT_IN_EXPENSE_CATEGORIES } from "../lib/expenses"
import type { AppData, Order, Recipe, RecipeSnapshot } from "../types"
import { createEmptyAppData, defaultBudgetPlan, defaultSettings } from "./defaults"

export type StarterMode = "minimal" | "empty"

export function resolveStarterMode(raw?: string): StarterMode {
  return raw?.trim().toLowerCase() === "empty" ? "empty" : "minimal"
}

function snapshot(recipe: Recipe): RecipeSnapshot {
  const { updatedAt: _, ...recipeSnapshot } = structuredClone(recipe)
  return recipeSnapshot
}

function relativeIsoDate(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function relativeIsoTimestamp(offsetDays: number, hourUtc = 9): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  d.setUTCHours(hourUtc, 0, 0, 0)
  return d.toISOString()
}

/**
 * Minimal 1-item starter slice (1 customer, 1 product + 1 variant, 1 recipe with
 * its 6 supporting inventory items, and 1 active order) for UI verification.
 */
export function createStarterData(): AppData {
  const starterRecipe: Recipe = {
    id: "recipe-chocolate-15",
    name: "Signature chocolate celebration cake",
    image: "preset:chocolate-cake",
    productId: "product-cake",
    variantId: "cake-15kg",
    version: 1,
    yield: 1,
    yieldLabel: "1 × 1.5 kg cake",
    expectedOutput: null,
    preparationMinutes: 150,
    ingredients: [
      {
        inventoryId: "flour",
        name: "All-purpose flour",
        quantity: 650,
        unit: "g",
      },
      { inventoryId: "sugar", name: "Caster sugar", quantity: 520, unit: "g" },
      {
        inventoryId: "butter",
        name: "Unsalted butter",
        quantity: 480,
        unit: "g",
      },
      { inventoryId: "cocoa", name: "Cocoa powder", quantity: 140, unit: "g" },
    ],
    packaging: [
      {
        inventoryId: "cake-box-large",
        name: "Large cake box",
        quantity: 1,
        unit: "unit",
      },
      {
        inventoryId: "cake-board-12",
        name: "12-inch cake board",
        quantity: 1,
        unit: "unit",
      },
    ],
    instructions: [
      "Bake the chocolate sponge in three even layers.",
      "Cool fully before filling with chocolate ganache.",
      "Finish with a smooth buttercream coat and chocolate drip.",
    ],
    estimatedCost: 6200,
    updatedAt: relativeIsoTimestamp(-2, 9),
  }

  const starterOrder: Order = {
    id: "order-starter-1",
    reference: "US-1001",
    customerId: "customer-nadeesha",
    customerName: "Nadeesha Perera",
    isQuickOrder: false,
    status: "Confirmed",
    preparationStatus: "Awaiting preparation",
    paymentStatus: "Part paid",
    collectionDate: relativeIsoDate(0),
    collectionTime: "16:30",
    instructions: "Gold lettering: Happy Birthday Amaya.",
    lines: [
      {
        id: "line-starter-1",
        productId: "product-cake",
        productName: "Chocolate celebration cake",
        variantId: "cake-15kg",
        variantName: "1.5 kg · 10 inch",
        quantity: 1,
        recipeId: starterRecipe.id,
        recipeSnapshot: snapshot(starterRecipe),
      },
    ],
    agreedPrice: 15000,
    costSnapshot: {
      ingredients: 5050,
      packaging: 650,
      labour: 500,
      estimatedTotal: 6200,
      suggestedPrice: 15500,
    },
    reservations: [
      {
        inventoryId: "flour",
        name: "All-purpose flour",
        required: 650,
        availableAtConfirmation: 500,
        reserved: 500,
        shortage: 150,
        unit: "g",
      },
      {
        inventoryId: "sugar",
        name: "Caster sugar",
        required: 520,
        availableAtConfirmation: 1600,
        reserved: 520,
        shortage: 0,
        unit: "g",
      },
      {
        inventoryId: "butter",
        name: "Unsalted butter",
        required: 480,
        availableAtConfirmation: 900,
        reserved: 480,
        shortage: 0,
        unit: "g",
      },
      {
        inventoryId: "cocoa",
        name: "Cocoa powder",
        required: 140,
        availableAtConfirmation: 90,
        reserved: 90,
        shortage: 50,
        unit: "g",
      },
      {
        inventoryId: "cake-box-large",
        name: "Large cake box",
        required: 1,
        availableAtConfirmation: 1,
        reserved: 1,
        shortage: 0,
        unit: "unit",
      },
      {
        inventoryId: "cake-board-12",
        name: "12-inch cake board",
        required: 1,
        availableAtConfirmation: 2,
        reserved: 1,
        shortage: 0,
        unit: "unit",
      },
    ],
    shortages: [
      {
        inventoryId: "flour",
        name: "All-purpose flour",
        required: 650,
        availableAtConfirmation: 500,
        reserved: 500,
        shortage: 150,
        unit: "g",
      },
      {
        inventoryId: "cocoa",
        name: "Cocoa powder",
        required: 140,
        availableAtConfirmation: 90,
        reserved: 90,
        shortage: 50,
        unit: "g",
      },
    ],
    payments: [
      {
        id: "payment-starter-1",
        date: relativeIsoDate(-1),
        amount: 7500,
        method: "Online transaction",
        note: "Deposit",
      },
    ],
    createdAt: relativeIsoTimestamp(-2, 8),
    updatedAt: relativeIsoTimestamp(0, 7),
    confirmedAt: relativeIsoTimestamp(-1, 7),
  }

  return {
    customers: [
      { id: "customer-nadeesha", name: "Nadeesha Perera", phone: "077 234 8190" },
    ],
    products: [
      {
        id: "product-cake",
        name: "Chocolate celebration cake",
        image: "preset:chocolate-cake",
        variants: [
          { id: "cake-15kg", name: "1.5 kg · 10 inch", unitLabel: "cake" },
        ],
      },
    ],
    recipes: [starterRecipe],
    orders: [starterOrder],
    inventory: [
      {
        inventoryId: "flour",
        name: "All-purpose flour",
        image: "preset:flour",
        physical: 500,
        unit: "g",
        category: "ingredient",
        lowStockThreshold: 1000,
        averageUnitCost: 0.32,
      },
      {
        inventoryId: "sugar",
        name: "Caster sugar",
        image: "preset:sugar",
        physical: 1600,
        unit: "g",
        category: "ingredient",
        lowStockThreshold: 750,
        averageUnitCost: 0.4,
      },
      {
        inventoryId: "butter",
        name: "Unsalted butter",
        image: "preset:butter",
        physical: 900,
        unit: "g",
        category: "ingredient",
        lowStockThreshold: 500,
        averageUnitCost: 2.7,
      },
      {
        inventoryId: "cocoa",
        name: "Cocoa powder",
        image: "preset:cocoa",
        physical: 90,
        unit: "g",
        category: "ingredient",
        lowStockThreshold: 250,
        averageUnitCost: 2.1,
      },
      {
        inventoryId: "cake-box-large",
        name: "Large cake box",
        image: "preset:cake-box",
        physical: 1,
        unit: "unit",
        category: "packaging",
        lowStockThreshold: 2,
        averageUnitCost: 350,
      },
      {
        inventoryId: "cake-board-12",
        name: "12-inch cake board",
        image: "preset:cake-board",
        physical: 2,
        unit: "unit",
        category: "packaging",
        lowStockThreshold: 2,
        averageUnitCost: 180,
      },
    ],
    extraStockPlans: [],
    extraStockPreparations: [],
    finishedStockBatches: [],
    finishedStockTransactions: [],
    purchases: [],
    refunds: [],
    expenseCategories: structuredClone(BUILT_IN_EXPENSE_CATEGORIES),
    expenses: [],
    expenseAllocationHistories: [],
    inventoryMovements: [],
    shoppingSelections: {},
    shoppingTrips: [],
    preparationRecords: [],
    settings: structuredClone(defaultSettings),
    budgetPlan: structuredClone(defaultBudgetPlan),
  }
}

export function getInitialAppData(
  mode: StarterMode = resolveStarterMode(import.meta.env.VITE_STARTER_MODE),
): AppData {
  return mode === "empty" ? createEmptyAppData() : createStarterData()
}
