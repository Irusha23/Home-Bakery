import type { BaseUnit, InventoryItem, Unit } from "../types"
import {
  convertInventoryUnitQuantity,
  fromBaseQuantity,
  toBaseQuantity,
} from "./inventory"

/**
 * Sanitizes a typed numeric draft while always allowing "" (empty) and partial
 * decimals such as "0." or ".5" so users can clear and retype freely.
 */
export function sanitizeNumericDraft(raw: string, allowDecimal = true): string {
  if (raw === "") return ""
  if (!allowDecimal) {
    return raw.replace(/\D+/g, "")
  }
  const stripped = raw.replace(/[^0-9.]/g, "")
  const dotIndex = stripped.indexOf(".")
  if (dotIndex === -1) return stripped
  const intPart = stripped.slice(0, dotIndex)
  const fracPart = stripped.slice(dotIndex + 1).replace(/\./g, "")
  return `${intPart}.${fracPart}`
}

/**
 * Formats a non-negative number into a clean editable decimal string without
 * trailing zeros or locale commas.
 */
export function formatEditableQuantity(value: number, maxDecimals = 3): string {
  if (!Number.isFinite(value) || value < 0) return ""
  const factor = 10 ** maxDecimals
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? "0" : String(rounded)
}

function inferBaseUnit(unit: Unit): BaseUnit {
  if (unit === "kg" || unit === "g") return "g"
  if (unit === "L" || unit === "ml" || unit === "cup") return "ml"
  return "unit"
}

/**
 * Converts a numeric draft string cleanly when switching measurement units.
 * Empty, zero, or non-numeric drafts are preserved without modification.
 */
export function convertDraftOnUnitChange(
  draft: string,
  fromUnit: Unit,
  toUnit: Unit,
  target?:
    | Pick<InventoryItem, "name" | "unit" | "gramsPerTsp" | "mlPerTsp">
    | BaseUnit,
): string {
  if (fromUnit === toUnit) return draft
  const trimmed = draft.trim()
  if (trimmed === "") return draft
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return draft

  let converted = Number.NaN
  if (typeof target === "object" && target !== null) {
    converted = convertInventoryUnitQuantity(parsed, fromUnit, toUnit, target)
  } else {
    const base: BaseUnit = target ?? inferBaseUnit(fromUnit)
    const baseQty = toBaseQuantity(parsed, fromUnit, base)
    if (Number.isFinite(baseQty)) {
      converted = fromBaseQuantity(baseQty, toUnit, base)
    }
  }

  return Number.isFinite(converted) && converted > 0
    ? formatEditableQuantity(converted, 3)
    : draft
}
