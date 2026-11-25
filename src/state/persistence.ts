import { defaultBudgetPlan, defaultSettings } from "../data/defaults"
import { createId } from "../lib/id"

import { derivePaymentStatus } from "../lib/financials"

import {
  BUILT_IN_EXPENSE_CATEGORIES,
  validateAllocationHistory,
  validateExpense,
  validateExpenseCategory,
} from "../lib/expenses"

import type {
  AppData,
  AppSettings,
  BudgetPlan,
  Expense,
  ExpenseAllocationHistory,
  ExpenseAllocationVersion,
  ExpenseCategory,
  Order,
} from "../types"

export const CURRENT_STORAGE_KEY = "udenis-specials-demo-v7"

export const LEGACY_STORAGE_KEYS = [
  "udenis-specials-demo-v6",

  "udenis-specials-demo-v5",

  "udenis-specials-demo-v4",

  "udenis-specials-demo-v3",

  "udenis-specials-demo-v2",
] as const

export const RECOVERY_STORAGE_PREFIX = "udenis-specials-preserved-"

export const CURRENT_SCHEMA_VERSION = 7

export const BACKUP_FORMAT = "udenis-specials-backup"

export const BACKUP_SCHEMA_VERSION = 2

const LEGACY_BACKUP_SCHEMA_VERSION = 1

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export type PersistenceRecovery = {
  kind: "recovery"

  key: string | null

  raw: string | null

  message: string
}

export type PersistenceReady = {
  kind: "ready"

  data: AppData

  source: "demo" | "current" | "legacy" | "fresh"

  persistenceEnabled: boolean

  persistenceError?: string
}

export type PersistenceBootstrap = PersistenceRecovery | PersistenceReady

type NormalizeState = (source: AppData) => AppData

type StorageFactory = () => StorageLike

export type BackupEnvelope = {
  format: typeof BACKUP_FORMAT

  backupSchemaVersion: typeof BACKUP_SCHEMA_VERSION

  exportedAt: string

  data: AppData
}

export type RestoreResult =
  | { ok: true; data: AppData }
  | {
      ok: false
      error: string
    }

export type RecoverySource = Pick<PersistenceRecovery, "key" | "raw">

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isObjectArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord)
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  requireValue(isRecord(value), `${label} must be an object.`)

  return value
}

function requireArray(value: unknown, label: string): unknown[] {
  requireValue(Array.isArray(value), `${label} must be an array.`)

  return value
}

function requireString(value: unknown, label: string, allowEmpty = false) {
  requireValue(
    typeof value === "string" && (allowEmpty || value.trim().length > 0),

    `${label} is invalid.`,
  )
}

function requireFiniteNumber(value: unknown, label: string, minimum = 0) {
  requireValue(
    typeof value === "number" && Number.isFinite(value) && value >= minimum,

    `${label} is invalid.`,
  )
}

function requireMoneyAmount(value: unknown, label: string) {
  requireValue(
    typeof value === "number" && Number.isSafeInteger(value) && value > 0,

    `${label} must be a positive whole LKR amount.`,
  )
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const date = new Date(`${value}T00:00:00.000Z`)

  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

function isValidTimestamp(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    isValidDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  )
}

function requireRecordId(value: unknown, label: string) {
  const record = requireRecord(value, label)

  requireString(record.id, `${label} ID`)

  return record
}

function requireUniqueId(ids: Set<string>, id: string, label: string) {
  requireValue(!ids.has(id), `${label} IDs must be unique.`)

  ids.add(id)
}

function validateOptionalImageRef(value: unknown, label: string) {
  if (value === undefined) return
  requireValue(
    typeof value === "string" &&
      (value.startsWith("preset:") ||
        value.startsWith("media:") ||
        /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(
          value,
        )),
    `${label} is invalid.`,
  )
}

function validateRecipeSnapshot(value: unknown, label: string) {
  const recipe = requireRecord(value, label)

  requireString(recipe.id, `${label} ID`)

  requireString(recipe.name, `${label} name`)

  validateOptionalImageRef(recipe.image, `${label} image`)

  requireString(recipe.productId, `${label} product`)

  requireString(recipe.variantId, `${label} variant`)

  requireFiniteNumber(recipe.yield, `${label} yield`, Number.MIN_VALUE)

  requireArray(recipe.ingredients, `${label} ingredients`).forEach(
    (entry, index) => {
      const ingredient = requireRecord(
        entry,
        `${label} ingredient ${index + 1}`,
      )

      requireString(ingredient.inventoryId, "Ingredient inventory ID")

      requireFiniteNumber(
        ingredient.quantity,
        "Ingredient quantity",
        Number.MIN_VALUE,
      )

      requireString(ingredient.unit, "Ingredient unit")
    },
  )

  requireArray(recipe.packaging, `${label} packaging`).forEach(
    (entry, index) => {
      const packaging = requireRecord(entry, `${label} packaging ${index + 1}`)

      requireString(packaging.inventoryId, "Packaging inventory ID")

      requireFiniteNumber(
        packaging.quantity,
        "Packaging quantity",
        Number.MIN_VALUE,
      )

      requireString(packaging.unit, "Packaging unit")
    },
  )

  requireArray(recipe.instructions, `${label} instructions`).forEach((step) =>
    requireString(step, `${label} instruction`, true),
  )
}

function validateRecipeReferences(
  recipe: Record<string, unknown>,

  label: string,

  productIds: Set<string>,

  variantProductIds: Map<string, string>,

  inventoryIds: Set<string>,
) {
  requireValue(
    productIds.has(recipe.productId as string) &&
      variantProductIds.get(recipe.variantId as string) === recipe.productId,

    `${label} refers to a missing product or variant.`,
  )

  for (const requirement of [
    ...requireArray(recipe.ingredients, `${label} ingredients`),

    ...requireArray(recipe.packaging, `${label} packaging`),
  ]) {
    const item = requireRecord(requirement, `${label} stock requirement`)

    requireValue(
      inventoryIds.has(item.inventoryId as string),

      `${label} refers to missing inventory.`,
    )
  }
}

function validateExpenseCollections(
  value: Record<string, unknown>,

  allowMissing: boolean,
) {
  const expenseCategories =
    value.expenseCategories === undefined && allowMissing
      ? structuredClone(BUILT_IN_EXPENSE_CATEGORIES)
      : requireArray(value.expenseCategories, "Expense categories")

  const expenses =
    value.expenses === undefined && allowMissing
      ? []
      : requireArray(value.expenses, "Expenses")

  const expenseAllocationHistories =
    value.expenseAllocationHistories === undefined && allowMissing
      ? []
      : requireArray(
          value.expenseAllocationHistories,

          "Expense allocation histories",
        )

  const categories = expenseCategories.map((item, index) => {
    const category = requireRecord(item, `Expense category ${index + 1}`)

    requireString(category.id, "Expense category ID")

    requireString(category.name, "Expense category name")

    requireValue(
      category.source === "built-in" || category.source === "custom",

      "Expense category source is invalid.",
    )

    const result = validateExpenseCategory(
      category as unknown as ExpenseCategory,
    )

    requireValue(result.valid, result.issues.join(" "))

    return category as unknown as ExpenseCategory
  })

  const categoryIds = new Set<string>()

  for (const category of categories) {
    requireUniqueId(categoryIds, category.id, "Expense category")
  }

  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )

  for (const builtIn of BUILT_IN_EXPENSE_CATEGORIES) {
    const persisted = categoriesById.get(builtIn.id)

    requireValue(
      persisted?.source === "built-in" && persisted.name === builtIn.name,

      `Built-in expense category ${builtIn.name} is missing or invalid.`,
    )
  }

  const orderRecords = requireArray(value.orders, "Orders").map((item) =>
    requireRecord(item, "Order"),
  )

  const orders = orderRecords as unknown as Order[]

  const expenseRecords = expenses.map((item, index) => {
    const expense = requireRecord(item, `Expense ${index + 1}`)

    requireString(expense.id, "Expense ID")

    requireValue(
      typeof expense.amount === "number",

      "Expense amount is invalid.",
    )

    requireString(expense.paidDate, "Expense paid date")

    requireString(expense.categoryId, "Expense category ID")

    requireString(expense.description, "Expense description")

    if (expense.note !== undefined)
      requireString(expense.note, "Expense note", true)

    requireString(expense.createdAt, "Expense creation timestamp")

    const attribution = requireRecord(
      expense.attribution,
      "Expense attribution",
    )

    if (attribution.type === "direct") {
      requireString(attribution.orderId, "Direct expense order ID")
    } else {
      requireValue(
        attribution.type === "shared",

        "Expense attribution is invalid.",
      )
    }

    return expense as unknown as Expense
  })

  const expenseIds = new Set<string>()

  for (const expense of expenseRecords) {
    requireUniqueId(expenseIds, expense.id, "Expense")

    const result = validateExpense(expense, categories, orders)

    requireValue(result.valid, result.issues.join(" "))
  }

  const expensesById = new Map(
    expenseRecords.map((expense) => [expense.id, expense]),
  )

  const allocationHistories = expenseAllocationHistories.map((item, index) => {
    const history = requireRecord(
      item,
      `Expense allocation history ${index + 1}`,
    )

    requireString(history.expenseId, "Allocation history expense ID")

    const sourceExpense = expensesById.get(history.expenseId as string)

    requireValue(
      sourceExpense,
      "An allocation history refers to a missing expense.",
    )

    const versions = requireArray(history.versions, "Allocation versions")

    requireValue(versions.length > 0, "An allocation history cannot be empty.")

    versions.forEach((versionValue, versionIndex) => {
      const version = requireRecord(
        versionValue,

        `Allocation version ${versionIndex + 1}`,
      )

      requireString(version.id, "Allocation version ID")

      requireString(version.expenseId, "Allocation version expense ID")

      requireValue(
        Number.isSafeInteger(version.version),

        "Allocation version number is invalid.",
      )

      requireString(version.createdAt, "Allocation version timestamp")

      if (version.reason !== undefined)
        requireString(version.reason, "Allocation version reason", true)

      requireArray(version.allocations, "Allocation entries").forEach(
        (allocationValue, allocationIndex) => {
          const allocation = requireRecord(
            allocationValue,

            `Allocation entry ${allocationIndex + 1}`,
          )

          requireString(allocation.id, "Allocation entry ID")

          requireString(allocation.orderId, "Allocation order ID")

          requireValue(
            typeof allocation.amount === "number",

            "Allocation amount is invalid.",
          )
        },
      )
    })

    const typedHistory = history as unknown as ExpenseAllocationHistory

    const result = validateAllocationHistory(
      sourceExpense,

      typedHistory.versions as ExpenseAllocationVersion[],

      orders,
    )

    requireValue(result.valid, result.issues.join(" "))

    return typedHistory
  })

  const historyExpenseIds = new Set<string>()

  const allocationVersionIds = new Set<string>()

  const allocationEntryIds = new Set<string>()

  for (const history of allocationHistories) {
    requireUniqueId(historyExpenseIds, history.expenseId, "Allocation history")

    for (const version of history.versions) {
      requireUniqueId(allocationVersionIds, version.id, "Allocation version")

      for (const allocation of version.allocations) {
        requireUniqueId(allocationEntryIds, allocation.id, "Allocation entry")
      }
    }
  }

  return {
    expenseCategories: categories,

    expenses: expenseRecords,

    expenseAllocationHistories: allocationHistories,
  }
}

function validateNullableTimestamp(
  value: unknown,
  label: string,
): string | null {
  if (value === undefined || value === null) return null

  requireValue(
    typeof value === "string" && isValidTimestamp(value),

    `${label} must be a valid timestamp or null.`,
  )

  return value
}

function validateBackupSettings(raw: unknown): AppSettings {
  if (raw === undefined) {
    return structuredClone(defaultSettings)
  }

  const record = requireRecord(raw, "Settings")

  if (record.businessName !== undefined) {
    requireString(record.businessName, "Business name")
  }

  if (record.ownerName !== undefined) {
    requireString(record.ownerName, "Owner name", true)
  }

  if (record.defaultLabourRatePerHour !== undefined) {
    requireFiniteNumber(
      record.defaultLabourRatePerHour,

      "Default labour rate per hour",
    )
  }

  const defaultPricingMode =
    record.defaultPricingMode === undefined
      ? defaultSettings.defaultPricingMode
      : record.defaultPricingMode

  requireValue(
    defaultPricingMode === "margin" || defaultPricingMode === "markup",

    "Default pricing mode must be margin or markup.",
  )

  if (record.defaultMarginPercent !== undefined) {
    requireFiniteNumber(record.defaultMarginPercent, "Default margin percent")
  }

  const defaultMarginPercent =
    record.defaultMarginPercent === undefined
      ? defaultSettings.defaultMarginPercent
      : record.defaultMarginPercent as number

  requireValue(
    defaultMarginPercent < 100,

    "Default margin percent must be below 100.",
  )

  if (record.defaultMarkupPercent !== undefined) {
    requireFiniteNumber(record.defaultMarkupPercent, "Default markup percent")
  }

  const priceRoundingStep =
    record.priceRoundingStep === undefined
      ? defaultSettings.priceRoundingStep
      : record.priceRoundingStep

  requireValue(
    priceRoundingStep === 1 ||
      priceRoundingStep === 50 ||
      priceRoundingStep === 100,

    "Price rounding step must be 1, 50, or 100.",
  )

  if (record.defaultLowStockThreshold !== undefined) {
    requireFiniteNumber(
      record.defaultLowStockThreshold,

      "Default low stock threshold",
    )
  }

  return {
    businessName:
      record.businessName === undefined
        ? defaultSettings.businessName
        : (record.businessName as string).trim(),

    ownerName:
      record.ownerName === undefined
        ? defaultSettings.ownerName
        : (record.ownerName as string).trim(),

    defaultLabourRatePerHour:
      record.defaultLabourRatePerHour === undefined
        ? defaultSettings.defaultLabourRatePerHour
        : record.defaultLabourRatePerHour as number,

    defaultPricingMode,

    defaultMarginPercent,

    defaultMarkupPercent:
      record.defaultMarkupPercent === undefined
        ? defaultSettings.defaultMarkupPercent
        : record.defaultMarkupPercent as number,

    priceRoundingStep,

    defaultLowStockThreshold:
      record.defaultLowStockThreshold === undefined
        ? defaultSettings.defaultLowStockThreshold
        : record.defaultLowStockThreshold as number,

    backupReminderDismissedAt: validateNullableTimestamp(
      record.backupReminderDismissedAt,

      "Backup reminder dismissed timestamp",
    ),

    backupReminderSnoozedUntil: validateNullableTimestamp(
      record.backupReminderSnoozedUntil,

      "Backup reminder snoozed timestamp",
    ),

    lastBackupAt: validateNullableTimestamp(
      record.lastBackupAt,

      "Last backup timestamp",
    ),
  }
}

function validateBackupBudgetPlan(rawBudgetPlan: unknown): BudgetPlan {
  if (rawBudgetPlan === undefined) {
    return structuredClone(defaultBudgetPlan)
  }

  const record = requireRecord(rawBudgetPlan, "Budget plan")

  const validateOptionalWholeLkr = (val: unknown, label: string) => {
    if (val === undefined) return undefined

    requireValue(
      typeof val === "number" && Number.isSafeInteger(val) && val >= 0,

      `${label} must be a whole non-negative LKR integer.`,
    )

    return val as number
  }

  const categoryLimits: Record<string, number> = {}

  if (record.categoryLimits !== undefined) {
    const limits = requireRecord(
      record.categoryLimits,
      "Budget category limits",
    )

    for (const [key, val] of Object.entries(limits)) {
      requireValue(
        typeof val === "number" && Number.isSafeInteger(val) && val >= 0,

        `Budget limit for ${key} must be a whole non-negative LKR integer.`,
      )

      categoryLimits[key] = (val as number)
    }
  }

  return {
    monthlySalesTarget: validateOptionalWholeLkr(
      record.monthlySalesTarget,

      "Monthly sales target",
    ),

    monthlyProfitTarget: validateOptionalWholeLkr(
      record.monthlyProfitTarget,

      "Monthly profit target",
    ),

    ingredientSpendLimit: validateOptionalWholeLkr(
      record.ingredientSpendLimit,

      "Ingredient spend limit",
    ),

    categoryLimits,

    updatedAt:
      typeof record.updatedAt === "string" && record.updatedAt.trim()
        ? record.updatedAt
        : defaultBudgetPlan.updatedAt,
  }
}

function validateBackupData(
  value: unknown,

  allowMissingExpenseCollections = false,
): AppData {
  const data = requireRecord(value, "Backup data")

  const collectionNames = [
    "customers",

    "products",

    "recipes",

    "orders",

    "inventory",

    "extraStockPlans",

    "extraStockPreparations",

    "finishedStockBatches",

    "finishedStockTransactions",

    "purchases",

    "inventoryMovements",

    "shoppingSelections",

    "preparationRecords",
  ] as const

  for (const collection of collectionNames) {
    requireValue(
      collection === "shoppingSelections"
        ? isRecord(data[collection])
        : Array.isArray(data[collection]),

      `Backup is missing a valid ${collection} collection.`,
    )
  }

  requireValue(
    data.refunds === undefined || Array.isArray(data.refunds),

    "Backup refunds collection must be an array.",
  )

  requireValue(
    data.shoppingTrips === undefined || Array.isArray(data.shoppingTrips),

    "Backup shoppingTrips collection must be an array.",
  )

  const expenseCollections = validateExpenseCollections(
    data,

    allowMissingExpenseCollections,
  )

  const customers = requireArray(data.customers, "Customers")

  const products = requireArray(data.products, "Products")

  const recipes = requireArray(data.recipes, "Recipes")

  const orders = requireArray(data.orders, "Orders")

  const inventory = requireArray(data.inventory, "Inventory")

  const plans = requireArray(data.extraStockPlans, "Extra-stock plans")

  const extraPreparations = requireArray(
    data.extraStockPreparations,

    "Extra-stock preparations",
  )

  const batches = requireArray(
    data.finishedStockBatches,
    "Finished-stock batches",
  )

  const transactions = requireArray(
    data.finishedStockTransactions,

    "Finished-stock transactions",
  )

  const purchases = requireArray(data.purchases, "Purchases")

  const movements = requireArray(data.inventoryMovements, "Inventory movements")

  const preparationRecords = requireArray(
    data.preparationRecords,

    "Preparation records",
  )

  const refunds =
    data.refunds === undefined ? [] : requireArray(data.refunds, "Refunds")

  const customerIds = new Set<string>()

  customers.forEach((value, index) => {
    const customer = requireRecordId(value, `Customer ${index + 1}`)

    requireString(customer.name, "Customer name")

    requireString(customer.phone, "Customer phone", true)

    requireUniqueId(customerIds, customer.id as string, "Customer")
  })

  const inventoryIds = new Set<string>()

  inventory.forEach((value, index) => {
    const item = requireRecord(value, `Inventory item ${index + 1}`)

    requireString(item.inventoryId, "Inventory ID")

    requireString(item.name, "Inventory name")

    validateOptionalImageRef(item.image, "Inventory image")

    requireFiniteNumber(item.physical, "Inventory physical quantity")

    requireValue(
      ["g", "ml", "unit"].includes(String(item.unit)),
      "Inventory unit is invalid.",
    )

    if (item.category !== undefined) {
      requireValue(
        ["ingredient", "packaging", "finished"].includes(String(item.category)),

        "Inventory category is invalid.",
      )
    }

    requireUniqueId(inventoryIds, item.inventoryId as string, "Inventory")
  })

  const productIds = new Set<string>()

  const variantIds = new Set<string>()

  const variantProductIds = new Map<string, string>()

  products.forEach((value, index) => {
    const product = requireRecordId(value, `Product ${index + 1}`)

    requireString(product.name, "Product name")

    validateOptionalImageRef(product.image, "Product image")

    const variants = requireArray(product.variants, "Product variants")

    requireValue(
      variants.length > 0,
      "A product must have at least one variant.",
    )

    variants.forEach((variantValue, variantIndex) => {
      const variant = requireRecordId(
        variantValue,

        `Product variant ${variantIndex + 1}`,
      )

      requireString(variant.name, "Variant name")

      requireString(variant.unitLabel, "Variant unit label")

      requireUniqueId(variantIds, variant.id as string, "Product variant")

      variantProductIds.set(variant.id as string, product.id as string)

      if (variant.finishedInventoryId !== undefined) {
        requireValue(
          typeof variant.finishedInventoryId === "string" &&
            inventoryIds.has(variant.finishedInventoryId),

          "A product variant refers to missing finished inventory.",
        )
      }

      variantIds.add(variant.id as string)
    })

    requireUniqueId(productIds, product.id as string, "Product")
  })

  const recipeIds = new Set<string>()

  recipes.forEach((value, index) => {
    const recipe = requireRecordId(value, `Recipe ${index + 1}`)

    validateRecipeSnapshot(recipe, `Recipe ${index + 1}`)

    validateRecipeReferences(
      recipe,

      "Recipe",

      productIds,

      variantProductIds,

      inventoryIds,
    )

    requireUniqueId(recipeIds, recipe.id as string, "Recipe")
  })

  const orderIds = new Set<string>()

  const orderReferences = new Set<string>()

  const orderLineIds = new Set<string>()

  const orderLineIdsByOrder = new Map<string, Set<string>>()

  const paymentIds = new Set<string>()

  const paymentOrderIds = new Map<string, string>()

  const paymentAmounts = new Map<string, number>()

  orders.forEach((value, index) => {
    const order = requireRecordId(value, `Order ${index + 1}`)

    requireString(order.reference, "Order reference")

    validateOptionalImageRef(order.referencePhoto, "Order reference photo")

    requireUniqueId(
      orderReferences,
      order.reference as string,
      "Order reference",
    )

    requireValue(
      ["Draft", "Confirmed", "In Progress", "Completed", "Cancelled"].includes(
        String(order.status),
      ),
      "Order status is invalid.",
    )

    requireValue(
      [
        "Not started",
        "Awaiting preparation",
        "In progress",
        "Ready",
        "Completed",
        "Cancelled",
      ].includes(String(order.preparationStatus)),
      "Order preparation status is invalid.",
    )

    if (order.collectionDate !== undefined && order.collectionDate !== "") {
      requireValue(
        typeof order.collectionDate === "string" &&
          isValidDate(order.collectionDate),
        "Order collection date is invalid.",
      )
    }

    if (order.collectionTime !== undefined && order.collectionTime !== "") {
      requireValue(
        typeof order.collectionTime === "string" &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(order.collectionTime),
        "Order collection time is invalid.",
      )
    }

    const costSnapshot = requireRecord(order.costSnapshot, "Order cost snapshot")
    requireFiniteNumber(costSnapshot.ingredients, "Order ingredient cost")
    requireFiniteNumber(costSnapshot.packaging, "Order packaging cost")
    requireFiniteNumber(costSnapshot.labour, "Order labour cost")
    requireFiniteNumber(costSnapshot.estimatedTotal, "Order estimated total")
    requireFiniteNumber(costSnapshot.suggestedPrice, "Order suggested price")

    if (order.collectedAt !== undefined && order.collectedAt !== null) {
      requireValue(
        typeof order.collectedAt === "string" &&
          isValidTimestamp(order.collectedAt),

        "Order collection timestamp is invalid.",
      )
    }

    if (order.cancellationFee !== undefined) {
      requireValue(
        typeof order.cancellationFee === "number" &&
          Number.isSafeInteger(order.cancellationFee) &&
          order.cancellationFee >= 0,
        "Order cancellation fee is invalid.",
      )
    }

    requireValue(
      order.customerId === null ||
        (typeof order.customerId === "string" &&
          customerIds.has(order.customerId)),

      "An order refers to a missing customer.",
    )

    requireValue(
      typeof order.agreedPrice === "number" &&
        Number.isSafeInteger(order.agreedPrice) &&
        order.agreedPrice >= 0,
      "Order agreed price must be a non-negative whole LKR integer.",
    )

    const lineIds = new Set<string>()

    requireArray(order.lines, "Order lines").forEach((lineValue) => {
      const line = requireRecordId(lineValue, "Order line")

      requireValue(
        productIds.has(line.productId as string) &&
          variantProductIds.get(line.variantId as string) === line.productId,

        "An order line refers to a missing product or variant.",
      )

      requireFiniteNumber(
        line.quantity,
        "Order line quantity",
        Number.MIN_VALUE,
      )

      requireValue(
        line.recipeId === null ||
          (typeof line.recipeId === "string" && recipeIds.has(line.recipeId)),

        "An order line refers to a missing recipe.",
      )

      validateRecipeSnapshot(line.recipeSnapshot, "Order recipe snapshot")

      validateRecipeReferences(
        requireRecord(line.recipeSnapshot, "Order recipe snapshot"),

        "Order recipe snapshot",

        productIds,

        variantProductIds,

        inventoryIds,
      )

      requireUniqueId(lineIds, line.id as string, "Order line")

      requireUniqueId(orderLineIds, line.id as string, "Order line")
    })

    for (const field of ["reservations", "shortages"] as const) {
      requireArray(order[field], `Order ${field}`).forEach(
        (requirementValue) => {
          const requirement = requireRecord(
            requirementValue,
            `Order ${field} entry`,
          )

          requireValue(
            inventoryIds.has(requirement.inventoryId as string),

            "An order requirement refers to missing inventory.",
          )

          if (requirement.lineId !== undefined) {
            requireValue(
              lineIds.has(requirement.lineId as string),

              "An order requirement refers to a missing order line.",
            )
          }

          for (const quantity of [
            "required",

            "availableAtConfirmation",

            "reserved",

            "shortage",
          ]) {
            requireFiniteNumber(requirement[quantity], `Order ${quantity}`)
          }
        },
      )
    }

    requireArray(order.payments, "Order payments").forEach((paymentValue) => {
      const payment = requireRecordId(paymentValue, "Payment")

      requireValue(
        typeof payment.date === "string" && isValidDate(payment.date),

        "Payment date is invalid.",
      )

      requireString(payment.method, "Payment method")

      requireMoneyAmount(payment.amount, "Payment amount")

      requireUniqueId(paymentIds, payment.id as string, "Payment")

      paymentOrderIds.set(payment.id as string, order.id as string)

      paymentAmounts.set(payment.id as string, payment.amount as number)
    })

    orderLineIdsByOrder.set(order.id as string, lineIds)
    requireUniqueId(orderIds, order.id as string, "Order")
  })

  const refundIds = new Set<string>()

  const refundedByPayment = new Map<string, number>()

  refunds.forEach((value, index) => {
    const refund = requireRecordId(value, `Refund ${index + 1}`)

    requireString(refund.orderId, "Refund order ID")

    requireString(refund.paymentId, "Refund payment ID")

    requireValue(
      orderIds.has(refund.orderId as string) &&
        paymentOrderIds.get(refund.paymentId as string) === refund.orderId,

      "A refund must refer to a payment belonging to its order.",
    )

    requireValue(
      typeof refund.date === "string" && isValidDate(refund.date),

      "Refund date is invalid.",
    )

    requireMoneyAmount(refund.amount, "Refund amount")

    requireString(refund.reason, "Refund reason")

    requireUniqueId(refundIds, refund.id as string, "Refund")

    const refunded =
      (refundedByPayment.get(refund.paymentId as string) ?? 0) +
      (refund.amount as number)

    requireValue(
      Number.isSafeInteger(refunded),

      "Refund total is outside the supported range.",
    )

    requireValue(
      refunded <= (paymentAmounts.get(refund.paymentId as string) ?? 0),

      "Refunds cannot exceed the original payment amount.",
    )

    refundedByPayment.set(refund.paymentId as string, refunded)
  })

  const planIds = new Set<string>()

  plans.forEach((value, index) => {
    const plan = requireRecordId(value, `Extra-stock plan ${index + 1}`)

    requireValue(
      productIds.has(plan.productId as string) &&
        variantProductIds.get(plan.variantId as string) === plan.productId &&
        recipeIds.has(plan.recipeId as string),

      "An extra-stock plan refers to a missing product, variant, or recipe.",
    )

    validateRecipeSnapshot(plan.recipeSnapshot, "Extra-stock recipe snapshot")

    validateRecipeReferences(
      requireRecord(plan.recipeSnapshot, "Extra-stock recipe snapshot"),

      "Extra-stock recipe snapshot",

      productIds,

      variantProductIds,

      inventoryIds,
    )

    requireFiniteNumber(
      plan.quantity,
      "Extra-stock plan quantity",
      Number.MIN_VALUE,
    )

    requireUniqueId(planIds, plan.id as string, "Extra-stock plan")
  })

  const preparationIds = new Set<string>()
  const extraPreparationIds = new Set<string>()

  const preparationList = [
    ...preparationRecords.map((value) => ({ value, kind: "order" as const })),

    ...extraPreparations.map((value) => ({ value, kind: "extra" as const })),
  ]

  preparationList.forEach(({ value, kind }) => {
    const preparation = requireRecordId(value, "Preparation record")

    if (kind === "order") {
      requireValue(
        orderIds.has(preparation.orderId as string) &&
          Boolean(
            orderLineIdsByOrder
              .get(preparation.orderId as string)
              ?.has(preparation.orderLineId as string),
          ),

        "A preparation record refers to a missing order or order line.",
      )
    } else {
      requireValue(
        planIds.has(preparation.planId as string) &&
          productIds.has(preparation.productId as string) &&
          variantProductIds.get(preparation.variantId as string) ===
            preparation.productId &&
          inventoryIds.has(preparation.finishedInventoryId as string),

        "An extra-stock preparation refers to a missing related record.",
      )
      extraPreparationIds.add(preparation.id as string)
    }

    validateRecipeSnapshot(
      preparation.recipeSnapshot,
      "Preparation recipe snapshot",
    )

    validateRecipeReferences(
      requireRecord(preparation.recipeSnapshot, "Preparation recipe snapshot"),

      "Preparation recipe snapshot",

      productIds,

      variantProductIds,

      inventoryIds,
    )

    requireArray(preparation.actualUsage, "Preparation actual usage").forEach(
      (usageValue) => {
        const usage = requireRecord(usageValue, "Preparation usage")

        requireValue(
          inventoryIds.has(usage.inventoryId as string),

          "Preparation usage refers to missing inventory.",
        )

        requireFiniteNumber(usage.plannedQuantity, "Planned usage")

        requireFiniteNumber(usage.actualQuantity, "Actual usage")
      },
    )

    requireArray(
      preparation.completedSteps,
      "Completed preparation steps",
    ).forEach(
      (step) => requireFiniteNumber(step, "Completed step"),
    )

    requireUniqueId(preparationIds, preparation.id as string, "Preparation")
  })

  const batchIds = new Set<string>()

  batches.forEach((value) => {
    const batch = requireRecordId(value, "Finished-stock batch")

    requireValue(
      inventoryIds.has(batch.inventoryId as string),

      "A finished-stock batch refers to missing inventory.",
    )

    requireFiniteNumber(batch.remainingQuantity, "Batch remaining quantity")

    if (batch.source === "production") {
      requireValue(
        extraPreparationIds.has(batch.preparationId as string) &&
          planIds.has(batch.planId as string) &&
          productIds.has(batch.productId as string) &&
          variantProductIds.get(batch.variantId as string) === batch.productId,

        "A production batch refers to missing preparation, plan, product, or variant data.",
      )

      requireFiniteNumber(
        batch.producedQuantity,
        "Batch produced quantity",
        Number.MIN_VALUE,
      )

      requireValue(
        (batch.remainingQuantity as number) <= (batch.producedQuantity as number),
        "Batch remaining quantity cannot exceed produced quantity.",
      )

      requireFiniteNumber(batch.actualTotalCost, "Batch total cost")

      requireFiniteNumber(batch.actualUnitCost, "Batch unit cost")
    } else {
      requireValue(
        batch.source === "legacy-opening",
        "Finished-stock batch source is invalid.",
      )

      requireFiniteNumber(
        batch.reconciledQuantity,
        "Reconciled quantity",
        Number.MIN_VALUE,
      )

      requireFiniteNumber(batch.unitCost, "Reconciled unit cost")

      requireString(batch.reconciliationReason, "Reconciliation reason")
    }

    requireUniqueId(batchIds, batch.id as string, "Finished-stock batch")
  })

  const transactionIds = new Set<string>()

  transactions.forEach((value) => {
    const transaction = requireRecordId(value, "Finished-stock transaction")

    requireValue(
      batchIds.has(transaction.batchId as string) &&
        inventoryIds.has(transaction.inventoryId as string),

      "A finished-stock transaction refers to missing batch or inventory data.",
    )

    requireFiniteNumber(
      transaction.quantity,
      "Transaction quantity",
      Number.MIN_VALUE,
    )

    requireFiniteNumber(transaction.unitCost, "Transaction unit cost")

    requireFiniteNumber(transaction.totalCost, "Transaction total cost")

    requireString(transaction.occurredAt, "Transaction date")

    if (transaction.type === "write-off") {
      requireString(transaction.reason, "Write-off reason")
    } else {
      requireValue(
        transaction.type === "sale",
        "Finished-stock transaction type is invalid.",
      )

      if (transaction.sellingPrice !== undefined) {
        requireFiniteNumber(
          transaction.sellingPrice,
          "Transaction selling price",
        )
      }

      if (transaction.paymentMethod !== undefined) {
        requireString(
          transaction.paymentMethod,
          "Transaction payment method",
          true,
        )
      }

      if (transaction.customerName !== undefined) {
        requireString(
          transaction.customerName,
          "Transaction customer name",
          true,
        )
      }
    }

    requireUniqueId(
      transactionIds,

      transaction.id as string,

      "Finished-stock transaction",
    )
  })

  const purchaseIds = new Set<string>()

  purchases.forEach((value) => {
    const purchase = requireRecordId(value, "Purchase")

    requireValue(
      inventoryIds.has(purchase.inventoryId as string),

      "A purchase refers to missing inventory.",
    )

    requireFiniteNumber(
      purchase.purchasedQuantity,
      "Purchased quantity",
      Number.MIN_VALUE,
    )

    requireFiniteNumber(
      purchase.usableQuantity,
      "Usable quantity",
      Number.MIN_VALUE,
    )

    requireFiniteNumber(
      purchase.usableBaseQuantity,
      "Usable base quantity",
      Number.MIN_VALUE,
    )

    requireFiniteNumber(purchase.totalPrice, "Purchase total", Number.MIN_VALUE)

    requireString(purchase.purchasedUnit, "Purchased unit")

    requireString(purchase.usableUnit, "Usable unit")

    requireString(purchase.date, "Purchase date")

    requireUniqueId(purchaseIds, purchase.id as string, "Purchase")
  })

  const movementIds = new Set<string>()

  movements.forEach((value) => {
    const movement = requireRecordId(value, "Inventory movement")

    requireValue(
      inventoryIds.has(movement.inventoryId as string),

      "An inventory movement refers to missing inventory.",
    )

    requireFiniteNumber(movement.quantityDelta, "Movement quantity", -Infinity)

    requireFiniteNumber(movement.balanceAfter, "Movement balance")

    requireValue(
      [
        "Opening balance",
        "Purchase",
        "Correction",
        "Spoilage",
        "Damage",
        "Other",
        "Preparation consumption",
        "Production",
        "Finished stock sale",
        "Finished stock write-off",
      ].includes(String(movement.type)),
      "Movement type is invalid.",
    )

    requireValue(
      ["g", "ml", "unit"].includes(String(movement.unit)),
      "Movement unit is invalid.",
    )

    requireValue(
      typeof movement.date === "string" && isValidDate(movement.date),
      "Movement date is invalid.",
    )

    requireString(movement.reason, "Movement reason", true)

    if (movement.purchaseId !== undefined) {
      requireValue(
        purchaseIds.has(movement.purchaseId as string),

        "An inventory movement refers to a missing purchase.",
      )
    }

    requireUniqueId(movementIds, movement.id as string, "Inventory movement")
  })

  for (const [inventoryId, quantity] of Object.entries(
    data.shoppingSelections as Record<string, unknown>,
  )) {
    requireValue(
      inventoryIds.has(inventoryId),

      "A shopping selection refers to missing inventory.",
    )

    requireFiniteNumber(quantity, "Shopping selection")
  }

  const shoppingTripIds = new Set<string>()
  const shoppingTripRefs = new Set<string>()
  const shoppingTrips = Array.isArray(data.shoppingTrips) ? data.shoppingTrips : []
  for (const tripValue of shoppingTrips) {
    const trip = requireRecordId(tripValue, "Shopping trip")
    requireString(trip.reference, "Shopping trip reference")
    requireUniqueId(shoppingTripRefs, trip.reference as string, "Shopping trip reference")
    requireValue(
      typeof trip.date === "string" && isValidDate(trip.date),
      "Shopping trip date is invalid.",
    )
    requireValue(
      typeof trip.createdAt === "string" && isValidTimestamp(trip.createdAt),
      "Shopping trip timestamp is invalid.",
    )
    if (trip.totalSpent !== null) {
      requireValue(
        typeof trip.totalSpent === "number" &&
          Number.isSafeInteger(trip.totalSpent) &&
          trip.totalSpent >= 0,
        "Shopping trip total spent is invalid.",
      )
    }
    requireArray(trip.items, "Shopping trip items")
    requireUniqueId(shoppingTripIds, trip.id as string, "Shopping trip")
  }

  const settings = validateBackupSettings(data.settings)

  const budgetPlan = validateBackupBudgetPlan(data.budgetPlan)

  const validatedData = {
    ...data,

    ...expenseCollections,

    refunds,

    shoppingTrips: Array.isArray(data.shoppingTrips) ? data.shoppingTrips : [],

    settings,

    budgetPlan,
  } as unknown as AppData

  return {
    ...validatedData,

    orders: validatedData.orders.map((order) => ({
      ...order,

      paymentStatus: derivePaymentStatus(order, validatedData.refunds),
    })),
  }
}

type PersistedAppData = AppData & { schemaVersion?: number }

function isSupportedDataShape(value: unknown): value is PersistedAppData {
  if (!isRecord(value)) return false

  if (
    value.schemaVersion !== undefined &&
    (typeof value.schemaVersion !== "number" ||
      !Number.isSafeInteger(value.schemaVersion) ||
      value.schemaVersion < 2 ||
      value.schemaVersion > CURRENT_SCHEMA_VERSION)
  ) {
    return false
  }

  if (
    !isObjectArray(value.orders) ||
    !isObjectArray(value.recipes) ||
    !isObjectArray(value.inventory)
  ) {
    return false
  }

  const expenseCollectionNames = [
    "expenseCategories",

    "expenses",

    "expenseAllocationHistories",
  ] as const

  if (
    expenseCollectionNames.some(
      (collection) =>
        (value[collection] !== undefined &&
          !Array.isArray(value[collection])) ||
        (value.schemaVersion === CURRENT_SCHEMA_VERSION &&
          !Array.isArray(value[collection])),
    )
  ) {
    return false
  }

  if (
    value.orders.some(
      (order) =>
        !Array.isArray(order.lines) ||
        !Array.isArray(order.reservations) ||
        !Array.isArray(order.shortages) ||
        (order.payments !== undefined &&
          (!Array.isArray(order.payments) ||
            order.payments.some(
              (payment) =>
                !isRecord(payment) ||
                typeof payment.id !== "string" ||
                !payment.id.trim() ||
                typeof payment.date !== "string" ||
                !isValidDate(payment.date) ||
                typeof payment.method !== "string" ||
                !payment.method.trim() ||
                typeof payment.amount !== "number" ||
                !Number.isSafeInteger(payment.amount) ||
                payment.amount <= 0,
            ))) ||
        (order.collectedAt !== undefined &&
          order.collectedAt !== null &&
          (typeof order.collectedAt !== "string" ||
            !isValidTimestamp(order.collectedAt))) ||
        (order.cancellationFee !== undefined &&
          (typeof order.cancellationFee !== "number" ||
            !Number.isSafeInteger(order.cancellationFee) ||
            order.cancellationFee < 0)),
    ) ||
    value.recipes.some(
      (recipe) =>
        !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.packaging),
    ) ||
    value.inventory.some(
      (item) =>
        typeof item.inventoryId !== "string" ||
        !item.inventoryId.trim() ||
        typeof item.name !== "string" ||
        typeof item.physical !== "number" ||
        !Number.isFinite(item.physical) ||
        item.physical < 0 ||
        !["g", "ml", "unit"].includes(String(item.unit)),
    ) ||
    (value.shoppingTrips !== undefined && !Array.isArray(value.shoppingTrips))
  ) {
    return false
  }

  if (
    (value.settings !== undefined && !isRecord(value.settings)) ||
    (value.schemaVersion === CURRENT_SCHEMA_VERSION &&
      !isRecord(value.settings)) ||
    (value.budgetPlan !== undefined && !isRecord(value.budgetPlan))
  ) {
    return false
  }

  if (value.refunds !== undefined && !isObjectArray(value.refunds)) return false

  for (const key of [
    "customers",

    "products",

    "extraStockPlans",

    "extraStockPreparations",

    "finishedStockBatches",

    "finishedStockTransactions",

    "purchases",

    "inventoryMovements",

    "preparationRecords",
  ]) {
    if (value[key] !== undefined && !Array.isArray(value[key])) return false
  }

  const orderIds = new Set(value.orders.map((order) => order.id))

  const paymentOrderIds = new Map<string, string>()

  const paymentAmounts = new Map<string, number>()

  for (const order of value.orders) {
    if (!Array.isArray(order.payments)) continue

    for (const payment of order.payments) {
      if (typeof payment.id !== "string" || paymentOrderIds.has(payment.id)) {
        return false
      }

      paymentOrderIds.set(payment.id, order.id as string)

      paymentAmounts.set(payment.id, payment.amount as number)
    }
  }

  const refundIds = new Set<string>()

  const refundedByPayment = new Map<string, number>()

  for (const refund of (value.refunds ?? []) as Record<string, unknown>[]) {
    if (
      typeof refund.id !== "string" ||
      !refund.id.trim() ||
      refundIds.has(refund.id) ||
      typeof refund.orderId !== "string" ||
      !orderIds.has(refund.orderId) ||
      typeof refund.paymentId !== "string" ||
      paymentOrderIds.get(refund.paymentId) !== refund.orderId ||
      typeof refund.date !== "string" ||
      !isValidDate(refund.date) ||
      typeof refund.amount !== "number" ||
      !Number.isSafeInteger(refund.amount) ||
      refund.amount <= 0 ||
      typeof refund.reason !== "string" ||
      !refund.reason.trim()
    ) {
      return false
    }

    const refunded =
      (refundedByPayment.get(refund.paymentId) ?? 0) + refund.amount

    if (
      !Number.isSafeInteger(refunded) ||
      refunded > (paymentAmounts.get(refund.paymentId) ?? 0)
    ) {
      return false
    }

    refundIds.add(refund.id)

    refundedByPayment.set(refund.paymentId, refunded)
  }

  return true
}

function getVersionFromKey(key: string) {
  const match = /-v(\d+)$/.exec(key)

  return match ? Number(match[1]) : null
}

function normalizeSavedValue(
  raw: string,

  key: string,

  normalize: NormalizeState,
): AppData {
  const parsed: unknown = JSON.parse(raw)

  if (!isSupportedDataShape(parsed)) {
    throw new Error("The saved data has an invalid or unsupported structure.")
  }

  const keyVersion = getVersionFromKey(key)

  if (
    keyVersion !== null &&
    typeof parsed.schemaVersion === "number" &&
    parsed.schemaVersion > keyVersion
  ) {
    throw new Error(
      `The saved data uses schema version ${parsed.schemaVersion}, newer than storage key version ${keyVersion}.`,
    )
  }

  const { schemaVersion: _, ...state } = parsed

  const normalized = normalize(state as AppData)

  if (!isSupportedDataShape(normalized)) {
    throw new Error("The saved data could not be safely normalized.")
  }

  validateExpenseCollections(
    normalized as unknown as Record<string, unknown>,

    false,
  )

  return normalized
}

export function readPersistedState(
  getStorage: StorageFactory,

  demo: AppData,

  normalize: NormalizeState,
): PersistenceBootstrap {
  let storage: StorageLike

  try {
    storage = getStorage()
  } catch (error) {
    return {
      kind: "recovery",

      key: null,

      raw: null,

      message: `Browser storage could not be opened: ${errorMessage(error)}`,
    }
  }

  let saved: { key: string; raw: string; source: "current" | "legacy" } | null =
    null

  let readingKey = CURRENT_STORAGE_KEY

  try {
    readingKey = CURRENT_STORAGE_KEY

    const current = storage.getItem(CURRENT_STORAGE_KEY)

    if (current !== null) {
      saved = { key: CURRENT_STORAGE_KEY, raw: current, source: "current" }
    } else {
      for (const key of LEGACY_STORAGE_KEYS) {
        readingKey = key

        const raw = storage.getItem(key)

        if (raw !== null) {
          saved = { key, raw, source: "legacy" }

          break
        }
      }
    }
  } catch (error) {
    return {
      kind: "recovery",

      key: saved?.key ?? readingKey,

      raw: saved?.raw ?? null,

      message: `Browser storage could not be read: ${errorMessage(error)}`,
    }
  }

  if (!saved) {
    try {
      return {
        kind: "ready",

        data: normalize(structuredClone(demo)),

        source: "demo",

        persistenceEnabled: true,
      }
    } catch (error) {
      return {
        kind: "recovery",

        key: null,

        raw: null,

        message: `Workspace data could not be initialized: ${errorMessage(error)}`,
      }
    }
  }

  try {
    return {
      kind: "ready",

      data: normalizeSavedValue(saved.raw, saved.key, normalize),

      source: saved.source,

      persistenceEnabled: true,
    }
  } catch (error) {
    return {
      kind: "recovery",

      key: saved.key,

      raw: saved.raw,

      message: `Saved data at “${saved.key}” was not loaded and has been preserved. ${errorMessage(error)}`,
    }
  }
}

export function serializeAppData(data: AppData) {
  return JSON.stringify({ ...data, schemaVersion: CURRENT_SCHEMA_VERSION })
}

export function createBackupEnvelope(
  data: AppData,

  exportedAt = new Date().toISOString(),
): BackupEnvelope {
  const validatedData = validateBackupData(data)

  requireValue(
    Number.isFinite(Date.parse(exportedAt)) &&
      new Date(exportedAt).toISOString() === exportedAt,

    "The backup export timestamp is invalid.",
  )

  return {
    format: BACKUP_FORMAT,

    backupSchemaVersion: BACKUP_SCHEMA_VERSION,

    exportedAt,

    data: structuredClone(validatedData),
  }
}

export function serializeBackup(data: AppData, exportedAt?: string) {
  const serialized = JSON.stringify(createBackupEnvelope(data, exportedAt))

  requireValue(
    typeof serialized === "string",
    "The backup could not be serialized.",
  )

  return serialized
}

export function parseBackupEnvelope(raw: string): BackupEnvelope {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("The selected file is not valid JSON.")
  }

  const envelope = requireRecord(parsed, "Backup file")

  requireValue(
    envelope.format === BACKUP_FORMAT,

    "This file is not a Udeni’s Specials backup.",
  )

  requireValue(
    envelope.backupSchemaVersion === LEGACY_BACKUP_SCHEMA_VERSION ||
      envelope.backupSchemaVersion === BACKUP_SCHEMA_VERSION,

    "This backup version is not supported.",
  )

  requireValue(
    typeof envelope.exportedAt === "string" &&
      Number.isFinite(Date.parse(envelope.exportedAt)),

    "The backup export date is invalid.",
  )

  const data = validateBackupData(
    envelope.data,

    envelope.backupSchemaVersion === LEGACY_BACKUP_SCHEMA_VERSION,
  )

  return {
    format: BACKUP_FORMAT,

    backupSchemaVersion: BACKUP_SCHEMA_VERSION,

    exportedAt: envelope.exportedAt as string,

    data,
  }
}

export function parseBackup(raw: string): AppData {
  return parseBackupEnvelope(raw).data
}

function makeRecoveryId(): string {
  return createId("recovery")
}

export function restoreBackup(
  getStorage: StorageFactory,

  rawBackup: string,

  recoverySource?: RecoverySource,

  recoveryId = makeRecoveryId(),
): RestoreResult {
  let data: AppData

  let serialized: string

  try {
    data = parseBackup(rawBackup)

    serialized = serializeAppData(data)
  } catch (error) {
    return {
      ok: false,

      error:
        error instanceof Error
          ? error.message
          : "The selected backup could not be validated.",
    }
  }

  let storage: StorageLike

  let previousRaw: string | null

  let legacyRaw: string | null = null

  try {
    storage = getStorage()

    previousRaw = storage.getItem(CURRENT_STORAGE_KEY)

    if (previousRaw === null) {
      for (const key of LEGACY_STORAGE_KEYS) {
        legacyRaw = storage.getItem(key)

        if (legacyRaw !== null) break
      }
    }
  } catch {
    return {
      ok: false,

      error: "Browser storage is unavailable. Current data was not changed.",
    }
  }

  const rawToPreserve =
    previousRaw ??
    legacyRaw ??
    (recoverySource?.raw !== null && recoverySource?.raw !== undefined
      ? recoverySource.raw
      : null)

  if (rawToPreserve !== null) {
    try {
      const preservationKey = `${RECOVERY_STORAGE_PREFIX}${recoveryId}`

      storage.setItem(preservationKey, rawToPreserve)

      requireValue(
        storage.getItem(preservationKey) === rawToPreserve,

        "The recovery copy could not be verified.",
      )
    } catch {
      return {
        ok: false,

        error:
          "A recovery copy of the current saved data could not be verified. Restore was cancelled.",
      }
    }
  }

  try {
    storage.setItem(CURRENT_STORAGE_KEY, serialized)

    requireValue(
      storage.getItem(CURRENT_STORAGE_KEY) === serialized,

      "The restored data could not be verified.",
    )

    return { ok: true, data }
  } catch {
    try {
      if (previousRaw === null) {
        storage.removeItem(CURRENT_STORAGE_KEY)

        requireValue(
          storage.getItem(CURRENT_STORAGE_KEY) === null,

          "The previous empty storage state could not be restored.",
        )
      } else {
        storage.setItem(CURRENT_STORAGE_KEY, previousRaw)

        requireValue(
          storage.getItem(CURRENT_STORAGE_KEY) === previousRaw,

          "The previous saved value could not be restored.",
        )
      }
    } catch {
      return {
        ok: false,

        error:
          "Restore failed and the previous saved value could not be verified as restored. Do not close this page; use the preserved recovery copy if needed.",
      }
    }

    return {
      ok: false,

      error:
        "The restored data could not be saved. The previous saved value was restored and remains active.",
    }
  }
}

export function persistAppData(
  getStorage: StorageFactory,

  data: AppData,
) {
  getStorage().setItem(CURRENT_STORAGE_KEY, serializeAppData(data))
}

export function startFreshPreservingRaw(
  recovery: PersistenceRecovery,

  getStorage: StorageFactory,

  demo: AppData,

  normalize: NormalizeState,

  recoveryId: string,
): PersistenceBootstrap {
  let freshData: AppData

  try {
    freshData = normalize(structuredClone(demo))
  } catch (error) {
    return {
      ...recovery,

      message: `Workspace data could not be initialized. ${errorMessage(error)}`,
    }
  }

  if (recovery.raw === null || recovery.key === null) {
    return {
      kind: "ready",

      data: freshData,

      source: "fresh",

      persistenceEnabled: false,

      persistenceError:
        "A fresh workspace is available for this session, but storage access failed. It will not be saved, and existing data was not changed.",
    }
  }

  try {
    const storage = getStorage()

    const preservedKey = `${RECOVERY_STORAGE_PREFIX}${recoveryId}`

    storage.setItem(preservedKey, recovery.raw)

    if (storage.getItem(preservedKey) !== recovery.raw) {
      throw new Error("The preserved data could not be verified.")
    }

    storage.setItem(CURRENT_STORAGE_KEY, serializeAppData(freshData))

    return {
      kind: "ready",

      data: freshData,

      source: "fresh",

      persistenceEnabled: true,
    }
  } catch (error) {
    return {
      ...recovery,

      message: `Fresh data was not started because the original could not be safely preserved or fresh data could not be saved. ${errorMessage(error)}`,
    }
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
