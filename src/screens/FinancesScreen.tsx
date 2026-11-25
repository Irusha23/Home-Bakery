import { useEffect, useMemo, useState } from "react"
import {
  ChevronRight,
  Plus,
  ReceiptText,
  Save,
  Split,
  WalletCards,
} from "lucide-react"
import ShoppingReceiptSheet from "../components/domain/ShoppingReceiptSheet"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Disclosure from "../components/ui/Disclosure"
import Field from "../components/ui/Field"
import Illustration from "../components/ui/Illustration"
import SelectField from "../components/ui/SelectField"
import Sheet from "../components/ui/Sheet"
import StatusBadge from "../components/ui/StatusBadge"
import TextAreaField from "../components/ui/TextAreaField"
import { useToast } from "../components/ui/Toast"
import {
  selectLatestAllocationVersion,
  totalAllocationAmount,
  unallocatedExpenseBalance,
  validateAllocationVersion,
  validateExpense,
} from "../lib/expenses"
import { formatDate, formatLkr, getColomboTodayIso } from "../lib/format"
import { createId } from "../lib/id"
import { useAppState } from "../state/AppState"
import type {
  Expense,
  ExpenseAllocationVersion,
  ExpenseCategory,
  ShoppingTripRecord,
  StarterAction,
} from "../types"

type FinancesScreenProps = {
  starterAction?: StarterAction | null
  embedded?: boolean
}

type AllocationDraftRow = {
  orderId: string
  amount: string
}

function today() {
  return getColomboTodayIso()
}

function newId(prefix: string) {
  return createId(prefix)
}

export default function FinancesScreen({
  starterAction,
  embedded = false,
}: FinancesScreenProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()

  const customerOrders = useMemo(
    () =>
      state.orders
        .filter(
          (order) =>
            !order.isQuickOrder &&
            order.customerId !== null &&
            order.status !== "Cancelled",
        )
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [state.orders],
  )

  const [addSheetOpen, setAddSheetOpen] = useState(
    starterAction === "add-expense",
  )
  const [amount, setAmount] = useState("")
  const [paidDate, setPaidDate] = useState(today)
  const [categoryId, setCategoryId] = useState(
    state.expenseCategories[0]?.id ?? "",
  )
  const [description, setDescription] = useState("")
  const [attribution, setAttribution] = useState<"direct" | "shared">("shared")
  const [directOrderId, setDirectOrderId] = useState("")
  const [expenseError, setExpenseError] = useState("")

  const [categoryName, setCategoryName] = useState("")
  const [categoryError, setCategoryError] = useState("")

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [allocationRows, setAllocationRows] = useState<AllocationDraftRow[]>([])
  const [allocationError, setAllocationError] = useState("")
  const [selectedTrip, setSelectedTrip] = useState<ShoppingTripRecord | null>(
    null,
  )

  useEffect(() => {
    if (starterAction === "add-expense") {
      setAddSheetOpen(true)
    }
  }, [starterAction])

  const submitExpense = () => {
    const parsedAmount = Number(amount)
    if (
      !amount.trim() ||
      !Number.isSafeInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setExpenseError("Enter a positive whole-LKR amount.")
      return
    }
    if (!paidDate || !categoryId || !description.trim()) {
      setExpenseError("Fill in date, category, and description.")
      return
    }
    if (attribution === "direct" && !directOrderId) {
      setExpenseError("Choose the customer order this expense belongs to.")
      return
    }

    const expense: Expense = {
      id: newId("expense"),
      amount: parsedAmount,
      paidDate,
      categoryId,
      description: description.trim(),
      attribution:
        attribution === "direct"
          ? { type: "direct", orderId: directOrderId }
          : { type: "shared" },
      createdAt: new Date().toISOString(),
    }

    const validation = validateExpense(
      expense,
      state.expenseCategories,
      state.orders,
    )
    if (!validation.valid) {
      setExpenseError(validation.issues.join(" "))
      return
    }

    const accepted = dispatchIfAccepted({ type: "RECORD_EXPENSE", expense })
    if (!accepted) {
      setExpenseError("Expense could not be saved. Check the values.")
      return
    }

    setAmount("")
    setPaidDate(today())
    setDescription("")
    setAttribution("shared")
    setDirectOrderId("")
    setExpenseError("")
    setAddSheetOpen(false)
    showToast({ message: "Expense saved", tone: "success" })
  }

  const addCategory = () => {
    const name = categoryName.trim()
    if (!name) {
      setCategoryError("Enter a category name.")
      return
    }
    const category: ExpenseCategory = {
      id: newId("expense-category"),
      name,
      source: "custom",
    }
    if (!dispatchIfAccepted({ type: "ADD_EXPENSE_CATEGORY", category })) {
      setCategoryError("Category already exists or is invalid.")
      return
    }
    setCategoryId(category.id)
    setCategoryName("")
    setCategoryError("")
    showToast({ message: `Added ${category.name}`, tone: "success" })
  }

  const startAllocation = (expense: Expense) => {
    const history = state.expenseAllocationHistories.find(
      (item) => item.expenseId === expense.id,
    )
    const latestResult = history
      ? selectLatestAllocationVersion(
          expense,
          [...history.versions],
          state.orders,
        )
      : null

    if (latestResult && !latestResult.valid) {
      setEditingExpenseId(null)
      setAllocationRows([])
      setAllocationError(latestResult.issues.join(" "))
      return
    }

    const latest = latestResult?.valid ? latestResult.version : null
    setEditingExpenseId(expense.id)
    setAllocationError("")
    setAllocationRows(
      latest && latest.allocations.length > 0
        ? latest.allocations.map((allocation) => ({
            orderId: allocation.orderId,
            amount: String(allocation.amount),
          }))
        : [{ orderId: "", amount: "" }],
    )
  }

  const submitAllocation = (expense: Expense) => {
    const history = state.expenseAllocationHistories.find(
      (item) => item.expenseId === expense.id,
    )
    const previousVersions = history ? [...history.versions] : []
    const parsedRows: { orderId: string; amount: number }[] = []

    for (const row of allocationRows) {
      const parsedAmount = Number(row.amount)
      if (
        !row.orderId ||
        !row.amount.trim() ||
        !Number.isSafeInteger(parsedAmount) ||
        parsedAmount <= 0
      ) {
        setAllocationError("Select an order and enter a whole-LKR amount.")
        return
      }
      parsedRows.push({ orderId: row.orderId, amount: parsedAmount })
    }

    const nextVersionNumber =
      previousVersions.reduce(
        (max, version) => Math.max(max, version.version),
        0,
      ) + 1
    const nextVersion: ExpenseAllocationVersion = {
      id: newId("allocation-version"),
      expenseId: expense.id,
      version: nextVersionNumber,
      createdAt: new Date().toISOString(),
      allocations: parsedRows.map((row) => ({
        id: newId("allocation"),
        orderId: row.orderId,
        amount: row.amount,
      })),
    }

    const validation = validateAllocationVersion(
      expense,
      nextVersion,
      state.orders,
    )
    if (!validation.valid) {
      setAllocationError(validation.issues.join(" "))
      return
    }

    if (
      !dispatchIfAccepted({
        type: "ALLOCATE_SHARED_EXPENSE",
        version: nextVersion,
      })
    ) {
      setAllocationError("Could not save order split. Review the amounts.")
      return
    }

    setEditingExpenseId(null)
    setAllocationRows([])
    setAllocationError("")
    showToast({ message: "Order split saved", tone: "success" })
  }

  const sortedExpenses = useMemo(
    () =>
      state.expenses
        .slice()
        .sort((left, right) => right.paidDate.localeCompare(left.paidDate)),
    [state.expenses],
  )

  const totalSpent = useMemo(
    () => state.expenses.reduce((sum, item) => sum + item.amount, 0),
    [state.expenses],
  )

  return (
    <>
      <div className="space-y-4 pb-6">
        {!embedded ? (
          <ScreenHeader
            title="Expenses"
            icon={<WalletCards aria-hidden="true" size={22} />}
            action={
              <Button
                size="compact"
                leadingIcon={<Plus aria-hidden="true" size={16} />}
                onClick={() => {
                  setExpenseError("")
                  setAddSheetOpen(true)
                }}
              >
                Add
              </Button>
            }
          />
        ) : (
          <Card className="flex items-center justify-between gap-3 py-3.5">
            <div>
              <p className="text-xs font-medium text-muted">
                Recorded expenses ({state.expenses.length})
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-cocoa">
                {formatLkr(totalSpent)}
              </p>
            </div>
            <Button
              size="compact"
              leadingIcon={<Plus aria-hidden="true" size={16} />}
              onClick={() => {
                setExpenseError("")
                setAddSheetOpen(true)
              }}
            >
              Add
            </Button>
          </Card>
        )}

        {sortedExpenses.length === 0 ? (
          <Card className="px-5 py-8 text-center">
            <Illustration name="money-jar" size="md" />
            <p className="mt-2 text-base font-semibold text-cocoa">
              No expenses yet
            </p>
            <p className="mx-auto mt-1 max-w-empty text-xs text-muted">
              Tap Add above to record gas, electricity, packaging, or delivery
              costs.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedExpenses.map((expense) => {
              const category = state.expenseCategories.find(
                (item) => item.id === expense.categoryId,
              )
              const history = state.expenseAllocationHistories.find(
                (item) => item.expenseId === expense.id,
              )
              const latestResult = history
                ? selectLatestAllocationVersion(
                    expense,
                    [...history.versions],
                    state.orders,
                  )
                : null
              const latest = latestResult?.valid ? latestResult.version : null
              const allocated = latest ? totalAllocationAmount(latest) : 0
              const unallocated =
                expense.attribution.type === "shared" &&
                (!latestResult || latestResult.valid)
                  ? unallocatedExpenseBalance(expense, latest)
                  : null
              const directOrder =
                expense.attribution.type === "direct"
                  ? state.orders.find(
                      (o) =>
                        o.id ===
                        (expense.attribution as { orderId: string }).orderId,
                    )
                  : undefined
              const linkedTrip = (state.shoppingTrips ?? []).find(
                (trip) => trip.expenseId === expense.id,
              )
              const isEditing = editingExpenseId === expense.id

              const summaryHeader = (
                <>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-cocoa">
                      {expense.description}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(expense.paidDate)} ·{" "}
                      {category?.name ?? "Other"}
                      {directOrder ? ` · ${directOrder.reference}` : ""}
                      {linkedTrip ? ` · ${linkedTrip.reference}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <div>
                      <div className="text-sm font-bold tabular-nums text-cocoa">
                        {formatLkr(expense.amount)}
                      </div>
                      <StatusBadge
                        tone={
                          expense.attribution.type === "shared"
                            ? "progress"
                            : "neutral"
                        }
                      >
                        {expense.attribution.type === "shared"
                          ? "Shared"
                          : "Direct"}
                      </StatusBadge>
                    </div>
                    {linkedTrip ? (
                      <ChevronRight
                        aria-hidden="true"
                        size={16}
                        className="text-muted"
                      />
                    ) : null}
                  </div>
                </>
              )

              return (
                <Card key={expense.id} className="space-y-3">
                  {linkedTrip ? (
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 text-left transition-opacity hover:opacity-80"
                      onClick={() => setSelectedTrip(linkedTrip)}
                    >
                      {summaryHeader}
                    </button>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      {summaryHeader}
                    </div>
                  )}

                  {expense.attribution.type === "shared" &&
                  allocated > 0 &&
                  !isEditing ? (
                    <div className="flex items-center justify-between rounded-control bg-ivory px-3 py-2 text-xs">
                      <span className="text-muted">
                        Split across {latest?.allocations.length ?? 0} order(s)
                      </span>
                      <span className="font-semibold text-cocoa">
                        {unallocated === 0
                          ? "Fully split"
                          : `${formatLkr(unallocated ?? 0)} left`}
                      </span>
                    </div>
                  ) : null}

                  {isEditing ? (
                    <div className="space-y-3 border-t border-warm-border pt-3">
                      <div className="text-xs font-semibold text-cocoa">
                        Split across orders
                      </div>
                      {allocationRows.map((row, index) => (
                        <div key={index} className="grid grid-cols-2 gap-2">
                          <SelectField
                            label={`Order ${index + 1}`}
                            value={row.orderId}
                            onChange={(event) =>
                              setAllocationRows((current) =>
                                current.map((item, rowIndex) =>
                                  rowIndex === index
                                    ? { ...item, orderId: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            options={[
                              { value: "", label: "Order..." },
                              ...customerOrders.map((order) => ({
                                value: order.id,
                                label: `${order.reference} · ${order.customerName}`,
                              })),
                            ]}
                          />
                          <Field
                            label="Amount (LKR)"
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={row.amount}
                            onChange={(event) =>
                              setAllocationRows((current) =>
                                current.map((item, rowIndex) =>
                                  rowIndex === index
                                    ? { ...item, amount: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                      ))}

                      {allocationError ? (
                        <p
                          role="alert"
                          className="rounded-control bg-warning-soft p-2.5 text-xs text-cocoa"
                        >
                          {allocationError}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="compact"
                          variant="soft"
                          leadingIcon={<Plus aria-hidden="true" size={14} />}
                          onClick={() =>
                            setAllocationRows((current) => [
                              ...current,
                              { orderId: "", amount: "" },
                            ])
                          }
                        >
                          Order
                        </Button>
                        {allocationRows.length > 1 ? (
                          <Button
                            size="compact"
                            variant="ghost"
                            onClick={() =>
                              setAllocationRows((current) =>
                                current.slice(0, -1),
                              )
                            }
                          >
                            Remove last
                          </Button>
                        ) : null}
                      </div>

                      <div className="flex gap-2 border-t border-warm-border pt-2.5">
                        <Button
                          className="flex-1"
                          size="compact"
                          variant="secondary"
                          onClick={() => {
                            setEditingExpenseId(null)
                            setAllocationError("")
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1"
                          size="compact"
                          leadingIcon={<Save aria-hidden="true" size={14} />}
                          onClick={() => submitAllocation(expense)}
                        >
                          Save split
                        </Button>
                      </div>
                    </div>
                  ) : expense.attribution.type === "shared" &&
                    customerOrders.length > 0 &&
                    !linkedTrip ? (
                    <Button
                      variant="soft"
                      size="compact"
                      fullWidth
                      leadingIcon={<Split aria-hidden="true" size={14} />}
                      onClick={() => startAllocation(expense)}
                    >
                      {history ? "Edit split" : "Split across orders"}
                    </Button>
                  ) : null}
                </Card>
              )
            })}
          </div>
        )}

        <Disclosure
          title={`Categories (${state.expenseCategories.length})`}
          contentClassName="space-y-3 border-t border-warm-border p-4"
        >
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Field
                label="New category"
                hideLabel
                placeholder="e.g., Delivery"
                value={categoryName}
                onChange={(event) => {
                  setCategoryName(event.target.value)
                  setCategoryError("")
                }}
              />
            </div>
            <Button
              size="compact"
              leadingIcon={<Plus aria-hidden="true" size={15} />}
              onClick={addCategory}
            >
              Add
            </Button>
          </div>
          {categoryError ? (
            <p role="alert" className="text-xs text-error">
              {categoryError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {state.expenseCategories.map((category) => (
              <span
                key={category.id}
                className="rounded-full bg-sage-soft px-2.5 py-1 text-xs font-medium text-cocoa"
              >
                {category.name}
              </span>
            ))}
          </div>
        </Disclosure>
      </div>

      <Sheet
        open={addSheetOpen}
        title="Add expense"
        subtitle="Record a paid bakery expense"
        onClose={() => setAddSheetOpen(false)}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setAddSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              leadingIcon={<Save aria-hidden="true" size={16} />}
              onClick={submitExpense}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {expenseError ? (
            <p
              role="alert"
              className="rounded-control bg-warning-soft p-3 text-xs text-cocoa"
            >
              {expenseError}
            </p>
          ) : null}
          <Field
            label="Amount (LKR)"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value)
              setExpenseError("")
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Date"
              type="date"
              value={paidDate}
              onChange={(event) => setPaidDate(event.target.value)}
            />
            <SelectField
              label="Category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              options={[
                { value: "", label: "Category..." },
                ...state.expenseCategories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            />
          </div>
          <TextAreaField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What was paid for?"
            rows={2}
          />
          <SelectField
            label="Type"
            value={attribution}
            onChange={(event) =>
              setAttribution(event.target.value as "direct" | "shared")
            }
            options={[
              { value: "shared", label: "Shared bakery expense" },
              { value: "direct", label: "For one customer order" },
            ]}
          />
          {attribution === "direct" ? (
            <SelectField
              label="Customer order"
              value={directOrderId}
              onChange={(event) => setDirectOrderId(event.target.value)}
              options={[
                { value: "", label: "Choose an order..." },
                ...customerOrders.map((order) => ({
                  value: order.id,
                  label: `${order.reference} · ${order.customerName}`,
                })),
              ]}
            />
          ) : null}
        </div>
      </Sheet>

      <ShoppingReceiptSheet
        trip={selectedTrip}
        onClose={() => setSelectedTrip(null)}
      />
    </>
  )
}
