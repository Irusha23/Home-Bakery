import type {
  AppData,
  CostSnapshot,
  OrderLine,
  StockRequirement,
} from "../types"

export function calculateCostSnapshot(lines: OrderLine[]): CostSnapshot {
  const estimatedTotal = lines.reduce(
    (sum, line) =>
      sum + line.recipeSnapshot.estimatedCost * Math.max(1, line.quantity),
    0,
  )
  const ingredients = Math.round(estimatedTotal * 0.82)
  const packaging = Math.round(estimatedTotal * 0.1)
  const labour = estimatedTotal - ingredients - packaging
  return {
    ingredients,
    packaging,
    labour,
    estimatedTotal,
    suggestedPrice: Math.ceil((estimatedTotal * 2.4) / 100) * 100,
  }
}

export function calculateRequirements(
  state: AppData,
  lines: OrderLine[],
  excludeOrderId?: string,
) {
  const aggregated = new Map<string, {
    name: string
    required: number
    unit: StockRequirement["unit"]
  }>()

  for (const line of lines) {
    const requirements = [
      ...line.recipeSnapshot.ingredients,
      ...line.recipeSnapshot.packaging,
    ]
    for (const requirement of requirements) {
      const current = aggregated.get(requirement.inventoryId)
      const required = requirement.quantity * line.quantity
      aggregated.set(requirement.inventoryId, {
        name: requirement.name,
        required: (current?.required ?? 0) + required,
        unit: requirement.unit,
      })
    }
  }

  const alreadyReserved = new Map<string, number>()
  for (const order of state.orders) {
    if (
      order.id === excludeOrderId ||
      order.status === "Draft" ||
      order.status === "Cancelled" ||
      order.status === "Completed"
    ) {
      continue
    }
    for (const reservation of order.reservations) {
      alreadyReserved.set(
        reservation.inventoryId,
        (alreadyReserved.get(reservation.inventoryId) ?? 0) +
          reservation.reserved,
      )
    }
  }

  return Array.from(aggregated, ([inventoryId, requirement]) => {
    const inventory = state.inventory.find(
      (item) => item.inventoryId === inventoryId,
    )
    const available = Math.max(
      0,
      (inventory?.physical ?? 0) - (alreadyReserved.get(inventoryId) ?? 0),
    )
    const reserved = Math.min(available, requirement.required)
    return {
      inventoryId,
      name: requirement.name,
      required: requirement.required,
      availableAtConfirmation: available,
      reserved,
      shortage: Math.max(0, requirement.required - reserved),
      unit: requirement.unit,
    } satisfies StockRequirement
  })
}

export function calculateLineRequirements(
  state: AppData,
  lines: OrderLine[],
  excludeOrderId?: string,
) {
  const alreadyReserved = new Map<string, number>()
  for (const order of state.orders) {
    if (
      order.id === excludeOrderId ||
      order.status === "Draft" ||
      order.status === "Cancelled" ||
      order.status === "Completed"
    ) {
      continue
    }
    for (const reservation of order.reservations) {
      alreadyReserved.set(
        reservation.inventoryId,
        (alreadyReserved.get(reservation.inventoryId) ?? 0) +
          reservation.reserved,
      )
    }
  }

  const remaining = new Map(
    state.inventory.map((item) => [
      item.inventoryId,
      Math.max(0, item.physical - (alreadyReserved.get(item.inventoryId) ?? 0)),
    ]),
  )

  return lines.flatMap((line) =>
    [...line.recipeSnapshot.ingredients, ...line.recipeSnapshot.packaging].map(
      (requirement) => {
        const required = requirement.quantity * line.quantity
        const available = remaining.get(requirement.inventoryId) ?? 0
        const reserved = Math.min(available, required)
        remaining.set(requirement.inventoryId, available - reserved)
        return {
          inventoryId: requirement.inventoryId,
          lineId: line.id,
          name: requirement.name,
          required,
          availableAtConfirmation: available,
          reserved,
          shortage: Math.max(0, required - reserved),
          unit: requirement.unit,
        } satisfies StockRequirement
      },
    ),
  )
}
