import { BUILT_IN_EXPENSE_CATEGORIES } from "../lib/expenses"
import type { AppData, AppSettings, BudgetPlan } from "../types"

export const defaultBudgetPlan: BudgetPlan = {
  monthlySalesTarget: 150000,
  monthlyProfitTarget: 60000,
  ingredientSpendLimit: 75000,
  categoryLimits: {},
  updatedAt: "2026-01-01T00:00:00.000Z",
}

export const defaultSettings: AppSettings = {
  businessName: "Udeni's Specials",
  ownerName: "Udeni",
  defaultLabourRatePerHour: 600,
  defaultPricingMode: "margin",
  defaultMarginPercent: 45,
  defaultMarkupPercent: 80,
  priceRoundingStep: 50,
  defaultLowStockThreshold: 2,
  backupReminderDismissedAt: null,
  backupReminderSnoozedUntil: null,
  lastBackupAt: null,
}

/**
 * Returns a clean, empty production workspace with built-in expense categories
 * and default bakery settings.
 */
export function createEmptyAppData(): AppData {
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
    shoppingTrips: [],
    preparationRecords: [],
    settings: structuredClone(defaultSettings),
    budgetPlan: structuredClone(defaultBudgetPlan),
  }
}
