import type {
  AppData,
  BaseUnit,
  DemandSource,
  ExtraStockPlan,
  InventoryCategory,
  InventoryItem,
  Order,
  PreparationRecord,
  PreparationUsage,
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
  if (!Number.isFinite(quantity) || quantity < 0) return Number.NaN
  const converted =
    (base === "g" && unit === "kg") || (base === "ml" && unit === "L")
      ? quantity * 1000
      : unit === base
        ? quantity
        : Number.NaN
  return Number.isFinite(converted) ? converted : Number.NaN
}

export function toInventoryBaseQuantity(
  quantity: number,
  unit: Unit,
  item: InventoryItem,
) {
  return toBaseQuantity(quantity, unit, item.unit)
}

export function recipeRequirementBaseQuantity(
  state: AppData,
  requirement: { inventoryId: string; quantity: number; unit: Unit },
  expectedCategory: "ingredient" | "packaging",
) {
  const item = state.inventory.find(
    (entry) => entry.inventoryId === requirement.inventoryId,
  )
  if (!item || inventoryCategory(item) !== expectedCategory) return Number.NaN
  return toInventoryBaseQuantity(requirement.quantity, requirement.unit, item)
}

export function selectReservedByItem(state: AppData) {
  const reserved = new Map<string, number>()
  for (const order of state.orders) {
    if (order.status !== "Confirmed" && order.status !== "In Progress") continue
    for (const item of order.reservations) {
      const inventoryItem = state.inventory.find(
        (entry) => entry.inventoryId === item.inventoryId,
      )
      const quantity = inventoryItem
        ? toInventoryBaseQuantity(item.reserved, item.unit, inventoryItem)
        : Number.NaN
      const current = reserved.get(item.inventoryId) ?? 0
      reserved.set(
        item.inventoryId,
        Number.isFinite(quantity) && Number.isFinite(current)
          ? current + quantity
          : Number.NaN,
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
  state: AppData,
  plan: ExtraStockPlan,
  sources: Map<string, DemandSource[]>,
) {
  const requirements = [
    ...plan.recipeSnapshot.ingredients.map((requirement) => ({
      requirement,
      category: "ingredient" as const,
    })),
    ...plan.recipeSnapshot.packaging.map((requirement) => ({
      requirement,
      category: "packaging" as const,
    })),
  ]
  for (const { requirement, category } of requirements) {
    const perBatch = recipeRequirementBaseQuantity(state, requirement, category)
    const quantity = perBatch * plan.quantity
    addSource(sources, requirement.inventoryId, {
      id: `${plan.id}-${requirement.inventoryId}`,
      type: "extra-stock",
      label: plan.recipeSnapshot.name,
      reference: "Extra-stock plan",
      quantity,
      ...(!Number.isFinite(quantity)
        ? {
            unitError: `${requirement.name} uses ${requirement.unit}, which is incompatible with its inventory item or plan quantity.`,
          }
        : {}),
    })
  }
}

export function suggestedPurchaseQuantity(shortage: number, unit: BaseUnit) {
  if (!Number.isFinite(shortage)) return Number.NaN
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
      const inventoryItem = state.inventory.find(
        (item) => item.inventoryId === shortage.inventoryId,
      )
      const quantity = inventoryItem
        ? toInventoryBaseQuantity(
            shortage.shortage,
            shortage.unit,
            inventoryItem,
          )
        : Number.NaN
      addSource(sources, shortage.inventoryId, {
        id: `${order.id}-${shortage.lineId ?? "order"}-${shortage.inventoryId}`,
        type: "customer-order",
        label: order.customerName,
        reference: order.reference,
        quantity,
        ...(!Number.isFinite(quantity)
          ? {
              unitError: `${shortage.name} has an incompatible saved shortage unit.`,
            }
          : {}),
      })
    }
  }

  for (const plan of state.extraStockPlans) addPlanSources(state, plan, sources)

  const reserved = selectReservedByItem(state)
  return state.inventory
    .filter((item) => inventoryCategory(item) !== "finished")
    .flatMap((item) => {
      const itemSources = sources.get(item.inventoryId) ?? []
      if (!itemSources.length) return []
      const unitErrors = itemSources.flatMap((source) =>
        source.unitError ? [source.unitError] : [],
      )
      const required = itemSources.reduce(
        (sum, source) => sum + source.quantity,
        0,
      )
      const itemReserved = reserved.get(item.inventoryId) ?? 0
      const available = Math.max(0, item.physical - itemReserved)
      const shortage = Math.max(0, required - available)
      if (!Number.isFinite(itemReserved))
        unitErrors.push(
          "A saved reservation uses an incompatible inventory unit.",
        )
      if (!Number.isFinite(item.physical))
        unitErrors.push("Physical inventory has an invalid saved quantity.")
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
          selectedPurchase: unitErrors.length
            ? 0
            : (state.shoppingSelections[item.inventoryId] ?? suggested),
          sources: itemSources,
          unitErrors,
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

export function isUsageInPantry(
  order: Order | undefined,
  record: PreparationRecord,
  usage: PreparationUsage,
): boolean {
  if (usage.inPantry !== undefined) {
    return usage.inPantry
  }
  if (!order) return true
  const matchingShortage = order.shortages.find(
    (s) =>
      s.inventoryId === usage.inventoryId &&
      (!s.lineId || s.lineId === record.orderLineId) &&
      s.shortage > 0,
  )
  return !matchingShortage
}

export function hasUnpurchasedShoppingItems(
  order: Order | undefined,
  record: PreparationRecord,
): boolean {
  if (record.status === "Ready" || record.status === "Cancelled") return false
  return record.actualUsage.some(
    (usage) => !isUsageInPantry(order, record, usage),
  )
}

export function orderHasUnpurchasedItems(state: AppData, order: Order): boolean {
  if (
    order.status === "Draft" ||
    order.status === "Completed" ||
    order.status === "Cancelled"
  ) {
    return false
  }
  const records = state.preparationRecords.filter(
    (record) => record.orderId === order.id && record.status !== "Ready",
  )
  if (records.length > 0) {
    return records.some((record) => hasUnpurchasedShoppingItems(order, record))
  }
  return order.shortages.some((s) => s.shortage > 0)
}

export function getUsageToBuyQuantity(
  state: AppData,
  order: Order | undefined,
  record: PreparationRecord,
  usage: PreparationUsage,
): number {
  if (isUsageInPantry(order, record, usage)) {
    return 0
  }
  if (
    usage.toBuyQuantity !== undefined &&
    Number.isFinite(usage.toBuyQuantity) &&
    usage.toBuyQuantity > 0
  ) {
    return usage.toBuyQuantity
  }
  if (order) {
    const matchingShortage = order.shortages.find(
      (s) =>
        s.inventoryId === usage.inventoryId &&
        (!s.lineId || s.lineId === record.orderLineId) &&
        s.shortage > 0,
    )
    if (matchingShortage) {
      const invItem = state.inventory.find(
        (i) => i.inventoryId === usage.inventoryId,
      )
      const converted = invItem
        ? toInventoryBaseQuantity(
            matchingShortage.shortage,
            matchingShortage.unit,
            invItem,
          )
        : matchingShortage.shortage
      if (Number.isFinite(converted) && converted > 0) {
        return converted
      }
    }
  }
  return Number.isFinite(usage.plannedQuantity) && usage.plannedQuantity > 0
    ? usage.plannedQuantity
    : 1
}

export type ManualShoppingItem = {
  inventoryId: string
  name: string
  category: "ingredient" | "packaging"
  unit: BaseUnit
  neededQuantity: number
  boughtQuantity: number
  unitCost: number | null
  estimatedCost: number | null
  checked: boolean
  isManualExtra?: boolean
  orders: {
    orderId: string
    reference: string
    customerName: string
    productName: string
    quantity: number
  }[]
}

export function selectManualShoppingList(state: AppData): ManualShoppingItem[] {
  const byInventoryId = new Map<string, ManualShoppingItem>()
  const inventoryById = new Map(
    state.inventory.map((item) => [item.inventoryId, item]),
  )

  for (const record of state.preparationRecords) {
    if (record.status === "Ready" || record.status === "Cancelled") continue
    const order = state.orders.find((o) => o.id === record.orderId)
    if (
      !order ||
      order.status === "Draft" ||
      order.status === "Completed" ||
      order.status === "Cancelled"
    ) {
      continue
    }
    const line = order.lines.find((l) => l.id === record.orderLineId)

    for (const usage of record.actualUsage) {
      if (isUsageInPantry(order, record, usage)) continue
      const needed = getUsageToBuyQuantity(state, order, record, usage)
      if (!Number.isFinite(needed) || needed <= 0) continue

      const existing = byInventoryId.get(usage.inventoryId)
      const orderEntry = {
        orderId: order.id,
        reference: order.reference,
        customerName: order.customerName,
        productName: line?.productName ?? record.recipeSnapshot.name,
        quantity: needed,
      }

      if (existing) {
        existing.neededQuantity += needed
        existing.checked = existing.checked && Boolean(usage.shoppingChecked)
        existing.orders.push(orderEntry)
      } else {
        byInventoryId.set(usage.inventoryId, {
          inventoryId: usage.inventoryId,
          name: usage.name,
          category: usage.category,
          unit: usage.unit,
          neededQuantity: needed,
          boughtQuantity: 0,
          unitCost: null,
          estimatedCost: null,
          checked: Boolean(usage.shoppingChecked),
          orders: [orderEntry],
        })
      }
    }
  }

  for (const [inventoryId, qty] of Object.entries(state.shoppingSelections)) {
    if (!Number.isFinite(qty) || qty <= 0) continue
    if (byInventoryId.has(inventoryId)) continue
    const item = inventoryById.get(inventoryId)
    if (!item || inventoryCategory(item) === "finished") continue
    byInventoryId.set(inventoryId, {
      inventoryId: item.inventoryId,
      name: item.name,
      category: inventoryCategory(item) as "ingredient" | "packaging",
      unit: item.unit,
      neededQuantity: qty,
      boughtQuantity: qty,
      unitCost: null,
      estimatedCost: null,
      checked: false,
      isManualExtra: true,
      orders: [],
    })
  }

  return Array.from(byInventoryId.values())
    .map((item) => {
      const savedSelection = state.shoppingSelections[item.inventoryId]
      const boughtQuantity =
        savedSelection !== undefined && savedSelection > 0
          ? savedSelection
          : item.neededQuantity
      const invItem = inventoryById.get(item.inventoryId)
      const unitCost =
        invItem?.averageUnitCost !== undefined &&
        Number.isFinite(invItem.averageUnitCost) &&
        invItem.averageUnitCost >= 0
          ? invItem.averageUnitCost
          : null
      const estimatedCost =
        unitCost !== null ? Math.round(boughtQuantity * unitCost) : null
      return {
        ...item,
        boughtQuantity,
        unitCost,
        estimatedCost,
      }
    })
    .sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1
      return a.name.localeCompare(b.name)
    })
}
