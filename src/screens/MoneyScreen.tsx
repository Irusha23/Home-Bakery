import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Pencil,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import { GroupedList, ListRow } from "../components/ui/GroupedList"
import ProgressRing from "../components/ui/ProgressRing"
import SegmentedControl from "../components/ui/SegmentedControl"
import Sheet from "../components/ui/Sheet"
import StatusBadge from "../components/ui/StatusBadge"
import { useToast } from "../components/ui/Toast"
import {
  formatMonthHeading,
  getMonthPeriod,
  selectFinishedStockSalesSummary,
  selectMonthlyBudgetReport,
} from "../lib/budget"
import {
  buildExpensesCsv,
  buildOrdersCsv,
  buildPurchasesCsv,
  downloadCsvFile,
} from "../lib/csv"
import {
  selectActualMaterialCostByCompletionDate,
  selectCollectedSales,
  selectCustomerBalances,
  selectCustomerCashMovement,
  selectEstimatedContribution,
  selectExpenseBreakdown,
  selectFinishedStockCosts,
  selectRecordedExpenseValue,
  selectRecordedPurchaseValue,
  type DatePeriod,
} from "../lib/financialReports"
import { outstandingOrderBalance } from "../lib/financials"
import { formatLkr } from "../lib/format"
import { getCurrentWeekPeriod } from "../lib/homeFinancialMetrics"
import { useAppState } from "../state/AppState"
import type { StarterAction } from "../types"
import FinancesScreen from "./FinancesScreen"

type MoneySection = "overview" | "budget" | "expenses"
type PeriodPreset = "week" | "month" | "custom"

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

export default function MoneyScreen({
  starterAction,
  onOpenOrder,
  onViewDueOrders,
}: MoneyScreenProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()
  const [section, setSection] = useState<MoneySection>(
    starterAction === "add-expense" ? "expenses" : "overview",
  )
  const [preset, setPreset] = useState<PeriodPreset>("month")
  const [customStart, setCustomStart] = useState(
    () => getMonthPeriod().startDate,
  )
  const [customEnd, setCustomEnd] = useState(() => getMonthPeriod().endDate)
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false)
  const [dueSheetOpen, setDueSheetOpen] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)

  const [salesTargetDraft, setSalesTargetDraft] = useState("")
  const [profitTargetDraft, setProfitTargetDraft] = useState("")
  const [ingredientLimitDraft, setIngredientLimitDraft] = useState("")
  const [categoryLimitDrafts, setCategoryLimitDrafts] =
    useState<Record<string, string>>({})
  const [budgetError, setBudgetError] = useState("")

  useEffect(() => {
    if (starterAction === "add-expense") {
      setSection("expenses")
    }
  }, [starterAction])

  const period: DatePeriod = useMemo(() => {
    if (preset === "week") return getCurrentWeekPeriod(new Date())
    if (preset === "month") return getMonthPeriod(new Date())
    return {
      startDate: customStart || getMonthPeriod().startDate,
      endDate: customEnd || getMonthPeriod().endDate,
    }
  }, [customEnd, customStart, preset])

  const budgetReport = useMemo(
    () => selectMonthlyBudgetReport(state, new Date()),
    [state],
  )

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
  const contribution = useMemo(
    () => selectEstimatedContribution(state.orders, period),
    [period, state.orders],
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
  const purchaseValue = useMemo(
    () => selectRecordedPurchaseValue(state.purchases, period),
    [period, state.purchases],
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
  const expenseBreakdown = useMemo(
    () =>
      selectExpenseBreakdown(
        state.expenses,
        state.expenseCategories,
        state.orders,
        period,
      ),
    [period, state.expenseCategories, state.expenses, state.orders],
  )
  const materialByCompletion = useMemo(
    () =>
      selectActualMaterialCostByCompletionDate(
        state.preparationRecords,
        period,
      ),
    [period, state.preparationRecords],
  )
  const finishedStockCosts = useMemo(
    () => selectFinishedStockCosts(state.finishedStockTransactions, period),
    [period, state.finishedStockTransactions],
  )

  const totalCollectedSales =
    (salesReport.recognizedRevenueLkr ?? 0) + finishedSales.revenueLkr

  const openBudgetEditor = () => {
    setSalesTargetDraft(
      state.budgetPlan.monthlySalesTarget !== undefined
        ? String(state.budgetPlan.monthlySalesTarget)
        : "",
    )
    setProfitTargetDraft(
      state.budgetPlan.monthlyProfitTarget !== undefined
        ? String(state.budgetPlan.monthlyProfitTarget)
        : "",
    )
    setIngredientLimitDraft(
      state.budgetPlan.ingredientSpendLimit !== undefined
        ? String(state.budgetPlan.ingredientSpendLimit)
        : "",
    )
    const drafts: Record<string, string> = {}
    for (const cat of state.expenseCategories) {
      const val = state.budgetPlan.categoryLimits[cat.id]
      drafts[cat.id] = val !== undefined && val > 0 ? String(val) : ""
    }
    setCategoryLimitDrafts(drafts)
    setBudgetError("")
    setBudgetSheetOpen(true)
  }

  const saveBudgetPlan = () => {
    const parseOptionalWholeLkr = (
      raw: string,
      label: string,
    ):
      | {
          ok: true
          value: number | undefined
        }
      | { ok: false; error: string } => {
      const trimmed = raw.trim()
      if (!trimmed) return { ok: true, value: undefined }
      if (!/^\d+$/.test(trimmed)) {
        return { ok: false, error: `${label} must be a whole LKR number.` }
      }
      const n = Number(trimmed)
      if (!Number.isSafeInteger(n) || n < 0) {
        return { ok: false, error: `${label} must be zero or positive.` }
      }
      return { ok: true, value: n === 0 ? undefined : n }
    }

    const salesParsed = parseOptionalWholeLkr(salesTargetDraft, "Sales target")
    if (!salesParsed.ok) {
      setBudgetError(salesParsed.error)
      return
    }
    const profitParsed = parseOptionalWholeLkr(
      profitTargetDraft,
      "Profit target",
    )
    if (!profitParsed.ok) {
      setBudgetError(profitParsed.error)
      return
    }
    const ingredientParsed = parseOptionalWholeLkr(
      ingredientLimitDraft,
      "Ingredient spend limit",
    )
    if (!ingredientParsed.ok) {
      setBudgetError(ingredientParsed.error)
      return
    }

    const categoryLimits: Record<string, number> = {}
    for (const cat of state.expenseCategories) {
      const parsed = parseOptionalWholeLkr(
        categoryLimitDrafts[cat.id] ?? "",
        `${cat.name} limit`,
      )
      if (!parsed.ok) {
        setBudgetError(parsed.error)
        return
      }
      categoryLimits[cat.id] = parsed.value ?? 0
    }

    const accepted = dispatchIfAccepted({
      type: "UPDATE_BUDGET_PLAN",
      budgetPlan: {
        monthlySalesTarget: salesParsed.value,
        monthlyProfitTarget: profitParsed.value,
        ingredientSpendLimit: ingredientParsed.value,
        categoryLimits,
      },
    })
    if (!accepted) {
      setBudgetError("Could not save budget settings. Review the values.")
      return
    }

    showToast({ message: "Goals updated", tone: "success" })
    setBudgetSheetOpen(false)
  }

  const handleExportCsv = (kind: "orders" | "purchases" | "expenses") => {
    const stamp = budgetReport.monthKey
    if (kind === "orders") {
      downloadCsvFile(`udenis-orders-${stamp}.csv`, buildOrdersCsv(state))
      showToast({ message: "Orders CSV downloaded", tone: "success" })
    } else if (kind === "purchases") {
      downloadCsvFile(`udenis-purchases-${stamp}.csv`, buildPurchasesCsv(state))
      showToast({ message: "Purchases CSV downloaded", tone: "success" })
    } else {
      downloadCsvFile(`udenis-expenses-${stamp}.csv`, buildExpensesCsv(state))
      showToast({ message: "Expenses CSV downloaded", tone: "success" })
    }
  }

  const activeCategoryLimits = budgetReport.categories.filter(
    (cat) => (cat.limit && cat.limit > 0) || cat.spent > 0,
  )
  const hiddenCategoryLimits = budgetReport.categories.filter(
    (cat) => (!cat.limit || cat.limit <= 0) && cat.spent === 0,
  )
  const visibleCategoryLimits = showAllCategories
    ? budgetReport.categories
    : activeCategoryLimits

  return (
    <div className="space-y-4 pb-6">
      <ScreenHeader
        title="Money"
        subtitle={formatMonthHeading(budgetReport.monthKey)}
        action={
          section === "budget" ? (
            <Button
              size="compact"
              variant="secondary"
              leadingIcon={<Pencil aria-hidden="true" size={14} />}
              onClick={openBudgetEditor}
            >
              Edit
            </Button>
          ) : undefined
        }
      />

      <div className="sticky top-0 z-10 -mx-5 border-b border-warm-border/70 bg-ivory/95 px-5 pb-3 pt-1 backdrop-blur-sm">
        <SegmentedControl
          label="Money view"
          value={section}
          onChange={(value) => setSection(value as MoneySection)}
          segments={[
            { value: "overview", label: "Summary" },
            {
              value: "budget",
              label:
                budgetReport.overLimitAlerts.length > 0
                  ? `Goals (${budgetReport.overLimitAlerts.length})`
                  : "Goals",
            },
            { value: "expenses", label: "Expenses" },
          ]}
        />
      </div>

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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Sales earned
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-cocoa">
                  {formatLkr(totalCollectedSales)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {salesReport.collectedOrderCount} completed{" "}
                  {salesReport.collectedOrderCount === 1 ? "order" : "orders"}
                  {contribution.estimatedContributionLkr !== null
                    ? ` · Profit ${formatLkr(contribution.estimatedContributionLkr)}`
                    : ""}
                </p>
              </div>
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft text-cocoa">
                <TrendingUp aria-hidden="true" size={20} />
              </span>
            </div>

            {budgetReport.sales.target ? (
              <div className="border-t border-warm-border/70 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Monthly goal</span>
                  <span className="font-semibold text-cocoa">
                    {budgetReport.sales.progressPct}% of{" "}
                    {formatLkr(budgetReport.sales.target)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sage-soft">
                  <div
                    className="h-full rounded-full bg-sage transition-all duration-300"
                    style={{
                      width: `${Math.min(100, budgetReport.sales.progressPct)}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3.5">
              <p className="text-xs text-muted">Cash received</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-cocoa">
                {formatMoneyOrPlaceholder(
                  cashMovement.netCustomerCashMovementLkr,
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {cashMovement.paymentCount}{" "}
                {cashMovement.paymentCount === 1 ? "payment" : "payments"}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-xs text-muted">Expenses paid</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-cocoa">
                {formatMoneyOrPlaceholder(expenseValue.totalLkr)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {expenseValue.recordCount}{" "}
                {expenseValue.recordCount === 1 ? "entry" : "entries"}
              </p>
            </Card>
          </div>

          {budgetReport.overLimitAlerts.length > 0 ? (
            <Card
              tone="warning"
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  aria-hidden="true"
                  size={18}
                  className="mt-0.5 shrink-0 text-warning"
                />
                <div>
                  <p className="text-sm font-semibold text-cocoa">
                    {budgetReport.overLimitAlerts[0].label} over limit
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Over by {formatLkr(budgetReport.overLimitAlerts[0].overBy)}
                  </p>
                </div>
              </div>
              <Button
                size="compact"
                variant="secondary"
                onClick={() => setSection("budget")}
              >
                View
              </Button>
            </Card>
          ) : null}

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

          <details className="rounded-card border border-warm-border bg-white shadow-subtle">
            <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-cocoa">
              Breakdown & exports
              <ChevronDown aria-hidden="true" size={16} className="text-muted" />
            </summary>
            <div className="divide-y divide-warm-border border-t border-warm-border px-4 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted">Ingredients used in bakes</span>
                <span className="font-semibold tabular-nums text-cocoa">
                  {formatMoneyOrPlaceholder(
                    materialByCompletion.actualMaterialCost,
                  )}
                </span>
              </div>
              {(purchaseValue.totalLkr ?? 0) > 0 ? (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-muted">Legacy stock purchases</span>
                  <span className="font-semibold tabular-nums text-cocoa">
                    {formatMoneyOrPlaceholder(purchaseValue.totalLkr)}
                  </span>
                </div>
              ) : null}
              {(finishedStockCosts.costOfStockSold ?? 0) > 0 ? (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-muted">Finished-stock cost</span>
                  <span className="font-semibold tabular-nums text-cocoa">
                    {formatMoneyOrPlaceholder(
                      finishedStockCosts.costOfStockSold,
                    )}
                  </span>
                </div>
              ) : null}
              {expenseBreakdown.byCategory.map((row) => (
                <div
                  key={row.categoryId}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-muted">{row.categoryName}</span>
                  <span className="font-semibold tabular-nums text-cocoa">
                    {formatMoneyOrPlaceholder(row.totalLkr)}
                  </span>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 py-3">
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
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {section === "budget" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="flex items-center gap-4">
              <ProgressRing
                progress={
                  budgetReport.sales.target && budgetReport.sales.target > 0
                    ? budgetReport.sales.actual / budgetReport.sales.target
                    : 0
                }
                tone={budgetReport.sales.reached ? "success" : "sage"}
                label={
                  budgetReport.sales.target
                    ? `${Math.min(999, budgetReport.sales.progressPct)}%`
                    : "—"
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Sales goal
                </p>
                <p className="mt-1 text-base font-bold tabular-nums text-cocoa">
                  {formatLkr(budgetReport.sales.actual)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {budgetReport.sales.target
                    ? `Goal ${formatLkr(budgetReport.sales.target)}`
                    : "No goal set"}
                </p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <ProgressRing
                progress={
                  budgetReport.profit.target && budgetReport.profit.target > 0
                    ? Math.max(0, budgetReport.profit.actual) /
                      budgetReport.profit.target
                    : 0
                }
                tone={budgetReport.profit.reached ? "success" : "sage"}
                label={
                  budgetReport.profit.target
                    ? `${Math.min(999, Math.max(0, budgetReport.profit.progressPct))}%`
                    : "—"
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Profit goal
                </p>
                <p className="mt-1 text-base font-bold tabular-nums text-cocoa">
                  {formatLkr(budgetReport.profit.actual)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {budgetReport.profit.target
                    ? `Goal ${formatLkr(budgetReport.profit.target)}`
                    : "No goal set"}
                </p>
              </div>
            </Card>
          </div>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Spending limits
              </h2>
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<SlidersHorizontal aria-hidden="true" size={14} />}
                onClick={openBudgetEditor}
              >
                Limits
              </Button>
            </div>

            {(budgetReport.ingredientSpend.limit &&
              budgetReport.ingredientSpend.limit > 0) ||
            budgetReport.ingredientSpend.spent > 0 ? (
              <SpendLimitCard
                title="Ingredients & packaging"
                spent={budgetReport.ingredientSpend.spent}
                limit={budgetReport.ingredientSpend.limit}
                progressPct={budgetReport.ingredientSpend.progressPct}
                status={budgetReport.ingredientSpend.status}
              />
            ) : null}

            {visibleCategoryLimits.length > 0 ? (
              visibleCategoryLimits.map((cat) => (
                <SpendLimitCard
                  key={cat.categoryId}
                  title={cat.categoryName}
                  spent={cat.spent}
                  limit={cat.limit}
                  progressPct={cat.progressPct}
                  status={cat.status}
                />
              ))
            ) : (
              <Card className="py-5 text-center text-xs text-muted">
                No spending limits set yet. Tap Limits above to add one.
              </Card>
            )}

            {hiddenCategoryLimits.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowAllCategories((prev) => !prev)}
                className="w-full py-1.5 text-center text-xs font-semibold text-muted hover:text-cocoa"
              >
                {showAllCategories
                  ? "Hide uncapped categories"
                  : `Show ${hiddenCategoryLimits.length} uncapped categories`}
              </button>
            ) : null}
          </section>
        </div>
      ) : null}

      {section === "expenses" ? (
        <FinancesScreen starterAction={starterAction} embedded />
      ) : null}

      <Sheet
        open={budgetSheetOpen}
        onClose={() => setBudgetSheetOpen(false)}
        title="Monthly goals & limits"
        subtitle="Leave empty for no cap"
        footer={
          <Button
            fullWidth
            leadingIcon={<Wallet aria-hidden="true" size={17} />}
            onClick={saveBudgetPlan}
          >
            Save
          </Button>
        }
      >
        <div className="space-y-4">
          {budgetError ? (
            <div
              className="rounded-control border border-error-border bg-error-soft p-3 text-sm text-cocoa"
              role="alert"
            >
              {budgetError}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Sales goal (LKR)"
              type="number"
              min="0"
              step="100"
              inputMode="numeric"
              value={salesTargetDraft}
              onChange={(event) => {
                setSalesTargetDraft(event.target.value)
                setBudgetError("")
              }}
            />
            <Field
              label="Profit goal (LKR)"
              type="number"
              min="0"
              step="100"
              inputMode="numeric"
              value={profitTargetDraft}
              onChange={(event) => {
                setProfitTargetDraft(event.target.value)
                setBudgetError("")
              }}
            />
          </div>

          <Field
            label="Ingredients & packaging limit (LKR)"
            type="number"
            min="0"
            step="100"
            inputMode="numeric"
            placeholder="No limit"
            value={ingredientLimitDraft}
            onChange={(event) => {
              setIngredientLimitDraft(event.target.value)
              setBudgetError("")
            }}
          />

          <div className="space-y-3 border-t border-warm-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Expense limits
            </p>
            {state.expenseCategories.map((cat) => (
              <Field
                key={cat.id}
                label={`${cat.name} (LKR)`}
                type="number"
                min="0"
                step="100"
                inputMode="numeric"
                placeholder="No limit"
                value={categoryLimitDrafts[cat.id] ?? ""}
                onChange={(event) => {
                  const val = event.target.value
                  setCategoryLimitDrafts((prev) => ({ ...prev, [cat.id]: val }))
                  setBudgetError("")
                }}
              />
            ))}
          </div>
        </div>
      </Sheet>

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
                <p className="truncate text-sm font-semibold text-cocoa">
                  {order.customerName}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
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
    </div>
  )
}

function SpendLimitCard({
  title,
  spent,
  limit,
  progressPct,
  status,
}: {
  title: string
  spent: number
  limit?: number
  progressPct: number
  status: "on-track" | "warning" | "over"
}) {
  const barWidth =
    limit && limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
  return (
    <Card className="space-y-2.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-cocoa">{title}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted">
            {formatLkr(spent)} spent
            {limit && limit > 0 ? ` of ${formatLkr(limit)}` : ""}
          </p>
        </div>
        {limit && limit > 0 ? (
          <StatusBadge
            tone={
              status === "over"
                ? "warning"
                : status === "warning"
                  ? "progress"
                  : "success"
            }
          >
            {status === "over" ? `Over (${progressPct}%)` : `${progressPct}%`}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">No cap</StatusBadge>
        )}
      </div>
      {limit && limit > 0 ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sage-soft">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              status === "over"
                ? "bg-error"
                : status === "warning"
                  ? "bg-warning"
                  : "bg-sage"
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      ) : null}
    </Card>
  )
}
