import { useEffect, useMemo, useState } from "react"
import { ShoppingBag, Trash2 } from "lucide-react"
import Button, { IconButton } from "../ui/Button"
import Card from "../ui/Card"
import CheckboxField from "../ui/CheckboxField"
import Field from "../ui/Field"
import SelectField from "../ui/SelectField"
import Sheet from "../ui/Sheet"
import { useToast } from "../ui/Toast"
import { validateExpense } from "../../lib/expenses"
import { formatLkr, formatQuantity } from "../../lib/format"
import { createId } from "../../lib/id"
import { toBaseQuantity } from "../../lib/inventory"
import { getColomboTodayIso } from "../../lib/selectors/todaySelectors"
import { useAppState } from "../../state/AppState"
import type { BaseUnit, Expense, ShoppingRequirement } from "../../types"

type TripDraftRow = {
  inventoryId: string
  name: string
  baseUnit: BaseUnit
  quantity: string
  price: string
  included: boolean
}

type ShoppingTripSheetProps = {
  open: boolean
  requirements: ShoppingRequirement[]
  checkedIds: ReadonlySet<string>
  onClose: () => void
  onCompleted: (purchasedIds: string[]) => void
}

export default function ShoppingTripSheet({
  open,
  requirements,
  checkedIds,
  onClose,
  onCompleted,
}: ShoppingTripSheetProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()
  const [rows, setRows] = useState<TripDraftRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [date, setDate] = useState(() => getColomboTodayIso())
  const [includeTripExpense, setIncludeTripExpense] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseCategoryId, setExpenseCategoryId] = useState("")
  const [expenseDescription, setExpenseDescription] = useState(
    "Shopping trip transport & delivery",
  )
  const [error, setError] = useState("")

  const defaultCategoryId = useMemo(() => {
    const transport = state.expenseCategories.find(
      (cat) =>
        cat.name.toLowerCase().includes("transport") ||
        cat.name.toLowerCase().includes("delivery"),
    )
    return transport?.id ?? state.expenseCategories[0]?.id ?? ""
  }, [state.expenseCategories])

  useEffect(() => {
    if (!open) return
    setError("")
    setDate(getColomboTodayIso())
    setIncludeTripExpense(false)
    setExpenseAmount("")
    setExpenseCategoryId(defaultCategoryId)
    setExpenseDescription("Shopping trip transport & delivery")

    const validReqs = requirements.filter(
      (item) => item.unitErrors.length === 0,
    )
    const targetReqs =
      checkedIds.size > 0
        ? validReqs.filter((item) => checkedIds.has(item.inventoryId))
        : validReqs.filter(
            (item) => item.shortage > 0 || item.selectedPurchase > 0,
          )

    setRows(
      targetReqs.map((item) => {
        const defaultQty =
          item.selectedPurchase > 0
            ? item.selectedPurchase
            : item.shortage > 0
              ? item.shortage
              : item.suggestedPurchase
        return {
          inventoryId: item.inventoryId,
          name: item.name,
          baseUnit: item.unit,
          quantity: defaultQty > 0 ? String(defaultQty) : "",
          price: "",
          included: true,
        }
      }),
    )
  }, [checkedIds, defaultCategoryId, open, requirements])

  const activeRows = rows.filter((row) => row.included)
  const itemsTotal = activeRows.reduce((sum, row) => {
    const n = Number(row.price)
    return Number.isSafeInteger(n) && n > 0 ? sum + n : sum
  }, 0)
  const tripExpenseTotal =
    includeTripExpense && /^\d+$/.test(expenseAmount.trim())
      ? Number(expenseAmount.trim())
      : 0

  const handleSaveTrip = () => {
    if (submitting) return
    const toRecord = rows.filter((row) => row.included)
    if (toRecord.length === 0 && !includeTripExpense) {
      setError("Include at least one item or trip expense to record.")
      return
    }
    if (!date) {
      setError("Choose the shopping date.")
      return
    }

    for (const row of toRecord) {
      const qty = Number(row.quantity)
      const price = Number(row.price)
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Enter a positive quantity for ${row.name}.`)
        return
      }
      if (
        !/^\d+$/.test(row.price.trim()) ||
        !Number.isSafeInteger(price) ||
        price <= 0
      ) {
        setError(`Enter a whole-LKR total price for ${row.name}.`)
        return
      }
    }

    let pendingExpense: Expense | null = null
    if (includeTripExpense) {
      if (
        !/^\d+$/.test(expenseAmount.trim()) ||
        Number(expenseAmount.trim()) <= 0
      ) {
        setError("Enter a positive whole-LKR amount for the trip expense.")
        return
      }
      pendingExpense = {
        id: createId("expense"),
        amount: Number(expenseAmount.trim()),
        paidDate: date,
        categoryId: expenseCategoryId,
        description: expenseDescription.trim() || "Shopping trip expense",
        attribution: { type: "shared" },
        createdAt: new Date().toISOString(),
      }
      const validation = validateExpense(
        pendingExpense,
        state.expenseCategories,
        state.orders,
      )
      if (!validation.valid) {
        setError(validation.issues.join(" "))
        return
      }
    }

    setSubmitting(true)
    try {
      const recordedIds: string[] = []
    const nowIso = new Date().toISOString()
    for (const row of toRecord) {
      const qty = Number(row.quantity)
      const price = Number(row.price.trim())
      const usableBaseQuantity = toBaseQuantity(qty, row.baseUnit, row.baseUnit)
      const accepted = dispatchIfAccepted({
        type: "RECORD_PURCHASE",
        purchase: {
          id: createId("purchase"),
          inventoryId: row.inventoryId,
          purchasedQuantity: qty,
          purchasedUnit: row.baseUnit,
          usableQuantity: qty,
          usableUnit: row.baseUnit,
          usableBaseQuantity,
          totalPrice: price,
          date,
          note: "Recorded via Shopping Trip Mode",
          createdAt: nowIso,
        },
      })
      if (accepted) {
        recordedIds.push(row.inventoryId)
      }
    }

    if (recordedIds.length !== toRecord.length) {
      setError(
        recordedIds.length > 0
          ? `Recorded ${recordedIds.length} of ${toRecord.length} purchases. Review the remaining items and retry.`
          : "Purchases could not be recorded. Review quantities and prices.",
      )
      return
    }

    if (pendingExpense) {
      dispatchIfAccepted({ type: "RECORD_EXPENSE", expense: pendingExpense })
    }

    const grandTotal = itemsTotal + tripExpenseTotal
    showToast({
      message: `Shopping trip saved · ${recordedIds.length} item${
        recordedIds.length === 1 ? "" : "s"
      } · ${formatLkr(grandTotal)}`,
      tone: "success",
    })
    onCompleted(recordedIds)
    onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Shopping trip checkout"
      subtitle="Enter what you bought and the total paid on your receipt"
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              Trip total ({activeRows.length} item
              {activeRows.length === 1 ? "" : "s"})
            </span>
            <span className="font-bold tabular-nums text-cocoa">
              {formatLkr(itemsTotal + tripExpenseTotal)}
            </span>
          </div>
          <Button
            fullWidth
            leadingIcon={<ShoppingBag aria-hidden="true" size={17} />}
            onClick={handleSaveTrip}
          >
            Complete shopping trip
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div
            className="rounded-control border border-error-border bg-error-soft p-3 text-sm text-cocoa"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <Field
          label="Shopping date"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value)
            setError("")
          }}
        />

        {rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((row) => {
              const req = requirements.find(
                (entry) => entry.inventoryId === row.inventoryId,
              )
              return (
                <Card key={row.inventoryId} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-cocoa">
                        {row.name}
                      </p>
                      {req && req.shortage > 0 ? (
                        <p className="mt-0.5 text-xs text-warning">
                          Short {formatQuantity(req.shortage, req.unit)}
                        </p>
                      ) : null}
                    </div>
                    <IconButton
                      label={`Remove ${row.name} from trip`}
                      className="size-8 border-warm-border text-muted shadow-none"
                      onClick={() =>
                        setRows((current) =>
                          current.map((candidate) =>
                            candidate.inventoryId === row.inventoryId
                              ? { ...candidate, included: !candidate.included }
                              : candidate,
                          ),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </IconButton>
                  </div>
                  {row.included ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field
                        label={`Quantity (${row.baseUnit})`}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(event) => {
                          const value = event.target.value
                          setRows((current) =>
                            current.map((candidate) =>
                              candidate.inventoryId === row.inventoryId
                                ? { ...candidate, quantity: value }
                                : candidate,
                            ),
                          )
                          setError("")
                        }}
                      />
                      <Field
                        label="Total paid (LKR)"
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder="LKR"
                        value={row.price}
                        onChange={(event) => {
                          const value = event.target.value
                          setRows((current) =>
                            current.map((candidate) =>
                              candidate.inventoryId === row.inventoryId
                                ? { ...candidate, price: value }
                                : candidate,
                            ),
                          )
                          setError("")
                        }}
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      Skipped for this trip · tap icon to re-include
                    </p>
                  )}
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="p-4 text-center text-sm text-muted">
            Check items in your shopping list first, or record a trip expense
            below.
          </Card>
        )}

        <Card className="space-y-3 p-3">
          <CheckboxField
            label="Add shared trip expense (e.g., transport or delivery)"
            checked={includeTripExpense}
            onChange={(checked) => {
              setIncludeTripExpense(checked)
              setError("")
            }}
          />
          {includeTripExpense ? (
            <div className="space-y-3 border-t border-warm-border pt-3">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Amount (LKR)"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={expenseAmount}
                  onChange={(event) => {
                    setExpenseAmount(event.target.value)
                    setError("")
                  }}
                />
                <SelectField
                  label="Category"
                  value={expenseCategoryId}
                  onChange={(event) => {
                    setExpenseCategoryId(event.target.value)
                    setError("")
                  }}
                  options={state.expenseCategories.map((cat) => ({
                    value: cat.id,
                    label: cat.name,
                  }))}
                />
              </div>
              <Field
                label="Description"
                value={expenseDescription}
                onChange={(event) => {
                  setExpenseDescription(event.target.value)
                  setError("")
                }}
              />
            </div>
          ) : null}
        </Card>
      </div>
    </Sheet>
  )
}
