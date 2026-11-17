import type { AppData, Order } from "../types"

const cancellableStatuses = new Set(["Draft", "Confirmed", "In Progress"])

const collectibleStatuses = new Set(["Confirmed", "In Progress"])

export function getOrderCancellationBlockReason(
  state: AppData,

  order: Order,
): string | null {
  if (!cancellableStatuses.has(order.status)) return null

  const preparations = state.preparationRecords.filter(
    (record) => record.orderId === order.id,
  )

  const hasCompletedPreparation = preparations.some(
    (record) => record.status === "Ready",
  )

  const hasPreparationMovement = preparations.some((record) =>
    state.inventoryMovements.some((movement) =>
      movement.id.startsWith(`movement-preparation-${record.id}-`),
    ),
  )

  const hasOrderConsumption = state.inventoryMovements.some(
    (movement) =>
      movement.type === "Preparation consumption" &&
      (movement.reason === order.reference ||
        movement.reason.startsWith(`${order.reference} ·`)),
  )

  const hasProducedStock = preparations.some((record) =>
    state.finishedStockBatches.some(
      (batch) =>
        batch.source === "production" && batch.preparationId === record.id,
    ),
  )

  if (
    hasCompletedPreparation ||
    hasPreparationMovement ||
    hasOrderConsumption ||
    hasProducedStock
  ) {
    return "Cancellation is unavailable because preparation may have consumed stock or produced finished goods. No stock will be reversed."
  }

  return null
}

export function canCancelOrder(state: AppData, order: Order) {
  return (
    cancellableStatuses.has(order.status) &&
    getOrderCancellationBlockReason(state, order) === null
  )
}

export function getUnreadyOrderLines(state: AppData, order: Order) {
  if (!collectibleStatuses.has(order.status)) return []

  const readyLineIds = new Set(
    state.preparationRecords

      .filter(
        (record) => record.orderId === order.id && record.status === "Ready",
      )

      .map((record) => record.orderLineId),
  )

  return order.lines.filter((line) => !readyLineIds.has(line.id))
}

export function canCollectOrder(state: AppData, order: Order) {
  return (
    collectibleStatuses.has(order.status) &&
    order.lines.length > 0 &&
    getUnreadyOrderLines(state, order).length === 0
  )
}

export function canRepeatOrder(order: Order) {
  return order.status !== "Draft" && order.lines.length > 0
}

export function filterOrdersByStatus(
  orders: Order[],

  status: Order["status"] | "All",
) {
  return status === "All"
    ? orders
    : orders.filter((order) => order.status === status)
}
