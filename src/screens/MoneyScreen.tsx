import { useEffect, useMemo, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Download } from "lucide-react"
import ShoppingReceiptSheet from "../components/domain/ShoppingReceiptSheet"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Disclosure from "../components/ui/Disclosure"
import Field from "../components/ui/Field"
import { GroupedList, ListRow } from "../components/ui/GroupedList"
import Illustration from "../components/ui/Illustration"
import { TabView } from "../components/ui/MotionPrimitives"
import SegmentedControl from "../components/ui/SegmentedControl"
import Sheet from "../components/ui/Sheet"
import StatusBadge from "../components/ui/StatusBadge"
import { useToast } from "../components/ui/Toast"
import {
  formatMonthHeading,
  getMonthPeriod,
  selectFinishedStockSalesSummary,
} from "../lib/budget"
import {
  buildExpensesCsv,
  buildOrdersCsv,
  buildPurchasesCsv,
  downloadCsvFile,
} from "../lib/csv"
import {
  selectCollectedSales,
  selectCustomerBalances,
  selectCustomerCashMovement,
  selectRecordedExpenseValue,
  type DatePeriod,
} from "../lib/financialReports"
import {
  outstandingOrderBalance,
  pendingCancellationRefund,
} from "../lib/financials"
import { formatDate, formatLkr } from "../lib/format"
import { getCurrentWeekPeriod } from "../lib/homeFinancialMetrics"
import { calculateOrderProfit } from "../lib/orderProfit"
import { useAppState } from "../state/AppState"
import type { ShoppingTripRecord, StarterAction } from "../types"
import FinancesScreen from "./FinancesScreen"

type MoneySection = "overview" | "orders" | "expenses"
type PeriodPreset = "week" | "month" | "custom"

type MoneyLogEntry = {
  id: string
  date: string
  kind: "income" | "refund" | "expense"
  title: string
  subtitle: string
  amount: number
  orderId?: string
  tripId?: string
}

type MoneyScreenProps = {
  starterAction?: StarterAction | null
  onOpenOrder?: (orderId: string) => void
  onViewDueOrders?: () => void
}

function formatMoneyOrPlaceholder(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Incomplete"
  }
  return formatLkr(value)
}

function inPeriod(date: string, period: DatePeriod): boolean {
  return date >= period.startDate && date <= period.endDate
}

export default function MoneyScreen({
  starterAction,
  onOpenOrder,
  onViewDueOrders,
}: MoneyScreenProps) {
  const { state } = useAppState()
  const { showToast } = useToast()
  const [section, setSection] = useState<MoneySection>(
    starterAction === "add-expense" ? "expenses" : "overview",
  )
  const [preset, setPreset] = useState<PeriodPreset>("month")
  const [customStart, setCustomStart] = useState(
    () => getMonthPeriod().startDate,
  )
  const [customEnd, setCustomEnd] = useState(() => getMonthPeriod().endDate)
  const [dueSheetOpen, setDueSheetOpen] = useState(false)
  const [refundSheetOpen, setRefundSheetOpen] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<ShoppingTripRecord | null>(
    null,
  )
  const [showAllLog, setShowAllLog] = useState(false)

  useEffect(() => {
    if (starterAction === "add-expense") {
      setSection("expenses")
    }
  }, [starterAction])

  const monthPeriod = useMemo(() => getMonthPeriod(new Date()), [])
  const monthKey = monthPeriod.startDate.slice(0, 7)

  const period: DatePeriod = useMemo(() => {
    if (preset === "week") return getCurrentWeekPeriod(new Date())
    if (preset === "month") return monthPeriod
    return {
      startDate: customStart || monthPeriod.startDate,
      endDate: customEnd || monthPeriod.endDate,
    }
  }, [customEnd, customStart, monthPeriod, preset])

  const salesReport = useMemo(
    () => selectCollectedSales(state.orders, period),
    [period, state.orders],
  )
  const finishedSales = useMemo(
    () => selectFinishedStockSalesSummary(state, period),
    [period, state],
  )
  const cashMovement = useMemo(
    () => selectCustomerCashMovement(state.orders, state.refunds, period),
    [period, state.orders, state.refunds],
  )
  const expenseValue = useMemo(
    () =>
      selectRecordedExpenseValue(
        state.expenses,
        state.expenseCategories,
        state.orders,
        period,
      ),
    [period, state.expenseCategories, state.expenses, state.orders],
  )
  const customerBalances = useMemo(
    () => selectCustomerBalances(state.orders, state.refunds),
    [state.orders, state.refunds],
  )

  const dueOrders = useMemo(
    () =>
      state.orders
        .filter(
          (order) => order.status !== "Draft" && order.status !== "Cancelled",
        )
        .map((order) => ({
          order,
          balance: outstandingOrderBalance(order, state.refunds),
        }))
        .filter((item) => item.balance > 0)
        .sort((a, b) => {
          const rank = (o: typeof a.order) =>
            o.status === "Completed"
              ? 0
              : o.paymentStatus === "Part paid"
                ? 1
                : 2
          return rank(a.order) - rank(b.order)
        }),
    [state.orders, state.refunds],
  )

  const cancelledHeldOrders = useMemo(
    () =>
      state.orders
        .filter((order) => order.status === "Cancelled")
        .map((order) => ({
          order,
          retained: pendingCancellationRefund(order, state.refunds),
        }))
        .filter((item) => item.retained > 0),
    [state.orders, state.refunds],
  )
  const totalCancelledHeld = useMemo(
    () => cancelledHeldOrders.reduce((sum, item) => sum + item.retained, 0),
    [cancelledHeldOrders],
  )

  const logEntries = useMemo<MoneyLogEntry[]>(() => {
    const categoryNames = new Map(
      state.expenseCategories.map((cat) => [cat.id, cat.name]),
    )
    const orderById = new Map(state.orders.map((order) => [order.id, order]))
    const tripByExpenseId = new Map(
      (state.shoppingTrips ?? [])
        .filter((trip) => Boolean(trip.expenseId))
        .map((trip) => [trip.expenseId!, trip]),
    )
    const entries: MoneyLogEntry[] = []

    for (const order of state.orders) {
      for (const payment of order.payments) {
        if (!inPeriod(payment.date, period)) continue
        entries.push({
          id: `pay-${payment.id}`,
          date: payment.date,
          kind: "income",
          title: order.customerName,
          subtitle: `${formatDate(payment.date)} · ${payment.method} · ${order.reference}`,
          amount: payment.amount,
          orderId: order.id,
        })
      }
    }

    for (const refund of state.refunds) {
      if (!inPeriod(refund.date, period)) continue
      const order = orderById.get(refund.orderId)
      entries.push({
        id: `ref-${refund.id}`,
        date: refund.date,
        kind: "refund",
        title: `Refund · ${order?.customerName ?? "Customer"}`,
        subtitle: `${formatDate(refund.date)} · ${refund.reason}`,
        amount: refund.amount,
        orderId: order?.id,
      })
    }

    for (const expense of state.expenses) {
      if (!inPeriod(expense.paidDate, period)) continue
      const category = categoryNames.get(expense.categoryId) ?? "Expense"
      const linkedTrip = tripByExpenseId.get(expense.id)
      entries.push({
        id: `exp-${expense.id}`,
        date: expense.paidDate,
        kind: "expense",
        title: expense.description,
        subtitle: linkedTrip
          ? `${formatDate(expense.paidDate)} · ${linkedTrip.reference}`
          : `${formatDate(expense.paidDate)} · ${category}`,
        amount: expense.amount,
        tripId: linkedTrip?.id,
      })
    }

    return entries.sort((a, b) => b.date.localeCompare(a.date))
  }, [
    period,
    state.expenseCategories,
    state.expenses,
    state.orders,
    state.refunds,
    state.shoppingTrips,
  ])

  const visibleLog = showAllLog ? logEntries : logEntries.slice(0, 10)
  const totalCollectedSales =
    (salesReport.recognizedRevenueLkr ?? 0) + finishedSales.revenueLkr
  const netCash =
    cashMovement.netCustomerCashMovementLkr !== null &&
    expenseValue.totalLkr !== null
      ? cashMovement.netCustomerCashMovementLkr - expenseValue.totalLkr
      : null

  const orderProfits = useMemo(
    () =>
      state.orders
        .filter(
          (order) =>
            order.status !== "Draft" &&
            order.status !== "Cancelled" &&
            inPeriod(order.collectionDate, period),
        )
        .map((order) => ({
          order,
          profit: calculateOrderProfit(order, state),
        }))
        .sort((a, b) =>
          b.order.collectionDate.localeCompare(a.order.collectionDate),
        ),
    [period, state],
  )
  const totalOrderProfit = useMemo(
    () => orderProfits.reduce((sum, item) => sum + item.profit.profitLkr, 0),
    [orderProfits],
  )
  const totalOrderIncome = useMemo(
    () => orderProfits.reduce((sum, item) => sum + item.profit.incomeLkr, 0),
    [orderProfits],
  )
  const totalOrderCost = useMemo(
    () => orderProfits.reduce((sum, item) => sum + item.profit.totalCostLkr, 0),
    [orderProfits],
  )

  const handleExportCsv = (kind: "orders" | "purchases" | "expenses") => {
    if (kind === "orders") {
      downloadCsvFile(`udenis-orders-${monthKey}.csv`, buildOrdersCsv(state))
      showToast({ message: "Orders CSV downloaded", tone: "success" })
    } else if (kind === "purchases") {
      downloadCsvFile(
        `udenis-purchases-${monthKey}.csv`,
        buildPurchasesCsv(state),
      )
      showToast({ message: "Purchases CSV downloaded", tone: "success" })
    } else {
      downloadCsvFile(
        `udenis-expenses-${monthKey}.csv`,
        buildExpensesCsv(state),
      )
      showToast({ message: "Expenses CSV downloaded", tone: "success" })
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <ScreenHeader title="Money" subtitle={formatMonthHeading(monthKey)} />

      <div className="sticky top-0 z-10 -mx-5 border-b border-warm-border/70 bg-ivory/95 px-5 pb-3 pt-1 backdrop-blur-sm">
        <SegmentedControl
          label="Money view"
          value={section}
          onChange={(value) => setSection(value as MoneySection)}
          segments={[
            { value: "overview", label: "Log" },
            { value: "orders", label: "Orders" },
            { value: "expenses", label: "Expenses" },
          ]}
        />
      </div>

      <TabView viewKey={section}>
        {section === "overview" ? (
        <div className="space-y-4">
          <SegmentedControl
            label="Period"
            value={preset}
            onChange={(value) => setPreset(value as PeriodPreset)}
            segments={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "custom", label: "Custom" },
            ]}
          />

          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="From"
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
              />
              <Field
                label="To"
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </div>
          ) : null}

          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                  <ArrowDownLeft
                    aria-hidden="true"
                    size={13}
                    className="text-success"
                  />
                  Income
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-success">
                  {formatMoneyOrPlaceholder(
                    cashMovement.netCustomerCashMovementLkr,
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {cashMovement.paymentCount}{" "}
                  {cashMovement.paymentCount === 1 ? "payment" : "payments"}
                </p>
              </div>
              <div className="border-l border-warm-border pl-3">
                <p className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                  <ArrowUpRight
                    aria-hidden="true"
                    size={13}
                    className="text-warning"
                  />
                  Expenses
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-cocoa">
                  {formatMoneyOrPlaceholder(expenseValue.totalLkr)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {expenseValue.recordCount}{" "}
                  {expenseValue.recordCount === 1 ? "entry" : "entries"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-warm-border/75 pt-2.5 text-xs">
              <span className="text-muted">
                Net cash ·{" "}
                <strong
                  className={`tabular-nums ${
                    netCash !== null && netCash < 0
                      ? "text-warning"
                      : "text-cocoa"
                  }`}
                >
                  {formatMoneyOrPlaceholder(netCash)}
                </strong>
              </span>
              <span className="tabular-nums text-muted">
                Sales {formatLkr(totalCollectedSales)}
              </span>
            </div>
          </Card>

          <GroupedList title="Balances">
            <ListRow
              title="Unpaid customer orders"
              subtitle={
                dueOrders.length > 0
                  ? `${dueOrders.length} ${
                      dueOrders.length === 1 ? "order" : "orders"
                    } · Tap to view`
                  : "All settled"
              }
              showChevron={dueOrders.length > 0}
              onClick={
                dueOrders.length > 0 ? () => setDueSheetOpen(true) : undefined
              }
              trailing={
                <span className="font-semibold tabular-nums text-warning">
                  {formatMoneyOrPlaceholder(customerBalances.outstandingLkr)}
                </span>
              }
            />
            {cancelledHeldOrders.length > 0 ? (
              <ListRow
                title="Cancelled cash held"
                subtitle={`${cancelledHeldOrders.length} ${
                  cancelledHeldOrders.length === 1 ? "order" : "orders"
                } · Tap to refund`}
                showChevron
                onClick={() => setRefundSheetOpen(true)}
                trailing={
                  <span className="font-semibold tabular-nums text-warning">
                    {formatLkr(totalCancelledHeld)}
                  </span>
                }
              />
            ) : null}
            {(customerBalances.customerCreditLkr ?? 0) > 0 ? (
              <ListRow
                title="Customer credits"
                trailing={
                  <span className="font-semibold tabular-nums text-cocoa">
                    {formatMoneyOrPlaceholder(customerBalances.customerCreditLkr)}
                  </span>
                }
              />
            ) : null}
          </GroupedList>

          {logEntries.length > 0 ? (
            <div className="space-y-2">
              <GroupedList
                title={`Activity (${logEntries.length})`}
                action={
                  <button
                    type="button"
                    onClick={() => setSection("expenses")}
                    className="text-xs font-semibold text-cocoa hover:underline"
                  >
                    + Add expense
                  </button>
                }
              >
                {visibleLog.map((entry) => (
                  <ListRow
                    key={entry.id}
                    title={entry.title}
                    subtitle={entry.subtitle}
                    showChevron={Boolean(
                      entry.tripId || (entry.orderId && onOpenOrder),
                    )}
                    onClick={
                      entry.tripId
                        ? () => {
                            const trip =
                              (state.shoppingTrips ?? []).find(
                                (item) => item.id === entry.tripId,
                              ) ?? null
                            setSelectedTrip(trip)
                          }
                        : entry.orderId && onOpenOrder
                          ? () => onOpenOrder(entry.orderId!)
                          : undefined
                    }
                    trailing={
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          entry.kind === "income"
                            ? "text-success"
                            : entry.kind === "refund"
                              ? "text-warning"
                              : "text-error"
                        }`}
                      >
                        {entry.kind === "income" ? "+" : "−"}
                        {formatLkr(entry.amount)}
                      </span>
                    }
                  />
                ))}
              </GroupedList>
              {logEntries.length > 10 ? (
                <button
                  type="button"
                  onClick={() => setShowAllLog((prev) => !prev)}
                  className="w-full py-1.5 text-center text-xs font-semibold text-muted hover:text-cocoa"
                >
                  {showAllLog
                    ? "Show less"
                    : `Show all ${logEntries.length} entries`}
                </button>
              ) : null}
            </div>
          ) : (
            <Card className="px-5 py-7 text-center">
              <Illustration name="money-jar" size="sm" />
              <p className="mt-2 text-xs text-muted">
                No payments or expenses logged in this period.
              </p>
            </Card>
          )}

          <Disclosure
            title="Export CSV"
            contentClassName="flex flex-wrap gap-2 border-t border-warm-border px-4 py-3"
          >
            <Button
              size="compact"
              variant="secondary"
              leadingIcon={<Download aria-hidden="true" size={14} />}
              onClick={() => handleExportCsv("orders")}
            >
              Orders CSV
            </Button>
            <Button
              size="compact"
              variant="secondary"
              leadingIcon={<Download aria-hidden="true" size={14} />}
              onClick={() => handleExportCsv("expenses")}
            >
              Expenses CSV
            </Button>
            {state.purchases.length > 0 ? (
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<Download aria-hidden="true" size={14} />}
                onClick={() => handleExportCsv("purchases")}
              >
                Purchases CSV
              </Button>
            ) : null}
          </Disclosure>
        </div>
      ) : section === "orders" ? (
        <div className="space-y-4">
          <SegmentedControl
            label="Period"
            value={preset}
            onChange={(value) => setPreset(value as PeriodPreset)}
            segments={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "custom", label: "Custom" },
            ]}
          />

          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="From"
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
              />
              <Field
                label="To"
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </div>
          ) : null}

          <Card className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-muted">
                Order profit ({orderProfits.length})
              </span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  totalOrderProfit >= 0 ? "text-success" : "text-error"
                }`}
              >
                {totalOrderProfit >= 0 ? "+" : "−"}
                {formatLkr(Math.abs(totalOrderProfit))}
              </span>
            </div>
            <p className="text-xs tabular-nums text-muted">
              Income {formatLkr(totalOrderIncome)} · Cost{" "}
              {formatLkr(totalOrderCost)}
            </p>
          </Card>

          {orderProfits.length > 0 ? (
            <GroupedList>
              {orderProfits.map(({ order, profit }) => (
                <ListRow
                  key={order.id}
                  title={`${order.customerName} · ${order.reference}`}
                  subtitle={`Income ${formatLkr(profit.incomeLkr)} · Cost ${formatLkr(profit.totalCostLkr)}${
                    profit.extraExpensesLkr > 0
                      ? ` (+${formatLkr(profit.extraExpensesLkr)} extra)`
                      : ""
                  }`}
                  onClick={
                    onOpenOrder ? () => onOpenOrder(order.id) : undefined
                  }
                  trailing={
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        profit.profitLkr >= 0 ? "text-success" : "text-error"
                      }`}
                    >
                      {profit.profitLkr >= 0 ? "+" : "−"}
                      {formatLkr(Math.abs(profit.profitLkr))}
                    </span>
                  }
                />
              ))}
            </GroupedList>
          ) : (
            <Card className="px-5 py-7 text-center">
              <Illustration name="money-jar" size="sm" />
              <p className="mt-2 text-xs text-muted">
                No orders in this period.
              </p>
            </Card>
          )}
        </div>
      ) : (
        <FinancesScreen starterAction={starterAction} embedded />
      )}
      </TabView>

      <Sheet
        open={dueSheetOpen}
        onClose={() => setDueSheetOpen(false)}
        title="Unpaid & part-paid orders"
        subtitle={`Total ${formatMoneyOrPlaceholder(customerBalances.outstandingLkr)} due`}
        footer={
          onViewDueOrders ? (
            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                setDueSheetOpen(false)
                onViewDueOrders()
              }}
            >
              View all in Orders
            </Button>
          ) : undefined
        }
      >
        <div className="divide-y divide-warm-border rounded-card border border-warm-border bg-white">
          {dueOrders.map(({ order, balance }) => (
            <button
              key={order.id}
              type="button"
              onClick={() => {
                setDueSheetOpen(false)
                onOpenOrder?.(order.id)
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-ivory/70"
            >
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-cocoa">
                  {order.customerName}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted">
                  {order.reference} ·{" "}
                  {order.status === "Completed" ? "Collected" : order.status}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge
                  tone={
                    order.paymentStatus === "Part paid" ? "progress" : "warning"
                  }
                >
                  {order.paymentStatus}
                </StatusBadge>
                <span className="text-sm font-bold tabular-nums text-warning">
                  {formatLkr(balance)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={refundSheetOpen}
        onClose={() => setRefundSheetOpen(false)}
        title="Cancelled orders with cash held"
        subtitle={`Total ${formatLkr(totalCancelledHeld)} refundable`}
      >
        <div className="divide-y divide-warm-border rounded-card border border-warm-border bg-white">
          {cancelledHeldOrders.map(({ order, retained }) => (
            <button
              key={order.id}
              type="button"
              onClick={() => {
                setRefundSheetOpen(false)
                onOpenOrder?.(order.id)
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-ivory/70"
            >
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-cocoa">
                  {order.customerName}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted">
                  {order.reference} · Cancelled
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge
                  tone={
                    order.paymentStatus === "Paid" ? "success" : "progress"
                  }
                >
                  {order.paymentStatus}
                </StatusBadge>
                <span className="text-sm font-bold tabular-nums text-warning">
                  {formatLkr(retained)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </Sheet>

      <ShoppingReceiptSheet
        trip={selectedTrip}
        onClose={() => setSelectedTrip(null)}
      />
    </div>
  )
}
