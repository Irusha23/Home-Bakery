import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  createEmptyAppData,
  defaultBudgetPlan,
  defaultSettings,
} from "../data/defaults"
import { createStarterData, getInitialAppData } from "../data/starterData"
import AppLoader from "../components/ui/AppLoader"
import PersistenceRecoveryScreen from "../components/PersistenceRecoveryScreen"
import { createDefaultAppRepository } from "../db/createAppRepository"
import { bootstrapAppRepository } from "../db/legacyImport"
import type { AppRepository } from "../db/repository"
import { createId } from "../lib/id"
import {
  getUsageToBuyQuantity,
  hasUnpurchasedShoppingItems,
  inventoryCategory,
  isUsageInPantry,
  selectReservedByItem,
  toInventoryBaseQuantity,
} from "../lib/inventory"
import { estimateRecipeMaterialCost } from "../lib/pricing"
import { calculateCostSnapshot, calculateLineRequirements } from "../lib/orders"
import { canCancelOrder, canCollectOrder } from "../lib/orderLifecycle"
import {
  derivePaymentStatus,
  isValidMoneyAmount,
  netRetainedPayments,
  outstandingOrderBalance,
  remainingRefundableAmount,
} from "../lib/financials"
import {
  BUILT_IN_EXPENSE_CATEGORIES,
  appendAllocationVersion,
  validateAllocationHistory,
  validateExpense,
  validateExpenseCategory,
  validateNewAllocationVersion,
} from "../lib/expenses"
import {
  calculateActualUsageCost,
  createPreparationRecord,
  createPlannedUsageForQuantity,
  validateExtraStockPreparationCompletion,
  validatePreparationCompletion,
} from "../lib/preparation"
import type {
  AppData,
  AppSettings,
  BudgetPlan,
  Customer,
  Expense,
  ExpenseAllocationHistory,
  ExpenseAllocationVersion,
  ExpenseCategory,
  ExtraStockPreparationRecord,
  ExtraStockPlan,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  Order,
  OrderDraftInput,
  PreparationRecord,
  PreparationUsage,
  Product,
  PurchaseRecord,
  Refund,
  Recipe,
  RecipeSnapshot,
  ShoppingTripRecord,
} from "../types"
import {
  errorMessage,
  persistAppData,
  readPersistedState,
  restoreBackup,
  startFreshPreservingRaw,
  type PersistenceBootstrap,
  type PersistenceReady,
  type RecoverySource,
  type RestoreResult,
} from "./persistence"

type AppAction =
  | { type: "UPSERT_DRAFT"; payload: OrderDraftInput }
  | { type: "CONFIRM_ORDER"; orderId: string }
  | { type: "CANCEL_ORDER"; orderId: string }
  | { type: "COLLECT_ORDER"; orderId: string }
  | { type: "REPEAT_ORDER"; orderId: string; newOrderId: string }
  | {
      type: "RECORD_PAYMENT"
      orderId: string
      orderReference: string
      payment: Order["payments"][number]
    }
  | { type: "RECORD_REFUND"; refund: Refund }
  | { type: "SET_CANCELLATION_FEE"; orderId: string; fee: number }
  | { type: "RECORD_EXPENSE"; expense: Expense }
  | { type: "ADD_EXPENSE_CATEGORY"; category: ExpenseCategory }
  | {
      type: "ALLOCATE_SHARED_EXPENSE"
      version: ExpenseAllocationVersion
    }
  | { type: "ADD_CUSTOMER"; customer: Customer }
  | { type: "ADD_RECIPE"; recipe: Recipe }
  | { type: "UPDATE_RECIPE"; recipe: Recipe }
  | {
      type: "SET_VARIANT_FINISHED_INVENTORY"
      productId: string
      variantId: string
      inventoryId: string | null
    }
  | { type: "CLEAR_WORKSPACE" }
  | { type: "LOAD_STARTER_SAMPLE" }
  | { type: "RESTORE_DATA"; data: AppData }
  | { type: "UPSERT_EXTRA_STOCK_PLAN"; plan: ExtraStockPlan }
  | { type: "REMOVE_EXTRA_STOCK_PLAN"; planId: string }
  | {
      type: "START_EXTRA_STOCK_PREPARATION"
      planId: string
      preparationId: string
    }
  | {
      type: "COMPLETE_EXTRA_STOCK_PREPARATION"
      preparationId: string
      actualUsage: PreparationUsage[]
      usableOutputQuantity: number
    }
  | {
      type: "SELL_FINISHED_STOCK"
      transactionId: string
      batchId: string
      quantity: number
      sellingPrice?: number
      customerId?: string | null
      customerName?: string
      paymentMethod?: string
    }
  | {
      type: "WRITE_OFF_FINISHED_STOCK"
      transactionId: string
      batchId: string
      quantity: number
      reason: string
    }
  | {
      type: "RECONCILE_LEGACY_FINISHED_STOCK"
      batchId: string
      inventoryId: string
      quantity: number
      unitCost: number
      reason: string
    }
  | {
      type: "SET_PURCHASE_QUANTITY"
      inventoryId: string
      quantity: number
    }
  | { type: "RECORD_PURCHASE"; purchase: PurchaseRecord }
  | {
      type: "ADJUST_INVENTORY"
      adjustment: {
        id: string
        inventoryId: string
        type: Exclude<
          InventoryMovementType,
          | "Opening balance"
          | "Purchase"
          | "Preparation consumption"
          | "Production"
          | "Finished stock sale"
          | "Finished stock write-off"
        >
        quantityDelta: number
        date: string
        reason: string
      }
    }
  | { type: "START_PREPARATION"; preparationId: string }
  | {
      type: "TOGGLE_PREPARATION_STEP"
      preparationId: string
      stepIndex: number
    }
  | {
      type: "UPDATE_PREPARATION_USAGE"
      preparationId: string
      inventoryId: string
      quantity: number
    }
  | { type: "COMPLETE_PREPARATION"; preparationId: string }
  | { type: "UPDATE_SETTINGS"; patch: Partial<AppSettings> }
  | { type: "RECORD_BACKUP_EXPORT"; exportedAt: string }
  | { type: "UPDATE_CUSTOMER"; customer: Customer }
  | { type: "ADD_PRODUCT"; product: Product }
  | { type: "UPDATE_PRODUCT"; product: Product }
  | { type: "ARCHIVE_PRODUCT"; productId: string; archived: boolean }
  | { type: "ADD_INVENTORY_ITEM"; item: InventoryItem }
  | {
      type: "UPDATE_INVENTORY_ITEM"
      inventoryId: string
      patch: {
        name?: string
        image?: string | null
        lowStockThreshold?: number
        averageUnitCost?: number
        archived?: boolean
      }
    }
  | { type: "ARCHIVE_RECIPE"; recipeId: string; archived: boolean }
  | { type: "UPDATE_BUDGET_PLAN"; budgetPlan: Partial<BudgetPlan> }
  | {
      type: "SET_PANTRY_CHECKLIST_ITEM"
      preparationId: string
      inventoryId: string
      inPantry: boolean
      toBuyQuantity?: number
    }
  | {
      type: "MARK_ALL_PANTRY_CHECKLIST"
      preparationId: string
      inPantry: boolean
    }
  | {
      type: "UPDATE_SHOPPING_CHECKLIST_ITEM"
      inventoryId: string
      checked: boolean
      boughtQuantity?: number
    }
  | {
      type: "COMPLETE_SHOPPING_CHECKLIST"
      extraInventoryIds?: string[]
    }
  | {
      type: "ADD_SHOPPING_TRIP"
      trip: ShoppingTripRecord
    }
  | {
      type: "REMOVE_MANUAL_SHOPPING_ITEM"
      inventoryId: string
    }
  | {
      type: "FINISH_PREPARATION_SIMPLE"
      preparationId: string
    }

type AppStateValue = {
  state: AppData
  dispatch: React.Dispatch<AppAction>
  dispatchIfAccepted: (action: AppAction) => boolean
  restoreBackupFromRaw: (raw: string, source?: RecoverySource) => RestoreResult
  persistenceError: string | null
  retryPersistence: () => void
}

const ADJUSTMENT_MOVEMENT_TYPES = new Set<InventoryMovementType>([
  "Correction",
  "Spoilage",
  "Damage",
  "Other",
])
type AdjustmentMovementType = Extract<InventoryMovementType, "Correction" | "Spoilage" | "Damage" | "Other">

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

function isValidTimestamp(value: string) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    isValidDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  )
}

const AppStateContext = createContext<AppStateValue | null>(null)

function cloneStarterData(): AppData {
  return migrateState(createStarterData())
}

function cloneEmptyData(): AppData {
  return migrateState(createEmptyAppData())
}

function scopeRequirementsToLines(
  order: Order,
  requirements: Order["reservations"],
) {
  return requirements.flatMap((requirement) => {
    if (requirement.lineId) return [requirement]
    let remainingReserved = requirement.reserved
    let remainingShortage = requirement.shortage
    const candidates = order.lines.flatMap((line) => {
      const recipeRequirement = [
        ...line.recipeSnapshot.ingredients,
        ...line.recipeSnapshot.packaging,
      ].find((item) => item.inventoryId === requirement.inventoryId)
      return recipeRequirement
        ? [
            {
              lineId: line.id,
              required: recipeRequirement.quantity * line.quantity,
            },
          ]
        : []
    })
    if (!candidates.length)
      return [{ ...requirement, lineId: order.lines[0]?.id }]
    return candidates.map((candidate) => {
      const reserved = Math.min(remainingReserved, candidate.required)
      remainingReserved -= reserved
      const shortage = Math.min(
        remainingShortage,
        candidate.required - reserved,
      )
      remainingShortage -= shortage
      return {
        ...requirement,
        lineId: candidate.lineId,
        required: candidate.required,
        reserved,
        shortage,
      }
    })
  })
}

function normalizeRecipeSnapshot(snapshot: RecipeSnapshot): RecipeSnapshot {
  return {
    ...snapshot,
    expectedOutput: snapshot.expectedOutput ?? null,
  }
}

function normalizeBudgetPlan(raw?: Partial<BudgetPlan> | null): BudgetPlan {
  const base = structuredClone(defaultBudgetPlan)
  if (!raw || typeof raw !== "object") return base
  const categoryLimits: Record<string, number> = {}
  if (raw.categoryLimits && typeof raw.categoryLimits === "object") {
    for (const [key, value] of Object.entries(raw.categoryLimits)) {
      if (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0
      ) {
        categoryLimits[key] = value
      }
    }
  }
  return {
    monthlySalesTarget:
      raw.monthlySalesTarget === undefined
        ? base.monthlySalesTarget
        : Number.isSafeInteger(raw.monthlySalesTarget) &&
            raw.monthlySalesTarget >= 0
          ? raw.monthlySalesTarget
          : undefined,
    monthlyProfitTarget:
      raw.monthlyProfitTarget === undefined
        ? base.monthlyProfitTarget
        : Number.isSafeInteger(raw.monthlyProfitTarget) &&
            raw.monthlyProfitTarget >= 0
          ? raw.monthlyProfitTarget
          : undefined,
    ingredientSpendLimit:
      raw.ingredientSpendLimit === undefined
        ? base.ingredientSpendLimit
        : Number.isSafeInteger(raw.ingredientSpendLimit) &&
            raw.ingredientSpendLimit >= 0
          ? raw.ingredientSpendLimit
          : undefined,
    categoryLimits,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt.trim()
        ? raw.updatedAt
        : base.updatedAt,
  }
}

function normalizeSettings(raw?: Partial<AppSettings> | null): AppSettings {
  const base = structuredClone(defaultSettings)
  if (!raw || typeof raw !== "object") return base
  return {
    businessName:
      typeof raw.businessName === "string" && raw.businessName.trim()
        ? raw.businessName.trim()
        : base.businessName,
    ownerName:
      typeof raw.ownerName === "string" ? raw.ownerName.trim() : base.ownerName,
    defaultLabourRatePerHour:
      typeof raw.defaultLabourRatePerHour === "number" &&
      Number.isFinite(raw.defaultLabourRatePerHour) &&
      raw.defaultLabourRatePerHour >= 0
        ? Math.round(raw.defaultLabourRatePerHour)
        : base.defaultLabourRatePerHour,
    defaultPricingMode:
      raw.defaultPricingMode === "margin" || raw.defaultPricingMode === "markup"
        ? raw.defaultPricingMode
        : base.defaultPricingMode,
    defaultMarginPercent:
      typeof raw.defaultMarginPercent === "number" &&
      Number.isFinite(raw.defaultMarginPercent) &&
      raw.defaultMarginPercent >= 0 &&
      raw.defaultMarginPercent < 100
        ? raw.defaultMarginPercent
        : base.defaultMarginPercent,
    defaultMarkupPercent:
      typeof raw.defaultMarkupPercent === "number" &&
      Number.isFinite(raw.defaultMarkupPercent) &&
      raw.defaultMarkupPercent >= 0
        ? raw.defaultMarkupPercent
        : base.defaultMarkupPercent,
    priceRoundingStep:
      raw.priceRoundingStep === 1 ||
      raw.priceRoundingStep === 50 ||
      raw.priceRoundingStep === 100
        ? raw.priceRoundingStep
        : base.priceRoundingStep,
    defaultLowStockThreshold:
      typeof raw.defaultLowStockThreshold === "number" &&
      Number.isFinite(raw.defaultLowStockThreshold) &&
      raw.defaultLowStockThreshold >= 0
        ? raw.defaultLowStockThreshold
        : base.defaultLowStockThreshold,
    backupReminderDismissedAt:
      typeof raw.backupReminderDismissedAt === "string" &&
      isValidTimestamp(raw.backupReminderDismissedAt)
        ? raw.backupReminderDismissedAt
        : null,
    backupReminderSnoozedUntil:
      typeof raw.backupReminderSnoozedUntil === "string" &&
      isValidTimestamp(raw.backupReminderSnoozedUntil)
        ? raw.backupReminderSnoozedUntil
        : null,
    lastBackupAt:
      typeof raw.lastBackupAt === "string" && isValidTimestamp(raw.lastBackupAt)
        ? raw.lastBackupAt
        : null,
  }
}

export function migrateState(source: AppData): AppData {
  const defaults = createEmptyAppData()
  const sourceInventory = Array.isArray(source.inventory)
    ? source.inventory
    : []
  const inventory = sourceInventory.map((item) =>
    item.category === "finished" && item.unbatchedLegacyQuantity === undefined
      ? { ...item, unbatchedLegacyQuantity: item.physical }
      : item,
  )

  const recipes = (source.recipes ?? defaults.recipes).map((recipe) => ({
    ...recipe,
    expectedOutput: recipe.expectedOutput ?? null,
  }))
  const existingMovements = Array.isArray(source.inventoryMovements)
    ? source.inventoryMovements
    : []
  const inventoryMovements = existingMovements.length
    ? existingMovements
    : inventory.map((item) => ({
        id: `movement-opening-${item.inventoryId}`,
        inventoryId: item.inventoryId,
        type: "Opening balance" as const,
        quantityDelta: item.physical,
        unit: item.unit,
        balanceAfter: item.physical,
        date: "2025-04-01",
        reason: "Opening balance",
        createdAt: "2025-04-01T08:00:00.000Z",
      }))

  const stateForPreparation = {
    ...defaults,
    ...source,
    inventory,
  }
  const refunds = Array.isArray(source.refunds) ? source.refunds : []
  const orders = (source.orders ?? defaults.orders).map((order) => {
    const normalizedOrder = {
      ...order,
      payments: Array.isArray(order.payments) ? order.payments : [],
      collectedAt: order.collectedAt ?? null,
      lines: order.lines.map((line) => ({
        ...line,
        recipeSnapshot: normalizeRecipeSnapshot(line.recipeSnapshot),
      })),
      reservations: scopeRequirementsToLines(order, order.reservations),
      shortages: scopeRequirementsToLines(order, order.shortages),
    }
    return {
      ...normalizedOrder,
      paymentStatus: derivePaymentStatus(normalizedOrder, refunds),
    }
  })
  const preparationRecords = Array.isArray(source.preparationRecords)
    ? source.preparationRecords.map((record) => ({
        ...record,
        recipeSnapshot: normalizeRecipeSnapshot(record.recipeSnapshot),
      }))
    : []
  for (const order of orders) {
    if (order.status === "Draft" || order.status === "Cancelled") continue
    order.lines.forEach((line, index) => {
      if (
        preparationRecords.some(
          (record) =>
            record.orderId === order.id && record.orderLineId === line.id,
        )
      )
        return
      const status: PreparationRecord["status"] =
        order.preparationStatus === "Ready" ||
        order.preparationStatus === "Completed"
          ? "Ready"
          : order.preparationStatus === "In progress" && index === 0
            ? "In progress"
            : "Awaiting preparation"
      preparationRecords.push(
        createPreparationRecord(
          stateForPreparation,
          order.id,
          line,
          status,
          order.updatedAt,
        ),
      )
    })
  }

  return {
    ...defaults,
    ...source,
    orders,
    recipes,
    inventory,
    extraStockPlans: Array.isArray(source.extraStockPlans)
      ? source.extraStockPlans.map((plan) => ({
          ...plan,
          recipeSnapshot: normalizeRecipeSnapshot(plan.recipeSnapshot),
        }))
      : [],
    extraStockPreparations: Array.isArray(source.extraStockPreparations)
      ? source.extraStockPreparations.map((record) => ({
          ...record,
          recipeSnapshot: normalizeRecipeSnapshot(record.recipeSnapshot),
          actualCost: record.actualCost ?? null,
        }))
      : [],
    finishedStockBatches: Array.isArray(source.finishedStockBatches)
      ? source.finishedStockBatches
      : [],
    finishedStockTransactions: Array.isArray(source.finishedStockTransactions)
      ? source.finishedStockTransactions
      : [],
    purchases: Array.isArray(source.purchases) ? source.purchases : [],
    refunds,
    expenseCategories:
      source.expenseCategories === undefined
        ? defaults.expenseCategories
        : source.expenseCategories,
    expenses: source.expenses === undefined ? [] : source.expenses,
    expenseAllocationHistories:
      source.expenseAllocationHistories === undefined
        ? []
        : source.expenseAllocationHistories,
    inventoryMovements,
    shoppingSelections:
      source.shoppingSelections && typeof source.shoppingSelections === "object"
        ? source.shoppingSelections
        : {},
    preparationRecords,
    settings: normalizeSettings(source.settings),
    budgetPlan: normalizeBudgetPlan(source.budgetPlan),
  }
}

export function makeReference(orders: Order[]) {
  const highest = orders.reduce((max, order) => {
    const number = Number(order.reference.replace(/\D/g, ""))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 1000)
  return `US-${highest + 1}`
}

export function makeShoppingReference(trips: ShoppingTripRecord[]) {
  const highest = trips.reduce((max, trip) => {
    const number = Number(trip.reference.replace(/\D/g, ""))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 1000)
  return `SHP-${highest + 1}`
}

function makeUniqueId(prefix: string, existingIds: Set<string>) {
  let id: string
  do {
    id = createId(prefix)
  } while (existingIds.has(id))
  existingIds.add(id)
  return id
}

export function snapshotRecipe(recipe: Recipe): RecipeSnapshot {
  const {
    updatedAt: _updatedAt,
    archived: _archived,
    notes: _notes,
    history: _history,
    ...snapshot
  } = structuredClone(recipe)
  return snapshot
}

function isValidExpectedOutput(
  value: unknown,
): value is { quantity: number; unit: "unit" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "quantity" in value &&
    "unit" in value &&
    typeof value.quantity === "number" &&
    Number.isSafeInteger(value.quantity) &&
    value.quantity > 0 &&
    value.unit === "unit"
  )
}

function applyFinishedStockTransaction(
  state: AppData,
  transaction: {
    id: string
    type: "sale" | "write-off"
    batchId: string
    quantity: number
    reason?: string
    sellingPrice?: number
    customerId?: string | null
    customerName?: string
    paymentMethod?: string
  },
): AppData {
  if (
    !transaction.id ||
    !Number.isSafeInteger(transaction.quantity) ||
    transaction.quantity <= 0 ||
    state.finishedStockTransactions.some(
      (item) => item.id === transaction.id,
    ) ||
    (transaction.type === "write-off" && !transaction.reason?.trim()) ||
    (transaction.type === "sale" &&
      transaction.sellingPrice !== undefined &&
      (!Number.isSafeInteger(transaction.sellingPrice) ||
        transaction.sellingPrice < 0))
  ) {
    return state
  }
  const writeOffReason = transaction.reason?.trim() ?? ""

  const batch = state.finishedStockBatches.find(
    (item) => item.id === transaction.batchId,
  )
  if (!batch) return state
  const inventoryItem = state.inventory.find(
    (item) => item.inventoryId === batch.inventoryId,
  )
  let productionLinksValid = true
  if (batch.source === "production") {
    const product = state.products.find((item) => item.id === batch.productId)
    const variant = product?.variants.find(
      (item) => item.id === batch.variantId,
    )
    const preparation = state.extraStockPreparations.find(
      (item) => item.id === batch.preparationId,
    )
    productionLinksValid = Boolean(
      variant &&
        variant.finishedInventoryId === batch.inventoryId &&
        preparation?.status === "Ready" &&
        preparation.planId === batch.planId &&
        preparation.productId === batch.productId &&
        preparation.variantId === batch.variantId &&
        preparation.finishedInventoryId === batch.inventoryId,
    )
  }
  const batchUnitCost =
    batch.source === "production" ? batch.actualUnitCost : batch.unitCost
  if (
    !inventoryItem ||
    inventoryItem.category !== "finished" ||
    inventoryItem.unit !== "unit" ||
    !productionLinksValid ||
    !Number.isSafeInteger(batch.remainingQuantity) ||
    batch.remainingQuantity < transaction.quantity ||
    !Number.isSafeInteger(inventoryItem.physical) ||
    inventoryItem.physical < transaction.quantity ||
    (batch.source === "production" &&
      (!Number.isSafeInteger(batch.producedQuantity) ||
        batch.producedQuantity <= 0 ||
        batch.remainingQuantity > batch.producedQuantity ||
        !Number.isFinite(batch.actualTotalCost) ||
        batch.actualTotalCost < 0)) ||
    (batch.source === "legacy-opening" &&
      (!Number.isSafeInteger(batch.reconciledQuantity) ||
        batch.reconciledQuantity <= 0 ||
        batch.remainingQuantity > batch.reconciledQuantity ||
        !batch.reconciliationReason.trim())) ||
    !Number.isFinite(batchUnitCost) ||
    batchUnitCost < 0
  ) {
    return state
  }

  const inventoryBatches = state.finishedStockBatches.filter(
    (item) => item.inventoryId === batch.inventoryId,
  )
  const batchedQuantity = inventoryBatches.reduce(
    (sum, item) => sum + item.remainingQuantity,
    0,
  )
  const unbatchedLegacyQuantity =
    inventoryItem.unbatchedLegacyQuantity ??
    inventoryItem.physical - batchedQuantity
  if (
    !Number.isSafeInteger(batchedQuantity) ||
    !Number.isSafeInteger(unbatchedLegacyQuantity) ||
    unbatchedLegacyQuantity < 0 ||
    inventoryBatches.some(
      (item) =>
        !Number.isSafeInteger(item.remainingQuantity) ||
        item.remainingQuantity < 0,
    ) ||
    inventoryItem.physical !== unbatchedLegacyQuantity + batchedQuantity
  ) {
    return state
  }

  const totalCost = transaction.quantity * batchUnitCost
  const balanceAfter = inventoryItem.physical - transaction.quantity
  if (!Number.isFinite(totalCost) || !Number.isSafeInteger(balanceAfter)) {
    return state
  }
  const movementId = `movement-finished-${transaction.type}-${transaction.id}`
  if (state.inventoryMovements.some((item) => item.id === movementId)) {
    return state
  }

  const occurredAt = new Date().toISOString()
  const reason =
    transaction.type === "sale"
      ? `Finished stock sale · batch ${batch.id}`
      : writeOffReason
  const resolvedCustomer =
    transaction.type === "sale" && transaction.customerId
      ? state.customers.find((c) => c.id === transaction.customerId)
      : undefined
  const history =
    transaction.type === "sale"
      ? {
          id: transaction.id,
          type: "sale" as const,
          batchId: batch.id,
          inventoryId: batch.inventoryId,
          quantity: transaction.quantity,
          occurredAt,
          unitCost: batchUnitCost,
          totalCost,
          ...(transaction.sellingPrice !== undefined
            ? { sellingPrice: transaction.sellingPrice }
            : {}),
          ...(resolvedCustomer
            ? {
                customerId: resolvedCustomer.id,
                customerName: resolvedCustomer.name,
              }
            : transaction.customerName?.trim()
              ? {
                  customerId: null,
                  customerName: transaction.customerName.trim(),
                }
              : {}),
          ...(transaction.paymentMethod?.trim()
            ? { paymentMethod: transaction.paymentMethod.trim() }
            : {}),
        }
      : {
          id: transaction.id,
          type: "write-off" as const,
          batchId: batch.id,
          inventoryId: batch.inventoryId,
          quantity: transaction.quantity,
          occurredAt,
          reason,
          unitCost: batchUnitCost,
          totalCost,
        }

  return {
    ...state,
    inventory: state.inventory.map((item) =>
      item.inventoryId === inventoryItem.inventoryId
        ? { ...item, physical: balanceAfter, unbatchedLegacyQuantity }
        : item,
    ),
    finishedStockBatches: state.finishedStockBatches.map((item) =>
      item.id === batch.id
        ? {
            ...item,
            remainingQuantity: item.remainingQuantity - transaction.quantity,
          }
        : item,
    ),
    finishedStockTransactions: [history, ...state.finishedStockTransactions],
    inventoryMovements: [
      {
        id: movementId,
        inventoryId: batch.inventoryId,
        type:
          transaction.type === "sale"
            ? "Finished stock sale"
            : "Finished stock write-off",
        quantityDelta: -transaction.quantity,
        unit: "unit",
        balanceAfter,
        date: occurredAt.slice(0, 10),
        reason,
        createdAt: occurredAt,
      },
      ...state.inventoryMovements,
    ],
  }
}

export function reducer(state: AppData, action: AppAction): AppData {
  switch (action.type) {
    case "UPSERT_DRAFT": {
      const now = new Date().toISOString()
      const existing = action.payload.id
        ? state.orders.find((order) => order.id === action.payload.id)
        : undefined
      if (existing && existing.status !== "Draft") return state

      const order: Order = {
        ...action.payload,
        id: existing?.id ?? action.payload.id ?? createId("order"),
        reference: existing?.reference ?? makeReference(state.orders),
        status: "Draft",
        preparationStatus: "Not started",
        paymentStatus: "Unpaid",
        reservations: [],
        shortages: [],
        payments: existing?.payments ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        confirmedAt: null,
        collectedAt: null,
      }
      if (existing && outstandingOrderBalance(order, state.refunds) < 0) {
        return state
      }
      order.paymentStatus = derivePaymentStatus(order, state.refunds)

      return {
        ...state,
        orders: existing
          ? state.orders.map((item) => (item.id === order.id ? order : item))
          : [order, ...state.orders],
      }
    }

    case "CONFIRM_ORDER": {
      const order = state.orders.find((item) => item.id === action.orderId)
      if (!order || order.status !== "Draft") return state

      const requirements = calculateLineRequirements(
        state,
        order.lines,
        order.id,
      )
      if (
        requirements.some(
          (item) =>
            !Number.isFinite(item.required) ||
            !Number.isFinite(item.availableAtConfirmation) ||
            !Number.isFinite(item.reserved) ||
            !Number.isFinite(item.shortage),
        )
      ) {
        return state
      }
      const confirmedAt = new Date().toISOString()
      const confirmedOrder: Order = {
        ...order,
        status: "Confirmed",
        preparationStatus: "Awaiting preparation",
        reservations: requirements,
        shortages: requirements.filter((item) => item.shortage > 0),
        confirmedAt,
        updatedAt: confirmedAt,
        lines: order.lines.map((line) => ({
          ...line,
          recipeSnapshot: structuredClone(line.recipeSnapshot),
        })),
        costSnapshot: structuredClone(order.costSnapshot),
      }

      return {
        ...state,
        orders: state.orders.map((item) =>
          item.id === confirmedOrder.id ? confirmedOrder : item,
        ),
        preparationRecords: [
          ...state.preparationRecords.filter(
            (record) => record.orderId !== confirmedOrder.id,
          ),
          ...confirmedOrder.lines.map((line) =>
            createPreparationRecord(
              state,
              confirmedOrder.id,
              line,
              "Awaiting preparation",
              confirmedAt,
            ),
          ),
        ],
      }
    }

    case "CANCEL_ORDER": {
      const order = state.orders.find((item) => item.id === action.orderId)
      if (!order || !canCancelOrder(state, order)) return state

      const now = new Date().toISOString()
      return {
        ...state,
        orders: state.orders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: "Cancelled",
                preparationStatus: "Cancelled",
                reservations: [],
                shortages: [],
                updatedAt: now,
              }
            : item,
        ),
        preparationRecords: state.preparationRecords.map((record) =>
          record.orderId === order.id
            ? {
                ...record,
                status: "Cancelled",
                updatedAt: now,
              }
            : record,
        ),
      }
    }

    case "COLLECT_ORDER": {
      const order = state.orders.find((item) => item.id === action.orderId)
      if (!order || !canCollectOrder(state, order)) return state

      const now = new Date().toISOString()
      return {
        ...state,
        orders: state.orders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: "Completed",
                preparationStatus: "Completed",
                collectedAt: now,
                reservations: [],
                shortages: [],
                updatedAt: now,
              }
            : item,
        ),
      }
    }

    case "REPEAT_ORDER": {
      const source = state.orders.find((item) => item.id === action.orderId)
      if (
        !source ||
        source.status === "Draft" ||
        source.lines.length === 0 ||
        typeof action.newOrderId !== "string" ||
        !action.newOrderId.trim() ||
        state.orders.some((item) => item.id === action.newOrderId)
      ) {
        return state
      }

      const now = new Date().toISOString()
      const existingLineIds = new Set(
        state.orders.flatMap((item) => item.lines.map((line) => line.id)),
      )
      const lines = source.lines.map((line) => {
        const currentRecipe = state.recipes.find(
          (recipe) =>
            recipe.productId === line.productId &&
            recipe.variantId === line.variantId,
        )
        return {
          ...line,
          id: makeUniqueId("line", existingLineIds),
          recipeId: currentRecipe?.id ?? line.recipeId,
          recipeSnapshot: currentRecipe
            ? snapshotRecipe(currentRecipe)
            : structuredClone(line.recipeSnapshot),
        }
      })
      const costSnapshot = calculateCostSnapshot(lines)
      const order: Order = {
        ...source,
        id: action.newOrderId,
        reference: makeReference(state.orders),
        status: "Draft",
        preparationStatus: "Not started",
        paymentStatus: "Unpaid",
        collectionDate: "",
        collectionTime: "",
        lines,
        agreedPrice: costSnapshot.suggestedPrice,
        costSnapshot,
        collectedAt: null,
        reservations: [],
        shortages: [],
        payments: [],
        createdAt: now,
        updatedAt: now,
        confirmedAt: null,
      }
      return {
        ...state,
        orders: [order, ...state.orders],
      }
    }

    case "RECORD_PAYMENT": {
      const order = state.orders.find(
        (item) =>
          item.id === action.orderId &&
          item.reference === action.orderReference,
      )
      const outstandingBalance = order
        ? outstandingOrderBalance(order, state.refunds)
        : Number.NaN
      if (
        !order ||
        order.status === "Cancelled" ||
        state.orders.filter((item) => item.reference === action.orderReference)
          .length !== 1 ||
        !action.payment ||
        typeof action.payment.id !== "string" ||
        !action.payment.id.trim() ||
        !isValidDate(action.payment.date) ||
        typeof action.payment.method !== "string" ||
        !action.payment.method.trim() ||
        (action.payment.note !== undefined &&
          typeof action.payment.note !== "string") ||
        !isValidMoneyAmount(action.payment.amount) ||
        state.orders.some((item) =>
          item.payments.some((payment) => payment.id === action.payment.id),
        ) ||
        !Number.isSafeInteger(order.agreedPrice) ||
        order.agreedPrice <= 0 ||
        !Number.isSafeInteger(outstandingBalance) ||
        action.payment.amount > outstandingBalance
      ) {
        return state
      }

      const updatedOrder = {
        ...order,
        payments: [...order.payments, structuredClone(action.payment)],
        paymentStatus: derivePaymentStatus(
          {
            ...order,
            payments: [...order.payments, action.payment],
          },
          state.refunds,
        ),
        updatedAt: new Date().toISOString(),
      }
      return {
        ...state,
        orders: state.orders.map((item) =>
          item.id === order.id ? updatedOrder : item,
        ),
      }
    }

    case "RECORD_REFUND": {
      const refund = action.refund
      const order = state.orders.find((item) => item.id === refund?.orderId)
      const payment = order?.payments.find(
        (item) => item.id === refund?.paymentId,
      )
      const refundableAmount =
        order && payment
          ? remainingRefundableAmount(order, state.refunds, payment.id)
          : Number.NaN
      if (
        !refund ||
        !order ||
        !payment ||
        typeof refund.id !== "string" ||
        !refund.id.trim() ||
        state.refunds.some((item) => item.id === refund.id) ||
        !isValidDate(refund.date) ||
        !isValidMoneyAmount(refund.amount) ||
        typeof refund.reason !== "string" ||
        !refund.reason.trim() ||
        !Number.isSafeInteger(refundableAmount) ||
        refund.amount > refundableAmount
      ) {
        return state
      }

      const refunds = [...state.refunds, structuredClone(refund)]
      return {
        ...state,
        refunds,
        orders: state.orders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                paymentStatus: derivePaymentStatus(item, refunds),
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      }
    }

    case "SET_CANCELLATION_FEE": {
      const order = state.orders.find((item) => item.id === action.orderId)
      const retained = order
        ? netRetainedPayments(order, state.refunds)
        : Number.NaN
      if (
        !order ||
        order.status !== "Cancelled" ||
        !Number.isSafeInteger(action.fee) ||
        action.fee < 0 ||
        !Number.isSafeInteger(retained) ||
        action.fee > retained
      ) {
        return state
      }
      return {
        ...state,
        orders: state.orders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                cancellationFee: action.fee,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      }
    }

    case "RECORD_EXPENSE": {
      const expense = action.expense
      if (
        !expense ||
        typeof expense !== "object" ||
        !expense.attribution ||
        typeof expense.attribution !== "object" ||
        (expense.attribution.type === "direct" &&
          typeof expense.attribution.orderId !== "string") ||
        (expense.attribution.type !== "direct" &&
          expense.attribution.type !== "shared") ||
        state.expenses.some((item) => item.id === expense.id) ||
        !validateExpense(expense, state.expenseCategories, state.orders).valid
      ) {
        return state
      }
      return {
        ...state,
        expenses: [...state.expenses, structuredClone(expense)],
      }
    }

    case "ADD_EXPENSE_CATEGORY": {
      const category = action.category
      const builtInIds = new Set(
        BUILT_IN_EXPENSE_CATEGORIES.map((item) => item.id),
      )
      if (
        !category ||
        !validateExpenseCategory(category).valid ||
        category.source !== "custom" ||
        builtInIds.has(category.id) ||
        state.expenseCategories.some(
          (item) =>
            item.id === category.id ||
            item.name.trim().toLocaleLowerCase() ===
              category.name.trim().toLocaleLowerCase(),
        )
      ) {
        return state
      }
      return {
        ...state,
        expenseCategories: [
          ...state.expenseCategories,
          structuredClone(category),
        ],
      }
    }

    case "ALLOCATE_SHARED_EXPENSE": {
      const version = action.version
      if (
        !version ||
        typeof version !== "object" ||
        typeof version.id !== "string" ||
        typeof version.expenseId !== "string" ||
        !Array.isArray(version.allocations) ||
        version.allocations.some(
          (allocation) =>
            !allocation ||
            typeof allocation.id !== "string" ||
            typeof allocation.orderId !== "string",
        )
      ) {
        return state
      }
      const expense = state.expenses.find(
        (item) => item.id === version.expenseId,
      )
      const matchingHistories = state.expenseAllocationHistories.filter(
        (item) => item.expenseId === version.expenseId,
      )
      if (
        !expense ||
        matchingHistories.length > 1 ||
        !validateExpense(expense, state.expenseCategories, state.orders).valid
      ) {
        return state
      }

      const history = matchingHistories[0]
      const previousVersions = history ? [...history.versions] : []
      if (
        !validateAllocationHistory(expense, previousVersions, state.orders)
          .valid
      ) {
        return state
      }
      const existingVersionIds = new Set(
        state.expenseAllocationHistories.flatMap((item) =>
          item.versions.map((existing) => existing.id),
        ),
      )
      const existingEntryIds = new Set(
        state.expenseAllocationHistories.flatMap((item) =>
          item.versions.flatMap((existing) =>
            existing.allocations.map((allocation) => allocation.id),
          ),
        ),
      )
      if (
        existingVersionIds.has(version.id) ||
        version.allocations.some((allocation) =>
          existingEntryIds.has(allocation.id),
        )
      ) {
        return state
      }

      const newVersion = structuredClone(version)
      const appended = appendAllocationVersion(
        expense,
        previousVersions,
        newVersion,
        state.orders,
      )
      if (!appended.valid) return state
      const nextHistory: ExpenseAllocationHistory = {
        expenseId: expense.id,
        versions: appended.versions,
      }
      return {
        ...state,
        expenseAllocationHistories: history
          ? state.expenseAllocationHistories.map((item) =>
              item === history ? nextHistory : item,
            )
          : [...state.expenseAllocationHistories, nextHistory],
      }
    }

    case "ADD_CUSTOMER":
      if (
        !action.customer.id.trim() ||
        !action.customer.name.trim() ||
        state.customers.some((item) => item.id === action.customer.id)
      ) {
        return state
      }
      return { ...state, customers: [...state.customers, action.customer] }

    case "UPDATE_CUSTOMER":
      if (!action.customer.name.trim()) return state
      if (!state.customers.some((item) => item.id === action.customer.id)) {
        return state
      }
      return {
        ...state,
        customers: state.customers.map((item) =>
          item.id === action.customer.id
            ? {
                ...item,
                name: action.customer.name.trim(),
                phone: action.customer.phone.trim(),
              }
            : item,
        ),
      }

    case "ADD_PRODUCT": {
      const p = action.product
      if (
        !p.id.trim() ||
        !p.name.trim() ||
        !p.variants.length ||
        state.products.some((item) => item.id === p.id) ||
        p.variants.some(
          (v) => !v.id.trim() || !v.name.trim() || !v.unitLabel.trim(),
        )
      ) {
        return state
      }
      return { ...state, products: [...state.products, structuredClone(p)] }
    }

    case "UPDATE_PRODUCT": {
      const p = action.product
      if (
        !p.name.trim() ||
        !p.variants.length ||
        !state.products.some((item) => item.id === p.id) ||
        p.variants.some(
          (v) => !v.id.trim() || !v.name.trim() || !v.unitLabel.trim(),
        )
      ) {
        return state
      }
      return {
        ...state,
        products: state.products.map((item) =>
          item.id === p.id ? structuredClone(p) : item,
        ),
      }
    }

    case "ARCHIVE_PRODUCT":
      if (!state.products.some((item) => item.id === action.productId)) {
        return state
      }
      return {
        ...state,
        products: state.products.map((item) =>
          item.id === action.productId
            ? { ...item, archived: action.archived }
            : item,
        ),
      }

    case "ADD_INVENTORY_ITEM": {
      const item = action.item
      if (
        !item.inventoryId.trim() ||
        !item.name.trim() ||
        !["g", "ml", "unit"].includes(item.unit) ||
        !Number.isFinite(item.physical) ||
        item.physical < 0 ||
        (item.lowStockThreshold !== undefined &&
          (!Number.isFinite(item.lowStockThreshold) ||
            item.lowStockThreshold < 0)) ||
        (item.averageUnitCost !== undefined &&
          (!Number.isFinite(item.averageUnitCost) ||
            item.averageUnitCost < 0)) ||
        state.inventory.some(
          (existing) => existing.inventoryId === item.inventoryId,
        )
      ) {
        return state
      }
      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const openingMovement: InventoryMovement[] =
        item.physical > 0
          ? [
              {
                id: makeUniqueId(
                  "movement-open",
                  new Set(state.inventoryMovements.map((m) => m.id)),
                ),
                inventoryId: item.inventoryId,
                type: "Opening balance",
                quantityDelta: item.physical,
                unit: item.unit,
                balanceAfter: item.physical,
                date: today,
                reason: "Initial inventory balance",
                createdAt: now,
              },
            ]
          : []
      return {
        ...state,
        inventory: [...state.inventory, structuredClone(item)],
        inventoryMovements: [...openingMovement, ...state.inventoryMovements],
      }
    }

    case "UPDATE_INVENTORY_ITEM": {
      const target = state.inventory.find(
        (item) => item.inventoryId === action.inventoryId,
      )
      if (!target) return state
      const { patch } = action
      if (
        (patch.name !== undefined && !patch.name.trim()) ||
        (patch.lowStockThreshold !== undefined &&
          (!Number.isFinite(patch.lowStockThreshold) ||
            patch.lowStockThreshold < 0)) ||
        (patch.averageUnitCost !== undefined &&
          (!Number.isFinite(patch.averageUnitCost) ||
            patch.averageUnitCost < 0))
      ) {
        return state
      }
      const nextInventory = state.inventory.map((item) =>
        item.inventoryId === action.inventoryId
          ? {
              ...item,
              ...(patch.name !== undefined
                ? { name: patch.name.trim() }
                : {}),
              ...(patch.image !== undefined
                ? { image: patch.image ?? undefined }
                : {}),
              ...(patch.lowStockThreshold !== undefined
                ? { lowStockThreshold: patch.lowStockThreshold }
                : {}),
              ...(patch.averageUnitCost !== undefined
                ? { averageUnitCost: patch.averageUnitCost }
                : {}),
              ...(patch.archived !== undefined
                ? { archived: patch.archived }
                : {}),
            }
          : item,
      )
      const nextRecipes = state.recipes.map((recipe) => {
        const usesItem =
          recipe.ingredients.some(
            (ing) => ing.inventoryId === action.inventoryId,
          ) ||
          recipe.packaging.some((pkg) => pkg.inventoryId === action.inventoryId)
        if (!usesItem) return recipe
        const updatedIngredients =
          patch.name !== undefined
            ? recipe.ingredients.map((ing) =>
                ing.inventoryId === action.inventoryId
                  ? { ...ing, name: patch.name!.trim() }
                  : ing,
              )
            : recipe.ingredients
        const updatedPackaging =
          patch.name !== undefined
            ? recipe.packaging.map((pkg) =>
                pkg.inventoryId === action.inventoryId
                  ? { ...pkg, name: patch.name!.trim() }
                  : pkg,
              )
            : recipe.packaging
        const breakdown = estimateRecipeMaterialCost(
          {
            ingredients: updatedIngredients,
            packaging: updatedPackaging,
            preparationMinutes: recipe.preparationMinutes,
            estimatedCost: recipe.estimatedCost,
          },
          nextInventory,
          state.settings.defaultLabourRatePerHour,
        )
        return {
          ...recipe,
          ingredients: updatedIngredients,
          packaging: updatedPackaging,
          estimatedCost: breakdown.hasLivePricing
            ? breakdown.totalCost
            : recipe.estimatedCost,
        }
      })
      return {
        ...state,
        inventory: nextInventory,
        recipes: nextRecipes,
      }
    }

    case "ADD_RECIPE":
      if (state.recipes.some((item) => item.id === action.recipe.id))
        return state
      return { ...state, recipes: [action.recipe, ...state.recipes] }

    case "UPDATE_RECIPE": {
      if (
        action.recipe.expectedOutput !== null &&
        !isValidExpectedOutput(action.recipe.expectedOutput)
      ) {
        return state
      }
      const existing = state.recipes.find(
        (item) => item.id === action.recipe.id,
      )
      if (!existing) return state
      const nextHistory = [
        snapshotRecipe(existing),
        ...(existing.history ?? []),
      ].slice(0, 15)
      const nextRecipe: Recipe = {
        ...action.recipe,
        version:
          action.recipe.version > existing.version
            ? action.recipe.version
            : existing.version + 1,
        history: action.recipe.history ?? nextHistory,
      }
      return {
        ...state,
        recipes: state.recipes.map((item) =>
          item.id === action.recipe.id ? nextRecipe : item,
        ),
      }
    }

    case "ARCHIVE_RECIPE":
      if (!state.recipes.some((item) => item.id === action.recipeId)) {
        return state
      }
      return {
        ...state,
        recipes: state.recipes.map((item) =>
          item.id === action.recipeId
            ? { ...item, archived: action.archived }
            : item,
        ),
      }

    case "SET_VARIANT_FINISHED_INVENTORY": {
      const product = state.products.find(
        (item) => item.id === action.productId,
      )
      if (!product?.variants.some((item) => item.id === action.variantId))
        return state

      if (action.inventoryId !== null) {
        const inventory = state.inventory.find(
          (item) => item.inventoryId === action.inventoryId,
        )
        if (
          !inventory ||
          inventory.category !== "finished" ||
          inventory.unit !== "unit"
        ) {
          return state
        }
      }

      return {
        ...state,
        products: state.products.map((item) =>
          item.id !== product.id
            ? item
            : {
                ...item,
                variants: item.variants.map((variant) => {
                  if (variant.id !== action.variantId) return variant
                  const { finishedInventoryId: _, ...unmappedVariant } = variant
                  return action.inventoryId === null
                    ? unmappedVariant
                    : {
                        ...variant,
                        finishedInventoryId: action.inventoryId,
                      }
                }),
              },
        ),
      }
    }

    case "UPSERT_EXTRA_STOCK_PLAN": {
      const existing = state.extraStockPlans.some(
        (plan) => plan.id === action.plan.id,
      )
      return {
        ...state,
        extraStockPlans: existing
          ? state.extraStockPlans.map((plan) =>
              plan.id === action.plan.id ? action.plan : plan,
            )
          : [action.plan, ...state.extraStockPlans],
      }
    }

    case "START_EXTRA_STOCK_PREPARATION": {
      const plan = state.extraStockPlans.find(
        (item) => item.id === action.planId,
      )
      if (
        !plan ||
        !action.preparationId ||
        state.extraStockPreparations.some(
          (record) => record.id === action.preparationId,
        ) ||
        !Number.isSafeInteger(plan.quantity) ||
        plan.quantity <= 0
      ) {
        return state
      }

      const product = state.products.find((item) => item.id === plan.productId)
      const variant = product?.variants.find(
        (item) => item.id === plan.variantId,
      )
      const finishedInventory = variant?.finishedInventoryId
        ? state.inventory.find(
            (item) => item.inventoryId === variant.finishedInventoryId,
          )
        : undefined
      const output: unknown = plan.recipeSnapshot.expectedOutput
      if (
        !product ||
        !variant ||
        plan.recipeSnapshot.productId !== product.id ||
        plan.recipeSnapshot.variantId !== variant.id ||
        !finishedInventory ||
        finishedInventory.category !== "finished" ||
        finishedInventory.unit !== "unit" ||
        !isValidExpectedOutput(output)
      ) {
        return state
      }

      const now = new Date().toISOString()
      const actualUsage = createPlannedUsageForQuantity(
        state,
        plan.recipeSnapshot,
        plan.quantity,
      )
      if (
        actualUsage.some(
          (usage) =>
            !Number.isFinite(usage.plannedQuantity) ||
            !Number.isFinite(usage.actualQuantity),
        )
      ) {
        return state
      }
      const preparation: ExtraStockPreparationRecord = {
        id: action.preparationId,
        planId: plan.id,
        productId: product.id,
        variantId: variant.id,
        finishedInventoryId: finishedInventory.inventoryId,
        recipeSnapshot: structuredClone(plan.recipeSnapshot),
        plannedBatches: plan.quantity,
        status: "In progress",
        actualUsage,
        completedSteps: [],
        startedAt: now,
        completedAt: null,
        actualCost: null,
        updatedAt: now,
      }
      return {
        ...state,
        extraStockPreparations: [preparation, ...state.extraStockPreparations],
      }
    }

    case "COMPLETE_EXTRA_STOCK_PREPARATION": {
      const record = state.extraStockPreparations.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status !== "In progress") return state

      const output: unknown = record.recipeSnapshot.expectedOutput
      const finishedInventory = state.inventory.find(
        (item) => item.inventoryId === record.finishedInventoryId,
      )
      const product = state.products.find(
        (item) => item.id === record.productId,
      )
      const variant = product?.variants.find(
        (item) => item.id === record.variantId,
      )
      if (
        !isValidExpectedOutput(output) ||
        !finishedInventory ||
        finishedInventory.category !== "finished" ||
        finishedInventory.unit !== "unit" ||
        !product ||
        !variant ||
        variant.finishedInventoryId !== record.finishedInventoryId
      ) {
        return state
      }

      const validation = validateExtraStockPreparationCompletion(
        state,
        record,
        action.actualUsage,
        action.usableOutputQuantity,
      )
      if (!validation.valid) return state

      const batchId = `finished-batch-${record.id}`
      const existingBatches = state.finishedStockBatches.filter(
        (batch) => batch.inventoryId === record.finishedInventoryId,
      )
      if (
        state.finishedStockBatches.some(
          (batch) =>
            batch.id === batchId ||
            (batch.source === "production" &&
              batch.preparationId === record.id),
        ) ||
        !Number.isSafeInteger(finishedInventory.physical) ||
        finishedInventory.physical < 0 ||
        !Number.isSafeInteger(
          finishedInventory.physical + action.usableOutputQuantity,
        )
      ) {
        return state
      }
      const batchedQuantity = existingBatches.reduce(
        (sum, batch) => sum + batch.remainingQuantity,
        0,
      )
      const unbatchedLegacyQuantity =
        finishedInventory.unbatchedLegacyQuantity ??
        finishedInventory.physical - batchedQuantity
      if (
        !Number.isSafeInteger(unbatchedLegacyQuantity) ||
        unbatchedLegacyQuantity < 0 ||
        existingBatches.some(
          (batch) =>
            !Number.isSafeInteger(batch.remainingQuantity) ||
            batch.remainingQuantity < 0,
        ) ||
        finishedInventory.physical !== unbatchedLegacyQuantity + batchedQuantity
      ) {
        return state
      }

      const now = new Date().toISOString()
      const actualCost = calculateActualUsageCost(
        state,
        validation.canonicalUsage,
      )
      if (!Number.isFinite(actualCost) || actualCost < 0) return state

      const usageByItem = new Map<string, number>()
      for (const usage of validation.canonicalUsage) {
        usageByItem.set(
          usage.inventoryId,
          (usageByItem.get(usage.inventoryId) ?? 0) + usage.actualQuantity,
        )
      }
      const consumedItems = [...usageByItem.entries()].filter(
        ([, quantity]) => quantity > 0,
      )
      const movementIds = consumedItems.map(
        ([inventoryId]) =>
          `movement-extra-preparation-${record.id}-${inventoryId}`,
      )
      movementIds.push(`movement-extra-output-${record.id}`)
      if (
        movementIds.some((id) =>
          state.inventoryMovements.some((movement) => movement.id === id),
        )
      ) {
        return state
      }

      const inventory = state.inventory.map((item) => {
        if (item.inventoryId === record.finishedInventoryId) {
          return {
            ...item,
            physical: item.physical + action.usableOutputQuantity,
            unbatchedLegacyQuantity,
          }
        }
        const quantity = usageByItem.get(item.inventoryId)
        return quantity === undefined
          ? item
          : { ...item, physical: item.physical - quantity }
      })
      const movements: InventoryMovement[] = consumedItems.map(
        ([inventoryId, quantity]) => {
          const original = state.inventory.find(
            (item) => item.inventoryId === inventoryId,
          )!
          return {
            id: `movement-extra-preparation-${record.id}-${inventoryId}`,
            inventoryId,
            type: "Preparation consumption" as const,
            quantityDelta: -quantity,
            unit: original.unit,
            balanceAfter: original.physical - quantity,
            date: now.slice(0, 10),
            reason: `Extra stock · ${record.recipeSnapshot.name}`,
            createdAt: now,
          }
        },
      )
      movements.push({
        id: `movement-extra-output-${record.id}`,
        inventoryId: record.finishedInventoryId,
        type: "Production",
        quantityDelta: action.usableOutputQuantity,
        unit: "unit",
        balanceAfter: finishedInventory.physical + action.usableOutputQuantity,
        date: now.slice(0, 10),
        reason: `Extra stock · ${record.recipeSnapshot.name}`,
        createdAt: now,
      })
      const completedRecord: ExtraStockPreparationRecord = {
        ...record,
        status: "Ready",
        actualUsage: structuredClone(validation.canonicalUsage),
        completedAt: now,
        actualCost,
        updatedAt: now,
      }
      const bestBefore = state.extraStockPlans.find(
        (plan) => plan.id === record.planId,
      )?.bestBefore
      const batch = {
        id: batchId,
        source: "production" as const,
        preparationId: record.id,
        planId: record.planId,
        productId: record.productId,
        variantId: record.variantId,
        inventoryId: record.finishedInventoryId,
        producedQuantity: action.usableOutputQuantity,
        remainingQuantity: action.usableOutputQuantity,
        preparedAt: now,
        ...(bestBefore ? { bestBefore } : {}),
        actualTotalCost: actualCost,
        actualUnitCost: actualCost / action.usableOutputQuantity,
      }
      return {
        ...state,
        inventory,
        inventoryMovements: [...movements, ...state.inventoryMovements],
        extraStockPreparations: state.extraStockPreparations.map((item) =>
          item.id === record.id ? completedRecord : item,
        ),
        finishedStockBatches: [batch, ...state.finishedStockBatches],
      }
    }

    case "SELL_FINISHED_STOCK":
      return applyFinishedStockTransaction(state, {
        id: action.transactionId,
        type: "sale",
        batchId: action.batchId,
        quantity: action.quantity,
        sellingPrice: action.sellingPrice,
        customerId: action.customerId,
        customerName: action.customerName,
        paymentMethod: action.paymentMethod,
      })

    case "WRITE_OFF_FINISHED_STOCK":
      return applyFinishedStockTransaction(state, {
        id: action.transactionId,
        type: "write-off",
        batchId: action.batchId,
        quantity: action.quantity,
        reason: action.reason,
      })

    case "RECONCILE_LEGACY_FINISHED_STOCK": {
      if (
        !action.batchId ||
        !action.reason.trim() ||
        !Number.isSafeInteger(action.quantity) ||
        action.quantity <= 0 ||
        !Number.isFinite(action.unitCost) ||
        action.unitCost < 0 ||
        state.finishedStockBatches.some((batch) => batch.id === action.batchId)
      ) {
        return state
      }
      const inventoryItem = state.inventory.find(
        (item) => item.inventoryId === action.inventoryId,
      )
      const unbatchedLegacyQuantity = inventoryItem?.unbatchedLegacyQuantity
      if (
        !inventoryItem ||
        inventoryItem.category !== "finished" ||
        inventoryItem.unit !== "unit" ||
        !Number.isSafeInteger(inventoryItem.physical) ||
        inventoryItem.physical < 0 ||
        typeof unbatchedLegacyQuantity !== "number" ||
        !Number.isSafeInteger(unbatchedLegacyQuantity) ||
        unbatchedLegacyQuantity < action.quantity
      ) {
        return state
      }

      const inventoryBatches = state.finishedStockBatches.filter(
        (batch) => batch.inventoryId === inventoryItem.inventoryId,
      )
      const batchedQuantity = inventoryBatches.reduce(
        (sum, batch) => sum + batch.remainingQuantity,
        0,
      )
      if (
        !Number.isSafeInteger(batchedQuantity) ||
        inventoryBatches.some(
          (batch) =>
            !Number.isSafeInteger(batch.remainingQuantity) ||
            batch.remainingQuantity < 0,
        ) ||
        inventoryItem.physical !== unbatchedLegacyQuantity + batchedQuantity
      ) {
        return state
      }

      const now = new Date().toISOString()
      const batch = {
        id: action.batchId,
        source: "legacy-opening" as const,
        inventoryId: inventoryItem.inventoryId,
        reconciledQuantity: action.quantity,
        remainingQuantity: action.quantity,
        reconciledAt: now,
        reconciliationReason: action.reason.trim(),
        unitCost: action.unitCost,
      }
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.inventoryId === inventoryItem.inventoryId
            ? {
                ...item,
                unbatchedLegacyQuantity:
                  unbatchedLegacyQuantity - action.quantity,
              }
            : item,
        ),
        finishedStockBatches: [batch, ...state.finishedStockBatches],
      }
    }

    case "REMOVE_EXTRA_STOCK_PLAN":
      return {
        ...state,
        extraStockPlans: state.extraStockPlans.filter(
          (plan) => plan.id !== action.planId,
        ),
      }

    case "SET_PURCHASE_QUANTITY":
      return {
        ...state,
        shoppingSelections: {
          ...state.shoppingSelections,
          [action.inventoryId]: Math.max(0, action.quantity),
        },
      }

    case "RECORD_PURCHASE": {
      const purchase = action.purchase
      if (
        !purchase ||
        typeof purchase !== "object" ||
        typeof purchase.id !== "string" ||
        !purchase.id.trim() ||
        typeof purchase.inventoryId !== "string" ||
        !purchase.inventoryId.trim() ||
        state.purchases.some((item) => item.id === purchase.id) ||
        state.inventoryMovements.some(
          (movement) => movement.id === `movement-${purchase.id}`,
        ) ||
        !Number.isFinite(purchase.purchasedQuantity) ||
        purchase.purchasedQuantity <= 0 ||
        !Number.isFinite(purchase.usableQuantity) ||
        purchase.usableQuantity <= 0 ||
        !Number.isFinite(purchase.usableBaseQuantity) ||
        purchase.usableBaseQuantity <= 0 ||
        !Number.isSafeInteger(purchase.totalPrice) ||
        purchase.totalPrice <= 0 ||
        !isValidDate(purchase.date) ||
        !isValidTimestamp(purchase.createdAt) ||
        typeof purchase.note !== "string"
      ) {
        return state
      }
      const inventoryItem = state.inventory.find(
        (item) => item.inventoryId === purchase.inventoryId,
      )
      if (
        !inventoryItem ||
        inventoryCategory(inventoryItem) === "finished" ||
        !Number.isFinite(inventoryItem.physical) ||
        inventoryItem.physical < 0 ||
        (inventoryItem.averageUnitCost !== undefined &&
          (!Number.isFinite(inventoryItem.averageUnitCost) ||
            inventoryItem.averageUnitCost < 0))
      ) {
        return state
      }
      const purchasedBaseQuantity = toInventoryBaseQuantity(
        purchase.purchasedQuantity,
        purchase.purchasedUnit,
        inventoryItem,
      )
      const usableBaseQuantity = toInventoryBaseQuantity(
        purchase.usableQuantity,
        purchase.usableUnit,
        inventoryItem,
      )
      if (
        !Number.isFinite(purchasedBaseQuantity) ||
        purchasedBaseQuantity <= 0 ||
        !Number.isFinite(usableBaseQuantity) ||
        usableBaseQuantity <= 0 ||
        purchase.usableBaseQuantity !== usableBaseQuantity ||
        usableBaseQuantity > purchasedBaseQuantity
      ) {
        return state
      }
      const balanceAfter = inventoryItem.physical + usableBaseQuantity
      const priorValue =
        inventoryItem.physical * (inventoryItem.averageUnitCost ?? 0)
      const totalValue = priorValue + purchase.totalPrice
      const averageUnitCost =
        balanceAfter > 0
          ? totalValue / balanceAfter
          : inventoryItem.averageUnitCost
      if (
        !Number.isFinite(balanceAfter) ||
        !Number.isFinite(priorValue) ||
        !Number.isFinite(totalValue) ||
        typeof averageUnitCost !== "number" ||
        !Number.isFinite(averageUnitCost) ||
        averageUnitCost < 0
      ) {
        return state
      }
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.inventoryId === inventoryItem.inventoryId
            ? { ...item, physical: balanceAfter, averageUnitCost }
            : item,
        ),
        purchases: [purchase, ...state.purchases],
        inventoryMovements: [
          {
            id: `movement-${purchase.id}`,
            inventoryId: inventoryItem.inventoryId,
            type: "Purchase",
            quantityDelta: usableBaseQuantity,
            unit: inventoryItem.unit,
            balanceAfter,
            date: purchase.date,
            reason: purchase.note || "Recorded purchase",
            purchaseId: purchase.id,
            createdAt: purchase.createdAt,
          },
          ...state.inventoryMovements,
        ],
      }
    }

    case "ADJUST_INVENTORY": {
      const adjustment = action.adjustment
      if (
        !adjustment ||
        typeof adjustment !== "object" ||
        state.inventoryMovements.some(
          (movement) => movement.id === adjustment.id,
        ) ||
        typeof adjustment.id !== "string" ||
        !adjustment.id.trim() ||
        typeof adjustment.inventoryId !== "string" ||
        !adjustment.inventoryId.trim() ||
        !ADJUSTMENT_MOVEMENT_TYPES.has(adjustment.type) ||
        typeof adjustment.reason !== "string" ||
        !adjustment.reason.trim() ||
        !isValidDate(adjustment.date) ||
        !Number.isFinite(adjustment.quantityDelta) ||
        adjustment.quantityDelta === 0
      ) {
        return state
      }
      const item = state.inventory.find(
        (entry) => entry.inventoryId === adjustment.inventoryId,
      )
      if (
        !item ||
        inventoryCategory(item) === "finished" ||
        !Number.isFinite(item.physical) ||
        item.physical < 0
      ) {
        return state
      }
      const balanceAfter = item.physical + adjustment.quantityDelta
      const reserved = selectReservedByItem(state).get(item.inventoryId) ?? 0
      if (
        !Number.isFinite(balanceAfter) ||
        balanceAfter < 0 ||
        !Number.isFinite(reserved) ||
        reserved < 0 ||
        balanceAfter < reserved
      ) {
        return state
      }
      return {
        ...state,
        inventory: state.inventory.map((entry) =>
          entry.inventoryId === item.inventoryId
            ? { ...entry, physical: balanceAfter }
            : entry,
        ),
        inventoryMovements: [
          {
            ...adjustment,
            reason: adjustment.reason.trim(),
            unit: item.unit,
            balanceAfter,
            createdAt: new Date().toISOString(),
          },
          ...state.inventoryMovements,
        ],
      }
    }

    case "START_PREPARATION": {
      const record = state.preparationRecords.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status !== "Awaiting preparation") return state
      const order = state.orders.find((item) => item.id === record.orderId)
      if (!order || hasUnpurchasedShoppingItems(order, record)) return state
      const now = new Date().toISOString()
      return {
        ...state,
        preparationRecords: state.preparationRecords.map((item) =>
          item.id === record.id
            ? {
                ...item,
                status: "In progress",
                startedAt: now,
                updatedAt: now,
              }
            : item,
        ),
        orders: state.orders.map((item) =>
          item.id === record.orderId
            ? {
                ...item,
                status: "In Progress",
                preparationStatus: "In progress",
                updatedAt: now,
              }
            : item,
        ),
      }
    }

    case "TOGGLE_PREPARATION_STEP": {
      const record = state.preparationRecords.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status !== "In progress") return state
      const order = state.orders.find((item) => item.id === record.orderId)
      if (!order || hasUnpurchasedShoppingItems(order, record)) return state
      const completedSteps = record.completedSteps.includes(action.stepIndex)
        ? record.completedSteps.filter((step) => step !== action.stepIndex)
        : [...record.completedSteps, action.stepIndex].sort((a, b) => a - b)
      return {
        ...state,
        preparationRecords: state.preparationRecords.map((item) =>
          item.id === record.id
            ? {
                ...item,
                completedSteps,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      }
    }

    case "UPDATE_PREPARATION_USAGE": {
      if (!Number.isFinite(action.quantity) || action.quantity < 0) return state
      const record = state.preparationRecords.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status !== "In progress") return state
      return {
        ...state,
        preparationRecords: state.preparationRecords.map((item) =>
          item.id === record.id
            ? {
                ...item,
                actualUsage: item.actualUsage.map((usage) =>
                  usage.inventoryId === action.inventoryId
                    ? { ...usage, actualQuantity: action.quantity }
                    : usage,
                ),
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      }
    }

    case "COMPLETE_PREPARATION": {
      const record = state.preparationRecords.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status !== "In progress") return state
      const validation = validatePreparationCompletion(state, record)
      if (!validation.valid) return state
      const order = state.orders.find((item) => item.id === record.orderId)
      if (!order) return state

      const now = new Date().toISOString()
      const usageByItem = new Map<string, number>()
      for (const usage of validation.canonicalUsage) {
        usageByItem.set(
          usage.inventoryId,
          (usageByItem.get(usage.inventoryId) ?? 0) + usage.actualQuantity,
        )
      }
      const inventory = state.inventory.map((item) => {
        const quantity = usageByItem.get(item.inventoryId)
        return quantity === undefined
          ? item
          : { ...item, physical: item.physical - quantity }
      })
      const movements = validation.canonicalUsage
        .filter((usage) => usage.actualQuantity > 0)
        .reduce<InventoryMovement[]>((result, usage) => {
          const original = state.inventory.find(
            (item) => item.inventoryId === usage.inventoryId,
          )!
          const existingMovement = result.find(
            (movement) => movement.inventoryId === usage.inventoryId,
          )
          if (existingMovement) {
            existingMovement.quantityDelta -= usage.actualQuantity
            existingMovement.balanceAfter -= usage.actualQuantity
          } else {
            result.push({
              id: `movement-preparation-${record.id}-${usage.inventoryId}`,
              inventoryId: usage.inventoryId,
              type: "Preparation consumption",
              quantityDelta: -usage.actualQuantity,
              unit: original.unit,
              balanceAfter: original.physical - usage.actualQuantity,
              date: now.slice(0, 10),
              reason: `${order.reference} · ${record.recipeSnapshot.name}`,
              createdAt: now,
            })
          }
          return result
        }, [])
      const actualCost = calculateActualUsageCost(
        state,
        validation.canonicalUsage,
      )
      if (!Number.isFinite(actualCost) || actualCost < 0) return state
      const completedRecord: PreparationRecord = {
        ...record,
        status: "Ready",
        actualUsage: structuredClone(validation.canonicalUsage),
        completedAt: now,
        actualCost,
        updatedAt: now,
      }
      const preparationRecords = state.preparationRecords.map((item) =>
        item.id === record.id ? completedRecord : item,
      )
      const siblingRecords = preparationRecords.filter(
        (item) => item.orderId === order.id,
      )
      const allReady = siblingRecords.every((item) => item.status === "Ready")

      return {
        ...state,
        inventory,
        inventoryMovements: [
          ...movements.filter(
            (movement) =>
              !state.inventoryMovements.some(
                (existing) => existing.id === movement.id,
              ),
          ),
          ...state.inventoryMovements,
        ],
        preparationRecords,
        orders: state.orders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: "In Progress",
                preparationStatus: allReady ? "Ready" : "In progress",
                reservations: item.reservations.filter(
                  (reservation) => reservation.lineId !== record.orderLineId,
                ),
                shortages: item.shortages.filter(
                  (shortage) => shortage.lineId !== record.orderLineId,
                ),
                updatedAt: now,
              }
            : item,
        ),
      }
    }

    case "UPDATE_SETTINGS": {
      const nextPatch = action.patch
      if (
        (nextPatch.businessName !== undefined &&
          !nextPatch.businessName.trim()) ||
        (nextPatch.defaultLabourRatePerHour !== undefined &&
          (!Number.isFinite(nextPatch.defaultLabourRatePerHour) ||
            nextPatch.defaultLabourRatePerHour < 0)) ||
        (nextPatch.defaultPricingMode !== undefined &&
          nextPatch.defaultPricingMode !== "margin" &&
          nextPatch.defaultPricingMode !== "markup") ||
        (nextPatch.defaultMarginPercent !== undefined &&
          (!Number.isFinite(nextPatch.defaultMarginPercent) ||
            nextPatch.defaultMarginPercent < 0 ||
            nextPatch.defaultMarginPercent >= 100)) ||
        (nextPatch.defaultMarkupPercent !== undefined &&
          (!Number.isFinite(nextPatch.defaultMarkupPercent) ||
            nextPatch.defaultMarkupPercent < 0)) ||
        (nextPatch.priceRoundingStep !== undefined &&
          nextPatch.priceRoundingStep !== 1 &&
          nextPatch.priceRoundingStep !== 50 &&
          nextPatch.priceRoundingStep !== 100) ||
        (nextPatch.defaultLowStockThreshold !== undefined &&
          (!Number.isFinite(nextPatch.defaultLowStockThreshold) ||
            nextPatch.defaultLowStockThreshold < 0)) ||
        (nextPatch.backupReminderDismissedAt !== undefined &&
          nextPatch.backupReminderDismissedAt !== null &&
          !isValidTimestamp(nextPatch.backupReminderDismissedAt)) ||
        (nextPatch.backupReminderSnoozedUntil !== undefined &&
          nextPatch.backupReminderSnoozedUntil !== null &&
          !isValidTimestamp(nextPatch.backupReminderSnoozedUntil)) ||
        (nextPatch.lastBackupAt !== undefined &&
          nextPatch.lastBackupAt !== null &&
          !isValidTimestamp(nextPatch.lastBackupAt))
      ) {
        return state
      }
      return {
        ...state,
        settings: normalizeSettings({
          ...state.settings,
          ...nextPatch,
        }),
      }
    }

    case "RECORD_BACKUP_EXPORT": {
      if (!isValidTimestamp(action.exportedAt)) return state
      return {
        ...state,
        settings: {
          ...state.settings,
          lastBackupAt: action.exportedAt,
          backupReminderSnoozedUntil: null,
        },
      }
    }

    case "UPDATE_BUDGET_PLAN": {
      const next = action.budgetPlan
      const validOptionalLimit = (v: number | undefined) =>
        v === undefined || (Number.isSafeInteger(v) && v >= 0)
      if (
        !validOptionalLimit(next.monthlySalesTarget) ||
        !validOptionalLimit(next.monthlyProfitTarget) ||
        !validOptionalLimit(next.ingredientSpendLimit)
      ) {
        return state
      }
      const nextLimits: Record<string, number> = {
        ...state.budgetPlan.categoryLimits,
      }
      if (next.categoryLimits) {
        for (const [categoryId, limit] of Object.entries(next.categoryLimits)) {
          if (!Number.isSafeInteger(limit) || limit < 0) return state
          if (limit === 0) {
            delete nextLimits[categoryId]
          } else {
            nextLimits[categoryId] = limit
          }
        }
      }
      return {
        ...state,
        budgetPlan: {
          monthlySalesTarget:
            "monthlySalesTarget" in next
              ? next.monthlySalesTarget
              : state.budgetPlan.monthlySalesTarget,
          monthlyProfitTarget:
            "monthlyProfitTarget" in next
              ? next.monthlyProfitTarget
              : state.budgetPlan.monthlyProfitTarget,
          ingredientSpendLimit:
            "ingredientSpendLimit" in next
              ? next.ingredientSpendLimit
              : state.budgetPlan.ingredientSpendLimit,
          categoryLimits: nextLimits,
          updatedAt: new Date().toISOString(),
        },
      }
    }

    case "CLEAR_WORKSPACE":
      return cloneEmptyData()
    case "LOAD_STARTER_SAMPLE":
      return cloneStarterData()
    case "RESTORE_DATA":
      return action.data

    case "SET_PANTRY_CHECKLIST_ITEM": {
      const record = state.preparationRecords.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status === "Ready" || record.status === "Cancelled")
        return state
      const order = state.orders.find((item) => item.id === record.orderId)
      if (!order) return state

      const now = new Date().toISOString()
      const updatedRecord: PreparationRecord = {
        ...record,
        actualUsage: record.actualUsage.map((usage) => {
          if (usage.inventoryId !== action.inventoryId) return usage
          const defaultToBuy =
            action.toBuyQuantity !== undefined &&
            Number.isFinite(action.toBuyQuantity) &&
            action.toBuyQuantity > 0
              ? action.toBuyQuantity
              : usage.plannedQuantity
          return {
            ...usage,
            inPantry: action.inPantry,
            toBuyQuantity: action.inPantry ? 0 : defaultToBuy,
            shoppingChecked: false,
          }
        }),
        updatedAt: now,
      }

      const nextPrepRecords = state.preparationRecords.map((item) =>
        item.id === record.id ? updatedRecord : item,
      )
      const orderPrepRecords = nextPrepRecords.filter(
        (item) => item.orderId === order.id && item.status !== "Ready",
      )
      const nextShortages = orderPrepRecords.flatMap((prep) =>
        prep.actualUsage.flatMap((usage) => {
          if (isUsageInPantry(order, prep, usage)) return []
          const qty = getUsageToBuyQuantity(state, order, prep, usage)
          if (!Number.isFinite(qty) || qty <= 0) return []
          return [
            {
              inventoryId: usage.inventoryId,
              lineId: prep.orderLineId,
              name: usage.name,
              required: usage.plannedQuantity,
              availableAtConfirmation: 0,
              reserved: 0,
              shortage: qty,
              unit: usage.unit,
            },
          ]
        }),
      )

      const nextSelections = { ...state.shoppingSelections }
      delete nextSelections[action.inventoryId]

      return {
        ...state,
        shoppingSelections: nextSelections,
        preparationRecords: nextPrepRecords,
        orders: state.orders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                shortages: nextShortages,
                updatedAt: now,
              }
            : item,
        ),
      }
    }

    case "MARK_ALL_PANTRY_CHECKLIST": {
      const record = state.preparationRecords.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status === "Ready" || record.status === "Cancelled")
        return state
      const order = state.orders.find((item) => item.id === record.orderId)
      if (!order) return state

      const now = new Date().toISOString()
      const updatedRecord: PreparationRecord = {
        ...record,
        actualUsage: record.actualUsage.map((usage) => ({
          ...usage,
          inPantry: action.inPantry,
          toBuyQuantity: action.inPantry ? 0 : usage.plannedQuantity,
          shoppingChecked: false,
        })),
        updatedAt: now,
      }
      const nextPrepRecords = state.preparationRecords.map((item) =>
        item.id === record.id ? updatedRecord : item,
      )
      const orderPrepRecords = nextPrepRecords.filter(
        (item) => item.orderId === order.id && item.status !== "Ready",
      )
      const nextShortages = orderPrepRecords.flatMap((prep) =>
        prep.actualUsage.flatMap((usage) => {
          if (isUsageInPantry(order, prep, usage)) return []
          const qty = getUsageToBuyQuantity(state, order, prep, usage)
          if (!Number.isFinite(qty) || qty <= 0) return []
          return [
            {
              inventoryId: usage.inventoryId,
              lineId: prep.orderLineId,
              name: usage.name,
              required: usage.plannedQuantity,
              availableAtConfirmation: 0,
              reserved: 0,
              shortage: qty,
              unit: usage.unit,
            },
          ]
        }),
      )

      const nextSelections = { ...state.shoppingSelections }
      if (action.inPantry) {
        for (const usage of record.actualUsage) {
          const stillNeededElsewhere = nextPrepRecords.some((prep) => {
            if (prep.status === "Ready" || prep.status === "Cancelled")
              return false
            const prepOrder = state.orders.find((o) => o.id === prep.orderId)
            if (
              !prepOrder ||
              prepOrder.status === "Draft" ||
              prepOrder.status === "Completed" ||
              prepOrder.status === "Cancelled"
            ) {
              return false
            }
            return prep.actualUsage.some(
              (u) =>
                u.inventoryId === usage.inventoryId &&
                !isUsageInPantry(prepOrder, prep, u),
            )
          })
          if (!stillNeededElsewhere) {
            delete nextSelections[usage.inventoryId]
          }
        }
      }

      return {
        ...state,
        shoppingSelections: nextSelections,
        preparationRecords: nextPrepRecords,
        orders: state.orders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                shortages: nextShortages,
                updatedAt: now,
              }
            : item,
        ),
      }
    }

    case "UPDATE_SHOPPING_CHECKLIST_ITEM": {
      const now = new Date().toISOString()
      const nextSelections = { ...state.shoppingSelections }
      if (
        action.boughtQuantity !== undefined &&
        Number.isFinite(action.boughtQuantity) &&
        action.boughtQuantity >= 0
      ) {
        nextSelections[action.inventoryId] = action.boughtQuantity
      }

      const nextPrepRecords = state.preparationRecords.map((record) => {
        if (record.status === "Ready" || record.status === "Cancelled")
          return record
        const order = state.orders.find((o) => o.id === record.orderId)
        let changed = false
        const actualUsage = record.actualUsage.map((usage) => {
          if (usage.inventoryId !== action.inventoryId) return usage
          if (isUsageInPantry(order, record, usage)) return usage
          changed = true
          return {
            ...usage,
            inPantry: false,
            toBuyQuantity: getUsageToBuyQuantity(state, order, record, usage),
            shoppingChecked: action.checked,
          }
        })
        return changed ? { ...record, actualUsage, updatedAt: now } : record
      })

      return {
        ...state,
        shoppingSelections: nextSelections,
        preparationRecords: nextPrepRecords,
      }
    }

    case "COMPLETE_SHOPPING_CHECKLIST": {
      const now = new Date().toISOString()
      const affectedOrderIds = new Set<string>()
      const clearedInventoryIds = new Set<string>(action.extraInventoryIds ?? [])

      const nextPrepRecords = state.preparationRecords.map((record) => {
        if (record.status === "Ready" || record.status === "Cancelled")
          return record
        let changed = false
        const actualUsage = record.actualUsage.map((usage) => {
          if (!usage.shoppingChecked) return usage
          changed = true
          affectedOrderIds.add(record.orderId)
          clearedInventoryIds.add(usage.inventoryId)
          return {
            ...usage,
            inPantry: true,
            toBuyQuantity: 0,
            shoppingChecked: false,
          }
        })
        return changed ? { ...record, actualUsage, updatedAt: now } : record
      })

      if (!affectedOrderIds.size && !clearedInventoryIds.size) return state

      const nextSelections = { ...state.shoppingSelections }
      for (const invId of clearedInventoryIds) {
        delete nextSelections[invId]
      }

      return {
        ...state,
        shoppingSelections: nextSelections,
        preparationRecords: nextPrepRecords,
        orders: state.orders.map((order) => {
          if (!affectedOrderIds.has(order.id)) return order
          const orderPrepRecords = nextPrepRecords.filter(
            (item) => item.orderId === order.id && item.status !== "Ready",
          )
          const nextShortages = orderPrepRecords.flatMap((prep) =>
            prep.actualUsage.flatMap((usage) => {
              if (isUsageInPantry(order, prep, usage)) return []
              const qty = getUsageToBuyQuantity(state, order, prep, usage)
              if (!Number.isFinite(qty) || qty <= 0) return []
              return [
                {
                  inventoryId: usage.inventoryId,
                  lineId: prep.orderLineId,
                  name: usage.name,
                  required: usage.plannedQuantity,
                  availableAtConfirmation: 0,
                  reserved: 0,
                  shortage: qty,
                  unit: usage.unit,
                },
              ]
            }),
          )
          return {
            ...order,
            shortages: nextShortages,
            updatedAt: now,
          }
        }),
      }
    }

    case "ADD_SHOPPING_TRIP": {
      const trip = action.trip
      const existing = state.shoppingTrips ?? []
      if (
        !trip ||
        typeof trip.id !== "string" ||
        !trip.id.trim() ||
        typeof trip.reference !== "string" ||
        !trip.reference.trim() ||
        !isValidDate(trip.date) ||
        !Array.isArray(trip.items) ||
        trip.items.length === 0 ||
        existing.some((item) => item.id === trip.id)
      ) {
        return state
      }
      return {
        ...state,
        shoppingTrips: [structuredClone(trip), ...existing],
      }
    }

    case "REMOVE_MANUAL_SHOPPING_ITEM": {
      const nextSelections = { ...state.shoppingSelections }
      if (!(action.inventoryId in nextSelections)) return state
      delete nextSelections[action.inventoryId]
      return {
        ...state,
        shoppingSelections: nextSelections,
      }
    }

    case "FINISH_PREPARATION_SIMPLE": {
      const record = state.preparationRecords.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status !== "In progress") return state
      const order = state.orders.find((item) => item.id === record.orderId)
      if (!order || hasUnpurchasedShoppingItems(order, record)) return state
      const allStepsChecked = record.recipeSnapshot.instructions.every(
        (_, index) => record.completedSteps.includes(index),
      )
      if (!allStepsChecked) return state

      const now = new Date().toISOString()
      const rawCost = calculateActualUsageCost(state, record.actualUsage)
      const actualCost =
        Number.isFinite(rawCost) && rawCost >= 0
          ? rawCost
          : record.recipeSnapshot.estimatedCost * record.plannedQuantity

      const completedRecord: PreparationRecord = {
        ...record,
        status: "Ready",
        startedAt: record.startedAt ?? now,
        completedAt: now,
        actualCost,
        updatedAt: now,
      }
      const preparationRecords = state.preparationRecords.map((item) =>
        item.id === record.id ? completedRecord : item,
      )
      const siblingRecords = preparationRecords.filter(
        (item) => item.orderId === order.id,
      )
      const allReady = siblingRecords.every((item) => item.status === "Ready")

      return {
        ...state,
        preparationRecords,
        orders: state.orders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: "In Progress",
                preparationStatus: allReady ? "Ready" : "In progress",
                reservations: item.reservations.filter(
                  (reservation) => reservation.lineId !== record.orderLineId,
                ),
                shortages: item.shortages.filter(
                  (shortage) => shortage.lineId !== record.orderLineId,
                ),
                updatedAt: now,
              }
            : item,
        ),
      }
    }
  }
}

export default function AppStateProvider({
  children,
}: {
  children: ReactNode
}) {
  const repositoryRef = useRef<AppRepository | null>(null)
  if (!repositoryRef.current) {
    repositoryRef.current = createDefaultAppRepository()
  }
  const [bootstrap, setBootstrap] = useState<PersistenceBootstrap | null>(null)
  const [activeRepository, setActiveRepository] =
    useState<AppRepository | null>(null)

  const runBootstrap = useCallback(async () => {
    const repository = repositoryRef.current!
    try {
      const next = await bootstrapAppRepository({
        repository,
        getLegacyStorage: () => window.localStorage,
        getFallbackData: getInitialAppData,
        normalize: migrateState,
      })
      setActiveRepository(repository)
      setBootstrap(next)
    } catch {
      setActiveRepository(null)
      setBootstrap(
        readPersistedState(
          () => window.localStorage,
          getInitialAppData(),
          migrateState,
        ),
      )
    }
  }, [])

  useEffect(() => {
    void runBootstrap()
  }, [runBootstrap])

  if (!bootstrap) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ivory px-4 text-cocoa">
        <AppLoader label="Opening your bakery records..." />
      </main>
    )
  }

  if (bootstrap.kind === "recovery") {
    return (
      <PersistenceRecoveryScreen
        recovery={bootstrap}
        onRetry={() => {
          setBootstrap(null)
          void runBootstrap()
        }}
        onStartFresh={() => {
          const recoveryId = createId()
          const next = startFreshPreservingRaw(
            bootstrap,
            () => window.localStorage,
            getInitialAppData(),
            migrateState,
            recoveryId,
          )
          if (next.kind === "ready" && repositoryRef.current) {
            void repositoryRef.current
              .init()
              .then(() => repositoryRef.current!.saveAppData(next.data))
              .then(() => setActiveRepository(repositoryRef.current))
              .catch(() => undefined)
          }
          setBootstrap(next)
        }}
        onRestore={(raw, source) => {
          const result = restoreBackup(() => window.localStorage, raw, source)
          if (result.ok) {
            if (repositoryRef.current) {
              void repositoryRef.current
                .init()
                .then(() => repositoryRef.current!.saveAppData(result.data))
                .then(() => setActiveRepository(repositoryRef.current))
                .catch(() => undefined)
            }
            setBootstrap({
              kind: "ready",
              data: result.data,
              source: "current",
              persistenceEnabled: true,
            })
          }
          return result
        }}
      />
    )
  }

  return (
    <ReadyAppStateProvider bootstrap={bootstrap} repository={activeRepository}>
      {children}
    </ReadyAppStateProvider>
  )
}

function ReadyAppStateProvider({
  bootstrap,
  repository,
  children,
}: {
  bootstrap: PersistenceReady
  repository: AppRepository | null
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(reducer, bootstrap.data)
  const latestStateRef = useRef(state)
  latestStateRef.current = state
  const writeChainRef = useRef<Promise<void>>(Promise.resolve())
  const lastPersistedStateRef = useRef<AppData>(bootstrap.data)
  const [persistenceError, setPersistenceError] = useState(
    bootstrap.persistenceError ?? null,
  )

  const enqueuePersist = useCallback(
    (snapshot: AppData) => {
      writeChainRef.current = writeChainRef.current.then(async () => {
        if (repository) {
          try {
            await repository.saveAppData(snapshot)
            try {
              persistAppData(() => window.localStorage, snapshot)
            } catch {
              // Secondary localStorage mirror is best-effort once repository succeeds
            }
            setPersistenceError(null)
            return
          } catch (error) {
            setPersistenceError(
              `Your changes are currently only in this session and were not saved: ${errorMessage(error)}`,
            )
            return
          }
        }

        try {
          persistAppData(() => window.localStorage, snapshot)
          setPersistenceError(null)
        } catch (error) {
          setPersistenceError(
            `Your changes are currently only in this session and were not saved: ${errorMessage(error)}`,
          )
        }
      })
    },
    [repository],
  )

  useEffect(() => {
    if (!bootstrap.persistenceEnabled || persistenceError) return
    if (state === lastPersistedStateRef.current) return
    lastPersistedStateRef.current = state
    enqueuePersist(state)
  }, [bootstrap.persistenceEnabled, enqueuePersist, persistenceError, state])

  const retryPersistence = useCallback(() => {
    if (!bootstrap.persistenceEnabled) return
    enqueuePersist(latestStateRef.current)
  }, [bootstrap.persistenceEnabled, enqueuePersist])

  const handleRestore = useCallback((raw: string, source?: RecoverySource) => {
    const result = restoreBackup(() => window.localStorage, raw, source)
    if (result.ok) {
      dispatch({ type: "RESTORE_DATA", data: result.data })
      setPersistenceError(null)
    }
    return result
  }, [])

  const trackedDispatch = useCallback((action: AppAction) => {
    latestStateRef.current = reducer(latestStateRef.current, action)
    dispatch(action)
  }, [])

  const dispatchIfAccepted = useCallback((action: AppAction) => {
    const next = reducer(latestStateRef.current, action)
    if (next === latestStateRef.current) return false
    latestStateRef.current = next
    dispatch(action)
    return true
  }, [])

  const value = useMemo(
    () => ({
      state,
      dispatch: trackedDispatch,
      dispatchIfAccepted,
      restoreBackupFromRaw: handleRestore,
      persistenceError,
      retryPersistence,
    }),
    [
      state,
      trackedDispatch,
      dispatchIfAccepted,
      handleRestore,
      persistenceError,
      retryPersistence,
    ],
  )

  return (
    <AppStateContext.Provider value={value}>
      {persistenceError ? (
        <div
          role="alert"
          className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-sm text-cocoa"
        >
          <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3">
            <span>{persistenceError}</span>
            {bootstrap.persistenceEnabled ? (
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={retryPersistence}
              >
                Retry saving
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const value = useContext(AppStateContext)
  if (!value)
    throw new Error("useAppState must be used inside AppStateProvider")
  return value
}
