import {
  FINANCIAL_REPORT_TIME_ZONE,
  selectCollectedSales,
  selectEstimatedContribution,
  selectExpenseBreakdown,
  selectRecordedExpenseValue,
  selectRecordedPurchaseValue,
  type DatePeriod,
} from "./financialReports"
import { getColomboTodayIso } from "./selectors/todaySelectors"
import type { AppData } from "../types"

export type BudgetLimitStatus = "on-track" | "warning" | "over"

export type BudgetTargetProgress = {
  actual: number
  target?: number
  progressPct: number
  reached: boolean
}

export type BudgetSpendProgress = {
  spent: number
  limit?: number
  progressPct: number
  status: BudgetLimitStatus
}

export type CategoryBudgetProgress = BudgetSpendProgress & {
  categoryId: string
  categoryName: string
}

export type BudgetAlert = {
  id: string
  label: string
  spent: number
  limit: number
  overBy: number
}

export type MonthlyBudgetReport = {
  monthKey: string
  period: DatePeriod
  sales: BudgetTargetProgress
  profit: BudgetTargetProgress
  ingredientSpend: BudgetSpendProgress
  totalExpenses: number
  finishedStockRevenue: number
  categories: CategoryBudgetProgress[]
  overLimitAlerts: BudgetAlert[]
}

function colomboDateFromIsoTimestamp(timestamp: string): string | null {
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) return null
  return getColomboTodayIso(new Date(parsed))
}

export function getMonthPeriod(now = new Date()): DatePeriod {
  const today = getColomboTodayIso(now)
  const [year, month] = today.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    startDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
    endDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  }
}

export function computeSpendStatus(
  spent: number,
  limit?: number,
): BudgetSpendProgress {
  if (limit === undefined || limit <= 0) {
    return {
      spent,
      limit,
      progressPct: 0,
      status: "on-track",
    }
  }
  const progressPct = Math.round((spent / limit) * 100)
  const status: BudgetLimitStatus =
    spent > limit ? "over" : spent >= limit * 0.8 ? "warning" : "on-track"
  return {
    spent,
    limit,
    progressPct,
    status,
  }
}

export function selectFinishedStockSalesSummary(
  state: AppData,
  period: DatePeriod,
): { revenueLkr: number; costLkr: number; pricedCostLkr: number; saleCount: number } {
  let revenueLkr = 0
  let costLkr = 0
  let pricedCostLkr = 0
  let saleCount = 0
  for (const tx of state.finishedStockTransactions) {
    if (tx.type !== "sale") continue
    const date = colomboDateFromIsoTimestamp(tx.occurredAt)
    if (!date || date < period.startDate || date > period.endDate) continue
    saleCount += 1
    const txCost = Number.isFinite(tx.totalCost) ? tx.totalCost : 0
    costLkr += txCost
    if (
      typeof tx.sellingPrice === "number" &&
      Number.isSafeInteger(tx.sellingPrice)
    ) {
      revenueLkr += tx.sellingPrice
      pricedCostLkr += txCost
    }
  }
  return { revenueLkr, costLkr, pricedCostLkr, saleCount }
}

export function selectMonthlyBudgetReport(
  state: AppData,
  now = new Date(),
): MonthlyBudgetReport {
  const period = getMonthPeriod(now)
  const monthKey = period.startDate.slice(0, 7)

  const orderSalesReport = selectCollectedSales(state.orders, period)
  const orderContribution = selectEstimatedContribution(state.orders, period)
  const purchasesReport = selectRecordedPurchaseValue(state.purchases, period)
  const expensesValue = selectRecordedExpenseValue(
    state.expenses,
    state.expenseCategories,
    state.orders,
    period,
  )
  const expenseBreakdown = selectExpenseBreakdown(
    state.expenses,
    state.expenseCategories,
    state.orders,
    period,
  )
  const finishedSales = selectFinishedStockSalesSummary(state, period)

  const shoppingExpenseIds = new Set(
    (state.shoppingTrips ?? [])
      .map((trip) => trip.expenseId)
      .filter((id): id is string => Boolean(id)),
  )
  const periodShoppingTripSpend = (state.shoppingTrips ?? [])
    .filter(
      (trip) =>
        trip.date >= period.startDate &&
        trip.date <= period.endDate &&
        typeof trip.totalSpent === "number" &&
        Number.isSafeInteger(trip.totalSpent) &&
        trip.totalSpent > 0,
    )
    .reduce((sum, trip) => sum + (trip.totalSpent ?? 0), 0)
  const nonShoppingExpensesReport = selectRecordedExpenseValue(
    state.expenses.filter((expense) => !shoppingExpenseIds.has(expense.id)),
    state.expenseCategories,
    state.orders,
    period,
  )

  const totalSales =
    (orderSalesReport.recognizedRevenueLkr ?? 0) + finishedSales.revenueLkr
  const totalExpenses = expensesValue.totalLkr ?? 0
  const overheadExpenses = nonShoppingExpensesReport.totalLkr ?? 0
  const finishedGrossMargin =
    finishedSales.revenueLkr > 0 || finishedSales.pricedCostLkr > 0
      ? Math.round(finishedSales.revenueLkr - finishedSales.pricedCostLkr)
      : 0
  const estimatedNetContribution = Math.round(
    (orderContribution.estimatedContributionLkr ?? 0) +
      finishedGrossMargin -
      overheadExpenses,
  )

  const {
    monthlySalesTarget,
    monthlyProfitTarget,
    ingredientSpendLimit,
    categoryLimits,
  } = state.budgetPlan

  const sales: BudgetTargetProgress = {
    actual: totalSales,
    target: monthlySalesTarget,
    progressPct:
      monthlySalesTarget && monthlySalesTarget > 0
        ? Math.round((totalSales / monthlySalesTarget) * 100)
        : 0,
    reached:
      monthlySalesTarget !== undefined &&
      monthlySalesTarget > 0 &&
      totalSales >= monthlySalesTarget,
  }

  const profit: BudgetTargetProgress = {
    actual: estimatedNetContribution,
    target: monthlyProfitTarget,
    progressPct:
      monthlyProfitTarget && monthlyProfitTarget > 0
        ? Math.round((estimatedNetContribution / monthlyProfitTarget) * 100)
        : 0,
    reached:
      monthlyProfitTarget !== undefined &&
      monthlyProfitTarget > 0 &&
      estimatedNetContribution >= monthlyProfitTarget,
  }

  const ingredientSpend = computeSpendStatus(
    (purchasesReport.totalLkr ?? 0) + periodShoppingTripSpend,
    ingredientSpendLimit,
  )

  const spentByCategory = new Map<string, number>()
  for (const row of expenseBreakdown.byCategory) {
    spentByCategory.set(row.categoryId, row.totalLkr ?? 0)
  }

  const categories: CategoryBudgetProgress[] = state.expenseCategories.map(
    (cat) => {
      const spent = spentByCategory.get(cat.id) ?? 0
      const limit = categoryLimits[cat.id]
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        ...computeSpendStatus(spent, limit),
      }
    },
  )

  const overLimitAlerts: BudgetAlert[] = []
  if (
    ingredientSpend.limit !== undefined &&
    ingredientSpend.limit > 0 &&
    ingredientSpend.spent > ingredientSpend.limit
  ) {
    overLimitAlerts.push({
      id: "budget-ingredients",
      label: "Ingredient & packaging purchases",
      spent: ingredientSpend.spent,
      limit: ingredientSpend.limit,
      overBy: ingredientSpend.spent - ingredientSpend.limit,
    })
  }
  for (const cat of categories) {
    if (cat.limit !== undefined && cat.limit > 0 && cat.spent > cat.limit) {
      overLimitAlerts.push({
        id: `budget-${cat.categoryId}`,
        label: cat.categoryName,
        spent: cat.spent,
        limit: cat.limit,
        overBy: cat.spent - cat.limit,
      })
    }
  }

  return {
    monthKey,
    period,
    sales,
    profit,
    ingredientSpend,
    totalExpenses,
    finishedStockRevenue: finishedSales.revenueLkr,
    categories,
    overLimitAlerts,
  }
}

export function formatMonthHeading(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number)
  if (!year || !month) return monthKey
  return new Intl.DateTimeFormat("en-US", {
    timeZone: FINANCIAL_REPORT_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 15)))
}
