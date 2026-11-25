import type { AppData } from "../types"
import { shareOrDownloadBackupFile } from "./backupShare"
import { netRetainedPayments } from "./financials"

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value)
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`
  }
  return neutralized
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvCell).join(",")]
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","))
  }
  return lines.join("\r\n")
}

export function buildOrdersCsv(state: AppData): string {
  const headers = [
    "Reference",
    "Customer",
    "Status",
    "PrepStatus",
    "PaymentStatus",
    "CollectionDate",
    "CollectionTime",
    "AgreedPriceLKR",
    "PaidLKR",
    "EstimatedCostLKR",
  ]
  const rows = state.orders.map((order) => {
    const paid = netRetainedPayments(order, state.refunds)
    return [
      order.reference,
      order.customerName,
      order.status,
      order.preparationStatus,
      order.paymentStatus,
      order.collectionDate,
      order.collectionTime,
      order.agreedPrice,
      paid,
      order.costSnapshot.estimatedTotal,
    ]
  })
  return toCsv(headers, rows)
}

export function buildPurchasesCsv(state: AppData): string {
  const invMap = new Map(
    state.inventory.map((item) => [item.inventoryId, item.name]),
  )
  const headers = [
    "Date",
    "Item",
    "PurchasedQty",
    "PurchasedUnit",
    "UsableBaseQty",
    "TotalPriceLKR",
    "Note",
  ]
  const rows = state.purchases.map((p) => [
    p.date,
    invMap.get(p.inventoryId) ?? p.inventoryId,
    p.purchasedQuantity,
    p.purchasedUnit,
    p.usableBaseQuantity,
    p.totalPrice,
    p.note,
  ])
  return toCsv(headers, rows)
}

export function buildExpensesCsv(state: AppData): string {
  const catMap = new Map(state.expenseCategories.map((c) => [c.id, c.name]))
  const headers = [
    "Date",
    "Category",
    "Description",
    "AmountLKR",
    "Attribution",
  ]
  const rows = state.expenses.map((e) => [
    e.paidDate,
    catMap.get(e.categoryId) ?? e.categoryId,
    e.description,
    e.amount,
    e.attribution.type === "direct"
      ? `Direct (${e.attribution.orderId})`
      : "Shared",
  ])
  return toCsv(headers, rows)
}

export async function downloadCsvFile(
  filename: string,
  csvContent: string,
  title = "Udeni's Specials CSV Export",
) {
  return shareOrDownloadBackupFile({
    filename,
    content: csvContent,
    title,
    text: "Udeni's Specials bakery CSV report.",
    mimeType: "text/csv",
    dialogTitle: "Save or share CSV",
  })
}
