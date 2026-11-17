import { useMemo, useState } from "react"

import { ChefHat, ClipboardCheck, PackageCheck } from "lucide-react"

import Button from "../components/ui/Button"

import Card from "../components/ui/Card"

import Field from "../components/ui/Field"

import ScreenHeader from "../components/ScreenHeader"

import StatusBadge from "../components/ui/StatusBadge"

import { parseExpectedOutputQuantity } from "../lib/expectedOutput"

import { formatLkr, formatQuantity } from "../lib/format"

import { selectReservedByItem } from "../lib/inventory"

import { validateExtraStockPreparationCompletion } from "../lib/preparation"

import { useAppState } from "../state/AppState"

import type { ExtraStockPreparationRecord, PreparationUsage } from "../types"

type ExtraStockPreparationScreenProps = {
  preparationId?: string

  onBack: () => void

  onSelect: (preparationId: string) => void
}

export default function ExtraStockPreparationScreen({
  preparationId,

  onBack,

  onSelect,
}: ExtraStockPreparationScreenProps) {
  const { state } = useAppState()

  const records = [...state.extraStockPreparations].sort((a, b) =>
    (b.startedAt ?? "").localeCompare(a.startedAt ?? ""),
  )

  if (preparationId) {
    return (
      <ExtraStockPreparationDetail
        preparationId={preparationId}
        onBack={onBack}
      />
    )
  }

  const inProgress = records.filter((record) => record.status === "In progress")

  const completed = records.filter((record) => record.status === "Ready")

  return (
    <div className="pb-6">
      <ScreenHeader
        eyebrow="Independent production"
        title="Extra-stock preparations"
        subtitle="Planned future stock · separate from customer orders"
        onBack={onBack}
        backLabel="Back to shopping"
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Card tone="sage" className="p-3 text-center">
          <p className="text-xl font-bold text-sage-dark">
            {inProgress.length}
          </p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">
            In progress
          </p>
        </Card>
        <Card tone="sage" className="p-3 text-center">
          <p className="text-xl font-bold text-success">{completed.length}</p>
          <p className="mt-1 text-nav font-bold uppercase text-muted">
            Completed
          </p>
        </Card>
      </div>
      <section className="mt-5 space-y-3">
        {records.length ? (
          records.map((record) => {
            const product = state.products.find(
              (item) => item.id === record.productId,
            )

            const variant = product?.variants.find(
              (item) => item.id === record.variantId,
            )

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
                      {product?.name ?? record.recipeSnapshot.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {variant?.name ?? "Variant unavailable"} · Plan{" "}
                      {record.planId} · {record.plannedBatches} recipe batch
                      {record.plannedBatches === 1 ? "" : "es"}
                    </span>
                  </span>
                  <StatusBadge
                    tone={record.status === "Ready" ? "success" : "progress"}
                  >
                    {record.status}
                  </StatusBadge>
                </span>
                <span className="mt-3 block border-t border-warm-border pt-3 text-xs text-muted">
                  Frozen recipe v{record.recipeSnapshot.version} · Expected{" "}
                  {record.recipeSnapshot.expectedOutput
                    ? `${record.recipeSnapshot.expectedOutput.quantity} unit${
                        record.recipeSnapshot.expectedOutput.quantity === 1
                          ? ""
                          : "s"
                      } per batch`
                    : "not configured"}
                </span>
              </button>
            )
          })
        ) : (
          <Card className="py-8 text-center">
            <ChefHat
              aria-hidden="true"
              className="mx-auto text-sage"
              size={26}
            />
            <p className="mt-3 text-sm font-semibold text-cocoa">
              No extra-stock preparations yet
            </p>
            <p className="mt-1 text-xs text-muted">
              Start one from an eligible plan in Shopping.
            </p>
          </Card>
        )}
      </section>
    </div>
  )
}

function ExtraStockPreparationDetail({
  preparationId,

  onBack,
}: {
  preparationId: string

  onBack: () => void
}) {
  const { state, dispatchIfAccepted } = useAppState()

  const record = state.extraStockPreparations.find(
    (item) => item.id === preparationId,
  )

  const [actualUsage, setActualUsage] = useState<PreparationUsage[]>(
    () => structuredClone(record?.actualUsage ?? []),
  )

  const [actualOutput, setActualOutput] = useState("")

  const [issues, setIssues] = useState<string[]>([])

  const [error, setError] = useState("")

  const reservedByItem = useMemo(() => selectReservedByItem(state), [state])

  if (!record) {
    return (
      <div className="py-2">
        <ScreenHeader
          title="Preparation unavailable"
          onBack={onBack}
          backLabel="Back to preparation queue"
        />
        <Card className="mt-4 text-sm text-muted">
          This extra-stock preparation could not be found.
        </Card>
      </div>
    )
  }

  const product = state.products.find((item) => item.id === record.productId)

  const variant = product?.variants.find(
    (item) => item.id === record.variantId,
  )

  const plan = state.extraStockPlans.find((item) => item.id === record.planId)

  const updateUsage = (index: number, value: string) => {
    const quantity = value === "" ? 0 : Number(value)

    setActualUsage((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, actualQuantity: quantity } : item,
      ),
    )

    setIssues([])

    setError("")
  }

  const complete = () => {
    const parsedOutput = parseExpectedOutputQuantity(actualOutput)

    if (!parsedOutput.valid || !parsedOutput.value) {
      setError(
        "Enter actual usable output as a positive whole number of units.",
      )

      setIssues([])

      return
    }

    const outputQuantity = parsedOutput.value.quantity

    const validation = validateExtraStockPreparationCompletion(
      state,

      record,

      actualUsage,

      outputQuantity,
    )

    if (!validation.valid) {
      setIssues(validation.issues)

      setError("")

      return
    }

    const accepted = dispatchIfAccepted({
      type: "COMPLETE_EXTRA_STOCK_PREPARATION",

      preparationId: record.id,

      actualUsage,

      usableOutputQuantity: outputQuantity,
    })

    if (!accepted) {
      setError(
        "The preparation could not be completed. Check its status, stock availability, and finished-stock balance, then review the values again.",
      )

      return
    }

    setError("")

    setIssues([])
  }

  if (record.status === "Ready") {
    const foundBatch = state.finishedStockBatches.find(
      (item) =>
        item.source === "production" && item.preparationId === record.id,
    )

    const batch = foundBatch?.source === "production" ? foundBatch : undefined

    return (
      <div className="pb-6">
        <ScreenHeader
          eyebrow="Extra-stock preparation"
          title={product?.name ?? record.recipeSnapshot.name}
          subtitle={`${variant?.name ?? "Variant unavailable"} · Plan ${record.planId}`}
          onBack={onBack}
          backLabel="Back to preparation queue"
          compact
        />
        <Card tone="sage" className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cocoa">
                Preparation completed
              </p>
              <p className="mt-1 text-xs text-muted">
                {batch?.producedQuantity ?? 0} usable unit
                {(batch?.producedQuantity ?? 0) === 1 ? "" : "s"} produced ·{" "}
                {formatLkr(record.actualCost ?? 0)} actual material cost
              </p>
            </div>
            <StatusBadge tone="success">Ready</StatusBadge>
          </div>
          <p className="mt-3 border-t border-sage-border pt-3 text-sm text-cocoa">
            Finished stock remaining in batch:{" "}
            <span className="font-semibold">
              {batch?.remainingQuantity ?? 0} units
            </span>
          </p>
        </Card>
        <PreparationSnapshot record={record} />
        <section className="mt-5">
          <div className="mb-3 text-lg font-semibold text-cocoa">
            Recorded actual usage
          </div>
          <Card className="divide-y divide-warm-border p-0">
            {record.actualUsage.map((usage) => (
              <div
                key={`${usage.category}-${usage.inventoryId}`}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <span className="text-muted">{usage.name}</span>
                <span className="font-semibold text-cocoa">
                  {formatQuantity(usage.actualQuantity, usage.unit)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <ScreenHeader
        eyebrow="Independent extra-stock production"
        title={product?.name ?? record.recipeSnapshot.name}
        subtitle={`${variant?.name ?? "Variant unavailable"} · Plan ${record.planId} · ${record.plannedBatches} recipe batch${
          record.plannedBatches === 1 ? "" : "es"
        }`}
        onBack={onBack}
        backLabel="Back to preparation queue"
        compact
      />
      <div className="mt-4 flex items-start justify-between gap-3 rounded-control bg-sage-soft p-3">
        <div>
          <p className="text-sm font-semibold text-cocoa">
            {record.recipeSnapshot.name}
          </p>
          <p className="mt-1 text-xs text-muted">
            Frozen recipe v{record.recipeSnapshot.version} ·{" "}
            {record.recipeSnapshot.preparationMinutes} min · Plan reference{" "}
            {plan?.id ?? record.planId}
          </p>
        </div>
        <StatusBadge tone="progress">In progress</StatusBadge>
      </div>
      <div className="mt-3 rounded-control border border-warm-border bg-white px-3 py-2 text-sm text-muted">
        Expected output for context:{" "}
        <span className="font-semibold text-cocoa">
          {record.recipeSnapshot.expectedOutput
            ? `${record.recipeSnapshot.expectedOutput.quantity} unit${
                record.recipeSnapshot.expectedOutput.quantity === 1 ? "" : "s"
              } per recipe batch`
            : "Not configured"}
        </span>
      </div>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold text-cocoa">
            Actual ingredient and packaging usage
          </div>
          <StatusBadge tone="neutral">Review before completion</StatusBadge>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Planned quantities are prefilled. Record actual consumption; customer
          order reservations remain protected.
        </p>
        <Card className="space-y-4">
          {actualUsage.map((usage, index) => (
            <Field
              key={`${usage.category}-${usage.inventoryId}`}
              label={`${
                usage.category === "ingredient" ? "Ingredient" : "Packaging"
              } · ${usage.name} (${usage.unit})`}
              type="number"
              min="0"
              step={usage.unit === "unit" ? "1" : "any"}
              inputMode={usage.unit === "unit" ? "numeric" : "decimal"}
              value={usage.actualQuantity}
              onChange={(event) => updateUsage(index, event.target.value)}
              helperText={`Planned ${formatQuantity(usage.plannedQuantity, usage.unit)} · Available now ${formatQuantity(
                Math.max(
                  0,

                  (state.inventory.find(
                    (item) => item.inventoryId === usage.inventoryId,
                  )?.physical ?? 0) -
                    (reservedByItem.get(usage.inventoryId) ?? 0),
                ),

                usage.unit,
              )}`}
            />
          ))}
          {!actualUsage.length ? (
            <p className="text-sm text-muted">
              No ingredient or packaging materials are recorded in this recipe.
            </p>
          ) : null}
        </Card>
      </section>

      <section className="mt-5">
        <div className="mb-3 text-lg font-semibold text-cocoa">
          Actual usable output
        </div>
        <Card>
          <Field
            label="Usable whole units produced"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={actualOutput}
            onChange={(event) => {
              setActualOutput(event.target.value)

              setError("")
            }}
            helperText="Enter the actual saleable output. Expected output is context only and is not copied here."
          />
        </Card>
      </section>

      <PreparationSnapshot record={record} />

      {issues.length || error ? (
        <Card tone="warning" className="mt-4" role="alert">
          {error ? (
            <p className="text-sm font-semibold text-cocoa">{error}</p>
          ) : null}
          {issues.length ? (
            <ul
              className={`list-disc space-y-1 pl-5 text-sm text-cocoa ${
                error ? "mt-2" : ""
              }`}
            >
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[27rem] border-t border-warm-border bg-ivory/95 px-5 pb-3 pt-3 backdrop-blur-nav">
        <Button
          fullWidth
          leadingIcon={<ClipboardCheck aria-hidden="true" size={18} />}
          onClick={complete}
        >
          Complete and record actual usage
        </Button>
      </div>
    </div>
  )
}

function PreparationSnapshot({
  record,
}: {
  record: ExtraStockPreparationRecord
}) {
  return (
    <div className="mt-5 space-y-4">
      <section>
        <div className="mb-3 text-lg font-semibold text-cocoa">
          Instructions
        </div>
        <Card className="space-y-3">
          {record.recipeSnapshot.instructions.map((instruction, index) => (
            <div key={`${index}-${instruction}`} className="flex gap-3">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-soft text-xs font-bold text-sage-dark">
                {index + 1}
              </span>
              <p className="pt-1 text-sm leading-relaxed text-cocoa">
                {instruction}
              </p>
            </div>
          ))}
        </Card>
      </section>
      <section>
        <div className="mb-3 text-lg font-semibold text-cocoa">
          Frozen recipe materials
        </div>
        <Card className="divide-y divide-warm-border p-0">
          {record.recipeSnapshot.ingredients.map((item) => (
            <div
              key={`ingredient-${item.inventoryId}`}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <span className="text-muted">{item.name}</span>
              <span className="font-semibold text-cocoa">
                {formatQuantity(
                  item.quantity * record.plannedBatches,
                  item.unit,
                )}
              </span>
            </div>
          ))}
          {record.recipeSnapshot.packaging.map((item) => (
            <div
              key={`packaging-${item.inventoryId}`}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <span className="flex items-center gap-2 text-muted">
                <PackageCheck
                  aria-hidden="true"
                  className="text-sage"
                  size={15}
                />
                {item.name}
              </span>
              <span className="font-semibold text-cocoa">
                {formatQuantity(
                  item.quantity * record.plannedBatches,
                  item.unit,
                )}
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
