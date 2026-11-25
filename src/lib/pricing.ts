import { toInventoryBaseQuantity } from "./inventory"
import type {
  AppData,
  AppSettings,
  BaseUnit,
  InventoryItem,
  PricingMode,
  RecipeIngredient,
  RecipePricingConfig,
  PackagingRequirement,
  Unit,
} from "../types"

export function getDisplayPriceUnitLabel(unit: BaseUnit): "kg" | "L" | "unit" {
  if (unit === "g") return "kg"
  if (unit === "ml") return "L"
  return "unit"
}

export function toDisplayUnitPrice(
  averageUnitCost: number | undefined,
  unit: BaseUnit,
): number | undefined {
  if (
    averageUnitCost === undefined ||
    !Number.isFinite(averageUnitCost) ||
    averageUnitCost < 0
  ) {
    return undefined
  }
  if (unit === "g" || unit === "ml") {
    return Math.round(averageUnitCost * 1000)
  }
  return Math.round(averageUnitCost * 100) / 100
}

export function fromDisplayUnitPrice(
  displayPrice: number,
  unit: BaseUnit,
): number {
  if (!Number.isFinite(displayPrice) || displayPrice < 0) return Number.NaN
  if (unit === "g" || unit === "ml") {
    return displayPrice / 1000
  }
  return displayPrice
}

export function calculateItemRecipeCost(
  quantity: number,
  unit: Unit,
  item: InventoryItem | undefined,
): number | null {
  if (
    !item ||
    item.averageUnitCost === undefined ||
    !Number.isFinite(item.averageUnitCost)
  ) {
    return null
  }
  const baseQty = toInventoryBaseQuantity(quantity, unit, item)
  if (!Number.isFinite(baseQty)) return null
  return Math.round(baseQty * item.averageUnitCost)
}

export type PricingInput = {
  mode: PricingMode
  marginPercent: number
  markupPercent: number
  roundingStep: 1 | 50 | 100
}

export type SuggestedPriceResult = {
  valid: true
  rawSuggestedPrice: number
  suggestedPrice: number
  profitAtSuggested: number
  actualMarginPercent: number
  actualMarkupPercent: number
} | {
  valid: false
  error: string
}

export type RecipeCostBreakdown = {
  ingredientsCost: number
  packagingCost: number
  labourCost: number
  totalCost: number
  unpricedItems: string[]
  hasLivePricing: boolean
  hasCompletePricing: boolean
}

export function roundCurrencyToStep(
  amount: number,
  step: 1 | 50 | 100,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  if (step === 1) return Math.round(amount)
  return Math.ceil(amount / step) * step
}

export function calculateSuggestedPrice(
  totalCost: number,
  input: PricingInput,
): SuggestedPriceResult {
  if (!Number.isFinite(totalCost) || totalCost < 0) {
    return { valid: false, error: "Total cost must be zero or higher." }
  }
  if (input.mode === "margin") {
    if (
      !Number.isFinite(input.marginPercent) ||
      input.marginPercent < 0 ||
      input.marginPercent >= 100
    ) {
      return {
        valid: false,
        error: "Target margin must be between 0% and 99.9%.",
      }
    }
    const raw = totalCost / (1 - input.marginPercent / 100)
    const rawRounded = Math.round(raw * 100) / 100
    const suggestedPrice = roundCurrencyToStep(rawRounded, input.roundingStep)
    return {
      valid: true,
      rawSuggestedPrice: rawRounded,
      suggestedPrice,
      profitAtSuggested: suggestedPrice - Math.round(totalCost),
      actualMarginPercent:
        suggestedPrice > 0
          ? Math.round(((suggestedPrice - totalCost) / suggestedPrice) * 1000) /
            10
          : 0,
      actualMarkupPercent:
        totalCost > 0
          ? Math.round(((suggestedPrice - totalCost) / totalCost) * 1000) / 10
          : 0,
    }
  }

  if (!Number.isFinite(input.markupPercent) || input.markupPercent < 0) {
    return { valid: false, error: "Markup percent must be zero or higher." }
  }
  const raw = totalCost * (1 + input.markupPercent / 100)
  const rawRounded = Math.round(raw * 100) / 100
  const suggestedPrice = roundCurrencyToStep(rawRounded, input.roundingStep)
  return {
    valid: true,
    rawSuggestedPrice: rawRounded,
    suggestedPrice,
    profitAtSuggested: suggestedPrice - Math.round(totalCost),
    actualMarginPercent:
      suggestedPrice > 0
        ? Math.round(((suggestedPrice - totalCost) / suggestedPrice) * 1000) /
          10
        : 0,
    actualMarkupPercent:
      totalCost > 0
        ? Math.round(((suggestedPrice - totalCost) / totalCost) * 1000) / 10
        : 0,
  }
}

export function estimateRecipeMaterialCost(
  recipe: {
    ingredients: RecipeIngredient[]
    packaging: PackagingRequirement[]
    preparationMinutes: number
    estimatedCost?: number
  },
  inventory: InventoryItem[],
  labourRatePerHour = 0,
): RecipeCostBreakdown {
  const byId = new Map(inventory.map((item) => [item.inventoryId, item]))
  let rawIngredients = 0
  let rawPackaging = 0
  let pricedCount = 0
  const unpricedItems: string[] = []

  for (const ing of recipe.ingredients) {
    const item = byId.get(ing.inventoryId)
    if (
      !item ||
      item.averageUnitCost === undefined ||
      !Number.isFinite(item.averageUnitCost)
    ) {
      unpricedItems.push(ing.name)
      continue
    }
    const baseQty = toInventoryBaseQuantity(ing.quantity, ing.unit, item)
    if (!Number.isFinite(baseQty)) {
      unpricedItems.push(ing.name)
      continue
    }
    rawIngredients += baseQty * item.averageUnitCost
    pricedCount += 1
  }

  for (const pkg of recipe.packaging) {
    const item = byId.get(pkg.inventoryId)
    if (
      !item ||
      item.averageUnitCost === undefined ||
      !Number.isFinite(item.averageUnitCost)
    ) {
      unpricedItems.push(pkg.name)
      continue
    }
    const baseQty = toInventoryBaseQuantity(pkg.quantity, pkg.unit, item)
    if (!Number.isFinite(baseQty)) {
      unpricedItems.push(pkg.name)
      continue
    }
    rawPackaging += baseQty * item.averageUnitCost
    pricedCount += 1
  }

  const ingredientsCost = Math.round(rawIngredients)
  const packagingCost = Math.round(rawPackaging)
  const labourCost = Math.round(
    (Math.max(0, recipe.preparationMinutes) / 60) *
      Math.max(0, labourRatePerHour),
  )

  return {
    ingredientsCost,
    packagingCost,
    labourCost,
    totalCost: ingredientsCost + packagingCost + labourCost,
    unpricedItems,
    hasLivePricing: pricedCount > 0,
    hasCompletePricing: unpricedItems.length === 0,
  }
}

export function pricingInputFromSettings(settings: AppSettings): PricingInput {
  return {
    mode: settings.defaultPricingMode,
    marginPercent: settings.defaultMarginPercent,
    markupPercent: settings.defaultMarkupPercent,
    roundingStep: settings.priceRoundingStep,
  }
}

export function calculatePriceMetricsAtSellingPrice(
  totalCost: number,
  sellingPrice: number,
) {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    return {
      profitLkr: -Math.round(totalCost),
      marginPercent: 0,
      markupPercent: 0,
    }
  }
  const profit = sellingPrice - totalCost
  return {
    profitLkr: Math.round(profit),
    marginPercent: Math.round((profit / sellingPrice) * 1000) / 10,
    markupPercent:
      totalCost > 0 ? Math.round((profit / totalCost) * 1000) / 10 : 100,
  }
}

export function getStateLabourRate(state?: AppData): number {
  return state?.settings?.defaultLabourRatePerHour ?? 600
}

export type ResolvedRecipePrice = {
  breakdown: RecipeCostBreakdown
  effectiveCost: number
  sellingPrice: number
  source: "saved" | "suggested"
  profitLkr: number
  marginPercent: number
}

export function resolveRecipeSellingPrice(
  recipe: {
    ingredients: RecipeIngredient[]
    packaging: PackagingRequirement[]
    preparationMinutes: number
    estimatedCost?: number
    sellingPrice?: number
    pricing?: RecipePricingConfig
  },
  inventory: InventoryItem[],
  settings: AppSettings,
): ResolvedRecipePrice {
  const labourRate =
    recipe.pricing?.labourRatePerHour ?? settings.defaultLabourRatePerHour
  const breakdown = estimateRecipeMaterialCost(recipe, inventory, labourRate)
  const effectiveCost = breakdown.hasLivePricing
    ? breakdown.totalCost
    : (recipe.estimatedCost ?? 0)
  const pricingInput: PricingInput = recipe.pricing
    ? {
        mode: recipe.pricing.mode,
        marginPercent: recipe.pricing.marginPercent,
        markupPercent: recipe.pricing.markupPercent,
        roundingStep: recipe.pricing.roundingStep,
      }
    : pricingInputFromSettings(settings)

  let sellingPrice: number
  let source: "saved" | "suggested"
  if (
    recipe.sellingPrice !== undefined &&
    Number.isFinite(recipe.sellingPrice) &&
    recipe.sellingPrice > 0
  ) {
    sellingPrice = Math.round(recipe.sellingPrice)
    source = "saved"
  } else {
    const suggested = calculateSuggestedPrice(effectiveCost, pricingInput)
    sellingPrice = suggested.valid
      ? suggested.suggestedPrice
      : Math.round(effectiveCost * 2)
    source = "suggested"
  }

  const metrics = calculatePriceMetricsAtSellingPrice(effectiveCost, sellingPrice)
  return {
    breakdown,
    effectiveCost,
    sellingPrice,
    source,
    profitLkr: metrics.profitLkr,
    marginPercent: metrics.marginPercent,
  }
}
