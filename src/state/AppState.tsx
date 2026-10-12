import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react"
import { demoData } from "../data/demoData"
import { selectReservedByItem } from "../lib/inventory"
import { calculateLineRequirements } from "../lib/orders"
import {
  calculateActualPreparationCost,
  createPreparationRecord,
  validatePreparationCompletion,
} from "../lib/preparation"
import type {
  AppData,
  Customer,
  ExtraStockPlan,
  InventoryMovementType,
  Order,
  OrderDraftInput,
  PreparationRecord,
  PurchaseRecord,
  Recipe,
  RecipeSnapshot,
} from "../types"

const STORAGE_KEY = "udenis-specials-demo-v4"
const LEGACY_STORAGE_KEYS = [
  "udenis-specials-demo-v3",
  "udenis-specials-demo-v2",
]

type AppAction = { type: "UPSERT_DRAFT" payload: OrderDraftInput } | {
  type: "CONFIRM_ORDER"
  orderId: string
} | { type: "ADD_CUSTOMER" customer: Customer } | {
  type: "ADD_RECIPE"
  recipe: Recipe
} | { type: "UPDATE_RECIPE" recipe: Recipe } | { type: "RESET_DEMO" } | {
  type: "UPSERT_EXTRA_STOCK_PLAN"
  plan: ExtraStockPlan
} | { type: "REMOVE_EXTRA_STOCK_PLAN" planId: string } | {
  type: "SET_PURCHASE_QUANTITY"
  inventoryId: string
  quantity: number
} | { type: "RECORD_PURCHASE" purchase: PurchaseRecord } | {
  type: "ADJUST_INVENTORY"
  adjustment: {
    id: string
    inventoryId: string
    type: Exclude<InventoryMovementType, "Opening balance" | "Purchase" | "Preparation consumption">
    quantityDelta: number
    date: string
    reason: string
  }
} | { type: "START_PREPARATION" preparationId: string } | {
  type: "TOGGLE_PREPARATION_STEP"
  preparationId: string
  stepIndex: number
} | {
  type: "UPDATE_PREPARATION_USAGE"
  preparationId: string
  inventoryId: string
  quantity: number
} | { type: "COMPLETE_PREPARATION" preparationId: string }

type AppStateValue = {
  state: AppData
  dispatch: React.Dispatch<AppAction>
}

const AppStateContext = createContext<AppStateValue | null>(null)

function cloneDemoData(): AppData {
  return migrateState(structuredClone(demoData))
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

function migrateState(source: AppData): AppData {
  const defaults = structuredClone(demoData)
  const sourceInventory = Array.isArray(source.inventory)
    ? source.inventory
    : []
  const inventory = sourceInventory.map((item) => ({
    ...(defaults.inventory.find(
      (candidate) => candidate.inventoryId === item.inventoryId,
    ) ?? {}),
    ...item,
  }))
  for (const defaultItem of defaults.inventory) {
    if (!inventory.some((item) => item.inventoryId === defaultItem.inventoryId))
      inventory.push(defaultItem)
  }

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
        reason: "Opening demo balance",
        createdAt: "2025-04-01T08:00:00.000Z",
      }))

  const orders = (source.orders ?? defaults.orders).map((order) => ({
    ...order,
    reservations: scopeRequirementsToLines(order, order.reservations),
    shortages: scopeRequirementsToLines(order, order.shortages),
  }))
  const preparationRecords = Array.isArray(source.preparationRecords)
    ? [...source.preparationRecords]
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
        createPreparationRecord(order.id, line, status, order.updatedAt),
      )
    })
  }

  return {
    ...defaults,
    ...source,
    orders,
    inventory,
    extraStockPlans: Array.isArray(source.extraStockPlans)
      ? source.extraStockPlans
      : [],
    purchases: Array.isArray(source.purchases) ? source.purchases : [],
    inventoryMovements,
    shoppingSelections:
      source.shoppingSelections && typeof source.shoppingSelections === "object"
        ? source.shoppingSelections
        : {},
    preparationRecords,
  }
}

function loadState(): AppData {
  try {
    const stored =
      window.localStorage.getItem(STORAGE_KEY) ??
      LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(
        Boolean,
      )
    if (!stored) return cloneDemoData()
    const parsed = JSON.parse(stored) as AppData
    if (
      !Array.isArray(parsed.orders) ||
      !Array.isArray(parsed.recipes) ||
      !Array.isArray(parsed.inventory)
    ) {
      return cloneDemoData()
    }
    return migrateState(parsed)
  } catch {
    return cloneDemoData()
  }
}

function makeReference(orders: Order[]) {
  const highest = orders.reduce((max, order) => {
    const number = Number(order.reference.replace(/\D/g, ""))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 1000)
  return `US-${highest + 1}`
}

export function snapshotRecipe(recipe: Recipe): RecipeSnapshot {
  const { updatedAt: _, ...snapshot } = structuredClone(recipe)
  return snapshot
}

function reducer(state: AppData, action: AppAction): AppData {
  switch (action.type) {
    case "UPSERT_DRAFT": {
      const now = new Date().toISOString()
      const existing = action.payload.id
        ? state.orders.find((order) => order.id === action.payload.id)
        : undefined
      if (existing && existing.status !== "Draft") return state

      const order: Order = {
        ...action.payload,
        id: existing?.id ?? action.payload.id ?? `order-${crypto.randomUUID()}`,
        reference: existing?.reference ?? makeReference(state.orders),
        status: "Draft",
        preparationStatus: "Not started",
        paymentStatus: existing?.paymentStatus ?? "Unpaid",
        reservations: [],
        shortages: [],
        payments: existing?.payments ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        confirmedAt: null,
      }

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
              confirmedOrder.id,
              line,
              "Awaiting preparation",
              confirmedAt,
            ),
          ),
        ],
      }
    }

    case "ADD_CUSTOMER":
      if (state.customers.some((item) => item.id === action.customer.id))
        return state
      return { ...state, customers: [...state.customers, action.customer] }

    case "ADD_RECIPE":
      if (state.recipes.some((item) => item.id === action.recipe.id))
        return state
      return { ...state, recipes: [action.recipe, ...state.recipes] }

    case "UPDATE_RECIPE":
      return {
        ...state,
        recipes: state.recipes.map((item) =>
          item.id === action.recipe.id ? action.recipe : item,
        ),
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
      if (
        state.purchases.some(
          (purchase) => purchase.id === action.purchase.id,
        ) ||
        action.purchase.usableBaseQuantity <= 0 ||
        action.purchase.totalPrice <= 0
      ) {
        return state
      }
      const inventoryItem = state.inventory.find(
        (item) => item.inventoryId === action.purchase.inventoryId,
      )
      if (!inventoryItem) return state
      const balanceAfter =
        inventoryItem.physical + action.purchase.usableBaseQuantity
      const priorValue =
        inventoryItem.physical * (inventoryItem.averageUnitCost ?? 0)
      const averageUnitCost =
        balanceAfter > 0
          ? (priorValue + action.purchase.totalPrice) / balanceAfter
          : inventoryItem.averageUnitCost
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.inventoryId === inventoryItem.inventoryId
            ? { ...item, physical: balanceAfter, averageUnitCost }
            : item,
        ),
        purchases: [action.purchase, ...state.purchases],
        inventoryMovements: [
          {
            id: `movement-${action.purchase.id}`,
            inventoryId: inventoryItem.inventoryId,
            type: "Purchase",
            quantityDelta: action.purchase.usableBaseQuantity,
            unit: inventoryItem.unit,
            balanceAfter,
            date: action.purchase.date,
            reason: action.purchase.note || "Recorded purchase",
            purchaseId: action.purchase.id,
            createdAt: action.purchase.createdAt,
          },
          ...state.inventoryMovements,
        ],
      }
    }

    case "ADJUST_INVENTORY": {
      if (
        state.inventoryMovements.some(
          (movement) => movement.id === action.adjustment.id,
        ) ||
        !action.adjustment.reason.trim() ||
        action.adjustment.quantityDelta === 0
      ) {
        return state
      }
      const item = state.inventory.find(
        (entry) => entry.inventoryId === action.adjustment.inventoryId,
      )
      if (!item) return state
      const balanceAfter = item.physical + action.adjustment.quantityDelta
      const reserved = selectReservedByItem(state).get(item.inventoryId) ?? 0
      if (balanceAfter < 0 || balanceAfter < reserved) return state
      return {
        ...state,
        inventory: state.inventory.map((entry) =>
          entry.inventoryId === item.inventoryId
            ? { ...entry, physical: balanceAfter }
            : entry,
        ),
        inventoryMovements: [
          {
            ...action.adjustment,
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
        orders: state.orders.map((order) =>
          order.id === record.orderId
            ? {
                ...order,
                status: "In Progress",
                preparationStatus: "In progress",
                updatedAt: now,
              }
            : order,
        ),
      }
    }

    case "TOGGLE_PREPARATION_STEP": {
      const record = state.preparationRecords.find(
        (item) => item.id === action.preparationId,
      )
      if (!record || record.status !== "In progress") return state
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
      const inventory = state.inventory.map((item) => {
        const usage = record.actualUsage.find(
          (entry) => entry.inventoryId === item.inventoryId,
        )
        return usage
          ? { ...item, physical: item.physical - usage.actualQuantity }
          : item
      })
      const movements = record.actualUsage
        .filter((usage) => usage.actualQuantity > 0)
        .map((usage) => {
          const original = state.inventory.find(
            (item) => item.inventoryId === usage.inventoryId,
          )!
          return {
            id: `movement-preparation-${record.id}-${usage.inventoryId}`,
            inventoryId: usage.inventoryId,
            type: "Preparation consumption" as const,
            quantityDelta: -usage.actualQuantity,
            unit: usage.unit,
            balanceAfter: original.physical - usage.actualQuantity,
            date: now.slice(0, 10),
            reason: `${order.reference} · ${record.recipeSnapshot.name}`,
            createdAt: now,
          }
        })
      const completedRecord: PreparationRecord = {
        ...record,
        status: "Ready",
        completedAt: now,
        actualCost: calculateActualPreparationCost(state, record),
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

    case "RESET_DEMO":
      return cloneDemoData()
  }
}

export default function AppStateProvider({
  children,
}: {
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return (
    <AppStateContext.Provider value={value}>
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
