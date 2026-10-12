import type { Unit } from "../types"

const lkrFormatter = new Intl.NumberFormat("en-LK", {
  maximumFractionDigits: 0,
})

export function formatLkr(value: number) {
  return `Rs. ${lkrFormatter.format(value)}`
}

export function formatDate(date: string) {
  if (!date) return "Date not set"
  return new Intl.DateTimeFormat("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`))
}

export function formatTime(time: string) {
  if (!time) return "Time not set"
  const [hours, minutes] = time.split(":").map(Number)
  return new Intl.DateTimeFormat("en-LK", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2025, 0, 1, hours, minutes))
}

export function formatQuantity(quantity: number, unit: Unit) {
  if (unit === "g" && quantity >= 1000) {
    return `${(quantity / 1000).toLocaleString("en-LK", {
      maximumFractionDigits: 2,
    })} kg`
  }
  if (unit === "ml" && quantity >= 1000) {
    return `${(quantity / 1000).toLocaleString("en-LK", {
      maximumFractionDigits: 2,
    })} L`
  }
  return `${quantity.toLocaleString("en-LK")} ${
    unit === "unit" ? (quantity === 1 ? "unit" : "units") : unit
  }`
}
