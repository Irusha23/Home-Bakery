import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  CircleCheck,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingBasket,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import InventoryItemSheet from "../components/domain/InventoryItemSheet"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Dialog from "../components/ui/Dialog"
import EmptyState from "../components/ui/EmptyState"
import Field from "../components/ui/Field"
import ItemThumbnail from "../components/ui/ItemThumbnail"
import SegmentedControl from "../components/ui/SegmentedControl"
import SelectField from "../components/ui/SelectField"
import StatusBadge from "../components/ui/StatusBadge"
import TextAreaField from "../components/ui/TextAreaField"
import { useToast } from "../components/ui/Toast"
import { formatDate, formatLkr, formatQuantity } from "../lib/format"
import { createId } from "../lib/id"
import {
  inventoryCategory,
  selectAvailableInventory,
  selectPlannedRequirement,
  selectShoppingRequirements,
} from "../lib/inventory"
import { useAppState } from "../state/AppState"
import type {
  FinishedStockBatch,
  InventoryCategory,
  InventoryItem,
  InventoryMovementType,
  StarterAction,
} from "../types"
import PurchaseForm from "./PurchaseForm"

type StockFilter = "all" | "low" | "short"
type View = "list" | "detail" | "purchase"
type AdjustmentType = Exclude<InventoryMovementType, "Opening balance" | "Purchase" | "Preparation consumption" | "Production" | "Finished stock sale" | "Finished stock write-off">

function formatStockCost(item: InventoryItem) {
  if (!item.averageUnitCost) return "Cost not recorded"
  if (item.unit === "g") return `${formatLkr(item.averageUnitCost * 1000)} / kg`
  if (item.unit === "ml") return `${formatLkr(item.averageUnitCost * 1000)} / L`
  return `${formatLkr(item.averageUnitCost)} / unit`
}

function finishedBatchDate(batch: FinishedStockBatch) {
  return batch.source === "production" ? batch.preparedAt : batch.reconciledAt
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
  const [newItemOpen, setNewItemOpen] = useState(false)
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
    <div className="space-y-4 pb-6">
      <ScreenHeader
        title="Pantry"
        action={
          category !== "finished" ? (
            <div className="flex items-center gap-2">
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<Plus aria-hidden="true" size={16} />}
                onClick={() => setNewItemOpen(true)}
              >
                New
              </Button>
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
            </div>
          ) : null
        }
      />

      {showSalesNotice ? (
        <Card tone="sage" className="py-3">
          <p className="text-xs font-medium text-cocoa">
            Tap any baked item below to record a sale or write-off by batch.
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
          filter === "all" && !search.trim() ? (
            <EmptyState
              illustration={category === "finished" ? "cake-box" : "shopping-cart"}
              title={
                category === "ingredient"
                  ? "No ingredients yet"
                  : category === "packaging"
                    ? "No packaging items yet"
                    : "No finished stock yet"
              }
              description={
                category === "finished"
                  ? "Extra-stock bakes you finish will appear here for quick sales."
                  : `Add your first ${category === "packaging" ? "box or board" : "ingredient"} to track stock and costs.`
              }
              actionLabel={
                category === "finished"
                  ? undefined
                  : category === "packaging"
                    ? "Add packaging"
                    : "Add ingredient"
              }
              onAction={
                category === "finished" ? undefined : () => setNewItemOpen(true)
              }
            />
          ) : (
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
          )
        ) : null}
      </div>
      <InventoryItemSheet
        open={newItemOpen}
        defaultCategory={category === "packaging" ? "packaging" : "ingredient"}
        onClose={() => setNewItemOpen(false)}
        onSaved={(saved) => {
          setCategory(inventoryCategory(saved))
          setSelectedId(saved.inventoryId)
          setView("detail")
        }}
      />
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
  const meterMax = Math.max(
    availability.physical,
    planned,
    (item.lowStockThreshold ?? 0) * 2,
    1,
  )
  const availablePct = Math.max(
    0,
    Math.min(100, Math.round((availability.available / meterMax) * 100)),
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-card border border-warm-border bg-white p-4 text-left shadow-subtle transition duration-ui hover:border-sage-border"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ItemThumbnail image={item.image} alt={item.name} size="sm" />
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-cocoa">
              {item.name}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {formatQuantity(availability.available, item.unit)} available ·{" "}
              {formatStockCost(item)}
            </span>
          </div>
        </div>
        <StatusBadge tone={shortage ? "warning" : low ? "progress" : "success"}>
          {shortage ? "Short" : low ? "Low" : "In stock"}
        </StatusBadge>
      </div>
      <span className="mt-3 block h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
        <span
          className={`block h-full rounded-full transition-all duration-300 ${
            shortage > 0 ? "bg-warning" : low ? "bg-terracotta" : "bg-sage"
          }`}
          style={{ width: `${availablePct}%` }}
        />
      </span>
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
  const { state, dispatch, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()
  const [itemSheetOpen, setItemSheetOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustmentId, setAdjustmentId] = useState(
    () => createId("movement-adjust"),
  )
  const [type, setType] = useState<AdjustmentType>("Correction")
  const [direction, setDirection] = useState<"add" | "remove">("remove")
  const [quantity, setQuantity] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [finishedAction, setFinishedAction] =
    useState<"sale" | "write-off" | null>(null)
  const [finishedBatchId, setFinishedBatchId] = useState("")
  const [finishedQuantity, setFinishedQuantity] = useState("")
  const [finishedReason, setFinishedReason] = useState("")
  const [finishedSalePrice, setFinishedSalePrice] = useState("")
  const [finishedPaymentMethod, setFinishedPaymentMethod] = useState("Cash")
  const [finishedCustomerId, setFinishedCustomerId] = useState("")
  const [finishedActionError, setFinishedActionError] = useState("")
  const [finishedActionNotice, setFinishedActionNotice] = useState("")
  const finishedActionLock = useRef(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [reconcileQuantity, setReconcileQuantity] = useState("")
  const [reconcileUnitCost, setReconcileUnitCost] = useState("")
  const [reconcileReason, setReconcileReason] = useState("")
  const [reconcileError, setReconcileError] = useState("")
  const [reconcileNotice, setReconcileNotice] = useState("")
  const reconcileLock = useRef(false)
  const availability = selectAvailableInventory(state, item.inventoryId)
  const planned = selectPlannedRequirement(state, item.inventoryId)
  const movements = state.inventoryMovements
    .filter((movement) => movement.inventoryId === item.inventoryId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const batches = state.finishedStockBatches
    .filter((batch) => batch.inventoryId === item.inventoryId)
    .sort((a, b) => finishedBatchDate(b).localeCompare(finishedBatchDate(a)))
  const transactions = state.finishedStockTransactions
    .filter((transaction) => transaction.inventoryId === item.inventoryId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const unbatchedLegacyQuantity =
    item.unbatchedLegacyQuantity ??
    item.physical -
      batches.reduce((sum, batch) => sum + batch.remainingQuantity, 0)

  const openFinishedAction = (action: "sale" | "write-off") => {
    setFinishedAction(action)
    setFinishedBatchId("")
    setFinishedQuantity("")
    setFinishedReason("")
    setFinishedSalePrice("")
    setFinishedPaymentMethod("Cash")
    setFinishedCustomerId("")
    setFinishedActionError("")
  }

  const closeFinishedAction = () => {
    if (finishedActionLock.current) return
    setFinishedAction(null)
    setFinishedActionError("")
  }

  const submitFinishedAction = () => {
    if (finishedActionLock.current || !finishedAction) return
    const batch = batches.find((candidate) => candidate.id === finishedBatchId)
    if (!batch) {
      setFinishedActionError("Select a finished-stock batch.")
      return
    }
    if (!/^\d+$/.test(finishedQuantity)) {
      setFinishedActionError("Enter a positive whole-unit quantity.")
      return
    }
    const amount = Number(finishedQuantity)
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > batch.remainingQuantity
    ) {
      setFinishedActionError(
        `Enter a whole-unit quantity from 1 to ${batch.remainingQuantity}.`,
      )
      return
    }
    if (finishedAction === "write-off" && !finishedReason.trim()) {
      setFinishedActionError("Enter a reason for writing off this stock.")
      return
    }
    let parsedSellingPrice: number | undefined
    if (finishedAction === "sale" && finishedSalePrice.trim() !== "") {
      if (!/^\d+$/.test(finishedSalePrice.trim())) {
        setFinishedActionError(
          "Enter a whole LKR selling price or leave blank.",
        )
        return
      }
      parsedSellingPrice = Number(finishedSalePrice.trim())
      if (!Number.isSafeInteger(parsedSellingPrice) || parsedSellingPrice < 0) {
        setFinishedActionError("Enter a valid whole LKR selling price.")
        return
      }
    }
    const unitCost =
      batch.source === "production" ? batch.actualUnitCost : batch.unitCost
    const stockCost = amount * unitCost
    const transactionId = createId(`finished-${finishedAction}`)
    finishedActionLock.current = true
    const accepted =
      finishedAction === "sale"
        ? dispatchIfAccepted({
            type: "SELL_FINISHED_STOCK",
            transactionId,
            batchId: batch.id,
            quantity: amount,
            ...(parsedSellingPrice !== undefined
              ? { sellingPrice: parsedSellingPrice }
              : {}),
            ...(finishedCustomerId ? { customerId: finishedCustomerId } : {}),
            paymentMethod: finishedPaymentMethod,
          })
        : dispatchIfAccepted({
            type: "WRITE_OFF_FINISHED_STOCK",
            transactionId,
            batchId: batch.id,
            quantity: amount,
            reason: finishedReason.trim(),
          })
    finishedActionLock.current = false
    if (!accepted) {
      setFinishedActionError(
        "This transaction was not recorded. The batch or inventory may have changed; review the current balance and try again.",
      )
      return
    }
    const summaryText =
      finishedAction === "sale"
        ? parsedSellingPrice !== undefined
          ? `Sale recorded · ${formatLkr(parsedSellingPrice)} (${finishedPaymentMethod}) · stock cost ${formatLkr(stockCost)}.`
          : `Sale recorded · stock cost ${formatLkr(stockCost)}.`
        : `Write-off recorded · stock cost ${formatLkr(stockCost)}.`
    setFinishedActionNotice(
      `${summaryText} A separate inventory movement was recorded.`,
    )
    showToast({ message: summaryText, tone: "success" })
    setFinishedAction(null)
    setFinishedActionError("")
  }

  const openReconciliation = () => {
    setReconcileQuantity("")
    setReconcileUnitCost("")
    setReconcileReason("")
    setReconcileError("")
    setReconcileOpen(true)
  }

  const closeReconciliation = () => {
    if (reconcileLock.current) return
    setReconcileOpen(false)
  }

  const submitReconciliation = () => {
    if (reconcileLock.current) return
    if (!/^\d+$/.test(reconcileQuantity)) {
      setReconcileError("Enter a positive whole-unit quantity.")
      return
    }
    const amount = Number(reconcileQuantity)
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > unbatchedLegacyQuantity
    ) {
      setReconcileError(
        `Enter a whole-unit quantity from 1 to ${unbatchedLegacyQuantity}.`,
      )
      return
    }
    if (
      reconcileUnitCost.trim() === "" ||
      !/^(?:\d+\.?\d*|\.\d+)$/.test(reconcileUnitCost) ||
      !Number.isFinite(Number(reconcileUnitCost)) ||
      Number(reconcileUnitCost) < 0
    ) {
      setReconcileError(
        "Enter an explicit finite unit cost of zero or greater.",
      )
      return
    }
    if (!reconcileReason.trim()) {
      setReconcileError("Enter a reason for reconciling this legacy stock.")
      return
    }

    const batchId = createId("legacy-batch")
    reconcileLock.current = true
    const accepted = dispatchIfAccepted({
      type: "RECONCILE_LEGACY_FINISHED_STOCK",
      batchId,
      inventoryId: item.inventoryId,
      quantity: amount,
      unitCost: Number(reconcileUnitCost),
      reason: reconcileReason.trim(),
    })
    reconcileLock.current = false
    if (!accepted) {
      setReconcileError(
        "The stock was not reconciled. Its inventory balance or unbatched quantity may have changed; review the current values and try again.",
      )
      return
    }
    setReconcileOpen(false)
    setReconcileError("")
    setReconcileNotice(
      `${formatQuantity(amount, "unit")} reconciled into legacy-opening batch ${batchId}. Physical stock did not change.`,
    )
  }

  const resetAdjustment = () => {
    setAdjustmentId(createId("movement-adjust"))
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
      <div className="pb-6">
        <ScreenHeader
          eyebrow={inventoryCategory(item)}
          title={item.name}
          subtitle={`Base unit · ${item.unit}`}
          onBack={onBack}
          backLabel="Back to inventory"
          action={
            inventoryCategory(item) !== "finished" ? (
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<Pencil aria-hidden="true" size={15} />}
                onClick={() => setItemSheetOpen(true)}
              >
                Edit
              </Button>
            ) : undefined
          }
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
            <>
              <Button
                variant="secondary"
                leadingIcon={<ShoppingBasket aria-hidden="true" size={17} />}
                disabled={!batches.some((batch) => batch.remainingQuantity > 0)}
                onClick={() => openFinishedAction("sale")}
              >
                Sell batch stock
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<Trash2 aria-hidden="true" size={17} />}
                disabled={!batches.some((batch) => batch.remainingQuantity > 0)}
                onClick={() => openFinishedAction("write-off")}
              >
                Write off
              </Button>
            </>
          )}
          {inventoryCategory(item) !== "finished" ? (
            <Button
              leadingIcon={<SlidersHorizontal aria-hidden="true" size={17} />}
              onClick={() => setAdjustOpen(true)}
            >
              Adjust
            </Button>
          ) : null}
        </div>

        {finishedActionNotice ? (
          <Card tone="sage" className="mt-4" role="status">
            <p className="text-sm font-semibold text-cocoa">
              {finishedActionNotice}
            </p>
          </Card>
        ) : null}

        {inventoryCategory(item) === "finished" ? (
          <>
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-semibold text-cocoa">
                  Finished-stock batches
                </div>
                <StatusBadge tone="neutral">{batches.length}</StatusBadge>
              </div>
              <Card className="divide-y divide-warm-border p-0">
                {batches.map((batch) => {
                  const production =
                    batch.source === "production" ? batch : undefined
                  const product = production
                    ? state.products.find(
                        (candidate) => candidate.id === production.productId,
                      )
                    : undefined
                  const variant = product?.variants.find(
                    (candidate) => candidate.id === production?.variantId,
                  )
                  const unitCost =
                    batch.source === "production"
                      ? batch.actualUnitCost
                      : batch.unitCost
                  return (
                    <div key={batch.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-cocoa">
                            {production
                              ? `${product?.name ?? "Product unavailable"} · ${variant?.name ?? "Variant unavailable"}`
                              : "Legacy opening batch"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-sage-dark">
                            {production
                              ? "Production batch"
                              : "Reconciled legacy stock"}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {batch.source === "production"
                              ? `Batch ${batch.id} · Plan ${batch.planId} · ${formatDate(batch.preparedAt.slice(0, 10))}`
                              : `Batch ${batch.id} · Reconciled ${formatDate(batch.reconciledAt.slice(0, 10))}`}
                          </p>
                          {batch.source === "production" ? (
                            <p className="mt-1 text-xs text-muted">
                              Produced{" "}
                              {formatQuantity(batch.producedQuantity, "unit")}
                              {batch.bestBefore
                                ? ` · Best before ${formatDate(batch.bestBefore)}`
                                : ""}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-muted">
                              Reconciled{" "}
                              {formatQuantity(batch.reconciledQuantity, "unit")}
                              {" · "}
                              {batch.reconciliationReason}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-right text-xs text-muted">
                          Unit stock cost
                          <span className="mt-1 block font-semibold text-cocoa">
                            {formatLkr(unitCost)} / unit
                          </span>
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between rounded-control bg-ivory px-3 py-2 text-sm">
                        <span className="text-muted">Remaining</span>
                        <span className="font-semibold text-cocoa">
                          {formatQuantity(batch.remainingQuantity, "unit")}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {!batches.length ? (
                  <div className="p-4 text-sm text-muted">
                    No finished-stock batches are recorded for this item.
                  </div>
                ) : null}
              </Card>
              <Card className="mt-3" aria-label="Unbatched legacy stock">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-cocoa">
                      Unbatched legacy stock
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Reconciliation changes tracking representation only. It
                      does not add physical stock or record a production run or
                      purchase.
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-cocoa">
                    {formatQuantity(unbatchedLegacyQuantity, "unit")}
                  </span>
                </div>
                {reconcileNotice ? (
                  <p
                    className="mt-3 rounded-control bg-sage-soft p-3 text-sm text-sage-dark"
                    role="status"
                  >
                    {reconcileNotice}
                  </p>
                ) : null}
                {unbatchedLegacyQuantity > 0 ? (
                  <Button
                    className="mt-3"
                    fullWidth
                    variant="secondary"
                    leadingIcon={<Boxes aria-hidden="true" size={17} />}
                    onClick={openReconciliation}
                  >
                    Reconcile into a batch
                  </Button>
                ) : (
                  <p className="mt-3 text-xs font-medium text-success">
                    All physical stock is assigned to batches.
                  </p>
                )}
              </Card>
            </section>

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-semibold text-cocoa">
                  Finished-stock transactions
                </div>
                <StatusBadge tone="neutral">{transactions.length}</StatusBadge>
              </div>
              <Card className="divide-y divide-warm-border p-0">
                {transactions.map((transaction) => {
                  const batch = state.finishedStockBatches.find(
                    (candidate) => candidate.id === transaction.batchId,
                  )
                  return (
                    <div key={transaction.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-cocoa">
                            {transaction.type === "sale"
                              ? "Finished-stock sale"
                              : "Finished-stock write-off"}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {formatDate(transaction.occurredAt.slice(0, 10))} ·{" "}
                            {formatQuantity(transaction.quantity, "unit")} ·{" "}
                            {batch?.source === "production"
                              ? `Production batch ${batch.id}`
                              : batch
                                ? `Legacy-opening batch ${batch.id}`
                                : `Batch ${transaction.batchId}`}
                          </p>
                          {transaction.type === "sale" &&
                          (transaction.sellingPrice !== undefined ||
                            transaction.customerName ||
                            transaction.paymentMethod) ? (
                            <p className="mt-1 text-xs font-medium text-sage-dark">
                              {transaction.sellingPrice !== undefined
                                ? `Sold for ${formatLkr(transaction.sellingPrice)}`
                                : "Sale recorded"}
                              {transaction.paymentMethod
                                ? ` · ${transaction.paymentMethod}`
                                : ""}
                              {transaction.customerName
                                ? ` · ${transaction.customerName}`
                                : ""}
                            </p>
                          ) : null}
                          {transaction.type === "write-off" ? (
                            <p className="mt-1 text-xs text-muted">
                              Reason: {transaction.reason}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-right text-xs text-muted">
                          Stock cost
                          <span className="mt-1 block font-semibold text-cocoa">
                            {formatLkr(transaction.totalCost)}
                          </span>
                          <span className="mt-0.5 block">
                            {formatLkr(transaction.unitCost)} / unit
                          </span>
                        </p>
                      </div>
                      <p className="mt-3 flex items-center gap-1.5 border-t border-warm-border pt-2 text-xs text-sage-dark">
                        <ReceiptText aria-hidden="true" size={14} />
                        Movement{" "}
                        <span className="font-semibold">
                          movement-finished-{transaction.type}-{transaction.id}
                        </span>{" "}
                        is listed separately in Movement history.
                      </p>
                    </div>
                  )
                })}
                {!transactions.length ? (
                  <div className="p-4 text-sm text-muted">
                    No finished-stock sales or write-offs are recorded yet.
                  </div>
                ) : null}
              </Card>
            </section>
          </>
        ) : null}

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
        open={reconcileOpen}
        title="Reconcile legacy finished stock"
        description={`${item.name} · ${formatQuantity(unbatchedLegacyQuantity, "unit")} remains unbatched.`}
        onClose={closeReconciliation}
        footer={
          <div className="space-y-2">
            <Button
              fullWidth
              disabled={reconcileLock.current}
              onClick={submitReconciliation}
            >
              Create legacy-opening batch
            </Button>
            <Button fullWidth variant="ghost" onClick={closeReconciliation}>
              Cancel
            </Button>
          </div>
        }
      >
        <div className="max-h-dialog-content space-y-4 overflow-y-auto pr-1">
          {reconcileError ? (
            <div
              className="flex items-start gap-2 rounded-control bg-warning-soft p-3 text-sm text-cocoa"
              role="alert"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-warning"
                size={17}
              />
              {reconcileError}
            </div>
          ) : null}
          <Card tone="sage">
            <p className="text-sm font-semibold text-cocoa">
              Tracking change only
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              The selected quantity moves from unbatched legacy tracking into a
              legacy-opening batch. Physical stock remains unchanged. This does
              not represent new production or a purchase.
            </p>
          </Card>
          <Field
            label="Quantity to reconcile (whole units)"
            type="number"
            min="1"
            max={unbatchedLegacyQuantity}
            step="1"
            inputMode="numeric"
            value={reconcileQuantity}
            onChange={(event) => {
              setReconcileQuantity(event.target.value)
              setReconcileError("")
            }}
            helperText={`Maximum ${formatQuantity(unbatchedLegacyQuantity, "unit")}`}
          />
          <Field
            label="Explicit unit stock cost (LKR)"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={reconcileUnitCost}
            onChange={(event) => {
              setReconcileUnitCost(event.target.value)
              setReconcileError("")
            }}
            helperText="Enter the cost you explicitly want associated with this batch; zero is allowed."
          />
          <TextAreaField
            label="Reconciliation reason"
            placeholder="For example, counted and costed during stocktake"
            value={reconcileReason}
            onChange={(event) => {
              setReconcileReason(event.target.value)
              setReconcileError("")
            }}
          />
        </div>
      </Dialog>

      <Dialog
        open={finishedAction !== null}
        title={
          finishedAction === "sale"
            ? "Sell from finished-stock batch"
            : "Write off finished-stock batch"
        }
        description={`${item.name} · Select a batch and record whole units only.`}
        onClose={closeFinishedAction}
        footer={
          <div className="space-y-2">
            <Button
              fullWidth
              disabled={finishedActionLock.current}
              onClick={submitFinishedAction}
            >
              {finishedAction === "sale" ? "Record sale" : "Record write-off"}
            </Button>
            <Button fullWidth variant="ghost" onClick={closeFinishedAction}>
              Cancel
            </Button>
          </div>
        }
      >
        <div className="max-h-dialog-content space-y-4 overflow-y-auto pr-1">
          {finishedActionError ? (
            <div
              className="flex items-start gap-2 rounded-control bg-warning-soft p-3 text-sm text-cocoa"
              role="alert"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-warning"
                size={17}
              />
              {finishedActionError}
            </div>
          ) : null}
          <SelectField
            label="Finished-stock batch"
            value={finishedBatchId}
            onChange={(event) => {
              setFinishedBatchId(event.target.value)
              setFinishedActionError("")
            }}
            options={[
              { value: "", label: "Select a batch" },
              ...batches
                .filter((batch) => batch.remainingQuantity > 0)
                .map((batch) => ({
                  value: batch.id,
                  label: `${
                    batch.source === "production"
                      ? "Production"
                      : "Legacy opening"
                  } · ${batch.id} · ${batch.remainingQuantity} units remaining`,
                })),
            ]}
          />
          <Field
            label="Quantity (whole units)"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={finishedQuantity}
            onChange={(event) => {
              setFinishedQuantity(event.target.value)
              setFinishedActionError("")
            }}
            helperText={
              batches.find((batch) => batch.id === finishedBatchId)
                ? `Selected batch balance: ${batches.find(
                    (batch) => batch.id === finishedBatchId,
                  )?.remainingQuantity} units`
                : "Choose a batch first."
            }
          />
          {finishedAction === "sale" ? (
            <>
              <Field
                label="Selling price (LKR, optional)"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="Whole LKR collected for this sale"
                value={finishedSalePrice}
                onChange={(event) => {
                  setFinishedSalePrice(event.target.value)
                  setFinishedActionError("")
                }}
              />
              <SelectField
                label="Payment method"
                value={finishedPaymentMethod}
                onChange={(event) => {
                  setFinishedPaymentMethod(event.target.value)
                  setFinishedActionError("")
                }}
                options={[
                  { value: "Cash", label: "Cash" },
                  { value: "Bank transfer", label: "Bank transfer" },
                  { value: "Card", label: "Card" },
                ]}
              />
              <SelectField
                label="Customer (optional)"
                value={finishedCustomerId}
                onChange={(event) => {
                  setFinishedCustomerId(event.target.value)
                  setFinishedActionError("")
                }}
                options={[
                  { value: "", label: "Walk-in / direct sale" },
                  ...state.customers.map((customer) => ({
                    value: customer.id,
                    label: customer.name,
                  })),
                ]}
              />
            </>
          ) : null}
          {finishedAction === "write-off" ? (
            <TextAreaField
              label="Write-off reason"
              placeholder="For example, damaged during storage"
              value={finishedReason}
              onChange={(event) => {
                setFinishedReason(event.target.value)
                setFinishedActionError("")
              }}
            />
          ) : null}
          {finishedBatchId && /^\d+$/.test(finishedQuantity) ? (
            <Card tone="sage">
              <p className="text-sm text-cocoa">
                Estimated stock cost{" "}
                <span className="font-semibold">
                  {formatLkr(
                    Number(finishedQuantity) *
                      (() => {
                        const batch = batches.find(
                          (candidate) => candidate.id === finishedBatchId,
                        )
                        if (!batch) return 0
                        return batch.source === "production"
                          ? batch.actualUnitCost
                          : batch.unitCost
                      })(),
                  )}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {finishedAction === "sale" &&
                finishedSalePrice.trim() !== "" &&
                /^\d+$/.test(finishedSalePrice.trim())
                  ? `Estimated gross margin: ${formatLkr(
                      Number(finishedSalePrice.trim()) -
                        Number(finishedQuantity) *
                          (() => {
                            const batch = batches.find(
                              (candidate) => candidate.id === finishedBatchId,
                            )
                            if (!batch) return 0
                            return batch.source === "production"
                              ? batch.actualUnitCost
                              : batch.unitCost
                          })(),
                    )}`
                  : "Enter a selling price above to track sale revenue separately from batch stock cost."}
              </p>
            </Card>
          ) : null}
        </div>
      </Dialog>

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

      <InventoryItemSheet
        open={itemSheetOpen}
        item={item}
        onClose={() => setItemSheetOpen(false)}
      />
    </>
  )
}
