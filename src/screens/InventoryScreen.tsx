import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Package,
  PackagePlus,
  Pencil,
  ReceiptText,
  SlidersHorizontal,
} from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Dialog from "../components/ui/Dialog"
import Field from "../components/ui/Field"
import SegmentedControl from "../components/ui/SegmentedControl"
import SelectField from "../components/ui/SelectField"
import StatusBadge from "../components/ui/StatusBadge"
import TextAreaField from "../components/ui/TextAreaField"
import { formatDate, formatLkr, formatQuantity } from "../lib/format"
import {
  inventoryCategory,
  selectAvailableInventory,
  selectPlannedRequirement,
  selectShoppingRequirements,
} from "../lib/inventory"
import { useAppState } from "../state/AppState"
import type {
  InventoryCategory,
  InventoryItem,
  InventoryMovementType,
  StarterAction,
} from "../types"
import PurchaseForm from "./PurchaseForm"

type StockFilter = "all" | "low" | "short"
type View = "list" | "detail" | "purchase"
type AdjustmentType = Exclude<InventoryMovementType, "Opening balance" | "Purchase" | "Preparation consumption">

function formatStockCost(item: InventoryItem) {
  if (!item.averageUnitCost) return "Cost not recorded"
  if (item.unit === "g") return `${formatLkr(item.averageUnitCost * 1000)} / kg`
  if (item.unit === "ml") return `${formatLkr(item.averageUnitCost * 1000)} / L`
  return `${formatLkr(item.averageUnitCost)} / unit`
}

type InventoryScreenProps = {
  starterAction: StarterAction | null
  initialInventoryId?: string
  onConsumeStarterAction: () => void
  onConsumeInventoryIntent: () => void
  onFocusedChange: (focused: boolean) => void
}

export default function InventoryScreen({
  starterAction,
  initialInventoryId,
  onConsumeStarterAction,
  onConsumeInventoryIntent,
  onFocusedChange,
}: InventoryScreenProps) {
  const { state } = useAppState()
  const [view, setView] = useState<View>("list")
  const [category, setCategory] = useState<InventoryCategory>("ingredient")
  const [filter, setFilter] = useState<StockFilter>("all")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSalesNotice, setShowSalesNotice] = useState(false)
  const consumedAction = useRef<StarterAction | null>(null)

  useEffect(() => {
    if (initialInventoryId) {
      const item = state.inventory.find(
        (entry) => entry.inventoryId === initialInventoryId,
      )
      if (item) {
        setCategory(inventoryCategory(item))
        setSelectedId(item.inventoryId)
        setView("detail")
      }
      onConsumeInventoryIntent()
    }
  }, [initialInventoryId, onConsumeInventoryIntent, state.inventory])

  useEffect(() => {
    if (!starterAction || consumedAction.current === starterAction) return
    consumedAction.current = starterAction
    if (starterAction === "record-sale") {
      setCategory("finished")
      setShowSalesNotice(true)
    }
    onConsumeStarterAction()
  }, [starterAction, onConsumeStarterAction])

  useEffect(() => {
    onFocusedChange(view !== "list")
    return () => onFocusedChange(false)
  }, [view, onFocusedChange])

  const requirements = useMemo(() => selectShoppingRequirements(state), [state])
  const visibleItems = state.inventory.filter((item) => {
    if (inventoryCategory(item) !== category) return false
    if (
      search.trim() &&
      !item.name.toLowerCase().includes(search.trim().toLowerCase())
    )
      return false
    const availability = selectAvailableInventory(state, item.inventoryId)
    const planned =
      requirements.find((entry) => entry.inventoryId === item.inventoryId)
        ?.required ?? 0
    const isLow = availability.available <= (item.lowStockThreshold ?? 0)
    const isShort = planned > availability.available
    if (filter === "low" && !isLow) return false
    if (filter === "short" && !isShort) return false
    return true
  })
  const selectedItem = state.inventory.find(
    (item) => item.inventoryId === selectedId,
  )

  if (view === "purchase") {
    return (
      <PurchaseForm
        initialInventoryId={selectedId ?? undefined}
        onCancel={() => setView(selectedItem ? "detail" : "list")}
        onComplete={(inventoryId) => {
          setSelectedId(inventoryId)
          setView("detail")
        }}
      />
    )
  }

  if (view === "detail" && selectedItem) {
    return (
      <InventoryDetail
        item={selectedItem}
        onBack={() => {
          setSelectedId(null)
          setView("list")
        }}
        onPurchase={() => setView("purchase")}
      />
    )
  }

  return (
    <div className="px-page pb-6">
      <ScreenHeader
        eyebrow="Stock overview"
        title="Inventory"
        subtitle="Physical, reserved and available"
        action={
          category !== "finished" ? (
            <Button
              size="compact"
              leadingIcon={<PackagePlus aria-hidden="true" size={16} />}
              onClick={() => {
                setSelectedId(null)
                setView("purchase")
              }}
            >
              Buy
            </Button>
          ) : null
        }
      />

      {showSalesNotice ? (
        <Card tone="sage" className="mt-4">
          <p className="text-sm font-semibold text-cocoa">
            Finished-stock sales are not active yet
          </p>
          <p className="mt-1 text-xs text-muted">
            Existing finished units are shown without simulating a sale.
          </p>
        </Card>
      ) : null}

      <div className="mt-4">
        <Field
          label="Search inventory"
          hideLabel
          isSearch
          placeholder="Search stock"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mt-3">
        <SegmentedControl
          label="Inventory category"
          value={category}
          segments={[
            { value: "ingredient", label: "Ingredients" },
            { value: "packaging", label: "Packaging" },
            { value: "finished", label: "Finished stock" },
          ]}
          onChange={setCategory}
        />
      </div>
      <div className="mt-2">
        <SegmentedControl
          label="Stock status"
          value={filter}
          segments={[
            { value: "all", label: "All" },
            { value: "low", label: "Low stock" },
            { value: "short", label: "Shortage" },
          ]}
          onChange={setFilter}
        />
      </div>

      <div className="mt-5 space-y-3">
        {visibleItems.map((item) => (
          <InventoryRow
            key={item.inventoryId}
            item={item}
            state={state}
            onClick={() => {
              setSelectedId(item.inventoryId)
              setView("detail")
            }}
          />
        ))}
        {!visibleItems.length ? (
          <Card className="py-8 text-center">
            <CircleCheck
              aria-hidden="true"
              className="mx-auto text-success"
              size={25}
            />
            <p className="mt-3 text-sm font-semibold text-cocoa">
              No stock matches this filter
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function InventoryRow({
  item,
  state,
  onClick,
}: {
  item: InventoryItem
  state: ReturnType<typeof useAppState>["state"]
  onClick: () => void
}) {
  const availability = selectAvailableInventory(state, item.inventoryId)
  const planned = selectPlannedRequirement(state, item.inventoryId)
  const shortage = Math.max(0, planned - availability.available)
  const low = availability.available <= (item.lowStockThreshold ?? 0)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-card border border-warm-border bg-white p-4 text-left shadow-subtle transition duration-ui hover:border-sage-border"
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-cocoa">
            {item.name}
          </span>
          <span className="mt-1 block text-xs text-muted">
            {formatStockCost(item)}
          </span>
        </span>
        <StatusBadge tone={shortage ? "warning" : low ? "progress" : "success"}>
          {shortage ? "Short" : low ? "Low" : "Available"}
        </StatusBadge>
      </span>
      <span className="mt-3 grid grid-cols-3 gap-2 rounded-control bg-ivory p-3 text-center">
        <span>
          <span className="block text-nav font-bold uppercase text-muted">
            Physical
          </span>
          <span className="mt-1 block text-xs font-semibold text-cocoa">
            {formatQuantity(availability.physical, item.unit)}
          </span>
        </span>
        <span className="border-x border-warm-border">
          <span className="block text-nav font-bold uppercase text-muted">
            Reserved
          </span>
          <span className="mt-1 block text-xs font-semibold text-cocoa">
            {formatQuantity(availability.reserved, item.unit)}
          </span>
        </span>
        <span>
          <span className="block text-nav font-bold uppercase text-muted">
            Available
          </span>
          <span className="mt-1 block text-xs font-semibold text-cocoa">
            {formatQuantity(availability.available, item.unit)}
          </span>
        </span>
      </span>
      {planned > 0 ? (
        <span className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted">Planned requirement</span>
          <span className="font-semibold text-cocoa">
            {formatQuantity(planned, item.unit)}
          </span>
        </span>
      ) : null}
    </button>
  )
}

function InventoryDetail({
  item,
  onBack,
  onPurchase,
}: {
  item: InventoryItem
  onBack: () => void
  onPurchase: () => void
}) {
  const { state, dispatch } = useAppState()
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustmentId, setAdjustmentId] = useState(
    () => `movement-adjust-${crypto.randomUUID()}`,
  )
  const [type, setType] = useState<AdjustmentType>("Correction")
  const [direction, setDirection] = useState<"add" | "remove">("remove")
  const [quantity, setQuantity] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const availability = selectAvailableInventory(state, item.inventoryId)
  const planned = selectPlannedRequirement(state, item.inventoryId)
  const movements = state.inventoryMovements
    .filter((movement) => movement.inventoryId === item.inventoryId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const resetAdjustment = () => {
    setAdjustmentId(`movement-adjust-${crypto.randomUUID()}`)
    setQuantity("")
    setReason("")
    setError("")
  }

  const submitAdjustment = () => {
    const amount = Number(quantity)
    const delta = direction === "add" ? amount : -amount
    const balanceAfter = item.physical + delta
    if (amount <= 0 || !reason.trim() || !date) {
      setError("Enter a positive quantity, date and clear reason.")
      return
    }
    if (balanceAfter < 0) {
      setError("This adjustment would make physical stock negative.")
      return
    }
    if (balanceAfter < availability.reserved) {
      setError(
        `Cannot reduce below ${formatQuantity(
          availability.reserved,
          item.unit,
        )} reserved for active orders.`,
      )
      return
    }
    dispatch({
      type: "ADJUST_INVENTORY",
      adjustment: {
        id: adjustmentId,
        inventoryId: item.inventoryId,
        type,
        quantityDelta: delta,
        date,
        reason: reason.trim(),
      },
    })
    setAdjustOpen(false)
    resetAdjustment()
  }

  return (
    <>
      <div className="px-page pb-6">
        <ScreenHeader
          eyebrow={inventoryCategory(item)}
          title={item.name}
          subtitle={`Base unit · ${item.unit}`}
          onBack={onBack}
          backLabel="Back to inventory"
        />

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <p className="text-lg font-bold text-cocoa">
              {formatQuantity(availability.physical, item.unit)}
            </p>
            <p className="mt-1 text-nav font-bold uppercase text-muted">
              Physical
            </p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-lg font-bold text-warning">
              {formatQuantity(availability.reserved, item.unit)}
            </p>
            <p className="mt-1 text-nav font-bold uppercase text-muted">
              Reserved
            </p>
          </Card>
          <Card tone="sage" className="p-3 text-center">
            <p className="text-lg font-bold text-sage-dark">
              {formatQuantity(availability.available, item.unit)}
            </p>
            <p className="mt-1 text-nav font-bold uppercase text-muted">
              Available
            </p>
          </Card>
        </div>

        <Card className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted">Planned requirement</p>
              <p className="mt-1 text-sm font-semibold text-cocoa">
                {formatQuantity(planned, item.unit)}
              </p>
            </div>
            <div className="border-l border-warm-border pl-4">
              <p className="text-xs text-muted">Average unit cost</p>
              <p className="mt-1 text-sm font-semibold text-cocoa">
                {formatStockCost(item)}
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {inventoryCategory(item) !== "finished" ? (
            <Button
              variant="secondary"
              leadingIcon={<PackagePlus aria-hidden="true" size={17} />}
              onClick={onPurchase}
            >
              Purchase
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              Sales later
            </Button>
          )}
          <Button
            leadingIcon={<SlidersHorizontal aria-hidden="true" size={17} />}
            onClick={() => setAdjustOpen(true)}
          >
            Adjust
          </Button>
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-semibold text-cocoa">Movements</div>
            <StatusBadge tone="neutral">{movements.length}</StatusBadge>
          </div>
          <Card className="divide-y divide-warm-border p-0">
            {movements.map((movement) => (
              <div key={movement.id} className="flex items-start gap-3 p-4">
                <span
                  className={`inline-flex size-9 shrink-0 items-center justify-center rounded-control ${
                    movement.quantityDelta >= 0
                      ? "bg-success-soft text-success"
                      : "bg-warning-soft text-warning"
                  }`}
                >
                  {movement.quantityDelta >= 0 ? (
                    <ArrowUp aria-hidden="true" size={17} />
                  ) : (
                    <ArrowDown aria-hidden="true" size={17} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-cocoa">
                        {movement.type}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDate(movement.date)} · {movement.reason}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        movement.quantityDelta >= 0
                          ? "text-success"
                          : "text-warning"
                      }`}
                    >
                      {movement.quantityDelta >= 0 ? "+" : ""}
                      {formatQuantity(movement.quantityDelta, movement.unit)}
                    </p>
                  </div>
                  <p className="mt-1 text-nav font-medium uppercase text-muted">
                    Balance{" "}
                    {formatQuantity(movement.balanceAfter, movement.unit)}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      </div>

      <Dialog
        open={adjustOpen}
        title="Adjust stock"
        description={`${item.name} · ${formatQuantity(
          item.physical,
          item.unit,
        )} physical`}
        onClose={() => {
          setAdjustOpen(false)
          resetAdjustment()
        }}
        footer={
          <div className="space-y-2">
            <Button fullWidth onClick={submitAdjustment}>
              Record adjustment
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setAdjustOpen(false)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="max-h-dialog-content space-y-4 overflow-y-auto pr-1">
          {error ? (
            <div className="flex items-start gap-2 rounded-control bg-warning-soft p-3 text-sm text-cocoa">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-warning"
                size={17}
              />
              {error}
            </div>
          ) : null}
          <SelectField
            label="Adjustment type"
            value={type}
            onChange={(event) => setType(event.target.value as AdjustmentType)}
            options={[
              { value: "Correction", label: "Stock correction" },
              { value: "Spoilage", label: "Spoilage" },
              { value: "Damage", label: "Damage" },
              { value: "Other", label: "Other" },
            ]}
          />
          <SegmentedControl
            label="Adjustment direction"
            value={direction}
            segments={[
              { value: "add", label: "Add stock" },
              { value: "remove", label: "Remove stock" },
            ]}
            onChange={setDirection}
          />
          <Field
            label={`Quantity (${item.unit})`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <Field
            label="Adjustment date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <TextAreaField
            label="Reason"
            placeholder="Why is this stock changing?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </Dialog>
    </>
  )
}
