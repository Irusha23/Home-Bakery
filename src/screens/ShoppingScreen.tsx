import { useEffect, useMemo, useState } from "react"
import {
  Check,
  CheckSquare,
  CircleCheck,
  Plus,
  ShoppingBag,
  Square,
  Trash2,
} from "lucide-react"
import InventoryItemSheet from "../components/domain/InventoryItemSheet"
import ShoppingReceiptSheet from "../components/domain/ShoppingReceiptSheet"
import ScreenHeader from "../components/ScreenHeader"
import Button, { IconButton } from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import { GroupedList, ListRow } from "../components/ui/GroupedList"
import Illustration from "../components/ui/Illustration"
import ItemThumbnail from "../components/ui/ItemThumbnail"
import {
  AnimatedItem,
  AnimatedList,
  TabView,
} from "../components/ui/MotionPrimitives"
import SegmentedControl from "../components/ui/SegmentedControl"
import SelectField from "../components/ui/SelectField"
import Sheet from "../components/ui/Sheet"
import StatusBadge from "../components/ui/StatusBadge"
import SwipeableRow from "../components/ui/SwipeableRow"
import { useToast } from "../components/ui/Toast"
import { formatDate, formatLkr, formatQuantity } from "../lib/format"
import { createId } from "../lib/id"
import { isValidMoneyAmount } from "../lib/financials"
import {
  compatibleUnits,
  inventoryCategory,
  selectManualShoppingList,
  toInventoryBaseQuantity,
} from "../lib/inventory"
import { makeShoppingReference, useAppState } from "../state/AppState"
import type {
  ExpenseAttribution,
  ShoppingTripRecord,
  StarterAction,
  Unit,
} from "../types"

type ShoppingCategoryFilter = "all" | "ingredient" | "packaging"

type ShoppingScreenProps = {
  starterAction: StarterAction | null
  onConsumeStarterAction: () => void
}

export default function ShoppingScreen({
  starterAction,
  onConsumeStarterAction,
}: ShoppingScreenProps) {
  const { state, dispatch, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()
  const [category, setCategory] = useState<ShoppingCategoryFilter>("all")
  const [search, setSearch] = useState("")
  const [checkedExtraIds, setCheckedExtraIds] = useState<Set<string>>(
    () => new Set(),
  )

  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [newItemSheetOpen, setNewItemSheetOpen] = useState(false)
  const [finishSheetOpen, setFinishSheetOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"to-buy" | "history">("to-buy")
  const [selectedTrip, setSelectedTrip] = useState<ShoppingTripRecord | null>(
    null,
  )
  const [tripTotalInput, setTripTotalInput] = useState("")
  const [tripError, setTripError] = useState("")
  const [selectedItemId, setSelectedItemId] = useState("")
  const [addQty, setAddQty] = useState("1")
  const [addUnit, setAddUnit] = useState<Unit>("kg")
  const [addError, setAddError] = useState("")

  useEffect(() => {
    if (starterAction === "plan-shopping") {
      onConsumeStarterAction()
    }
  }, [starterAction, onConsumeStarterAction])

  const selectableItems = useMemo(
    () =>
      state.inventory.filter(
        (item) => inventoryCategory(item) !== "finished" && !item.archived,
      ),
    [state.inventory],
  )

  const openAddSheet = () => {
    const first = selectableItems[0]
    setSelectedItemId(first?.inventoryId ?? "")
    if (first) {
      setAddUnit(first.unit === "g" ? "kg" : first.unit === "ml" ? "L" : "unit")
      setAddQty("1")
    } else {
      setAddUnit("unit")
      setAddQty("1")
    }
    setAddError("")
    setAddSheetOpen(true)
  }

  const allItems = useMemo(
    () =>
      selectManualShoppingList(state).map((item) => ({
        ...item,
        checked: item.isManualExtra
          ? checkedExtraIds.has(item.inventoryId)
          : item.checked,
      })),
    [checkedExtraIds, state],
  )
  const checkedCount = allItems.filter((item) => item.checked).length
  const totalEstimatedValue = useMemo(
    () => allItems.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0),
    [allItems],
  )
  const unpricedCount = useMemo(
    () => allItems.filter((item) => item.estimatedCost === null).length,
    [allItems],
  )

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allItems.filter((item) => {
      if (category !== "all" && item.category !== category) return false
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        item.orders.some((o) =>
          `${o.customerName} ${o.reference} ${o.productName}`
            .toLowerCase()
            .includes(query),
        )
      )
    })
  }, [allItems, category, search])

  const selectedInventoryItem = selectableItems.find(
    (item) => item.inventoryId === selectedItemId,
  )

  const handleAddExtraItem = () => {
    if (!selectedInventoryItem) {
      setAddError("Select or create an item first.")
      return
    }
    const rawQty = Number(addQty)
    if (!Number.isFinite(rawQty) || rawQty <= 0) {
      setAddError("Enter a quantity greater than 0.")
      return
    }
    const baseQty = toInventoryBaseQuantity(
      rawQty,
      addUnit,
      selectedInventoryItem,
    )
    if (!Number.isFinite(baseQty) || baseQty <= 0) {
      setAddError("Quantity unit does not match this item.")
      return
    }
    const existingQty = state.shoppingSelections[selectedInventoryItem.inventoryId] ?? 0
    dispatch({
      type: "SET_PURCHASE_QUANTITY",
      inventoryId: selectedInventoryItem.inventoryId,
      quantity: existingQty + baseQty,
    })
    setCheckedExtraIds((prev) => {
      const next = new Set(prev)
      next.delete(selectedInventoryItem.inventoryId)
      return next
    })
    setAddSheetOpen(false)
    showToast({
      message: `Added ${selectedInventoryItem.name} to shopping list`,
      tone: "success",
    })
  }

  const toggleItemChecked = (item: (typeof allItems)[number]) => {
    if (item.isManualExtra) {
      setCheckedExtraIds((prev) => {
        const next = new Set(prev)
        if (next.has(item.inventoryId)) {
          next.delete(item.inventoryId)
        } else {
          next.add(item.inventoryId)
        }
        return next
      })
    } else {
      dispatch({
        type: "UPDATE_SHOPPING_CHECKLIST_ITEM",
        inventoryId: item.inventoryId,
        checked: !item.checked,
        boughtQuantity: item.boughtQuantity,
      })
    }
  }

  const resolveShoppingExpenseCategoryId = () => {
    const existing = state.expenseCategories.find((cat) =>
      /^(shopping|ingredients)/i.test(cat.name.trim()),
    )
    if (existing) return existing.id
    const shoppingCatId = "expense-category-shopping"
    const added = dispatchIfAccepted({
      type: "ADD_EXPENSE_CATEGORY",
      category: {
        id: shoppingCatId,
        name: "Shopping",
        source: "custom",
      },
    })
    if (added) return shoppingCatId
    return state.expenseCategories[0]?.id ?? "expense-category-other"
  }

  const completeShopping = (expenseAmount?: number) => {
    const checkedItems = allItems.filter((i) => i.checked)
    const extraIds = checkedItems
      .filter((i) => i.isManualExtra)
      .map((i) => i.inventoryId)

    let recordedExpense = false
    let expenseId: string | undefined
    const todayIso = new Date().toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()

    if (
      expenseAmount !== undefined &&
      isValidMoneyAmount(expenseAmount) &&
      checkedItems.length > 0
    ) {
      const orderIds = new Set(
        checkedItems.flatMap((i) => i.orders.map((o) => o.orderId)),
      )
      const hasManual = checkedItems.some((i) => i.isManualExtra)
      let attribution: ExpenseAttribution = { type: "shared" }
      if (!hasManual && orderIds.size === 1) {
        const singleOrderId = [...orderIds][0]
        const targetOrder = state.orders.find((o) => o.id === singleOrderId)
        if (
          targetOrder &&
          !targetOrder.isQuickOrder &&
          targetOrder.customerId !== null
        ) {
          attribution = { type: "direct", orderId: singleOrderId }
        }
      }
      const description = `Shopping trip · ${checkedItems.length} ${
        checkedItems.length === 1 ? "item" : "items"
      }`
      const candidateExpenseId = createId("exp")

      recordedExpense = dispatchIfAccepted({
        type: "RECORD_EXPENSE",
        expense: {
          id: candidateExpenseId,
          amount: expenseAmount,
          paidDate: todayIso,
          categoryId: resolveShoppingExpenseCategoryId(),
          description,
          attribution,
          createdAt: nowIso,
        },
      })
      if (recordedExpense) {
        expenseId = candidateExpenseId
      }
    }

    if (checkedItems.length > 0) {
      dispatchIfAccepted({
        type: "ADD_SHOPPING_TRIP",
        trip: {
          id: createId("trip"),
          reference: makeShoppingReference(state.shoppingTrips ?? []),
          date: todayIso,
          createdAt: nowIso,
          totalSpent: recordedExpense ? (expenseAmount ?? null) : null,
          ...(expenseId ? { expenseId } : {}),
          items: checkedItems.map((item) => ({
            inventoryId: item.inventoryId,
            name: item.name,
            category: item.category,
            quantity: item.boughtQuantity,
            unit: item.unit,
            estimatedCost: item.estimatedCost,
            orders: item.orders.map((o) => ({
              orderId: o.orderId,
              reference: o.reference,
              customerName: o.customerName,
              quantity: o.quantity,
            })),
          })),
        },
      })
    }

    dispatch({
      type: "COMPLETE_SHOPPING_CHECKLIST",
      extraInventoryIds: extraIds,
    })
    setCheckedExtraIds(new Set())
    setFinishSheetOpen(false)
    showToast({
      message: recordedExpense
        ? `Moved to pantry · ${formatLkr(expenseAmount!)} expense recorded`
        : "Bought items moved to pantry!",
      tone: "success",
    })
  }

  const handleDoneClick = () => {
    const checkedItems = allItems.filter((i) => i.checked)
    if (!checkedItems.length) return
    const hasUnpriced = checkedItems.some((i) => i.estimatedCost === null)
    const estimatedTotal = Math.round(
      checkedItems.reduce((sum, i) => sum + (i.estimatedCost ?? 0), 0),
    )
    if (!hasUnpriced && estimatedTotal > 0) {
      completeShopping(estimatedTotal)
      return
    }
    setTripTotalInput(estimatedTotal > 0 ? String(estimatedTotal) : "")
    setTripError("")
    setFinishSheetOpen(true)
  }

  return (
    <>
      <div className="space-y-4 pb-6">
        <ScreenHeader
          title="Shopping list"
          subtitle="Tap items as you shop or add extras manually"
          action={
            viewMode === "to-buy" ? (
              <Button
                size="compact"
                leadingIcon={<Plus aria-hidden="true" size={16} />}
                onClick={openAddSheet}
              >
                Add
              </Button>
            ) : undefined
          }
        />

        {(state.shoppingTrips?.length ?? 0) > 0 ? (
          <SegmentedControl
            label="Shopping view"
            value={viewMode}
            onChange={(value) => setViewMode(value as "to-buy" | "history")}
            segments={[
              { value: "to-buy", label: `To buy (${allItems.length})` },
              {
                value: "history",
                label: `History (${state.shoppingTrips?.length ?? 0})`,
              },
            ]}
          />
        ) : null}

        <TabView viewKey={viewMode} className="space-y-4">
        {viewMode === "history" ? (
          <GroupedList title="Saved shopping trips">
            {(state.shoppingTrips ?? []).map((trip) => (
              <ListRow
                key={trip.id}
                title={`${trip.reference} · ${trip.items.length} ${
                  trip.items.length === 1 ? "item" : "items"
                }`}
                subtitle={formatDate(trip.date)}
                value={
                  trip.totalSpent !== null ? formatLkr(trip.totalSpent) : "—"
                }
                showChevron
                onClick={() => setSelectedTrip(trip)}
              />
            ))}
          </GroupedList>
        ) : (
          <>
            {checkedCount > 0 ? (
          <Card
            tone="sage"
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cocoa">
                {checkedCount} {checkedCount === 1 ? "item" : "items"} marked
                bought
              </p>
              <p className="text-xs text-muted">
                Move checked items to your pantry.
              </p>
            </div>
            <Button
              size="compact"
              leadingIcon={<Check aria-hidden="true" size={15} />}
              onClick={handleDoneClick}
            >
              Done ({checkedCount})
            </Button>
          </Card>
        ) : null}

        {allItems.length > 0 ? (
          <>
            <Card className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <p className="text-xs font-medium text-muted">
                  Estimated list total
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-cocoa">
                  {formatLkr(totalEstimatedValue)}
                </p>
              </div>
              <div className="text-right text-xs text-muted">
                <div>
                  {allItems.length} {allItems.length === 1 ? "item" : "items"}
                </div>
                <div>
                  {unpricedCount > 0
                    ? `${unpricedCount} without unit price`
                    : "All items priced"}
                </div>
              </div>
            </Card>

            <Field
              label="Search shopping list"
              hideLabel
              isSearch
              placeholder="Search ingredients or customer..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <SegmentedControl
              label="Shopping category"
              value={category}
              segments={[
                { value: "all", label: `All (${allItems.length})` },
                { value: "ingredient", label: "Ingredients" },
                { value: "packaging", label: "Packaging" },
              ]}
              onChange={setCategory}
            />
          </>
        ) : null}

        {visibleItems.length > 0 ? (
          <AnimatedList className="space-y-3">
            {visibleItems.map((item) => {
              const inventoryItem = state.inventory.find(
                (inv) => inv.inventoryId === item.inventoryId,
              )
              return (
              <AnimatedItem key={item.inventoryId}>
                <SwipeableRow
                  actionLabel="Remove"
                  disabled={!item.isManualExtra}
                  onAction={() => {
                    dispatch({
                      type: "REMOVE_MANUAL_SHOPPING_ITEM",
                      inventoryId: item.inventoryId,
                    })
                    setCheckedExtraIds((prev) => {
                      const next = new Set(prev)
                      next.delete(item.inventoryId)
                      return next
                    })
                  }}
                >
                  <Card
                    className={`space-y-3 transition ${
                      item.checked ? "border-sage bg-sage-soft/50" : ""
                    }`}
                  >
                <div className="flex items-start justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleItemChecked(item)}
                    className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                    aria-pressed={item.checked}
                  >
                    <span className="mt-0.5 shrink-0 text-sage-dark">
                      {item.checked ? (
                        <CheckSquare
                          aria-hidden="true"
                          size={20}
                          className="text-success"
                        />
                      ) : (
                        <Square
                          aria-hidden="true"
                          size={20}
                          className="text-muted"
                        />
                      )}
                    </span>
                    <ItemThumbnail
                      image={inventoryItem?.image}
                      alt={item.name}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-semibold text-cocoa ${
                          item.checked ? "line-through opacity-75" : ""
                        }`}
                      >
                        {item.name}
                      </span>
                      {item.orders.length > 0 ? (
                        <span className="mt-1.5 block space-y-1">
                          {item.orders.map((o) => (
                            <span
                              key={o.orderId}
                              className="flex items-center justify-between gap-3 text-xs text-muted"
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  aria-hidden="true"
                                  className="size-1 shrink-0 rounded-full bg-muted-light"
                                />
                                <span className="leading-snug">
                                  {o.customerName}
                                </span>
                              </span>
                              <span className="shrink-0 whitespace-nowrap font-medium tabular-nums">
                                {formatQuantity(o.quantity, item.unit)}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-muted">
                          Added manually
                        </span>
                      )}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <div className="text-right">
                      <StatusBadge tone={item.checked ? "success" : "warning"}>
                        {item.checked
                          ? "Bought"
                          : formatQuantity(item.boughtQuantity, item.unit)}
                      </StatusBadge>
                      <div className="mt-1 text-[11px] font-semibold tabular-nums text-cocoa">
                        {item.estimatedCost !== null
                          ? formatLkr(item.estimatedCost)
                          : "No price"}
                      </div>
                    </div>
                    {item.isManualExtra ? (
                      <IconButton
                        label={`Remove ${item.name}`}
                        className="size-8"
                        onClick={() => {
                          dispatch({
                            type: "REMOVE_MANUAL_SHOPPING_ITEM",
                            inventoryId: item.inventoryId,
                          })
                          setCheckedExtraIds((prev) => {
                            const next = new Set(prev)
                            next.delete(item.inventoryId)
                            return next
                          })
                        }}
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </IconButton>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-warm-border/70 pt-2.5 text-xs">
                  <span className="text-muted">
                    Qty to buy ({item.unit}):
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    aria-label={`Quantity to buy for ${item.name}`}
                    value={item.boughtQuantity}
                    onChange={(event) => {
                      const val = Number(event.target.value)
                      dispatch({
                        type: "UPDATE_SHOPPING_CHECKLIST_ITEM",
                        inventoryId: item.inventoryId,
                        checked: item.checked,
                        boughtQuantity:
                          Number.isFinite(val) && val >= 0
                            ? val
                            : item.neededQuantity,
                      })
                    }}
                    className="w-28 rounded-control border border-warm-border bg-white px-2.5 py-1 text-right text-xs font-semibold text-cocoa outline-none focus:border-sage"
                  />
                </div>
              </Card>
              </SwipeableRow>
              </AnimatedItem>
              )
            })}
          </AnimatedList>
        ) : (
          <Card className="px-5 py-8 text-center">
            <Illustration name="shopping-cart" size="md" />
            <p className="mt-2 text-base font-semibold text-cocoa">
              {allItems.length === 0
                ? "Shopping list is clear"
                : "No matching items"}
            </p>
            <p className="mx-auto mt-1 max-w-empty text-xs leading-relaxed text-muted">
              {allItems.length === 0
                ? "Mark missing order items as “Need to buy”, or tap + Add above to add any extra ingredients."
                : "Try another search or category filter."}
            </p>
          </Card>
        )}
          </>
        )}
        </TabView>
      </div>

      <Sheet
        open={addSheetOpen}
        title="Add to shopping list"
        subtitle="Pick a saved ingredient or create a new one"
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
              leadingIcon={<Plus aria-hidden="true" size={16} />}
              onClick={handleAddExtraItem}
            >
              Add
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">
                Ingredient or packaging
              </span>
              <button
                type="button"
                onClick={() => setNewItemSheetOpen(true)}
                className="text-xs font-semibold text-rose hover:underline"
              >
                + New item
              </button>
            </div>
            <SelectField
              label="Select item"
              value={selectedItemId}
              options={
                selectableItems.length > 0
                  ? selectableItems.map((i) => ({
                      value: i.inventoryId,
                      label: i.name,
                    }))
                  : [{ value: "", label: "No items saved yet" }]
              }
              onChange={(e) => {
                const next = selectableItems.find(
                  (i) => i.inventoryId === e.target.value,
                )
                setSelectedItemId(e.target.value)
                if (next) {
                  setAddUnit(
                    next.unit === "g"
                      ? "kg"
                      : next.unit === "ml"
                        ? "L"
                        : "unit",
                  )
                }
                setAddError("")
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Quantity to buy"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={addQty}
              onChange={(e) => {
                setAddQty(e.target.value)
                setAddError("")
              }}
            />
            <SelectField
              label="Unit"
              value={addUnit}
              options={(selectedInventoryItem
                ? compatibleUnits(selectedInventoryItem.unit)
                : (["g", "kg", "ml", "L", "unit"] as Unit[])
              ).map((u) => ({ value: u, label: u }))}
              onChange={(e) => setAddUnit(e.target.value as Unit)}
            />
          </div>

          {addError ? (
            <p className="text-sm font-medium text-error">{addError}</p>
          ) : null}
        </div>
      </Sheet>

      <InventoryItemSheet
        open={newItemSheetOpen}
        onClose={() => setNewItemSheetOpen(false)}
        onSaved={(newItem) => {
          setSelectedItemId(newItem.inventoryId)
          setAddUnit(
            newItem.unit === "g" ? "kg" : newItem.unit === "ml" ? "L" : "unit",
          )
          setAddQty("1")
        }}
      />

      <Sheet
        open={finishSheetOpen}
        title="Record shopping expense"
        subtitle="Some checked items don't have a unit price yet"
        onClose={() => setFinishSheetOpen(false)}
        footer={
          <div className="space-y-2">
            <Button
              fullWidth
              onClick={() => {
                const parsed = Number(tripTotalInput)
                if (!isValidMoneyAmount(parsed)) {
                  setTripError("Enter a positive whole LKR amount.")
                  return
                }
                completeShopping(parsed)
              }}
            >
              Save expense & move to pantry
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => completeShopping(undefined)}
            >
              Move without expense
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field
            label="Total spent (LKR)"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="e.g., 1500"
            value={tripTotalInput}
            onChange={(event) => {
              setTripTotalInput(event.target.value)
              setTripError("")
            }}
          />
          {tripError ? (
            <p role="alert" className="text-sm font-medium text-error">
              {tripError}
            </p>
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
