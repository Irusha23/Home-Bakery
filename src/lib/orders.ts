import type {
  AppData,
  CostSnapshot,
  OrderLine,
  RecipeIngredient,
  PackagingRequirement,
  StockRequirement,
} from "../types"
import {
  inventoryCategory,
  recipeRequirementBaseQuantity,
  selectReservedByItem,
  toInventoryBaseQuantity,
} from "./inventory"
import {
  calculateSuggestedPrice,
  estimateRecipeMaterialCost,
  pricingInputFromSettings,
  type PricingInput,
} from "./pricing"

type RecipeRequirement = {
  requirement: RecipeIngredient | PackagingRequirement
  category: "ingredient" | "packaging"
}

function recipeRequirements(line: OrderLine): RecipeRequirement[] {
  return [
    ...line.recipeSnapshot.ingredients.map((requirement) => ({
      requirement,
      category: "ingredient" as const,
    })),
    ...line.recipeSnapshot.packaging.map((requirement) => ({
      requirement,
      category: "packaging" as const,
    })),
  ]
}

function toCanonicalRequirement(
  state: AppData,
  item: RecipeRequirement,
  multiplier: number,
) {
  const inventory = state.inventory.find(
    (entry) => entry.inventoryId === item.requirement.inventoryId,
  )
  return {
    inventory,
    quantity:
      recipeRequirementBaseQuantity(state, item.requirement, item.category) *
      multiplier,
  }
}

export function getRecipeUnitIssues(
  state: AppData,
  lines: OrderLine[],
  excludeOrderId?: string,
) {
  const issues: string[] = []
  const inventoryIds = new Set(
    lines.flatMap((line) =>
      recipeRequirements(line).map(
        ({ requirement }) => requirement.inventoryId,
      ),
    ),
  )
  for (const line of lines) {
    for (const { requirement, category } of recipeRequirements(line)) {
      const inventory = state.inventory.find(
        (item) => item.inventoryId === requirement.inventoryId,
      )
      if (!inventory) {
        issues.push(`${requirement.name} is missing from inventory.`)
      } else if (inventoryCategory(inventory) !== category) {
        issues.push(
          `${requirement.name} is not assigned to ${category} inventory.`,
        )
      } else if (
        !Number.isFinite(
          recipeRequirementBaseQuantity(state, requirement, category),
        )
      ) {
        issues.push(
          `${requirement.name} uses ${requirement.unit}, which is incompatible with inventory unit ${inventory.unit}.`,
        )
      } else if (
        !Number.isFinite(
          recipeRequirementBaseQuantity(state, requirement, category) *
            line.quantity,
        )
      ) {
        issues.push(
          `${requirement.name} quantity is outside the supported range.`,
        )
      }
    }
  }
  const reservedByItem = selectReservedByItem({
    ...state,
    orders: state.orders.filter((order) => order.id !== excludeOrderId),
  })
  for (const inventoryId of inventoryIds) {
    if (!Number.isFinite(reservedByItem.get(inventoryId) ?? 0)) {
      issues.push(
        `${state.inventory.find((item) => item.inventoryId === inventoryId)?.name ?? inventoryId} has an invalid saved reservation total.`,
      )
    }
  }
  for (const order of state.orders) {
    if (
      order.id === excludeOrderId ||
      (order.status !== "Confirmed" && order.status !== "In Progress")
    ) {
      continue
    }
    for (const reservation of order.reservations) {
      if (!inventoryIds.has(reservation.inventoryId)) continue
      const inventory = state.inventory.find(
        (item) => item.inventoryId === reservation.inventoryId,
      )
      if (
        !inventory ||
        !Number.isFinite(toInventoryReservationQuantity(reservation, inventory))
      ) {
        issues.push(
          `${reservation.name} has a saved reservation with an incompatible inventory unit.`,
        )
      }
    }
  }
  return [...new Set(issues)]
}

function toInventoryReservationQuantity(
  reservation: StockRequirement,
  inventory: AppData["inventory"][number],
) {
  return toInventoryBaseQuantity(
    reservation.reserved,
    reservation.unit,
    inventory,
  )
}

export type CostSnapshotOptions = {
  pricing?: Partial<PricingInput>
  labourRatePerHour?: number
}

export function calculateCostSnapshot(
  lines: OrderLine[],
  state?: AppData,
  options?: CostSnapshotOptions,
): CostSnapshot {
  if (!state) {
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

  const labourRatePerHour =
    options?.labourRatePerHour ?? state.settings.defaultLabourRatePerHour
  const pricing: PricingInput = {
    ...pricingInputFromSettings(state.settings),
    ...options?.pricing,
  }

  let ingredients = 0
  let packaging = 0
  let labour = 0
  let labourMinutes = 0
  let savedLinesSellingTotal = 0
  let hasAnySavedSellingPrice = false
  let unsavedCostTotal = 0
  const unpriced = new Set<string>()

  for (const line of lines) {
    const qty = Math.max(1, line.quantity)
    const lineLabourRate =
      options?.labourRatePerHour ??
      line.recipeSnapshot.pricing?.labourRatePerHour ??
      labourRatePerHour
    const breakdown = estimateRecipeMaterialCost(
      line.recipeSnapshot,
      state.inventory,
      lineLabourRate,
    )
    labourMinutes += Math.max(0, line.recipeSnapshot.preparationMinutes) * qty

    let lineTotalCost = 0
    if (breakdown.hasCompletePricing) {
      ingredients += breakdown.ingredientsCost * qty
      packaging += breakdown.packagingCost * qty
      labour += breakdown.labourCost * qty
      lineTotalCost = breakdown.totalCost * qty
    } else {
      const fallbackTotal = line.recipeSnapshot.estimatedCost * qty
      const lineIngredients = Math.round(fallbackTotal * 0.82)
      const linePackaging = Math.round(fallbackTotal * 0.1)
      const lineLabour = fallbackTotal - lineIngredients - linePackaging
      ingredients += lineIngredients
      packaging += linePackaging
      labour += lineLabour
      lineTotalCost = fallbackTotal
      for (const name of breakdown.unpricedItems) {
        unpriced.add(name)
      }
    }

    if (
      !options?.pricing &&
      line.recipeSnapshot.sellingPrice !== undefined &&
      Number.isFinite(line.recipeSnapshot.sellingPrice) &&
      line.recipeSnapshot.sellingPrice > 0
    ) {
      hasAnySavedSellingPrice = true
      savedLinesSellingTotal += Math.round(line.recipeSnapshot.sellingPrice) * qty
    } else {
      unsavedCostTotal += lineTotalCost
    }
  }

  const singleLinePricing =
    !options?.pricing && lines.length === 1 && lines[0].recipeSnapshot.pricing
      ? {
          mode: lines[0].recipeSnapshot.pricing.mode,
          marginPercent: lines[0].recipeSnapshot.pricing.marginPercent,
          markupPercent: lines[0].recipeSnapshot.pricing.markupPercent,
          roundingStep: lines[0].recipeSnapshot.pricing.roundingStep,
        }
      : pricing

  const estimatedTotal = ingredients + packaging + labour
  let suggestedPrice: number
  if (hasAnySavedSellingPrice) {
    if (unsavedCostTotal > 0) {
      const remainder = calculateSuggestedPrice(unsavedCostTotal, pricing)
      const remainderPrice = remainder.valid
        ? remainder.suggestedPrice
        : Math.ceil((unsavedCostTotal * 2.4) / pricing.roundingStep) *
          pricing.roundingStep
      suggestedPrice = savedLinesSellingTotal + remainderPrice
    } else {
      suggestedPrice = savedLinesSellingTotal
    }
  } else {
    const suggested = calculateSuggestedPrice(estimatedTotal, singleLinePricing)
    suggestedPrice = suggested.valid
      ? suggested.suggestedPrice
      : Math.ceil((estimatedTotal * 2.4) / singleLinePricing.roundingStep) *
        singleLinePricing.roundingStep
  }

  return {
    ingredients,
    packaging,
    labour,
    estimatedTotal,
    suggestedPrice,
    pricingMode: singleLinePricing.mode,
    marginPercent: singleLinePricing.marginPercent,
    markupPercent: singleLinePricing.markupPercent,
    labourMinutes,
    labourRatePerHour:
      options?.labourRatePerHour ??
      (lines.length === 1 && lines[0].recipeSnapshot.pricing
        ? lines[0].recipeSnapshot.pricing.labourRatePerHour
        : labourRatePerHour),
    unpricedIngredients: Array.from(unpriced),
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
    for (const item of recipeRequirements(line)) {
      const { requirement } = item
      const current = aggregated.get(requirement.inventoryId)
      const canonical = toCanonicalRequirement(state, item, line.quantity)
      aggregated.set(requirement.inventoryId, {
        name: requirement.name,
        required:
          Number.isFinite(canonical.quantity) &&
          Number.isFinite(current?.required ?? 0)
            ? (current?.required ?? 0) + canonical.quantity
            : Number.NaN,
        unit: canonical.inventory?.unit ?? requirement.unit,
      })
    }
  }

  const alreadyReserved = selectReservedByItem({
    ...state,
    orders: state.orders.filter((order) => order.id !== excludeOrderId),
  })

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
  const reservedByItem = selectReservedByItem({
    ...state,
    orders: state.orders.filter((order) => order.id !== excludeOrderId),
  })
  for (const [inventoryId, quantity] of reservedByItem) {
    alreadyReserved.set(inventoryId, quantity)
  }

  const remaining = new Map(
    state.inventory.map((item) => [
      item.inventoryId,
      Math.max(0, item.physical - (alreadyReserved.get(item.inventoryId) ?? 0)),
    ]),
  )

  return lines.flatMap((line) =>
    recipeRequirements(line).map(({ requirement, ...item }) => {
      const canonical = toCanonicalRequirement(
        state,
        { requirement, ...item },
        line.quantity,
      )
      const required = canonical.quantity
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
        unit: canonical.inventory?.unit ?? requirement.unit,
      } satisfies StockRequirement
    }),
  )
}
