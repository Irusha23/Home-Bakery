import {
  isValidFinancialDate,
  isValidMoneyAmount,
  validPaymentRecords,
  validRefundRecordsForPayment,
} from "./financials"

import {
  selectAllocationVersionAsKnownAt,
  selectLatestAllocationVersion,
  totalAllocationAmount,
  unallocatedExpenseBalance,
  validateExpense,
} from "./expenses"

import type {
  Expense,
  ExpenseAllocationHistory,
  ExpenseAllocationVersion,
  ExpenseCategory,
  FinishedStockTransaction,
  Order,
  PreparationRecord,
  PurchaseRecord,
  Refund,
} from "../types"

export const FINANCIAL_REPORT_TIME_ZONE = "Asia/Colombo"

export type DatePeriod = {
  startDate: string

  endDate: string
}

type ReportStatus = {
  complete: boolean

  issues: string[]
}

export type CollectedSalesReport = ReportStatus & {
  recognizedRevenueLkr: number | null

  collectedOrderCount: number

  undatedLegacyCollections: {
    count: number

    valueLkr: number | null
  }
}

export type CustomerCashMovementReport = ReportStatus & {
  paymentsReceivedLkr: number | null

  refundsIssuedLkr: number | null

  netCustomerCashMovementLkr: number | null

  paymentCount: number

  refundCount: number
}

export type CustomerBalancesReport = ReportStatus & {
  outstandingLkr: number | null

  customerCreditLkr: number | null

  receivableOrderCount: number

  creditOrderCount: number
}

export type DatedMoneyReport = ReportStatus & {
  totalLkr: number | null

  recordCount: number
}

export type EstimatedContributionReport = ReportStatus & {
  estimatedCostLkr: number | null

  estimatedContributionLkr: number | null

  collectedOrderCount: number
}

export type ActualMaterialCostReport = ReportStatus & {
  actualMaterialCost: number | null

  preparationCount: number
}

export type FinishedStockCostReport = ReportStatus & {
  costOfStockSold: number | null

  writeOffCost: number | null

  soldTransactionCount: number

  writeOffTransactionCount: number
}

export type ExpenseAllocationViewEntry = {
  expenseId: string

  expenseAmountLkr: number | null

  version: ExpenseAllocationVersion | null

  allocatedAmountLkr: number | null

  unallocatedBalanceLkr: number | null
}

export type ExpenseAllocationView = ReportStatus & {
  entries: ExpenseAllocationViewEntry[]
}

export type ExpenseBreakdownLine = {
  totalLkr: number | null
  expenseCount: number
}

export type ExpenseCategoryBreakdownLine = ExpenseBreakdownLine & {
  categoryId: string
  categoryName: string
}

export type ExpenseBreakdownReport = ReportStatus & ExpenseBreakdownLine & {
  byCategory: ExpenseCategoryBreakdownLine[]
  byAttribution: {
    direct: ExpenseBreakdownLine
    shared: ExpenseBreakdownLine
  }
}

export type ExpenseAllocationBasis = { type: "latest" } | {
  type: "as-known-at"
  timestamp: string
}

export type OrderExpenseAttribution = {
  orderId: string
  orderReference: string
  customerName: string
  directExpenseLkr: number | null
  sharedAllocatedLkr: number | null
  totalAttributedLkr: number | null
}

export type OrderExpenseAttributionReport = ReportStatus & {
  sourceExpenseTotalLkr: number | null
  directExpenseTotalLkr: number | null
  sharedAllocatedTotalLkr: number | null
  unallocatedSharedExpenseTotalLkr: number | null
  orders: OrderExpenseAttribution[]
}

type CollectedOrderSelection = {
  collected: Order[]

  undatedLegacy: Order[]

  issues: string[]
}

const colomboDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: FINANCIAL_REPORT_TIME_ZONE,

  year: "numeric",

  month: "2-digit",

  day: "2-digit",

  hour: "2-digit",

  minute: "2-digit",

  second: "2-digit",

  hourCycle: "h23",
})

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    isValidFinancialDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  )
}

function utcMillis(year: number, month: number, day: number): number {
  const date = new Date(0)

  date.setUTCFullYear(year, month - 1, day)

  date.setUTCHours(0, 0, 0, 0)

  return date.getTime()
}

function colomboDayStart(date: string): number {
  const [year, month, day] = date.split("-").map(Number)

  const targetUtc = utcMillis(year, month, day)

  let candidate = targetUtc

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = colomboDateTimeFormatter.formatToParts(new Date(candidate))

    const values = new Map(parts.map((part) => [part.type, part.value]))

    const localAsUtc =
      utcMillis(
        Number(values.get("year")),

        Number(values.get("month")),

        Number(values.get("day")),
      ) +
      Number(values.get("hour")) * 60 * 60 * 1000 +
      Number(values.get("minute")) * 60 * 1000 +
      Number(values.get("second")) * 1000

    candidate = targetUtc - (localAsUtc - candidate)
  }

  return candidate
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number)

  const next = new Date(utcMillis(year, month, day) + 24 * 60 * 60 * 1000)

  return [
    String(next.getUTCFullYear()).padStart(4, "0"),

    String(next.getUTCMonth() + 1).padStart(2, "0"),

    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

function periodBounds(period: DatePeriod): [number, number] | null {
  if (
    !period ||
    !isValidFinancialDate(period.startDate) ||
    !isValidFinancialDate(period.endDate) ||
    period.startDate > period.endDate
  ) {
    return null
  }

  return [
    colomboDayStart(period.startDate),

    colomboDayStart(nextDate(period.endDate)),
  ]
}

function timestampInPeriod(
  timestamp: string,

  bounds: [number, number],
): boolean {
  const instant = Date.parse(timestamp)

  return instant >= bounds[0] && instant < bounds[1]
}

function reportStatus(issues: string[]): ReportStatus {
  return { complete: issues.length === 0, issues }
}

function addWholeLkr(
  current: number | null,

  amount: number,

  issues: string[],

  label: string,
): number | null {
  if (current === null) return null

  const next = current + amount

  if (!Number.isSafeInteger(next)) {
    issues.push(`${label} exceeds the safe whole-LKR range.`)

    return null
  }

  return next
}

function addFiniteCost(
  current: number | null,

  amount: number,

  issues: string[],

  label: string,
): number | null {
  if (current === null) return null

  const next = current + amount

  if (!Number.isFinite(next)) {
    issues.push(`${label} exceeds the finite numeric range.`)

    return null
  }

  return next
}

function selectCollectedOrders(
  orders: Order[],

  bounds: [number, number],
): CollectedOrderSelection {
  const collected: Order[] = []

  const undatedLegacy: Order[] = []

  const issues: string[] = []

  const seenIds = new Set<string>()

  for (const order of orders) {
    if (
      typeof order.id !== "string" ||
      !order.id.trim() ||
      seenIds.has(order.id)
    ) {
      issues.push("Orders contain a missing or duplicate ID.")

      continue
    }

    seenIds.add(order.id)

    if (order.status === "Cancelled") continue

    if (order.collectedAt === undefined || order.collectedAt === null) {
      if (order.status === "Completed") undatedLegacy.push(order)

      continue
    }

    if (!validTimestamp(order.collectedAt)) {
      issues.push(`Order ${order.id} has an invalid collection timestamp.`)

      continue
    }

    if (order.status !== "Completed") {
      issues.push(
        `Order ${order.id} has a collection timestamp but is not completed.`,
      )
      continue
    }

    if (timestampInPeriod(order.collectedAt, bounds)) collected.push(order)
  }

  return { collected, undatedLegacy, issues }
}

function validOrderPrice(order: Order, issues: string[]): number | null {
  if (!Number.isSafeInteger(order.agreedPrice) || order.agreedPrice < 0) {
    issues.push(`Order ${order.id} has an invalid agreed price.`)

    return null
  }

  return order.agreedPrice
}

function invalidPeriodIssue(): string[] {
  return ["Reporting period must contain valid inclusive start and end dates."]
}

type ValidExpensePeriodSelection = {
  expenses: Expense[]
  issues: string[]
}

function selectValidExpensesForPeriod(
  expenses: Expense[],
  categories: ExpenseCategory[],
  orders: Order[],
  period: DatePeriod,
): ValidExpensePeriodSelection | null {
  if (!periodBounds(period)) return null

  const issues: string[] = []
  const selected: Expense[] = []
  const seenIds = new Set<string>()

  for (const expense of expenses) {
    if (
      !expense ||
      typeof expense !== "object" ||
      typeof expense.id !== "string" ||
      !expense.id.trim() ||
      seenIds.has(expense.id)
    ) {
      issues.push("Expenses contain a missing or duplicate ID.")
      continue
    }

    seenIds.add(expense.id)

    if (
      !expense.attribution ||
      typeof expense.attribution !== "object" ||
      (expense.attribution.type === "direct" &&
        typeof expense.attribution.orderId !== "string") ||
      (expense.attribution.type !== "direct" &&
        expense.attribution.type !== "shared")
    ) {
      issues.push(`Expense ${expense.id} has invalid attribution.`)
      continue
    }

    const validation = validateExpense(expense, categories, orders)
    if (!validation.valid) {
      issues.push(
        ...validation.issues.map((issue) => `Expense ${expense.id}: ${issue}`),
      )
      continue
    }
    if (!isValidMoneyAmount(expense.amount)) {
      issues.push(`Expense ${expense.id} has an invalid whole-LKR amount.`)
      continue
    }
    if (!isValidFinancialDate(expense.paidDate)) {
      issues.push(`Expense ${expense.id} has an invalid paid date.`)
      continue
    }
    if (
      expense.paidDate < period.startDate ||
      expense.paidDate > period.endDate
    )
      continue
    selected.push(expense)
  }
  return { expenses: selected, issues }
}

export function selectCollectedSales(
  orders: Order[],

  period: DatePeriod,
): CollectedSalesReport {
  const bounds = periodBounds(period)

  if (!bounds) {
    return {
      recognizedRevenueLkr: null,

      collectedOrderCount: 0,

      undatedLegacyCollections: { count: 0, valueLkr: null },

      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const selection = selectCollectedOrders(orders, bounds)

  const issues = [...selection.issues]

  let revenue: number | null = 0

  let undatedValue: number | null = 0

  for (const order of selection.collected) {
    const price = validOrderPrice(order, issues)

    if (price !== null)
      revenue = addWholeLkr(revenue, price, issues, "Collected revenue")
  }

  for (const order of selection.undatedLegacy) {
    const price = validOrderPrice(order, issues)

    if (price !== null)
      undatedValue = addWholeLkr(
        undatedValue,

        price,

        issues,

        "Undated legacy collection value",
      )
  }

  return {
    recognizedRevenueLkr: revenue,

    collectedOrderCount: selection.collected.length,

    undatedLegacyCollections: {
      count: selection.undatedLegacy.length,

      valueLkr: undatedValue,
    },

    ...reportStatus(issues),
  }
}

export function selectCustomerCashMovement(
  orders: Order[],

  refunds: Refund[],

  period: DatePeriod,
): CustomerCashMovementReport {
  const bounds = periodBounds(period)

  if (!bounds) {
    return {
      paymentsReceivedLkr: null,

      refundsIssuedLkr: null,

      netCustomerCashMovementLkr: null,

      paymentCount: 0,

      refundCount: 0,

      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const issues: string[] = []

  const paymentsByOrder =
    new Map<string, ReturnType<typeof validPaymentRecords>>()

  const seenPaymentIds = new Set<string>()

  const seenRefundIds = new Set<string>()

  const knownOrderIds = new Set(orders.map((order) => order.id))

  let paymentsReceived: number | null = 0

  let refundsIssued: number | null = 0

  let paymentCount = 0

  let refundCount = 0

  const seenOrderIds = new Set<string>()
  for (const order of orders) {
    if (
      typeof order.id !== "string" ||
      !order.id.trim() ||
      seenOrderIds.has(order.id)
    ) {
      issues.push("Orders contain a missing or duplicate ID.")
      continue
    }
    seenOrderIds.add(order.id)

    const validPayments = validPaymentRecords(order)

    if (validPayments.length !== order.payments.length)
      issues.push(`Order ${order.id} contains invalid or duplicate payments.`)

    const uniquePaymentsForOrder: typeof validPayments = []
    for (const payment of validPayments) {
      if (seenPaymentIds.has(payment.id)) {
        issues.push(`Payment ID ${payment.id} is duplicated across orders.`)

        continue
      }

      seenPaymentIds.add(payment.id)
      uniquePaymentsForOrder.push(payment)

      if (payment.date < period.startDate || payment.date > period.endDate)
        continue

      paymentsReceived = addWholeLkr(
        paymentsReceived,

        payment.amount,

        issues,

        "Payments received",
      )

      paymentCount += 1
    }

    paymentsByOrder.set(order.id, uniquePaymentsForOrder)
  }

  for (const refund of refunds) {
    if (!knownOrderIds.has(refund.orderId)) {
      issues.push(`Refund ${refund.id} refers to a missing order.`)

      continue
    }

    if (seenRefundIds.has(refund.id)) {
      issues.push(`Refund ID ${refund.id} is duplicated.`)

      continue
    }

    seenRefundIds.add(refund.id)

    const order = orders.find((item) => item.id === refund.orderId)

    const paymentExists = paymentsByOrder

      .get(refund.orderId)

      ?.some((payment) => payment.id === refund.paymentId)

    const validForPayment = paymentExists
      ? validRefundRecordsForPayment(order!, refunds, refund.paymentId).some(
          (item) => item.id === refund.id,
        )
      : false

    if (!validForPayment) {
      issues.push(`Refund ${refund.id} is invalid or exceeds its payment.`)

      continue
    }

    if (refund.date < period.startDate || refund.date > period.endDate) continue

    refundsIssued = addWholeLkr(
      refundsIssued,

      refund.amount,

      issues,

      "Refunds issued",
    )

    refundCount += 1
  }

  const net =
    paymentsReceived !== null && refundsIssued !== null
      ? paymentsReceived - refundsIssued
      : null

  if (net !== null && !Number.isSafeInteger(net)) {
    issues.push("Net customer cash movement exceeds the safe whole-LKR range.")
  }

  return {
    paymentsReceivedLkr: paymentsReceived,

    refundsIssuedLkr: refundsIssued,

    netCustomerCashMovementLkr:
      net !== null && Number.isSafeInteger(net) ? net : null,

    paymentCount,

    refundCount,

    ...reportStatus(issues),
  }
}

export function selectCustomerBalances(
  orders: Order[],

  refunds: Refund[],
): CustomerBalancesReport {
  const issues: string[] = []

  const seenOrderIds = new Set<string>()

  let outstanding: number | null = 0

  let credit: number | null = 0

  let receivableOrderCount = 0

  let creditOrderCount = 0

  for (const order of orders) {
    if (
      typeof order.id !== "string" ||
      !order.id.trim() ||
      seenOrderIds.has(order.id)
    ) {
      issues.push("Orders contain a missing or duplicate ID.")

      continue
    }

    seenOrderIds.add(order.id)

    if (order.status === "Cancelled") continue

    const price = validOrderPrice(order, issues)

    const validPayments = validPaymentRecords(order)

    if (validPayments.length !== order.payments.length)
      issues.push(`Order ${order.id} contains invalid or duplicate payments.`)

    const paymentRefunds = validPayments.flatMap((payment) =>
      validRefundRecordsForPayment(order, refunds, payment.id),
    )

    const relatedRefunds = refunds.filter(
      (refund) => refund.orderId === order.id,
    )

    const refundIds = new Set<string>()

    const validRefunds = paymentRefunds.filter((refund) => {
      if (refundIds.has(refund.id)) return false

      refundIds.add(refund.id)

      return true
    })

    if (
      validRefunds.length !== relatedRefunds.length ||
      validRefunds.length !== paymentRefunds.length
    )
      issues.push(`Order ${order.id} contains invalid or duplicate refunds.`)

    if (price === null) continue

    const paymentTotal = validPayments.reduce(
      (sum, payment) => sum + payment.amount,

      0,
    )

    const refundTotal = validRefunds.reduce(
      (sum, refund) => sum + refund.amount,

      0,
    )

    const netPayments = paymentTotal - refundTotal

    if (
      !Number.isSafeInteger(paymentTotal) ||
      !Number.isSafeInteger(refundTotal) ||
      !Number.isSafeInteger(netPayments)
    ) {
      issues.push(`Order ${order.id} has an unsafe payment balance.`)

      continue
    }

    const orderOutstanding =
      order.status === "Draft" ? 0 : Math.max(0, price - netPayments)

    const orderCredit =
      order.status === "Draft"
        ? Math.max(0, netPayments)
        : Math.max(0, netPayments - price)

    outstanding = addWholeLkrOrZero(
      outstanding,

      orderOutstanding,

      issues,

      "Outstanding balances",
    )

    credit = addWholeLkrOrZero(credit, orderCredit, issues, "Customer credit")

    if (orderOutstanding > 0) receivableOrderCount += 1

    if (orderCredit > 0) creditOrderCount += 1
  }

  return {
    outstandingLkr: outstanding,

    customerCreditLkr: credit,

    receivableOrderCount,

    creditOrderCount,

    ...reportStatus(issues),
  }
}

function addWholeLkrOrZero(
  current: number | null,

  amount: number,

  issues: string[],

  label: string,
): number | null {
  if (current === null) return null

  if (amount === 0) return current

  return addWholeLkr(current, amount, issues, label)
}

export function selectRecordedExpenseValue(
  expenses: Expense[],

  categories: ExpenseCategory[],

  orders: Order[],

  period: DatePeriod,
): DatedMoneyReport {
  const selection = selectValidExpensesForPeriod(
    expenses,
    categories,
    orders,
    period,
  )
  if (!selection) {
    return {
      totalLkr: null,

      recordCount: 0,

      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const issues = [...selection.issues]
  let total: number | null = 0
  for (const expense of selection.expenses)
    total = addWholeLkr(total, expense.amount, issues, "Recorded expenses")
  return {
    totalLkr: total,
    recordCount: selection.expenses.length,
    ...reportStatus(issues),
  }
}

function emptyExpenseBreakdownLine(): ExpenseBreakdownLine {
  return { totalLkr: 0, expenseCount: 0 }
}

export function selectExpenseBreakdown(
  expenses: Expense[],
  categories: ExpenseCategory[],
  orders: Order[],
  period: DatePeriod,
): ExpenseBreakdownReport {
  const selection = selectValidExpensesForPeriod(
    expenses,
    categories,
    orders,
    period,
  )
  if (!selection) {
    return {
      totalLkr: null,
      expenseCount: 0,
      byCategory: [],
      byAttribution: {
        direct: emptyExpenseBreakdownLine(),
        shared: emptyExpenseBreakdownLine(),
      },
      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const issues = [...selection.issues]
  let totalLkr: number | null = 0
  const byCategory = new Map<string, ExpenseCategoryBreakdownLine>()
  const byAttribution = {
    direct: emptyExpenseBreakdownLine(),
    shared: emptyExpenseBreakdownLine(),
  }

  for (const expense of selection.expenses) {
    const category = categories.find((item) => item.id === expense.categoryId)
    if (!category) {
      issues.push(`Expense ${expense.id} has no valid category.`)
      continue
    }
    totalLkr = addWholeLkr(
      totalLkr,
      expense.amount,
      issues,
      "Recorded expenses",
    )

    const categoryLine = byCategory.get(category.id) ?? {
      categoryId: category.id,
      categoryName: category.name,
      totalLkr: 0,
      expenseCount: 0,
    }
    categoryLine.totalLkr = addWholeLkr(
      categoryLine.totalLkr,
      expense.amount,
      issues,
      `Expense category ${category.name}`,
    )
    categoryLine.expenseCount += 1
    byCategory.set(category.id, categoryLine)

    const classification = byAttribution[expense.attribution.type]
    classification.totalLkr = addWholeLkr(
      classification.totalLkr,
      expense.amount,
      issues,
      `${expense.attribution.type === "direct" ? "Direct" : "Shared"} expenses`,
    )
    classification.expenseCount += 1
  }

  return {
    totalLkr,
    expenseCount: selection.expenses.length,
    byCategory: [...byCategory.values()].sort((left, right) =>
      left.categoryName.localeCompare(right.categoryName),
    ),
    byAttribution,
    ...reportStatus(issues),
  }
}

export function selectRecordedPurchaseValue(
  purchases: PurchaseRecord[],

  period: DatePeriod,
): DatedMoneyReport {
  if (!periodBounds(period)) {
    return {
      totalLkr: null,

      recordCount: 0,

      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const issues: string[] = []

  const seenIds = new Set<string>()

  let total: number | null = 0

  let recordCount = 0

  for (const purchase of purchases) {
    if (
      typeof purchase.id !== "string" ||
      !purchase.id.trim() ||
      seenIds.has(purchase.id)
    ) {
      issues.push("Purchases contain a missing or duplicate ID.")

      continue
    }

    seenIds.add(purchase.id)

    if (!isValidMoneyAmount(purchase.totalPrice)) {
      issues.push(`Purchase ${purchase.id} has an invalid whole-LKR value.`)

      continue
    }

    if (!isValidFinancialDate(purchase.date)) {
      issues.push(`Purchase ${purchase.id} has an invalid purchase date.`)

      continue
    }

    if (purchase.date < period.startDate || purchase.date > period.endDate)
      continue

    total = addWholeLkr(
      total,
      purchase.totalPrice,
      issues,
      "Recorded purchases",
    )

    recordCount += 1
  }

  return { totalLkr: total, recordCount, ...reportStatus(issues) }
}

export function selectEstimatedContribution(
  orders: Order[],

  period: DatePeriod,
): EstimatedContributionReport {
  const bounds = periodBounds(period)

  if (!bounds) {
    return {
      estimatedCostLkr: null,

      estimatedContributionLkr: null,

      collectedOrderCount: 0,

      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const selection = selectCollectedOrders(orders, bounds)

  const issues = [...selection.issues]

  let estimatedCost: number | null = 0

  let estimatedContribution: number | null = 0

  for (const order of selection.collected) {
    const price = validOrderPrice(order, issues)

    const cost = order.costSnapshot?.estimatedTotal

    if (!Number.isSafeInteger(cost) || cost < 0) {
      issues.push(`Order ${order.id} has an invalid estimated cost snapshot.`)

      continue
    }

    estimatedCost = addWholeLkr(
      estimatedCost,

      cost,

      issues,

      "Estimated order costs",
    )

    if (price !== null) {
      estimatedContribution = addWholeLkr(
        estimatedContribution,

        price - cost,

        issues,

        "Estimated contribution",
      )
    }
  }

  return {
    estimatedCostLkr: estimatedCost,

    estimatedContributionLkr: estimatedContribution,

    collectedOrderCount: selection.collected.length,

    ...reportStatus(issues),
  }
}

function selectActualMaterialCost(
  records: PreparationRecord[],

  predicate: (record: PreparationRecord) => boolean,
): ActualMaterialCostReport {
  const issues: string[] = []

  const seenIds = new Set<string>()

  let total: number | null = 0

  let preparationCount = 0

  for (const record of records) {
    if (
      typeof record.id !== "string" ||
      !record.id.trim() ||
      seenIds.has(record.id)
    ) {
      issues.push("Preparation records contain a missing or duplicate ID.")

      continue
    }

    seenIds.add(record.id)

    if (record.status !== "Ready") continue

    if (!predicate(record)) continue

    if (!record.completedAt || !validTimestamp(record.completedAt)) {
      issues.push(`Preparation ${record.id} has no valid completion timestamp.`)
      total = null
      continue
    }

    preparationCount += 1

    if (
      typeof record.actualCost !== "number" ||
      !Number.isFinite(record.actualCost) ||
      record.actualCost < 0
    ) {
      issues.push(`Preparation ${record.id} has no valid actual material cost.`)

      total = null

      continue
    }

    total = addFiniteCost(
      total,
      record.actualCost,
      issues,
      "Actual material cost",
    )
  }

  return {
    actualMaterialCost: total,

    preparationCount,

    ...reportStatus(issues),
  }
}

export function selectActualMaterialCostByCompletionDate(
  records: PreparationRecord[],

  period: DatePeriod,
): ActualMaterialCostReport {
  const bounds = periodBounds(period)

  if (!bounds) {
    return {
      actualMaterialCost: null,

      preparationCount: 0,

      ...reportStatus(invalidPeriodIssue()),
    }
  }

  return selectActualMaterialCost(records, (record) =>
    timestampInPeriod(record.completedAt!, bounds),
  )
}

export function selectActualMaterialCostByCollectedOrderCohort(
  orders: Order[],

  records: PreparationRecord[],

  period: DatePeriod,
): ActualMaterialCostReport {
  const bounds = periodBounds(period)

  if (!bounds) {
    return {
      actualMaterialCost: null,

      preparationCount: 0,

      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const selection = selectCollectedOrders(orders, bounds)

  const selectedIds = new Set(selection.collected.map((order) => order.id))

  const preparationOrderLineIds = new Set(
    records

      .filter((record) => record.status === "Ready")

      .map((record) => `${record.orderId}\u0000${record.orderLineId}`),
  )

  const missingPreparations = selection.collected.flatMap((order) =>
    order.lines

      .filter(
        (line) => !preparationOrderLineIds.has(`${order.id}\u0000${line.id}`),
      )

      .map(
        (line) =>
          `Order ${order.id} has no completed preparation for line ${line.id}.`,
      ),
  )

  const result = selectActualMaterialCost(
    records,

    (record) => selectedIds.has(record.orderId),
  )

  return {
    ...result,

    actualMaterialCost:
      missingPreparations.length > 0 ? null : result.actualMaterialCost,

    complete:
      result.complete &&
      selection.issues.length === 0 &&
      missingPreparations.length === 0,

    issues: [
      ...selection.issues,

      ...missingPreparations,

      ...result.issues,
    ],
  }
}

export function selectFinishedStockCosts(
  transactions: FinishedStockTransaction[],

  period: DatePeriod,
): FinishedStockCostReport {
  const bounds = periodBounds(period)

  if (!bounds) {
    return {
      costOfStockSold: null,

      writeOffCost: null,

      soldTransactionCount: 0,

      writeOffTransactionCount: 0,

      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const issues: string[] = []

  const seenIds = new Set<string>()

  let sold: number | null = 0

  let writeOff: number | null = 0

  let soldCount = 0

  let writeOffCount = 0

  for (const transaction of transactions) {
    if (
      typeof transaction.id !== "string" ||
      !transaction.id.trim() ||
      seenIds.has(transaction.id)
    ) {
      issues.push(
        "Finished-stock transactions contain a missing or duplicate ID.",
      )

      continue
    }

    seenIds.add(transaction.id)

    if (!validTimestamp(transaction.occurredAt)) {
      issues.push(
        `Finished-stock transaction ${transaction.id} has an invalid timestamp.`,
      )

      continue
    }

    if (!timestampInPeriod(transaction.occurredAt, bounds)) continue

    if (
      typeof transaction.totalCost !== "number" ||
      !Number.isFinite(transaction.totalCost) ||
      transaction.totalCost < 0
    ) {
      issues.push(
        `Finished-stock transaction ${transaction.id} has an invalid cost.`,
      )
      if (transaction.type === "sale") sold = null
      else if (transaction.type === "write-off") writeOff = null
      continue
    }

    if (transaction.type === "sale") {
      sold = addFiniteCost(
        sold,
        transaction.totalCost,
        issues,
        "Cost of stock sold",
      )

      soldCount += 1
    } else if (transaction.type === "write-off") {
      writeOff = addFiniteCost(
        writeOff,

        transaction.totalCost,

        issues,

        "Finished-stock write-off cost",
      )

      writeOffCount += 1
    }
  }

  return {
    costOfStockSold: sold,

    writeOffCost: writeOff,

    soldTransactionCount: soldCount,

    writeOffTransactionCount: writeOffCount,

    ...reportStatus(issues),
  }
}

function selectAllocationView(
  expenses: Expense[],

  histories: ExpenseAllocationHistory[],

  orders: Order[],

  asOf?: string,
): ExpenseAllocationView {
  const issues: string[] = []

  const entries: ExpenseAllocationViewEntry[] = []

  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]))

  const historiesByExpenseId = new Map<string, ExpenseAllocationHistory[]>()

  for (const history of histories) {
    const matching = historiesByExpenseId.get(history.expenseId) ?? []

    matching.push(history)

    historiesByExpenseId.set(history.expenseId, matching)

    const expense = expenseById.get(history.expenseId)

    if (!expense || expense.attribution.type !== "shared")
      issues.push(
        `Allocation history ${history.expenseId} has no shared source expense.`,
      )
  }

  for (const expense of expenses) {
    if (expense.attribution.type !== "shared") continue

    const amountValid = isValidMoneyAmount(expense.amount)

    if (!amountValid)
      issues.push(
        `Shared expense ${expense.id} has an invalid whole-LKR amount.`,
      )

    const matchingHistories = historiesByExpenseId.get(expense.id) ?? []

    if (matchingHistories.length > 1) {
      issues.push(
        `Shared expense ${expense.id} has duplicate allocation histories.`,
      )

      entries.push({
        expenseId: expense.id,

        expenseAmountLkr: amountValid ? expense.amount : null,

        version: null,

        allocatedAmountLkr: null,

        unallocatedBalanceLkr: null,
      })

      continue
    }

    const history = matchingHistories[0]

    const versions = history ? [...history.versions] : []

    const selection =
      asOf === undefined
        ? selectLatestAllocationVersion(expense, versions, orders)
        : selectAllocationVersionAsKnownAt(expense, versions, orders, asOf)

    if (!selection.valid) {
      issues.push(...selection.issues)

      entries.push({
        expenseId: expense.id,

        expenseAmountLkr: amountValid ? expense.amount : null,

        version: null,

        allocatedAmountLkr: null,

        unallocatedBalanceLkr: null,
      })

      continue
    }

    const version = selection.version

    const allocated = version ? totalAllocationAmount(version) : 0

    const unallocated = amountValid
      ? unallocatedExpenseBalance(expense, version)
      : Number.NaN

    if (
      !Number.isSafeInteger(allocated) ||
      !Number.isSafeInteger(unallocated)
    ) {
      issues.push(
        `Shared expense ${expense.id} has an invalid allocation total.`,
      )
    }

    entries.push({
      expenseId: expense.id,

      expenseAmountLkr: amountValid ? expense.amount : null,

      version,

      allocatedAmountLkr: Number.isSafeInteger(allocated) ? allocated : null,

      unallocatedBalanceLkr: Number.isSafeInteger(unallocated)
        ? unallocated
        : null,
    })
  }

  return { entries, ...reportStatus(issues) }
}

export function selectLatestExpenseAllocations(
  expenses: Expense[],

  histories: ExpenseAllocationHistory[],

  orders: Order[],
): ExpenseAllocationView {
  return selectAllocationView(expenses, histories, orders)
}

export function selectExpenseAllocationsAsKnownAt(
  expenses: Expense[],

  histories: ExpenseAllocationHistory[],

  orders: Order[],

  asOf: string,
): ExpenseAllocationView {
  return selectAllocationView(expenses, histories, orders, asOf)
}

function isEligibleAllocationOrder(order: Order | undefined): order is Order {
  return Boolean(
    order &&
      !order.isQuickOrder &&
      order.customerId &&
      order.status !== "Cancelled",
  )
}

export function selectOrderExpenseAttribution(
  expenses: Expense[],
  histories: ExpenseAllocationHistory[],
  categories: ExpenseCategory[],
  orders: Order[],
  period: DatePeriod,
  basis: ExpenseAllocationBasis,
): OrderExpenseAttributionReport {
  const selection = selectValidExpensesForPeriod(
    expenses,
    categories,
    orders,
    period,
  )
  if (!selection) {
    return {
      sourceExpenseTotalLkr: null,
      directExpenseTotalLkr: null,
      sharedAllocatedTotalLkr: null,
      unallocatedSharedExpenseTotalLkr: null,
      orders: [],
      ...reportStatus(invalidPeriodIssue()),
    }
  }

  const issues = [...selection.issues]
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]))
  const historyByExpenseId = new Map<string, ExpenseAllocationHistory[]>()
  const entriesByOrderId = new Map<string, OrderExpenseAttribution>()

  let sourceExpenseTotalLkr: number | null = 0
  let directExpenseTotalLkr: number | null = 0
  let sharedAllocatedTotalLkr: number | null = 0
  let unallocatedSharedExpenseTotalLkr: number | null = 0

  for (const history of histories) {
    const matching = historyByExpenseId.get(history.expenseId) ?? []
    matching.push(history)
    historyByExpenseId.set(history.expenseId, matching)

    const sourceExpense = expenseById.get(history.expenseId)
    if (!sourceExpense || sourceExpense.attribution.type !== "shared")
      issues.push(
        `Allocation history ${history.expenseId} has no shared source expense.`,
      )
  }

  for (const expense of selection.expenses) {
    sourceExpenseTotalLkr = addWholeLkr(
      sourceExpenseTotalLkr,
      expense.amount,
      issues,
      "Source expense total",
    )

    if (expense.attribution.type === "direct") {
      const directOrderId = expense.attribution.orderId
      directExpenseTotalLkr = addWholeLkr(
        directExpenseTotalLkr,
        expense.amount,
        issues,
        "Direct expense total",
      )
      const order = orders.find((item) => item.id === directOrderId)
      if (!order) {
        issues.push(`Direct expense ${expense.id} refers to a missing order.`)
        continue
      }
      const entry = entriesByOrderId.get(order.id) ?? {
        orderId: order.id,
        orderReference: order.reference,
        customerName: order.customerName,
        directExpenseLkr: 0,
        sharedAllocatedLkr: 0,
        totalAttributedLkr: 0,
      }
      entry.directExpenseLkr = addWholeLkr(
        entry.directExpenseLkr,
        expense.amount,
        issues,
        `Direct expenses for order ${order.reference}`,
      )
      entry.totalAttributedLkr = addWholeLkr(
        entry.totalAttributedLkr,
        expense.amount,
        issues,
        `Attributed expenses for order ${order.reference}`,
      )
      entriesByOrderId.set(order.id, entry)
      continue
    }

    const matchingHistories = historyByExpenseId.get(expense.id) ?? []
    if (matchingHistories.length > 1) {
      issues.push(
        `Shared expense ${expense.id} has duplicate allocation histories.`,
      )
      sharedAllocatedTotalLkr = null
      unallocatedSharedExpenseTotalLkr = null
      continue
    }

    const versions = matchingHistories[0]
      ? [...matchingHistories[0].versions]
      : []
    const allocationSelection =
      basis.type === "latest"
        ? selectLatestAllocationVersion(expense, versions, orders)
        : selectAllocationVersionAsKnownAt(
            expense,
            versions,
            orders,
            basis.timestamp,
          )
    if (!allocationSelection.valid) {
      issues.push(...allocationSelection.issues)
      sharedAllocatedTotalLkr = null
      unallocatedSharedExpenseTotalLkr = null
      continue
    }

    const version = allocationSelection.version
    const allocatedTotal = version ? totalAllocationAmount(version) : 0
    const unallocated = unallocatedExpenseBalance(expense, version)
    if (
      !Number.isSafeInteger(allocatedTotal) ||
      !Number.isSafeInteger(unallocated)
    ) {
      issues.push(
        `Shared expense ${expense.id} has an invalid allocation total.`,
      )
      sharedAllocatedTotalLkr = null
      unallocatedSharedExpenseTotalLkr = null
      continue
    }

    let versionEligible = true
    for (const allocation of version?.allocations ?? []) {
      const order = orders.find((item) => item.id === allocation.orderId)
      if (!isEligibleAllocationOrder(order)) {
        issues.push(
          `Allocation for shared expense ${expense.id} targets a missing, cancelled, or ineligible customer order.`,
        )
        versionEligible = false
      }
    }
    if (!versionEligible) {
      sharedAllocatedTotalLkr = null
      unallocatedSharedExpenseTotalLkr = null
      continue
    }

    sharedAllocatedTotalLkr = addWholeLkr(
      sharedAllocatedTotalLkr,
      allocatedTotal,
      issues,
      "Shared allocated total",
    )
    unallocatedSharedExpenseTotalLkr = addWholeLkr(
      unallocatedSharedExpenseTotalLkr,
      unallocated,
      issues,
      "Unallocated shared expense total",
    )

    for (const allocation of version?.allocations ?? []) {
      const order = orders.find((item) => item.id === allocation.orderId)
      if (!order) continue
      const entry = entriesByOrderId.get(order.id) ?? {
        orderId: order.id,
        orderReference: order.reference,
        customerName: order.customerName,
        directExpenseLkr: 0,
        sharedAllocatedLkr: 0,
        totalAttributedLkr: 0,
      }
      entry.sharedAllocatedLkr = addWholeLkr(
        entry.sharedAllocatedLkr,
        allocation.amount,
        issues,
        `Shared allocations for order ${order.reference}`,
      )
      entry.totalAttributedLkr = addWholeLkr(
        entry.totalAttributedLkr,
        allocation.amount,
        issues,
        `Attributed expenses for order ${order.reference}`,
      )
      entriesByOrderId.set(order.id, entry)
    }
  }

  return {
    sourceExpenseTotalLkr,
    directExpenseTotalLkr,
    sharedAllocatedTotalLkr,
    unallocatedSharedExpenseTotalLkr,
    orders: [...entriesByOrderId.values()].sort((left, right) =>
      left.orderReference.localeCompare(right.orderReference),
    ),
    ...reportStatus(issues),
  }
}
