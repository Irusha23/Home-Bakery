import type { Recipe } from "../types"

export type ExpectedOutputParseResult = {
  valid: true
  value: Recipe["expectedOutput"]
} | { valid: false }

export function parseExpectedOutputQuantity(
  value: string,
): ExpectedOutputParseResult {
  if (value === "") return { valid: true, value: null }

  if (!/^\d+$/.test(value)) return { valid: false }

  const quantity = Number(value)

  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { valid: false }

  return { valid: true, value: { quantity, unit: "unit" } }
}
