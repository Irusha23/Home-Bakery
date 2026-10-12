import { inventoryCategory, selectReservedByItem } from "./inventory"
import type {
  AppData,
  OrderLine,
  PreparationRecord,
  PreparationUsage,
} from "../types"

export function createPlannedUsage(line: OrderLine): PreparationUsage[] {
  return [
    ...line.recipeSnapshot.ingredients.map((item) => ({
      inventoryId: item.inventoryId,
      name: item.name,
      plannedQuantity: item.quantity * line.quantity,
      actualQuantity: item.quantity * line.quantity,
      unit: item.unit as PreparationUsage["unit"],
      category: "ingredient" as const,
    })),
    ...line.recipeSnapshot.packaging.map((item) => ({
      inventoryId: item.inventoryId,
      name: item.name,
      plannedQuantity: item.quantity * line.quantity,
      actualQuantity: item.quantity * line.quantity,
      unit: item.unit,
      category: "packaging" as const,
    })),
  ]
}

export function createPreparationRecord(
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
    actualUsage: createPlannedUsage(line),
    completedSteps: [],
    startedAt: status === "In progress" ? updatedAt : null,
    completedAt: status === "Ready" ? updatedAt : null,
    actualCost: null,
    updatedAt,
  }
}

export function validatePreparationCompletion(
  state: AppData,
  record: PreparationRecord,
) {
  const order = state.orders.find((item) => item.id === record.orderId)
  if (!order)
    return { valid: false, issues: ["The linked order no longer exists."] }
  if (record.status === "Ready")
    return { valid: false, issues: ["This product is already complete."] }

  const reservedByItem = selectReservedByItem(state)
  const issues: string[] = []
  for (const usage of record.actualUsage) {
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
    const ownReservation = order.reservations
      .filter(
        (reservation) =>
          reservation.lineId === record.orderLineId &&
          reservation.inventoryId === usage.inventoryId,
      )
      .reduce((sum, reservation) => sum + reservation.reserved, 0)
    const remainingReservations = Math.max(
      0,
      (reservedByItem.get(usage.inventoryId) ?? 0) - ownReservation,
    )
    const balanceAfter = item.physical - usage.actualQuantity
    if (balanceAfter < 0) {
      issues.push(
        `${usage.name} exceeds physical stock by ${Math.abs(balanceAfter)} ${usage.unit}.`,
      )
    } else if (balanceAfter < remainingReservations) {
      const allowable = Math.max(0, item.physical - remainingReservations)
      issues.push(
        `${usage.name} can use at most ${allowable} ${usage.unit}; the rest is reserved for other products.`,
      )
    }
  }
  return { valid: issues.length === 0, issues }
}

export function calculateActualPreparationCost(
  state: AppData,
  record: PreparationRecord,
) {
  return record.actualUsage.reduce((sum, usage) => {
    const item = state.inventory.find(
      (entry) => entry.inventoryId === usage.inventoryId,
    )
    return sum + usage.actualQuantity * (item?.averageUnitCost ?? 0)
  }, 0)
}
