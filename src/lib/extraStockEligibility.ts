import type {
  AppData,
  ExtraStockPlan,
  PackagingRequirement,
  RecipeIngredient,
} from "../types"

import { inventoryCategory, recipeRequirementBaseQuantity } from "./inventory"

export function getExtraStockPlanEligibilityIssues(
  state: AppData,

  plan: ExtraStockPlan,
): string[] {
  const issues: string[] = []

  const product = state.products.find((item) => item.id === plan.productId)

  const variant = product?.variants.find((item) => item.id === plan.variantId)

  const finishedInventory = variant?.finishedInventoryId
    ? state.inventory.find(
        (item) => item.inventoryId === variant.finishedInventoryId,
      )
    : undefined

  const expectedOutput: unknown = plan.recipeSnapshot.expectedOutput

  if (!product || plan.recipeSnapshot.productId !== plan.productId)
    issues.push("The planned product is missing or does not match its recipe.")

  if (!variant || plan.recipeSnapshot.variantId !== plan.variantId)
    issues.push("The planned variant is missing or does not match its recipe.")

  if (!finishedInventory)
    issues.push(
      "Map this variant to a finished inventory item in Recipes before starting.",
    )
  else if (
    finishedInventory.category !== "finished" ||
    finishedInventory.unit !== "unit"
  ) {
    issues.push(
      "The variant must map to finished inventory measured in units. Update the mapping in Recipes.",
    )
  }

  if (!isValidExpectedOutput(expectedOutput))
    issues.push(
      "Set a positive whole-unit expected output in the recipe editor before starting.",
    )

  if (!Number.isSafeInteger(plan.quantity) || plan.quantity <= 0)
    issues.push("The plan quantity must be a positive whole number of batches.")

  const requirements: {
    requirement: RecipeIngredient | PackagingRequirement

    category: "ingredient" | "packaging"
  }[] = [
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
    const item = state.inventory.find(
      (inventory) => inventory.inventoryId === requirement.inventoryId,
    )

    if (!item) {
      issues.push(`${requirement.name} is missing from inventory.`)
    } else if (inventoryCategory(item) !== category) {
      issues.push(`${requirement.name} is not in ${category} inventory.`)
    } else if (
      !Number.isFinite(
        recipeRequirementBaseQuantity(state, requirement, category) *
          plan.quantity,
      )
    ) {
      issues.push(
        `${requirement.name} uses ${requirement.unit}, incompatible with inventory unit ${item.unit} or plan quantity.`,
      )
    }
  }

  return issues
}

function isValidExpectedOutput(
  value: unknown,
): value is { quantity: number; unit: "unit" } {
  if (typeof value !== "object" || value === null) return false

  if (!("quantity" in value) || !("unit" in value)) return false

  return (
    typeof value.quantity === "number" &&
    Number.isSafeInteger(value.quantity) &&
    value.quantity > 0 &&
    value.unit === "unit"
  )
}
