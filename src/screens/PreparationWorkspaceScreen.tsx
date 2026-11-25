import { useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCheck,
  ChefHat,
  ClipboardCheck,
  Clock3,
  Flame,
  ShoppingBag,
} from "lucide-react"
import KitchenModeOverlay from "../components/domain/KitchenModeOverlay"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import CountdownBadge from "../components/ui/CountdownBadge"
import ItemThumbnail from "../components/ui/ItemThumbnail"
import StatusBadge from "../components/ui/StatusBadge"
import { useToast } from "../components/ui/Toast"
import { getBakeTargetMs } from "../lib/countdown"
import {
  formatDate,
  formatDualQuantity,
  formatLkr,
  formatQuantity,
  formatTime,
} from "../lib/format"
import {
  hasUnpurchasedShoppingItems,
  isUsageInPantry,
} from "../lib/inventory"
import { useAppState } from "../state/AppState"
import type { PreparationProductStatus } from "../types"

type PreparationWorkspaceProps = {
  onBack: () => void
  onSelect: (preparationId: string) => void
}

function preparationTone(status: PreparationProductStatus) {
  if (status === "Ready") return "success" as const
  if (status === "In progress") return "progress" as const
  return "warning" as const
}

export default function PreparationWorkspaceScreen({
  onBack,
  onSelect,
}: PreparationWorkspaceProps) {
  const { state } = useAppState()
  const records = state.preparationRecords
    .filter((record) => {
      const order = state.orders.find((item) => item.id === record.orderId)
      return (
        order &&
        order.status !== "Cancelled" &&
        order.status !== "Completed" &&
        order.status !== "Draft"
      )
    })
    .sort((a, b) => {
      const orderA = state.orders.find((item) => item.id === a.orderId)
      const orderB = state.orders.find((item) => item.id === b.orderId)
      return `${orderA?.collectionDate}${orderA?.collectionTime}`.localeCompare(
        `${orderB?.collectionDate}${orderB?.collectionTime}`,
      )
    })
  const ready = records.filter((record) => record.status === "Ready").length
  const inProgress = records.filter(
    (record) => record.status === "In progress",
  ).length

  return (
    <div className="space-y-4 pb-6">
      <ScreenHeader
        title="Prep queue"
        subtitle={`${records.length - ready} active`}
        onBack={onBack}
        backLabel="Back to orders"
      />

      <div className="grid grid-cols-3 gap-2">
        <Card tone="warning" className="p-3 text-center">
          <p className="text-xl font-bold text-warning">
            {records.length - ready - inProgress}
          </p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">
            To start
          </p>
        </Card>
        <Card tone="sage" className="p-3 text-center">
          <p className="text-xl font-bold text-sage-dark">{inProgress}</p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">Preparing</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xl font-bold text-success">{ready}</p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">Ready</p>
        </Card>
      </div>

      <div className="space-y-3">
        {records.map((record) => {
          const order = state.orders.find((item) => item.id === record.orderId)
          const line = order?.lines.find(
            (item) => item.id === record.orderLineId,
          )
          if (!order || !line) return null
          const toBuyCount = record.actualUsage.filter(
            (u) => !isUsageInPantry(order, record, u),
          ).length

          return (
            <button
              key={record.id}
              type="button"
              onClick={() => onSelect(record.id)}
              className="w-full rounded-card border border-warm-border bg-white p-4 text-left shadow-subtle transition hover:border-sage-border"
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-cocoa">
                    {line.productName}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {line.variantName} · Qty {line.quantity}
                  </span>
                </span>
                <StatusBadge tone={preparationTone(record.status)}>
                  {record.status}
                </StatusBadge>
              </span>
              <span className="mt-3 flex items-center justify-between gap-3 border-t border-warm-border pt-3">
                <span>
                  <span className="block text-xs font-semibold text-cocoa">
                    {order.customerName} · {order.reference}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <CalendarDays aria-hidden="true" size={13} />
                    {formatDate(order.collectionDate)}
                    <Clock3 aria-hidden="true" className="ml-1" size={13} />
                    {formatTime(order.collectionTime)}
                  </span>
                </span>
                {toBuyCount > 0 && record.status !== "Ready" ? (
                  <StatusBadge tone="warning">
                    Shop first ({toBuyCount})
                  </StatusBadge>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PreparationProductScreen({
  preparationId,
  onBack,
  onOpenShopping,
}: {
  preparationId: string
  onBack: () => void
  onOpenShopping?: () => void
}) {
  const { state, dispatch, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()
  const [kitchenOpen, setKitchenOpen] = useState(false)

  const record = state.preparationRecords.find(
    (item) => item.id === preparationId,
  )
  const order = state.orders.find((item) => item.id === record?.orderId)
  const line = order?.lines.find((item) => item.id === record?.orderLineId)

  if (!record || !order || !line) {
    return (
      <div className="py-2">
        <ScreenHeader title="Preparation unavailable" onBack={onBack} />
      </div>
    )
  }

  const shortageItems = record.actualUsage.filter(
    (usage) => !isUsageInPantry(order, record, usage),
  )
  const hasShortages = hasUnpurchasedShoppingItems(order, record)
  const totalSteps = record.recipeSnapshot.instructions.length
  const allStepsChecked = record.recipeSnapshot.instructions.every(
    (_, index) => record.completedSteps.includes(index),
  )

  const finishBake = () => {
    if (!allStepsChecked) {
      showToast({
        message: "Check off all preparation steps before marking ready.",
        tone: "warning",
      })
      return
    }
    const accepted = dispatchIfAccepted({
      type: "FINISH_PREPARATION_SIMPLE",
      preparationId: record.id,
    })
    if (!accepted) {
      showToast({
        message: "Buy all shopping list items or check all steps before finishing.",
        tone: "warning",
      })
      return
    }
    showToast({ message: "Marked ready for pickup!", tone: "success" })
    onBack()
  }

  return (
    <>
      <div className="space-y-5 pb-6">
        <ScreenHeader
          eyebrow={`${order.reference} · ${order.customerName}`}
          title={line.productName}
          subtitle={`${line.variantName} · Qty ${line.quantity}`}
          onBack={onBack}
          backLabel="Back"
          compact
        />

        <Card tone="sage">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ItemThumbnail
                image={
                  record.recipeSnapshot.image ??
                  state.products.find((p) => p.id === line.productId)?.image
                }
                alt={line.productName}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-cocoa">
                  {record.recipeSnapshot.name}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {record.recipeSnapshot.preparationMinutes} mins prep ·{" "}
                  {record.actualUsage.length} items
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StatusBadge tone={preparationTone(record.status)}>
                {record.status}
              </StatusBadge>
              {record.status === "In progress" ? (
                <CountdownBadge
                  targetMs={getBakeTargetMs(
                    record.startedAt ?? record.updatedAt,
                    record.recipeSnapshot.preparationMinutes,
                  )}
                  overdueLabel="Time up"
                  urgentThresholdMs={15 * 60_000}
                />
              ) : null}
            </div>
          </div>
        </Card>

        {record.status === "Ready" ? (
          <ReadySummary record={record} onBack={onBack} />
        ) : (
          <>
            {record.status === "In progress" ? (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-cocoa">
                    Recipe
                  </h2>
                  <span className="text-xs text-muted">
                    {record.recipeSnapshot.yieldLabel}
                  </span>
                </div>
                <Card className="divide-y divide-warm-border p-0">
                  {record.actualUsage.map((usage) => {
                    const invItem = state.inventory.find(
                      (inv) => inv.inventoryId === usage.inventoryId,
                    )
                    return (
                      <div
                        key={usage.inventoryId}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <ItemThumbnail
                            image={invItem?.image}
                            alt={usage.name}
                            size="sm"
                          />
                          <span className="truncate text-sm font-medium text-cocoa">
                            {usage.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
                          {(() => {
                            const dual = formatDualQuantity(
                              usage.plannedQuantity,
                              usage.unit,
                              invItem,
                            )
                            return dual.secondary
                              ? `${dual.primary} (${dual.secondary})`
                              : dual.primary
                          })()}
                        </span>
                      </div>
                    )
                  })}
                </Card>
              </section>
            ) : (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-cocoa">
                      1. Pantry checklist
                    </h2>
                    <p className="text-xs text-muted">
                      Add missing items to your shopping list before starting.
                    </p>
                  </div>
                  <Button
                    size="compact"
                    variant="secondary"
                    leadingIcon={
                      <CheckCheck
                        aria-hidden="true"
                        size={14}
                        className="text-success"
                      />
                    }
                    onClick={() => {
                      dispatch({
                        type: "MARK_ALL_PANTRY_CHECKLIST",
                        preparationId: record.id,
                        inPantry: true,
                      })
                      showToast("All items marked in pantry")
                    }}
                  >
                    All ready
                  </Button>
                </div>

                {hasShortages ? (
                  <Card tone="warning" className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          aria-hidden="true"
                          size={17}
                          className="mt-0.5 shrink-0 text-warning"
                        />
                        <div>
                          <p className="text-xs font-semibold text-cocoa">
                            Buy {shortageItems.length}{" "}
                            {shortageItems.length === 1 ? "item" : "items"} before
                            preparing
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            Preparation is locked until all missing items are bought or
                            marked In pantry.
                          </p>
                        </div>
                      </div>
                    </div>
                    {onOpenShopping ? (
                      <Button
                        fullWidth
                        size="compact"
                        variant="secondary"
                        leadingIcon={<ShoppingBag aria-hidden="true" size={14} />}
                        onClick={onOpenShopping}
                      >
                        To buy ({shortageItems.length})
                      </Button>
                    ) : null}
                  </Card>
                ) : null}

                <Card className="divide-y divide-warm-border p-0">
                  {record.actualUsage.map((usage) => {
                    const inPantry = isUsageInPantry(order, record, usage)
                    const invItem = state.inventory.find(
                      (inv) => inv.inventoryId === usage.inventoryId,
                    )
                    return (
                      <div
                        key={usage.inventoryId}
                        className="flex items-center justify-between gap-3 p-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <ItemThumbnail
                            image={invItem?.image}
                            alt={usage.name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-cocoa">
                              {usage.name}
                            </div>
                            <div className="text-xs text-muted">
                              {(() => {
                                const dual = formatDualQuantity(
                                  usage.plannedQuantity,
                                  usage.unit,
                                  invItem,
                                )
                                return dual.secondary
                                  ? `${dual.primary} (${dual.secondary})`
                                  : dual.primary
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="inline-flex shrink-0 rounded-full border border-warm-border bg-ivory p-0.5 text-xs font-semibold">
                          <button
                            type="button"
                            aria-label={`${usage.name} in pantry`}
                            onClick={() =>
                              dispatch({
                                type: "SET_PANTRY_CHECKLIST_ITEM",
                                preparationId: record.id,
                                inventoryId: usage.inventoryId,
                                inPantry: true,
                              })
                            }
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                              inPantry
                                ? "bg-success text-white shadow-subtle"
                                : "text-muted hover:text-cocoa"
                            }`}
                          >
                            <Check aria-hidden="true" size={12} />
                            Have
                          </button>
                          <button
                            type="button"
                            aria-label={`Add ${usage.name} to shopping list`}
                            onClick={() =>
                              dispatch({
                                type: "SET_PANTRY_CHECKLIST_ITEM",
                                preparationId: record.id,
                                inventoryId: usage.inventoryId,
                                inPantry: false,
                                toBuyQuantity: usage.plannedQuantity,
                              })
                            }
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                              !inPantry
                                ? "bg-warning text-white shadow-subtle"
                                : "text-muted hover:text-cocoa"
                            }`}
                          >
                            <ShoppingBag aria-hidden="true" size={12} />
                            Buy
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </Card>
              </section>
            )}

            <section className={`space-y-3 ${hasShortages ? "opacity-55" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-cocoa">
                    {record.status === "In progress"
                      ? "Preparation steps"
                      : "2. Preparation steps"}
                  </h2>
                  {record.status === "In progress" && !hasShortages ? (
                    <span className="text-xs font-semibold text-sage-dark">
                      {record.completedSteps.length}/
                      {record.recipeSnapshot.instructions.length}
                    </span>
                  ) : null}
                </div>
                <Button
                  size="compact"
                  variant="soft"
                  disabled={hasShortages}
                  leadingIcon={<Flame aria-hidden="true" size={14} />}
                  onClick={() => {
                    if (hasShortages) return
                    if (record.status === "Awaiting preparation") {
                      dispatch({
                        type: "START_PREPARATION",
                        preparationId: record.id,
                      })
                    }
                    setKitchenOpen(true)
                  }}
                >
                  Cook mode
                </Button>
              </div>
              <Card className="space-y-2">
                {record.recipeSnapshot.instructions.map(
                  (instruction, index) => {
                    const checked = record.completedSteps.includes(index)
                    return (
                      <button
                        key={`${index}-${instruction}`}
                        type="button"
                        disabled={hasShortages}
                        onClick={() => {
                          if (hasShortages) return
                          if (record.status === "Awaiting preparation") {
                            dispatch({
                              type: "START_PREPARATION",
                              preparationId: record.id,
                            })
                          }
                          dispatch({
                            type: "TOGGLE_PREPARATION_STEP",
                            preparationId: record.id,
                            stepIndex: index,
                          })
                        }}
                        className={`flex w-full items-start gap-3 rounded-control p-3 text-left transition disabled:cursor-not-allowed ${
                          checked ? "bg-success-soft" : "bg-ivory"
                        }`}
                      >
                        <span
                          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            checked
                              ? "bg-success text-white"
                              : "bg-white text-sage-dark"
                          }`}
                        >
                          {checked ? (
                            <Check aria-hidden="true" size={15} />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span
                          className={`pt-1 text-sm leading-relaxed ${
                            checked ? "text-success line-through" : "text-cocoa"
                          }`}
                        >
                          {instruction}
                        </span>
                      </button>
                    )
                  },
                )}
              </Card>
            </section>

            <div className="sticky bottom-0 z-20 -mx-5 mt-6 space-y-2 border-t border-warm-border bg-ivory/95 px-5 pb-3 pt-3 backdrop-blur-nav">
              {hasShortages ? (
                onOpenShopping ? (
                  <Button
                    fullWidth
                    leadingIcon={<ShoppingBag aria-hidden="true" size={17} />}
                    onClick={onOpenShopping}
                  >
                    To buy ({shortageItems.length})
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    disabled
                    leadingIcon={<ShoppingBag aria-hidden="true" size={17} />}
                  >
                    To buy ({shortageItems.length})
                  </Button>
                )
              ) : record.status === "Awaiting preparation" ? (
                <Button
                  fullWidth
                  leadingIcon={<ChefHat aria-hidden="true" size={18} />}
                  onClick={() =>
                    dispatchIfAccepted({
                      type: "START_PREPARATION",
                      preparationId: record.id,
                    })
                  }
                >
                  Start prep
                </Button>
              ) : (
                <>
                  {!allStepsChecked ? (
                    <p className="text-center text-xs font-medium text-muted">
                      Check all steps ({record.completedSteps.length}/
                      {totalSteps}) to mark ready
                    </p>
                  ) : null}
                  <Button
                    fullWidth
                    disabled={!allStepsChecked}
                    leadingIcon={<ClipboardCheck aria-hidden="true" size={18} />}
                    onClick={finishBake}
                  >
                    Mark ready
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <KitchenModeOverlay
        open={kitchenOpen && !hasShortages}
        title={line.productName}
        subtitle={`${line.variantName} · Qty ${line.quantity} · ${order.reference}`}
        steps={record.recipeSnapshot.instructions}
        completedSteps={record.completedSteps}
        onToggleStep={(stepIndex) => {
          if (hasShortages) return
          dispatch({
            type: "TOGGLE_PREPARATION_STEP",
            preparationId: record.id,
            stepIndex,
          })
        }}
        onFinishAll={() => {
          if (hasShortages) return
          setKitchenOpen(false)
          finishBake()
        }}
        onClose={() => setKitchenOpen(false)}
      />
    </>
  )
}

function ReadySummary({
  record,
  onBack,
}: {
  record: NonNullable<
    ReturnType<typeof useAppState>["state"]["preparationRecords"][number]
  >
  onBack: () => void
}) {
  return (
    <div className="mt-5 space-y-4">
      <Card tone="sage" className="text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-white text-success">
          <Check aria-hidden="true" size={23} />
        </span>
        <p className="mt-3 text-lg font-semibold text-cocoa">
          Ready for pickup
        </p>
        {record.actualCost !== null ? (
          <p className="mt-1 text-sm text-muted">
            Estimated material cost {formatLkr(record.actualCost)}
          </p>
        ) : null}
      </Card>
      <Button fullWidth onClick={onBack}>
        Back to order
      </Button>
    </div>
  )
}
