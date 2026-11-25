import { selectLatestAllocationVersion } from "./expenses"
import { netRetainedPayments } from "./financials"
import type { AppData, Order } from "../types"

export type OrderExtraExpenseItem = {
  id: string
  description: string
  amount: number
  kind: "direct" | "allocated"
}

export type OrderProfitSummary = {
  incomeLkr: number
  collectedLkr: number
  ingredientsLkr: number
  packagingLkr: number
  labourLkr: number
  recipeCostLkr: number
  extraExpensesLkr: number
  extraExpenseItems: OrderExtraExpenseItem[]
  totalCostLkr: number
  profitLkr: number
  marginPercent: number | null
}

/**
 * Calculates per-order profit using order income, recipe item-wise cost
 * (including ingredients, packaging, and labour), and order-specific expenses.
 * Shopping trip expenses are excluded from extra expenses to avoid double-counting
 * ingredients already captured in `order.costSnapshot`.
 */
export function calculateOrderProfit(
  order: Order,
  state: Pick<
    AppData,
    "refunds" | "expenses" | "expenseAllocationHistories" | "orders" | "shoppingTrips"
  >,
): OrderProfitSummary {
  const collectedLkr = netRetainedPayments(order, state.refunds)
  const incomeLkr =
    order.status === "Cancelled" ? collectedLkr : order.agreedPrice

  const ingredientsLkr = order.costSnapshot.ingredients
  const packagingLkr = order.costSnapshot.packaging
  const labourLkr = order.costSnapshot.labour
  const recipeCostLkr = order.costSnapshot.estimatedTotal

  const shoppingExpenseIds = new Set(
    (state.shoppingTrips ?? [])
      .map((trip) => trip.expenseId)
      .filter((id): id is string => Boolean(id)),
  )

  const historyByExpenseId = new Map(
    state.expenseAllocationHistories.map((history) => [
      history.expenseId,
      history,
    ]),
  )

  const extraExpenseItems: OrderExtraExpenseItem[] = []

  for (const expense of state.expenses) {
    if (shoppingExpenseIds.has(expense.id)) continue

    if (
      expense.attribution.type === "direct" &&
      expense.attribution.orderId === order.id
    ) {
      extraExpenseItems.push({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        kind: "direct",
      })
      continue
    }

    if (expense.attribution.type === "shared") {
      const history = historyByExpenseId.get(expense.id)
      if (!history) continue
      const latestResult = selectLatestAllocationVersion(
        expense,
        [...history.versions],
        state.orders,
      )
      if (!latestResult.valid || !latestResult.version) continue
      const slice = latestResult.version.allocations.find(
        (item) => item.orderId === order.id,
      )
      if (slice && slice.amount > 0) {
        extraExpenseItems.push({
          id: expense.id,
          description: expense.description,
          amount: slice.amount,
          kind: "allocated",
        })
      }
    }
  }

  const extraExpensesLkr = extraExpenseItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  )
  const totalCostLkr = recipeCostLkr + extraExpensesLkr
  const profitLkr = incomeLkr - totalCostLkr
  const marginPercent =
    incomeLkr > 0 ? Math.round((profitLkr / incomeLkr) * 100) : null

  return {
    incomeLkr,
    collectedLkr,
    ingredientsLkr,
    packagingLkr,
    labourLkr,
    recipeCostLkr,
    extraExpensesLkr,
    extraExpenseItems,
    totalCostLkr,
    profitLkr,
    marginPercent,
  }
}
