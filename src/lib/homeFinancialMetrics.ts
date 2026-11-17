import {
  FINANCIAL_REPORT_TIME_ZONE,
  selectCollectedSales,
  selectCustomerBalances,
  selectCustomerCashMovement,
  selectEstimatedContribution,
  selectRecordedExpenseValue,
  type DatePeriod,
} from "./financialReports"

import type { AppData } from "../types"

export type HomeFinancialMetrics = {
  period: DatePeriod

  sales: ReturnType<typeof selectCollectedSales>

  estimatedContribution: ReturnType<typeof selectEstimatedContribution>

  balances: ReturnType<typeof selectCustomerBalances>

  cashMovement: ReturnType<typeof selectCustomerCashMovement>

  expenses: ReturnType<typeof selectRecordedExpenseValue>
}

function colomboDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FINANCIAL_REPORT_TIME_ZONE,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  }).formatToParts(now)

  const values = new Map(parts.map((part) => [part.type, part.value]))

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number)

  const shifted = new Date(0)

  shifted.setUTCFullYear(year, month - 1, day + days)

  shifted.setUTCHours(0, 0, 0, 0)

  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),

    String(shifted.getUTCMonth() + 1).padStart(2, "0"),

    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

export function getCurrentWeekPeriod(now: Date): DatePeriod {
  const today = colomboDate(now)

  const [year, month, day] = today.split("-").map(Number)

  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

  const daysSinceMonday = (weekday + 6) % 7

  return {
    startDate: shiftDate(today, -daysSinceMonday),

    endDate: shiftDate(today, 6 - daysSinceMonday),
  }
}

export function selectHomeFinancialMetrics(
  data: AppData,

  now: Date,
): HomeFinancialMetrics {
  const period = getCurrentWeekPeriod(now)

  return {
    period,

    sales: selectCollectedSales(data.orders, period),

    estimatedContribution: selectEstimatedContribution(data.orders, period),

    balances: selectCustomerBalances(data.orders, data.refunds),

    cashMovement: selectCustomerCashMovement(
      data.orders,

      data.refunds,

      period,
    ),

    expenses: selectRecordedExpenseValue(
      data.expenses,

      data.expenseCategories,

      data.orders,

      period,
    ),
  }
}
