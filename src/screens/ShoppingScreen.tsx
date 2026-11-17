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
import ScreenHeader from "../components/ScreenHeader"
import Button, { IconButton } from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import SegmentedControl from "../components/ui/SegmentedControl"
import SelectField from "../components/ui/SelectField"
import Sheet from "../components/ui/Sheet"
import StatusBadge from "../components/ui/StatusBadge"
import { useToast } from "../components/ui/Toast"
import { formatLkr, formatQuantity } from "../lib/format"
import {
  compatibleUnits,
  inventoryCategory,
  selectManualShoppingList,
  toInventoryBaseQuantity,
} from "../lib/inventory"
import { useAppState } from "../state/AppState"
import type { StarterAction, Unit } from "../types"

type ShoppingCategoryFilter = "all" | "ingredient" | "packaging"

type ShoppingScreenProps = {
  starterAction: StarterAction | null
  onConsumeStarterAction: () => void
}

export default function ShoppingScreen({
  starterAction,
  onConsumeStarterAction,
}: ShoppingScreenProps) {
  const { state, dispatch } = useAppState()
  const { showToast } = useToast()
  const [category, setCategory] = useState<ShoppingCategoryFilter>("all")
  const [search, setSearch] = useState("")
  const [checkedExtraIds, setCheckedExtraIds] = useState<Set<string>>(
    () => new Set(),
  )

  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [newItemSheetOpen, setNewItemSheetOpen] = useState(false)
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

  return (
    <>
      <div className="space-y-4 pb-6">
        <ScreenHeader
          title="Shopping list"
          subtitle="Tap items as you shop or add extras manually"
          action={
            <Button
              size="compact"
              leadingIcon={<Plus aria-hidden="true" size={16} />}
              onClick={openAddSheet}
            >
              Add
            </Button>
          }
        />

        {checkedCount > 0 ? (
          <Card
            tone="sage"
            className="flex items-center justify-between gap-3 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-cocoa">
                {checkedCount} {checkedCount === 1 ? "item" : "items"} marked
                bought
              </p>
              <p className="text-xs text-muted">
                Done shopping? Move checked items to your pantry.
              </p>
            </div>
            <Button
              size="compact"
              leadingIcon={<Check aria-hidden="true" size={15} />}
              onClick={() => {
                const extraIds = allItems
                  .filter((i) => i.isManualExtra && i.checked)
                  .map((i) => i.inventoryId)
                dispatch({
                  type: "COMPLETE_SHOPPING_CHECKLIST",
                  extraInventoryIds: extraIds,
                })
                setCheckedExtraIds(new Set())
                showToast({
                  message: "Bought items moved to pantry!",
                  tone: "success",
                })
              }}
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
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <Card
                key={item.inventoryId}
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
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-semibold text-cocoa ${
                          item.checked ? "line-through opacity-75" : ""
                        }`}
                      >
                        {item.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {item.orders.length > 0
                          ? `Min needed: ${formatQuantity(item.neededQuantity, item.unit)} · ${item.orders
                              .map(
                                (o) =>
                                  `${o.customerName} (${formatQuantity(o.quantity, item.unit)})`,
                              )
                              .join(", ")}`
                          : "Added manually"}
                      </span>
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
            ))}
          </div>
        ) : (
          <Card className="px-5 py-10 text-center">
            <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-sage-soft text-success">
              {allItems.length === 0 ? (
                <CircleCheck aria-hidden="true" size={24} />
              ) : (
                <ShoppingBag aria-hidden="true" size={22} />
              )}
            </span>
            <p className="mt-3 text-base font-semibold text-cocoa">
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
    </>
  )
}
