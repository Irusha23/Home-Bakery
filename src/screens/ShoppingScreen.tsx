import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  CircleCheck,
  PackagePlus,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button, { IconButton } from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import SegmentedControl from "../components/ui/SegmentedControl"
import StatusBadge from "../components/ui/StatusBadge"
import { formatDate, formatLkr, formatQuantity } from "../lib/format"
import { inventoryCategory, selectShoppingRequirements } from "../lib/inventory"
import { useAppState } from "../state/AppState"
import type {
  ExtraStockPlan,
  ShoppingRequirement,
  StarterAction,
} from "../types"
import ExtraStockPlanForm from "./ExtraStockPlanForm"
import PurchaseForm from "./PurchaseForm"

type ShoppingCategory = "ingredient" | "packaging"
type View = "list" | "plan" | "purchase"

type ShoppingScreenProps = {
  starterAction: StarterAction | null
  onConsumeStarterAction: () => void
  onFocusedChange: (focused: boolean) => void
  onOpenInventory: (inventoryId?: string) => void
}

function requirementTone(item: ShoppingRequirement, low: boolean) {
  if (item.shortage > 0) return "warning" as const
  if (low) return "progress" as const
  return "success" as const
}

export default function ShoppingScreen({
  starterAction,
  onConsumeStarterAction,
  onFocusedChange,
  onOpenInventory,
}: ShoppingScreenProps) {
  const { state, dispatch } = useAppState()
  const [view, setView] = useState<View>("list")
  const [category, setCategory] = useState<ShoppingCategory>("ingredient")
  const [search, setSearch] = useState("")
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [purchaseInventoryId, setPurchaseInventoryId] =
    useState<string | undefined>()
  const [purchaseCompleteId, setPurchaseCompleteId] = useState<string | null>(
    null,
  )
  const consumedAction = useRef<StarterAction | null>(null)

  useEffect(() => {
    if (!starterAction || consumedAction.current === starterAction) return
    consumedAction.current = starterAction
    onConsumeStarterAction()
  }, [starterAction, onConsumeStarterAction])

  useEffect(() => {
    onFocusedChange(view !== "list")
    return () => onFocusedChange(false)
  }, [view, onFocusedChange])

  const requirements = useMemo(() => selectShoppingRequirements(state), [state])
  const visibleRequirements = requirements.filter((item) => {
    const matchesCategory = item.category === category
    const query = search.trim().toLowerCase()
    return (
      matchesCategory && (!query || item.name.toLowerCase().includes(query))
    )
  })
  const shortageCount = requirements.filter((item) => item.shortage > 0).length
  const totalSelected = requirements.reduce(
    (sum, item) => sum + (item.selectedPurchase > 0 ? 1 : 0),
    0,
  )
  const editingPlan = state.extraStockPlans.find(
    (plan) => plan.id === editingPlanId,
  )

  if (view === "plan") {
    return (
      <ExtraStockPlanForm
        plan={editingPlan}
        onCancel={() => {
          setEditingPlanId(null)
          setView("list")
        }}
        onComplete={() => {
          setEditingPlanId(null)
          setView("list")
        }}
      />
    )
  }

  if (view === "purchase") {
    return (
      <PurchaseForm
        initialInventoryId={purchaseInventoryId}
        onCancel={() => setView("list")}
        onComplete={(inventoryId) => {
          setPurchaseCompleteId(inventoryId)
          setView("list")
        }}
      />
    )
  }

  const openPurchase = (inventoryId?: string) => {
    setPurchaseInventoryId(inventoryId)
    setView("purchase")
  }

  return (
    <div className="px-page pb-6">
      <ScreenHeader
        eyebrow="Consolidated planner"
        title="Shopping"
        subtitle="Orders and future stock"
        action={
          <Button
            size="compact"
            leadingIcon={<Plus aria-hidden="true" size={16} />}
            onClick={() => {
              setEditingPlanId(null)
              setView("plan")
            }}
          >
            Plan
          </Button>
        }
      />

      {purchaseCompleteId ? (
        <Card tone="sage" className="mt-4 flex items-center gap-3">
          <CircleCheck
            aria-hidden="true"
            className="shrink-0 text-success"
            size={20}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-cocoa">
              Purchase recorded once
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Physical and available stock updated.
            </p>
          </div>
          <Button
            size="compact"
            variant="secondary"
            onClick={() => onOpenInventory(purchaseCompleteId)}
          >
            Inventory
          </Button>
        </Card>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-cocoa">
            {requirements.length}
          </p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">Items</p>
        </Card>
        <Card
          tone={shortageCount ? "warning" : "sage"}
          className="p-3 text-center"
        >
          <p
            className={`text-xl font-bold tabular-nums ${
              shortageCount ? "text-warning" : "text-success"
            }`}
          >
            {shortageCount}
          </p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">Short</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-sage-dark">
            {totalSelected}
          </p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">To buy</p>
        </Card>
      </div>

      {state.extraStockPlans.length ? (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-semibold text-cocoa">
              Extra-stock plans
            </div>
            <StatusBadge tone="progress">
              {state.extraStockPlans.length}
            </StatusBadge>
          </div>
          <div className="space-y-2">
            {state.extraStockPlans.map((plan) => (
              <ExtraStockPlanRow
                key={plan.id}
                plan={plan}
                onEdit={() => {
                  setEditingPlanId(plan.id)
                  setView("plan")
                }}
                onRemove={() =>
                  dispatch({
                    type: "REMOVE_EXTRA_STOCK_PLAN",
                    planId: plan.id,
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-5">
        <Field
          label="Search shopping items"
          hideLabel
          isSearch
          placeholder="Search ingredients or packaging"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="mt-3">
        <SegmentedControl
          label="Shopping category"
          value={category}
          segments={[
            { value: "ingredient", label: "Ingredients" },
            { value: "packaging", label: "Packaging" },
          ]}
          onChange={setCategory}
        />
      </div>

      <section className="mt-4 space-y-3">
        {visibleRequirements.length ? (
          visibleRequirements.map((item) => (
            <RequirementCard
              key={item.inventoryId}
              item={item}
              low={
                item.shortage === 0 &&
                item.available <=
                  (state.inventory.find(
                    (entry) => entry.inventoryId === item.inventoryId,
                  )?.lowStockThreshold ?? 0)
              }
              onQuantityChange={(quantity) =>
                dispatch({
                  type: "SET_PURCHASE_QUANTITY",
                  inventoryId: item.inventoryId,
                  quantity,
                })
              }
              onPurchase={() => openPurchase(item.inventoryId)}
            />
          ))
        ) : (
          <Card className="py-8 text-center">
            <CircleCheck
              aria-hidden="true"
              className="mx-auto text-success"
              size={25}
            />
            <p className="mt-3 text-sm font-semibold text-cocoa">
              Nothing required in this category
            </p>
          </Card>
        )}
      </section>

      <div className="mt-5">
        <Button
          fullWidth
          variant="secondary"
          leadingIcon={<PackagePlus aria-hidden="true" size={17} />}
          onClick={() => openPurchase()}
        >
          Record another purchase
        </Button>
      </div>

      <details className="mt-4 rounded-card border border-warm-border bg-white shadow-subtle">
        <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-cocoa">
          <span className="flex items-center gap-2">
            <ReceiptText aria-hidden="true" className="text-sage" size={17} />
            Purchase history
          </span>
          <span className="text-xs text-muted">{state.purchases.length}</span>
        </summary>
        <div className="divide-y divide-warm-border border-t border-warm-border">
          {state.purchases.length ? (
            state.purchases.map((purchase) => {
              const item = state.inventory.find(
                (entry) => entry.inventoryId === purchase.inventoryId,
              )
              return (
                <div key={purchase.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-cocoa">
                        {item?.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(purchase.date)} · Usable{" "}
                        {formatQuantity(
                          purchase.usableBaseQuantity,
                          item?.unit ?? "unit",
                        )}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-cocoa">
                      {formatLkr(purchase.totalPrice)}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="p-4 text-sm text-muted">No purchases recorded yet.</p>
          )}
        </div>
      </details>
    </div>
  )
}

type ExtraStockPlanRowProps = {
  plan: ExtraStockPlan
  onEdit: () => void
  onRemove: () => void
}

function ExtraStockPlanRow({ plan, onEdit, onRemove }: ExtraStockPlanRowProps) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-sage-soft text-sage-dark">
        <PackagePlus aria-hidden="true" size={19} />
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-sm font-semibold text-cocoa">
          {plan.recipeSnapshot.name}
        </span>
        <span className="mt-0.5 block text-xs text-muted">
          Qty {plan.quantity} · Recipe v{plan.recipeSnapshot.version}
          {plan.bestBefore
            ? ` · Best before ${formatDate(plan.bestBefore)}`
            : ""}
        </span>
      </button>
      <IconButton
        label={`Remove ${plan.recipeSnapshot.name} plan`}
        className="size-9 border-error/20 text-error shadow-none"
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" size={16} />
      </IconButton>
    </Card>
  )
}

type RequirementCardProps = {
  item: ShoppingRequirement
  low: boolean
  onQuantityChange: (quantity: number) => void
  onPurchase: () => void
}

function RequirementCard({
  item,
  low,
  onQuantityChange,
  onPurchase,
}: RequirementCardProps) {
  return (
    <Card className="p-0">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cocoa">{item.name}</p>
            <p className="mt-1 text-xs text-muted">
              Available {formatQuantity(item.available, item.unit)}
            </p>
          </div>
          <StatusBadge tone={requirementTone(item, low)}>
            {item.shortage > 0
              ? `Short ${formatQuantity(item.shortage, item.unit)}`
              : low
                ? "Low"
                : "Sufficient"}
          </StatusBadge>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-control bg-ivory p-3 text-center">
          <div>
            <p className="text-nav font-bold uppercase text-muted">Required</p>
            <p className="mt-1 text-xs font-semibold text-cocoa">
              {formatQuantity(item.required, item.unit)}
            </p>
          </div>
          <div className="border-x border-warm-border">
            <p className="text-nav font-bold uppercase text-muted">Physical</p>
            <p className="mt-1 text-xs font-semibold text-cocoa">
              {formatQuantity(item.physical, item.unit)}
            </p>
          </div>
          <div>
            <p className="text-nav font-bold uppercase text-muted">Reserved</p>
            <p className="mt-1 text-xs font-semibold text-cocoa">
              {formatQuantity(item.reserved, item.unit)}
            </p>
          </div>
        </div>

        <details className="mt-3">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-xs font-semibold text-sage-dark">
            Demand sources
            <ChevronDown aria-hidden="true" size={16} />
          </summary>
          <div className="divide-y divide-warm-border rounded-control border border-warm-border">
            {item.sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between gap-3 p-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-cocoa">{source.label}</p>
                  <p className="mt-0.5 text-muted">
                    {source.type === "customer-order"
                      ? `Customer order · ${source.reference}`
                      : "Extra-stock plan"}
                  </p>
                </div>
                <p className="font-semibold text-cocoa">
                  {formatQuantity(source.quantity, item.unit)}
                </p>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="grid grid-cols-purchase-action items-end gap-3 border-t border-warm-border bg-neutral-soft/60 p-3">
        <Field
          label={`Purchase quantity (${item.unit})`}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={item.selectedPurchase}
          onChange={(event) =>
            onQuantityChange(Math.max(0, Number(event.target.value)))
          }
          helperText={`Suggested ${formatQuantity(
            item.suggestedPurchase,
            item.unit,
          )}`}
        />
        <Button size="compact" onClick={onPurchase}>
          Record
        </Button>
      </div>
    </Card>
  )
}
