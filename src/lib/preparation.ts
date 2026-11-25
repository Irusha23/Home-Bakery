import {
  inventoryCategory,
  selectReservedByItem,
  toInventoryBaseQuantity,
} from "./inventory"
import type {
  AppData,
  ExtraStockPreparationRecord,
  OrderLine,
  PreparationRecord,
  PreparationUsage,
  RecipeSnapshot,
} from "../types"

export function createPlannedUsageForQuantity(
  state: AppData,
  recipeSnapshot: RecipeSnapshot,
  quantity: number,
): PreparationUsage[] {
  const createUsage = (
    item: RecipeSnapshot["ingredients"][number] | RecipeSnapshot["packaging"][number],
    category: PreparationUsage["category"],
  ): PreparationUsage => {
    const inventory = state.inventory.find(
      (entry) => entry.inventoryId === item.inventoryId,
    )
    const compatible =
      inventory !== undefined && inventoryCategory(inventory) === category
    const baseUnit = inventory?.unit ?? "unit"
    const plannedQuantity = compatible
      ? toInventoryBaseQuantity(item.quantity * quantity, item.unit, inventory)
      : Number.NaN
    return {
      inventoryId: item.inventoryId,
      name: item.name,
      plannedQuantity,
      actualQuantity: plannedQuantity,
      unit: baseUnit,
      category,
    }
  }

  return [
    ...recipeSnapshot.ingredients.map((item) =>
      createUsage(item, "ingredient"),
    ),
    ...recipeSnapshot.packaging.map((item) => createUsage(item, "packaging")),
  ]
}

export function createPlannedUsage(
  state: AppData,
  line: OrderLine,
): PreparationUsage[] {
  return createPlannedUsageForQuantity(
    state,
    line.recipeSnapshot,
    line.quantity,
  )
}

export function createPreparationRecord(
  state: AppData,
  orderId: string,
  line: OrderLine,
  status: PreparationRecord["status"] = "Awaiting preparation",
  updatedAt = new Date().toISOString(),
): PreparationRecord {
  return {
    id: `preparation-${orderId}-${line.id}`,
    orderId,
    orderLineId: line.id,
    status,
    recipeSnapshot: structuredClone(line.recipeSnapshot),
    plannedQuantity: line.quantity,
    actualUsage: createPlannedUsage(state, line),
    completedSteps: [],
    startedAt: status === "In progress" ? updatedAt : null,
    completedAt: status === "Ready" ? updatedAt : null,
    actualCost: null,
    updatedAt,
  }
}

export function canonicalizePreparationUsage(
  state: AppData,
  usage: PreparationUsage[],
): PreparationUsage[] | null {
  const canonical: PreparationUsage[] = []
  for (const entry of usage) {
    const item = state.inventory.find(
      (inventory) => inventory.inventoryId === entry.inventoryId,
    )
    if (!item || inventoryCategory(item) !== entry.category) return null
    const plannedQuantity = toInventoryBaseQuantity(
      entry.plannedQuantity,
      entry.unit,
      item,
    )
    const actualQuantity = toInventoryBaseQuantity(
      entry.actualQuantity,
      entry.unit,
      item,
    )
    if (
      !Number.isFinite(plannedQuantity) ||
      !Number.isFinite(actualQuantity) ||
      (item.unit === "unit" &&
        (!Number.isSafeInteger(plannedQuantity) ||
          !Number.isSafeInteger(actualQuantity)))
    ) {
      return null
    }
    canonical.push({
      ...entry,
      plannedQuantity,
      actualQuantity,
      unit: item.unit,
    })
  }
  return canonical
}

export function validatePreparationCompletion(
  state: AppData,
  record: PreparationRecord,
) {
  const order = state.orders.find((item) => item.id === record.orderId)
  if (!order)
    return {
      valid: false,
      issues: ["The linked order no longer exists."],
      canonicalUsage: [],
    }
  if (record.status === "Ready")
    return {
      valid: false,
      issues: ["This product is already complete."],
      canonicalUsage: [],
    }

  const canonicalUsage = canonicalizePreparationUsage(state, record.actualUsage)
  if (!canonicalUsage)
    return {
      valid: false,
      issues: [
        "Preparation usage has an incompatible inventory unit or category.",
      ],
      canonicalUsage: [],
    }

  const reservedByItem = selectReservedByItem(state)
  const issues: string[] = []
  const usageByItem = new Map<string, number>()
  for (const usage of canonicalUsage) {
    if (!Number.isFinite(usage.actualQuantity) || usage.actualQuantity < 0) {
      issues.push(`${usage.name} must have a valid non-negative quantity.`)
      continue
    }
    const item = state.inventory.find(
      (entry) => entry.inventoryId === usage.inventoryId,
    )
    if (!item) {
      issues.push(`${usage.name} is missing from inventory.`)
      continue
    }
    if (inventoryCategory(item) !== usage.category) {
      issues.push(`${usage.name} has an incompatible inventory category.`)
      continue
    }
    usageByItem.set(
      usage.inventoryId,
      (usageByItem.get(usage.inventoryId) ?? 0) + usage.actualQuantity,
    )
  }
  for (const [inventoryId, quantity] of usageByItem) {
    const item = state.inventory.find(
      (entry) => entry.inventoryId === inventoryId,
    )
    if (!item) continue
    const ownReservation = order.reservations
      .filter(
        (reservation) =>
          reservation.lineId === record.orderLineId &&
          reservation.inventoryId === inventoryId,
      )
      .reduce((sum, reservation) => {
        const inventoryItem = state.inventory.find(
          (entry) => entry.inventoryId === reservation.inventoryId,
        )
        return (
          sum +
          (inventoryItem
            ? toInventoryBaseQuantity(
                reservation.reserved,
                reservation.unit,
                inventoryItem,
              )
            : Number.NaN)
        )
      }, 0)
    const remainingReservations = Math.max(
      0,
      (reservedByItem.get(inventoryId) ?? 0) - ownReservation,
    )
    if (!Number.isFinite(remainingReservations)) {
      issues.push(`${item.name} has an invalid saved reservation unit.`)
      continue
    }
    const balanceAfter = item.physical - quantity
    if (balanceAfter < 0) {
      issues.push(
        `${item.name} exceeds physical stock by ${Math.abs(balanceAfter)} ${item.unit}.`,
      )
    } else if (balanceAfter < remainingReservations) {
      const allowable = Math.max(0, item.physical - remainingReservations)
      issues.push(
        `${item.name} can use at most ${allowable} ${item.unit}; the rest is reserved for other products.`,
      )
    }
  }
  return { valid: issues.length === 0, issues, canonicalUsage }
}

export function calculateActualPreparationCost(
  state: AppData,
  record: PreparationRecord,
) {
  return calculateActualUsageCost(state, record.actualUsage)
}

export function calculateActualUsageCost(
  state: AppData,
  actualUsage: PreparationUsage[],
  options?: { strictPricing?: boolean },
) {
  const strictPricing = options?.strictPricing ?? false
  return actualUsage.reduce((sum, usage) => {
    const item = state.inventory.find(
      (entry) => entry.inventoryId === usage.inventoryId,
    )
    if (!item || inventoryCategory(item) !== usage.category) return Number.NaN
    if (
      strictPricing &&
      (item.averageUnitCost === undefined ||
        !Number.isFinite(item.averageUnitCost))
    ) {
      return Number.NaN
    }
    const quantity = toInventoryBaseQuantity(
      usage.actualQuantity,
      usage.unit,
      item,
    )
    return sum + quantity * (item.averageUnitCost ?? 0)
  }, 0)
}

export function validateExtraStockPreparationCompletion(
  state: AppData,
  record: ExtraStockPreparationRecord,
  actualUsage: PreparationUsage[],
  usableOutputQuantity: number,
) {
  const issues: string[] = []
  if (!Array.isArray(actualUsage)) {
    return {
      valid: false,
      issues: ["Actual usage must be provided as a list of materials."],
      canonicalUsage: [],
    }
  }
  if (!Number.isSafeInteger(usableOutputQuantity) || usableOutputQuantity <= 0)
    issues.push("Usable output must be a positive whole number of units.")
  if (record.status !== "In progress")
    issues.push("This extra-stock preparation is not in progress.")
  if (actualUsage.length !== record.actualUsage.length)
    issues.push("Actual usage must include every planned material.")

  const canonicalUsage = canonicalizePreparationUsage(state, actualUsage)
  const canonicalPlanned = canonicalizePreparationUsage(
    state,
    record.actualUsage,
  )
  if (!canonicalUsage || !canonicalPlanned) {
    issues.push(
      "Preparation usage has an incompatible inventory unit or category.",
    )
  }

  const reservedByItem = selectReservedByItem(state)
  const usageByItem = new Map<string, number>()
  let totalUsage = 0
  for (let index = 0; index < actualUsage.length; index += 1) {
    const usage = actualUsage[index]
    const planned = record.actualUsage[index]
    if (
      !planned ||
      usage.inventoryId !== planned.inventoryId ||
      usage.name !== planned.name ||
      usage.plannedQuantity !== planned.plannedQuantity ||
      usage.unit !== planned.unit ||
      usage.category !== planned.category
    ) {
      issues.push("Actual usage does not match the preparation snapshot.")
      continue
    }
    if (
      !Number.isFinite(usage.actualQuantity) ||
      usage.actualQuantity < 0 ||
      (usage.unit === "unit" && !Number.isSafeInteger(usage.actualQuantity))
    ) {
      issues.push(`${usage.name} must have a valid non-negative quantity.`)
      continue
    }
    const canonicalEntry = canonicalUsage?.[index]
    const canonicalPlannedEntry = canonicalPlanned?.[index]
    if (!canonicalEntry || !canonicalPlannedEntry) continue
    if (
      canonicalEntry.plannedQuantity !== canonicalPlannedEntry.plannedQuantity
    ) {
      issues.push("Actual usage does not match the canonical recipe quantity.")
      continue
    }
    const combinedQuantity =
      (usageByItem.get(canonicalEntry.inventoryId) ?? 0) +
      canonicalEntry.actualQuantity
    if (!Number.isFinite(combinedQuantity)) {
      issues.push(`${usage.name} has an invalid total quantity.`)
      continue
    }
    usageByItem.set(canonicalEntry.inventoryId, combinedQuantity)
    totalUsage += canonicalEntry.actualQuantity
  }
  if (!Number.isFinite(totalUsage) || totalUsage <= 0)
    issues.push("Actual material usage must be greater than zero.")

  for (const [inventoryId, quantity] of usageByItem) {
    const item = state.inventory.find(
      (entry) => entry.inventoryId === inventoryId,
    )
    if (!item) continue
    const balanceAfter = item.physical - quantity
    const reserved = reservedByItem.get(inventoryId) ?? 0
    if (!Number.isFinite(reserved)) {
      issues.push(`${item.name} has an invalid saved reservation unit.`)
    } else if (balanceAfter < reserved) {
      issues.push(
        `${item.name} exceeds available stock after customer-order reservations.`,
      )
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    canonicalUsage: canonicalUsage ?? [],
  }
}
