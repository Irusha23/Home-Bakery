import type {
  AppData,
  BaseUnit,
  DemandSource,
  ExtraStockPlan,
  InventoryCategory,
  InventoryItem,
  ShoppingRequirement,
  Unit,
} from "../types"

export function inventoryCategory(item: InventoryItem): InventoryCategory {
  if (item.category) return item.category
  if (item.unit === "unit") return "packaging"
  return "ingredient"
}

export function compatibleUnits(unit: BaseUnit): Unit[] {
  if (unit === "g") return ["g", "kg"]
  if (unit === "ml") return ["ml", "L"]
  return ["unit"]
}

export function toBaseQuantity(quantity: number, unit: Unit, base: BaseUnit) {
  if (quantity < 0) return Number.NaN
  if (base === "g" && unit === "kg") return quantity * 1000
  if (base === "ml" && unit === "L") return quantity * 1000
  if (unit === base) return quantity
  return Number.NaN
}

export function selectReservedByItem(state: AppData) {
  const reserved = new Map<string, number>()
  for (const order of state.orders) {
    if (order.status !== "Confirmed" && order.status !== "In Progress") continue
    for (const item of order.reservations) {
      reserved.set(
        item.inventoryId,
        (reserved.get(item.inventoryId) ?? 0) + item.reserved,
      )
    }
  }
  return reserved
}

function addSource(
  sources: Map<string, DemandSource[]>,
  inventoryId: string,
  source: DemandSource,
) {
  sources.set(inventoryId, [...(sources.get(inventoryId) ?? []), source])
}

function addPlanSources(
  plan: ExtraStockPlan,
  sources: Map<string, DemandSource[]>,
) {
  const requirements = [
    ...plan.recipeSnapshot.ingredients,
    ...plan.recipeSnapshot.packaging,
  ]
  for (const requirement of requirements) {
    addSource(sources, requirement.inventoryId, {
      id: `${plan.id}-${requirement.inventoryId}`,
      type: "extra-stock",
      label: plan.recipeSnapshot.name,
      reference: "Extra-stock plan",
      quantity: requirement.quantity * plan.quantity,
    })
  }
}

export function suggestedPurchaseQuantity(shortage: number, unit: BaseUnit) {
  if (shortage <= 0) return 0
  if (unit === "g" || unit === "ml") {
    return Math.ceil(shortage / 1000) * 1000
  }
  return Math.ceil(shortage)
}

export function selectShoppingRequirements(
  state: AppData,
): ShoppingRequirement[] {
  const sources = new Map<string, DemandSource[]>()

  for (const order of state.orders) {
    if (order.status !== "Confirmed" && order.status !== "In Progress") continue
    for (const shortage of order.shortages) {
      addSource(sources, shortage.inventoryId, {
        id: `${order.id}-${shortage.lineId ?? "order"}-${shortage.inventoryId}`,
        type: "customer-order",
        label: order.customerName,
        reference: order.reference,
        quantity: shortage.shortage,
      })
    }
  }

  for (const plan of state.extraStockPlans) addPlanSources(plan, sources)

  const reserved = selectReservedByItem(state)
  return state.inventory
    .filter((item) => inventoryCategory(item) !== "finished")
    .flatMap((item) => {
      const itemSources = sources.get(item.inventoryId) ?? []
      if (!itemSources.length) return []
      const required = itemSources.reduce(
        (sum, source) => sum + source.quantity,
        0,
      )
      const itemReserved = reserved.get(item.inventoryId) ?? 0
      const available = Math.max(0, item.physical - itemReserved)
      const shortage = Math.max(0, required - available)
      const suggested = suggestedPurchaseQuantity(shortage, item.unit)
      return [
        {
          inventoryId: item.inventoryId,
          name: item.name,
          category: inventoryCategory(item) as "ingredient" | "packaging",
          unit: item.unit,
          required,
          physical: item.physical,
          reserved: itemReserved,
          available,
          shortage,
          suggestedPurchase: suggested,
          selectedPurchase:
            state.shoppingSelections[item.inventoryId] ?? suggested,
          sources: itemSources,
        },
      ]
    })
    .sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name))
}

export function selectPlannedRequirement(state: AppData, inventoryId: string) {
  return (
    selectShoppingRequirements(state).find(
      (item) => item.inventoryId === inventoryId,
    )?.required ?? 0
  )
}

export function selectAvailableInventory(state: AppData, inventoryId: string) {
  const item = state.inventory.find(
    (entry) => entry.inventoryId === inventoryId,
  )
  const reserved = selectReservedByItem(state).get(inventoryId) ?? 0
  return {
    physical: item?.physical ?? 0,
    reserved,
    available: Math.max(0, (item?.physical ?? 0) - reserved),
  }
}
