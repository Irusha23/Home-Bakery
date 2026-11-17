import type {
  AppData,
  InventoryItem,
  Order,
  OrderLine,
  PreparationRecord,
  RecipeSnapshot,
  StockRequirement,
} from "../types"
import { defaultBudgetPlan, defaultSettings } from "../data/demoData"
import { BUILT_IN_EXPENSE_CATEGORIES } from "../lib/expenses"

export function createTestAppData(overrides: Partial<AppData> = {}): AppData {
  return {
    customers: [],

    products: [],

    recipes: [],

    orders: [],

    inventory: [],

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

    preparationRecords: [],

    settings: structuredClone(defaultSettings),

    budgetPlan: structuredClone(defaultBudgetPlan),

    ...overrides,
  }
}

export function createTestInventoryItem(
  overrides: Partial<InventoryItem> = {},
): InventoryItem {
  return {
    inventoryId: "flour",

    name: "All-purpose flour",

    physical: 5000,

    unit: "g",

    category: "ingredient",

    ...overrides,
  }
}

export function createTestRecipeSnapshot(
  overrides: Partial<RecipeSnapshot> = {},
): RecipeSnapshot {
  return {
    id: "recipe-chocolate",

    name: "Chocolate cake",

    productId: "product-cake",

    variantId: "cake-1kg",

    version: 1,

    yield: 1,

    yieldLabel: "1 cake",

    expectedOutput: null,

    preparationMinutes: 90,

    ingredients: [
      {
        inventoryId: "flour",

        name: "All-purpose flour",

        quantity: 500,

        unit: "g",
      },
    ],

    packaging: [],

    instructions: ["Bake until cooked through."],

    estimatedCost: 2500,

    ...overrides,
  }
}

export function createTestOrderLine(
  id: string,

  recipeSnapshot = createTestRecipeSnapshot(),

  overrides: Partial<OrderLine> = {},
): OrderLine {
  return {
    id,

    productId: recipeSnapshot.productId,

    productName: "Chocolate cake",

    variantId: recipeSnapshot.variantId,

    variantName: "1 kg cake",

    quantity: 1,

    recipeId: recipeSnapshot.id,

    recipeSnapshot,

    ...overrides,
  }
}

export function createTestStockRequirement(
  overrides: Partial<StockRequirement> = {},
): StockRequirement {
  return {
    inventoryId: "flour",

    name: "All-purpose flour",

    required: 500,

    availableAtConfirmation: 500,

    reserved: 500,

    shortage: 0,

    unit: "g",

    ...overrides,
  }
}

export function createTestOrder(
  id: string,

  lines: OrderLine[],

  overrides: Partial<Order> = {},
): Order {
  return {
    id,

    reference: "US-2001",

    customerId: null,

    customerName: "Test customer",

    isQuickOrder: true,

    status: "Draft",

    preparationStatus: "Not started",

    paymentStatus: "Unpaid",

    collectionDate: "2026-10-20",

    collectionTime: "16:00",

    instructions: "",

    lines,

    agreedPrice: 12000,

    costSnapshot: {
      ingredients: 2050,

      packaging: 250,

      labour: 200,

      estimatedTotal: 2500,

      suggestedPrice: 6000,
    },

    reservations: [],

    shortages: [],

    payments: [],

    createdAt: "2026-10-12T08:00:00.000Z",

    updatedAt: "2026-10-12T08:00:00.000Z",

    confirmedAt: null,

    ...overrides,
  }
}

export function createTestPreparationRecord(
  orderId: string,

  line: OrderLine,

  overrides: Partial<PreparationRecord> = {},
): PreparationRecord {
  return {
    id: `preparation-${orderId}-${line.id}`,

    orderId,

    orderLineId: line.id,

    status: "In progress",

    recipeSnapshot: line.recipeSnapshot,

    plannedQuantity: line.quantity,

    actualUsage: [
      {
        inventoryId: "flour",

        name: "All-purpose flour",

        plannedQuantity: 500,

        actualQuantity: 500,

        unit: "g",

        category: "ingredient",
      },
    ],

    completedSteps: [],

    startedAt: "2026-10-12T08:00:00.000Z",

    completedAt: null,

    actualCost: null,

    updatedAt: "2026-10-12T08:00:00.000Z",

    ...overrides,
  }
}
