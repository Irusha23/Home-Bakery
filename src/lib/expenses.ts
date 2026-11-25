import type {
  Expense,
  ExpenseAllocationVersion,
  ExpenseCategory,
  Order,
} from "../types"

import { isValidFinancialDate, isValidMoneyAmount } from "./financials"

export const BUILT_IN_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "expense-category-utilities", name: "Utilities", source: "built-in" },

  { id: "expense-category-other", name: "Other", source: "built-in" },
]

export type ValidationResult =
  | { valid: false; issues: string[] }
  | {
      valid: true
      issues: string[]
    }

export type AllocationVersionSelection = ValidationResult & {
  valid: false
} | ValidationResult & {
  valid: true

  version: ExpenseAllocationVersion | null
}

export type AllocationVersionAppendResult = ValidationResult & {
  valid: false
} | ValidationResult & {
  valid: true

  versions: ExpenseAllocationVersion[]
}

function isValidTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return false
  }

  const timestamp = new Date(value)

  return (
    Number.isFinite(timestamp.getTime()) &&
    timestamp.toISOString().slice(0, 19) === value.slice(0, 19)
  )
}

function isCustomerOrder(order: Order): boolean {
  return !order.isQuickOrder && order.customerId !== null
}

function validationResult(issues: string[]): ValidationResult {
  return issues.length ? { valid: false, issues } : { valid: true, issues: [] }
}

function validateSharedExpense(expense: Expense): string[] {
  const issues: string[] = []

  if (!expense.id.trim()) issues.push("Expense ID is required.")

  if (!isValidMoneyAmount(expense.amount))
    issues.push("Expense amount must be a positive whole-LKR amount.")

  if (expense.attribution.type !== "shared")
    issues.push("Only shared expenses can have allocation versions.")

  return issues
}

export function validateExpense(
  expense: Expense,

  categories: ExpenseCategory[],

  orders: Order[],
): ValidationResult {
  const issues: string[] = []

  if (typeof expense.id !== "string" || !expense.id.trim())
    issues.push("Expense ID is required.")

  if (!isValidMoneyAmount(expense.amount))
    issues.push("Expense amount must be a positive whole-LKR amount.")

  if (!isValidFinancialDate(expense.paidDate))
    issues.push("Enter a valid date when the expense was paid.")

  if (typeof expense.categoryId !== "string" || !expense.categoryId.trim()) {
    issues.push("Expense category is required.")
  } else {
    const matches = categories.filter(
      (category) => category.id === expense.categoryId,
    )

    if (matches.length !== 1)
      issues.push("Expense category must reference exactly one category.")
    else if (
      !matches[0].name.trim() ||
      (matches[0].source !== "built-in" && matches[0].source !== "custom")
    )
      issues.push("Expense category reference is invalid.")
  }

  if (typeof expense.description !== "string" || !expense.description.trim())
    issues.push("Expense description is required.")

  if (expense.note !== undefined && typeof expense.note !== "string")
    issues.push("Expense note must be text.")

  if (!isValidTimestamp(expense.createdAt))
    issues.push("Expense creation timestamp is invalid.")

  if (expense.attribution.type === "direct") {
    const orderId = expense.attribution.orderId

    if (!orderId.trim()) issues.push("Direct expense order is required.")
    else if (!orders.some((order) => order.id === orderId))
      issues.push("Direct expense must reference an existing order.")
  } else if (expense.attribution.type !== "shared") {
    issues.push("Expense attribution is invalid.")
  }

  return validationResult(issues)
}

export function totalAllocationAmount(
  version: ExpenseAllocationVersion,
): number {
  let total = 0

  for (const allocation of version.allocations) {
    if (!isValidMoneyAmount(allocation.amount)) return Number.NaN

    total += allocation.amount

    if (!Number.isSafeInteger(total)) return Number.NaN
  }

  return total
}

export function unallocatedExpenseBalance(
  expense: Expense,

  version: ExpenseAllocationVersion | null,
): number {
  if (
    expense.attribution.type !== "shared" ||
    !isValidMoneyAmount(expense.amount)
  )
    return Number.NaN

  if (!version) return expense.amount

  if (version.expenseId !== expense.id) return Number.NaN

  const total = totalAllocationAmount(version)

  if (!Number.isSafeInteger(total) || total > expense.amount) return Number.NaN

  return expense.amount - total
}

export function validateAllocationVersion(
  expense: Expense,

  version: ExpenseAllocationVersion,

  orders: Order[],
): ValidationResult {
  const issues = validateSharedExpense(expense)

  if (version.expenseId !== expense.id)
    issues.push("Allocation version must reference its source expense.")

  if (typeof version.id !== "string" || !version.id.trim())
    issues.push("Allocation version ID is required.")

  if (!Number.isSafeInteger(version.version) || version.version < 1)
    issues.push("Allocation version number must be a positive integer.")

  if (!isValidTimestamp(version.createdAt))
    issues.push("Allocation version timestamp is invalid.")

  if (version.reason !== undefined && typeof version.reason !== "string")
    issues.push("Allocation version reason must be text.")

  if (!Array.isArray(version.allocations)) {
    issues.push("Allocation entries are required.")
    return validationResult(issues)
  }

  const entryIds = new Set<string>()

  const orderIds = new Set<string>()

  let total = 0

  for (const allocation of version.allocations) {
    if (typeof allocation.id !== "string" || !allocation.id.trim()) {
      issues.push("Allocation entry ID is required.")
    } else if (entryIds.has(allocation.id)) {
      issues.push("Allocation entry IDs must be unique within a version.")
    } else {
      entryIds.add(allocation.id)
    }

    if (typeof allocation.orderId !== "string" || !allocation.orderId.trim()) {
      issues.push("Allocation target order ID is required.")
    } else {
      if (orderIds.has(allocation.orderId))
        issues.push("An order can appear only once in an allocation version.")

      orderIds.add(allocation.orderId)

      const target = orders.find((order) => order.id === allocation.orderId)

      if (!target || !isCustomerOrder(target))
        issues.push(
          "Each allocation target must be an existing customer order.",
        )
    }

    if (!isValidMoneyAmount(allocation.amount)) {
      issues.push("Allocation amount must be a positive whole-LKR amount.")
    } else {
      total += allocation.amount

      if (!Number.isSafeInteger(total))
        issues.push("Allocation total must be a safe whole-LKR amount.")
    }
  }

  if (Number.isSafeInteger(total) && total > expense.amount)
    issues.push("Allocation total cannot exceed the shared expense.")

  return validationResult(issues)
}

export function validateAllocationHistory(
  expense: Expense,

  versions: ExpenseAllocationVersion[],

  orders: Order[],
): ValidationResult {
  const issues = validateSharedExpense(expense)

  const versionIds = new Set<string>()

  const entryIds = new Set<string>()

  let previousCreatedAt = ""

  versions.forEach((version, index) => {
    const result = validateAllocationVersion(expense, version, orders)

    issues.push(...result.issues)

    if (version.version !== index + 1)
      issues.push("Allocation versions must be sequential starting at 1.")

    if (versionIds.has(version.id))
      issues.push("Allocation version IDs must be unique.")

    versionIds.add(version.id)

    if (
      previousCreatedAt &&
      isValidTimestamp(version.createdAt) &&
      version.createdAt < previousCreatedAt
    )
      issues.push("Allocation version timestamps cannot go backwards.")

    if (isValidTimestamp(version.createdAt))
      previousCreatedAt = version.createdAt

    for (const allocation of version.allocations) {
      if (entryIds.has(allocation.id))
        issues.push("Allocation entry IDs must be unique across versions.")

      entryIds.add(allocation.id)
    }
  })

  return validationResult(issues)
}

export function validateNewAllocationVersion(
  expense: Expense,

  previousVersions: ExpenseAllocationVersion[],

  nextVersion: ExpenseAllocationVersion,

  orders: Order[],
): ValidationResult {
  const result = validateAllocationHistory(
    expense,

    [...previousVersions, nextVersion],

    orders,
  )
  const issues = [...result.issues]
  if (Array.isArray(nextVersion.allocations)) {
    for (const allocation of nextVersion.allocations) {
      const target = orders.find((order) => order.id === allocation.orderId)
      if (target?.status === "Cancelled") {
        issues.push(
          `Cannot allocate a shared expense to cancelled order ${target.reference}.`,
        )
      }
    }
  }
  return validationResult(issues)
}

export function appendAllocationVersion(
  expense: Expense,

  previousVersions: ExpenseAllocationVersion[],

  nextVersion: ExpenseAllocationVersion,

  orders: Order[],
): AllocationVersionAppendResult {
  const result = validateNewAllocationVersion(
    expense,

    previousVersions,

    nextVersion,

    orders,
  )

  if (!result.valid) return result

  return {
    valid: true,
    issues: [],
    versions: [...previousVersions, nextVersion],
  }
}

export function selectLatestAllocationVersion(
  expense: Expense,

  versions: ExpenseAllocationVersion[],

  orders: Order[],
): AllocationVersionSelection {
  const result = validateAllocationHistory(expense, versions, orders)

  if (!result.valid) return result

  return {
    valid: true,

    issues: [],

    version: versions.length ? versions[versions.length - 1] : null,
  }
}

export function selectAllocationVersionAsKnownAt(
  expense: Expense,

  versions: ExpenseAllocationVersion[],

  orders: Order[],

  asOf: string,
): AllocationVersionSelection {
  if (!isValidTimestamp(asOf))
    return { valid: false, issues: ["Reporting timestamp is invalid."] }

  const result = validateAllocationHistory(expense, versions, orders)

  if (!result.valid) return result

  const eligible = versions.filter((version) => version.createdAt <= asOf)

  return {
    valid: true,

    issues: [],

    version: eligible.length ? eligible[eligible.length - 1] : null,
  }
}

export function validateExpenseCategory(
  category: ExpenseCategory,
): ValidationResult {
  const issues: string[] = []

  if (typeof category.id !== "string" || !category.id.trim())
    issues.push("Expense category ID is required.")

  if (typeof category.name !== "string" || !category.name.trim())
    issues.push("Expense category name is required.")

  if (category.source !== "built-in" && category.source !== "custom")
    issues.push("Expense category source must be built-in or custom.")

  return validationResult(issues)
}
