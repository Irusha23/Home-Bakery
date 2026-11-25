import type { InventoryItem, Unit } from "../types"
import {
  fromBaseQuantity,
  getEffectiveGramsPerTsp,
  getEffectiveMlPerTsp,
  toBaseQuantity,
} from "./inventory"

export const COLOMBO_TIME_ZONE = "Asia/Colombo"

export function getColomboTodayIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const year = parts.find((part) => part.type === "year")?.value ?? "1970"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"
  return `${year}-${month}-${day}`
}

export function shiftColomboIsoDate(days: number, baseDate = new Date()): string {
  const [y, m, d] = getColomboTodayIso(baseDate).split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

const lkrFormatter = new Intl.NumberFormat("en-LK", {
  maximumFractionDigits: 0,
})

export function formatLkr(value: number) {
  return `Rs. ${lkrFormatter.format(value)}`
}

export function formatDate(date: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Date not set"
  const parsed = new Date(`${date}T00:00:00+05:30`)
  if (!Number.isFinite(parsed.getTime())) return "Date not set"
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: COLOMBO_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

export function formatTime(time: string) {
  if (!time || !/^\d{2}:\d{2}/.test(time)) return "Time not set"
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number)
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return "Time not set"
  }
  const parsed = new Date(Date.UTC(2025, 0, 1, hours, minutes))
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

export function formatQuantity(quantity: number, unit: Unit) {
  const absQty = Math.abs(quantity)
  if (unit === "g" && absQty >= 1000) {
    return `${(quantity / 1000).toLocaleString("en-LK", {
      maximumFractionDigits: 2,
    })} kg`
  }
  if (unit === "ml" && absQty >= 1000) {
    return `${(quantity / 1000).toLocaleString("en-LK", {
      maximumFractionDigits: 2,
    })} L`
  }
  return `${quantity.toLocaleString("en-LK", {
    maximumFractionDigits: 2,
  })} ${unit === "unit" ? (absQty === 1 ? "unit" : "units") : unit}`
}

export function formatDualQuantity(
  quantity: number,
  unit: Unit,
  item?: Pick<InventoryItem, "name" | "unit" | "gramsPerTsp" | "mlPerTsp">,
): { primary: string; secondary: string | null } {
  const primary = formatQuantity(quantity, unit)
  if (!item || !Number.isFinite(quantity) || quantity <= 0) {
    return { primary, secondary: null }
  }
  const opts = {
    gramsPerTsp: getEffectiveGramsPerTsp(item),
    mlPerTsp: getEffectiveMlPerTsp(item),
  }
  const baseQty = toBaseQuantity(quantity, unit, item.unit, opts)
  if (!Number.isFinite(baseQty)) {
    return { primary, secondary: null }
  }

  if (item.unit === "g") {
    if (unit === "tsp" || unit === "tbsp") {
      return {
        primary,
        secondary: `≈ ${formatQuantity(Math.round(baseQty * 10) / 10, "g")}`,
      }
    }
    if (unit === "g" && quantity <= 250) {
      const tsps = fromBaseQuantity(baseQty, "tsp", "g", opts)
      if (Number.isFinite(tsps) && tsps > 0 && tsps <= 50) {
        return {
          primary,
          secondary: `≈ ${formatQuantity(Math.round(tsps * 4) / 4, "tsp")}`,
        }
      }
    }
    return { primary, secondary: null }
  }

  if (item.unit === "ml") {
    if (unit === "tsp" || unit === "tbsp" || unit === "cup") {
      const customTsp = item.mlPerTsp !== undefined && item.mlPerTsp !== 5 && unit !== "cup"
      return {
        primary,
        secondary: `${customTsp ? "≈ " : ""}${formatQuantity(Math.round(baseQty * 10) / 10, "ml")}`,
      }
    }
    if (unit === "ml" && quantity <= 250) {
      if (quantity === 250) return { primary, secondary: "1 cup" }
      const tsps = fromBaseQuantity(baseQty, "tsp", "ml", opts)
      const tbsps = fromBaseQuantity(baseQty, "tbsp", "ml", opts)
      if (Number.isFinite(tbsps) && tbsps >= 1 && Math.abs(tbsps - Math.round(tbsps)) < 0.01) {
        return { primary, secondary: formatQuantity(tbsps, "tbsp") }
      }
      if (Number.isFinite(tsps) && tsps > 0 && tsps <= 50) {
        return {
          primary,
          secondary: `≈ ${formatQuantity(Math.round(tsps * 4) / 4, "tsp")}`,
        }
      }
    }
  }

  return { primary, secondary: null }
}
