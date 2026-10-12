import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChefHat,
  ClipboardCheck,
  Clock3,
  PackageCheck,
} from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Dialog from "../components/ui/Dialog"
import Field from "../components/ui/Field"
import StatusBadge from "../components/ui/StatusBadge"
import {
  formatDate,
  formatLkr,
  formatQuantity,
  formatTime,
} from "../lib/format"
import {
  selectAvailableInventory,
  selectReservedByItem,
} from "../lib/inventory"
import { validatePreparationCompletion } from "../lib/preparation"
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
    <div className="px-page pb-6">
      <ScreenHeader
        eyebrow="Kitchen workspace"
        title="Preparation"
        subtitle={`${records.length - ready} products still need attention`}
        onBack={onBack}
        backLabel="Back to orders"
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Card tone="warning" className="p-3 text-center">
          <p className="text-xl font-bold text-warning">
            {records.length - ready - inProgress}
          </p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">
            Awaiting
          </p>
        </Card>
        <Card tone="sage" className="p-3 text-center">
          <p className="text-xl font-bold text-sage-dark">{inProgress}</p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">
            In progress
          </p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xl font-bold text-success">{ready}</p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">Ready</p>
        </Card>
      </div>

      <div className="mt-5 space-y-3">
        {records.map((record) => {
          const order = state.orders.find((item) => item.id === record.orderId)
          const line = order?.lines.find(
            (item) => item.id === record.orderLineId,
          )
          if (!order || !line) return null
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
                {order.shortages.some(
                  (shortage) => shortage.lineId === line.id,
                ) ? (
                  <AlertTriangle
                    aria-label="Stock shortage"
                    className="shrink-0 text-warning"
                    size={18}
                  />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

type PreparationProductScreenProps = {
  preparationId: string
  onBack: () => void
}

export function PreparationProductScreen({
  preparationId,
  onBack,
}: PreparationProductScreenProps) {
  const { state, dispatch } = useAppState()
  const [reviewUsage, setReviewUsage] = useState(false)
  const [issues, setIssues] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const record = state.preparationRecords.find(
    (item) => item.id === preparationId,
  )
  const order = state.orders.find((item) => item.id === record?.orderId)
  const line = order?.lines.find((item) => item.id === record?.orderLineId)
  const reservedByItem = useMemo(() => selectReservedByItem(state), [state])

  if (!record || !order || !line) {
    return (
      <div className="px-page">
        <ScreenHeader title="Preparation unavailable" onBack={onBack} />
      </div>
    )
  }

  const complete = () => {
    const validation = validatePreparationCompletion(state, record)
    if (!validation.valid) {
      setIssues(validation.issues)
      setConfirmOpen(false)
      return
    }
    dispatch({ type: "COMPLETE_PREPARATION", preparationId: record.id })
    setConfirmOpen(false)
    setIssues([])
  }

  return (
    <>
      <div className="px-page pb-6">
        <ScreenHeader
          eyebrow={`${order.reference} · ${order.customerName}`}
          title={line.productName}
          subtitle={`${line.variantName} · Quantity ${line.quantity}`}
          onBack={onBack}
          backLabel="Back to preparation queue"
          compact
        />

        <Card tone="sage" className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cocoa">
                {record.recipeSnapshot.name}
              </p>
              <p className="mt-1 text-xs text-muted">
                Frozen recipe v{record.recipeSnapshot.version} ·{" "}
                {record.recipeSnapshot.preparationMinutes} min
              </p>
            </div>
            <StatusBadge tone={preparationTone(record.status)}>
              {record.status}
            </StatusBadge>
          </div>
        </Card>

        {record.status === "Ready" ? (
          <ReadySummary record={record} />
        ) : reviewUsage && record.status === "In progress" ? (
          <UsageReview
            preparationId={record.id}
            issues={issues}
            onBack={() => {
              setReviewUsage(false)
              setIssues([])
            }}
            onComplete={() => {
              const validation = validatePreparationCompletion(state, record)
              if (!validation.valid) setIssues(validation.issues)
              else setConfirmOpen(true)
            }}
          />
        ) : (
          <>
            <section className="mt-5">
              <div className="mb-3 text-lg font-semibold text-cocoa">
                Ingredients
              </div>
              <Card className="divide-y divide-warm-border p-0">
                {record.actualUsage
                  .filter((usage) => usage.category === "ingredient")
                  .map((usage) => (
                    <div
                      key={usage.inventoryId}
                      className="flex items-center justify-between gap-3 p-4"
                    >
                      <span className="text-sm text-cocoa">{usage.name}</span>
                      <span className="text-sm font-semibold text-cocoa">
                        {formatQuantity(usage.plannedQuantity, usage.unit)}
                      </span>
                    </div>
                  ))}
              </Card>
            </section>

            <section className="mt-5">
              <div className="mb-3 text-lg font-semibold text-cocoa">
                Packaging
              </div>
              <Card className="space-y-3">
                {record.actualUsage
                  .filter((usage) => usage.category === "packaging")
                  .map((usage) => (
                    <div
                      key={usage.inventoryId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex items-center gap-2 text-sm text-cocoa">
                        <PackageCheck
                          aria-hidden="true"
                          className="text-sage"
                          size={16}
                        />
                        {usage.name}
                      </span>
                      <span className="text-sm font-semibold text-cocoa">
                        {formatQuantity(usage.plannedQuantity, usage.unit)}
                      </span>
                    </div>
                  ))}
              </Card>
            </section>

            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-semibold text-cocoa">
                  Instructions
                </div>
                {record.status === "In progress" ? (
                  <span className="text-xs font-semibold text-sage-dark">
                    {record.completedSteps.length}/
                    {record.recipeSnapshot.instructions.length}
                  </span>
                ) : null}
              </div>
              <Card className="space-y-2">
                {record.recipeSnapshot.instructions.map(
                  (instruction, index) => {
                    const checked = record.completedSteps.includes(index)
                    return (
                      <button
                        key={`${index}-${instruction}`}
                        type="button"
                        disabled={record.status !== "In progress"}
                        onClick={() =>
                          dispatch({
                            type: "TOGGLE_PREPARATION_STEP",
                            preparationId: record.id,
                            stepIndex: index,
                          })
                        }
                        className={`flex w-full items-start gap-3 rounded-control p-3 text-left transition ${
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

            <div className="sticky bottom-0 z-20 -mx-page mt-6 border-t border-warm-border bg-ivory/95 px-page pb-3 pt-3 backdrop-blur-nav">
              {record.status === "Awaiting preparation" ? (
                <Button
                  fullWidth
                  leadingIcon={<ChefHat aria-hidden="true" size={18} />}
                  onClick={() =>
                    dispatch({
                      type: "START_PREPARATION",
                      preparationId: record.id,
                    })
                  }
                >
                  Start preparation
                </Button>
              ) : (
                <Button
                  fullWidth
                  leadingIcon={<ClipboardCheck aria-hidden="true" size={18} />}
                  onClick={() => setReviewUsage(true)}
                >
                  Review actual usage
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        title="Complete preparation?"
        description="Actual stock will be consumed and this product will become ready."
        onClose={() => setConfirmOpen(false)}
        footer={
          <div className="space-y-2">
            <Button fullWidth onClick={complete}>
              Complete preparation
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Review again
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          This operation is recorded once and cannot be edited after completion.
        </p>
      </Dialog>
    </>
  )

  function UsageReview({
    preparationId,
    issues,
    onBack,
    onComplete,
  }: {
    preparationId: string
    issues: string[]
    onBack: () => void
    onComplete: () => void
  }) {
    return (
      <>
        <section className="mt-5">
          <div className="mb-1 text-lg font-semibold text-cocoa">
            Actual usage
          </div>
          <p className="text-xs text-muted">
            Planned values are prefilled. Edit only what changed.
          </p>
          {issues.length ? (
            <Card tone="warning" className="mt-3">
              <div className="space-y-2">
                {issues.map((issue) => (
                  <p
                    key={issue}
                    className="flex items-start gap-2 text-xs leading-relaxed text-cocoa"
                  >
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-warning"
                      size={15}
                    />
                    {issue}
                  </p>
                ))}
              </div>
            </Card>
          ) : null}
          <div className="mt-4 space-y-3">
            {record.actualUsage.map((usage) => {
              const availability = selectAvailableInventory(
                state,
                usage.inventoryId,
              )
              const difference = usage.actualQuantity - usage.plannedQuantity
              return (
                <Card key={usage.inventoryId}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-cocoa">
                        {usage.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Planned{" "}
                        {formatQuantity(usage.plannedQuantity, usage.unit)} ·
                        Physical{" "}
                        {formatQuantity(availability.physical, usage.unit)}
                      </p>
                    </div>
                    {difference !== 0 ? (
                      <StatusBadge
                        tone={difference > 0 ? "warning" : "progress"}
                      >
                        {difference > 0 ? "+" : ""}
                        {formatQuantity(difference, usage.unit)}
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">As planned</StatusBadge>
                    )}
                  </div>
                  <div className="mt-3">
                    <Field
                      label={`Actual quantity (${usage.unit})`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={usage.actualQuantity}
                      onChange={(event) => {
                        const quantity = Number(event.target.value)
                        dispatch({
                          type: "UPDATE_PREPARATION_USAGE",
                          preparationId,
                          inventoryId: usage.inventoryId,
                          quantity,
                        })
                      }}
                      helperText={`${formatQuantity(
                        reservedByItem.get(usage.inventoryId) ?? 0,
                        usage.unit,
                      )} reserved across active products`}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
        <div className="sticky bottom-0 z-20 -mx-page mt-6 space-y-2 border-t border-warm-border bg-ivory/95 px-page pb-3 pt-3 backdrop-blur-nav">
          <Button fullWidth onClick={onComplete}>
            Complete preparation
          </Button>
          <Button fullWidth variant="ghost" onClick={onBack}>
            Back to recipe
          </Button>
        </div>
      </>
    )
  }
}

function ReadySummary({
  record,
}: {
  record: NonNullable<ReturnType<typeof useAppState>["state"]["preparationRecords"][number]>
}) {
  return (
    <div className="mt-5">
      <Card tone="sage" className="text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-white text-success">
          <Check aria-hidden="true" size={23} />
        </span>
        <p className="mt-3 text-lg font-semibold text-cocoa">
          Ready for collection
        </p>
        <p className="mt-1 text-sm text-muted">
          Actual cost {formatLkr(record.actualCost ?? 0)}
        </p>
        <p className="mt-2 text-xs text-muted">
          Collection and payment remain separate order actions.
        </p>
      </Card>
      <div className="mt-4 space-y-2">
        {record.actualUsage.map((usage) => (
          <div
            key={usage.inventoryId}
            className="flex items-center justify-between rounded-control bg-white px-4 py-3 text-sm"
          >
            <span className="text-muted">{usage.name}</span>
            <span className="font-semibold text-cocoa">
              {formatQuantity(usage.actualQuantity, usage.unit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
