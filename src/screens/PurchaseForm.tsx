import { useMemo, useRef, useState } from "react"
import { ArrowRight, PackagePlus } from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import SelectField from "../components/ui/SelectField"
import TextAreaField from "../components/ui/TextAreaField"
import {
  compatibleUnits,
  inventoryCategory,
  selectShoppingRequirements,
  toInventoryBaseQuantity,
} from "../lib/inventory"
import { formatQuantity, getColomboTodayIso } from "../lib/format"
import { createId } from "../lib/id"
import { submitPurchaseIfAccepted } from "../lib/purchaseSubmission"
import { useAppState } from "../state/AppState"
import type { Unit } from "../types"

function today() {
  return getColomboTodayIso()
}

type PurchaseFormProps = {
  initialInventoryId?: string
  onCancel: () => void
  onComplete: (inventoryId: string) => void
}

export default function PurchaseForm({
  initialInventoryId,
  onCancel,
  onComplete,
}: PurchaseFormProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const purchasableItems = state.inventory.filter(
    (item) => inventoryCategory(item) !== "finished",
  )
  const requirements = selectShoppingRequirements(state)
  const initialItem =
    purchasableItems.find((item) => item.inventoryId === initialInventoryId) ??
    purchasableItems[0]
  const suggested =
    requirements.find((item) => item.inventoryId === initialItem?.inventoryId)
      ?.selectedPurchase ?? 0

  const [purchaseId] = useState(() => createId("purchase"))
  const [inventoryId, setInventoryId] = useState(initialItem?.inventoryId ?? "")
  const [purchasedQuantity, setPurchasedQuantity] = useState(
    suggested > 0 ? String(suggested) : "",
  )
  const [purchasedUnit, setPurchasedUnit] = useState<Unit>(
    initialItem?.unit ?? "g",
  )
  const [usableQuantity, setUsableQuantity] = useState(
    suggested > 0 ? String(suggested) : "",
  )
  const [usableUnit, setUsableUnit] = useState<Unit>(initialItem?.unit ?? "g")
  const [totalPrice, setTotalPrice] = useState("")
  const [date, setDate] = useState(today())
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const submitting = useRef(false)

  const selectedItem = useMemo(
    () => state.inventory.find((item) => item.inventoryId === inventoryId),
    [inventoryId, state.inventory],
  )
  const unitOptions = selectedItem
    ? compatibleUnits(selectedItem.unit).map((unit) => ({
        value: unit,
        label: unit === "unit" ? "Units" : unit,
      }))
    : []

  const changeItem = (nextId: string) => {
    const item = state.inventory.find((entry) => entry.inventoryId === nextId)
    const requirement = requirements.find(
      (entry) => entry.inventoryId === nextId,
    )
    const nextQuantity = requirement?.selectedPurchase ?? 0
    setInventoryId(nextId)
    setPurchasedUnit(item?.unit ?? "g")
    setUsableUnit(item?.unit ?? "g")
    setPurchasedQuantity(nextQuantity ? String(nextQuantity) : "")
    setUsableQuantity(nextQuantity ? String(nextQuantity) : "")
    setError("")
  }

  const submit = () => {
    if (!selectedItem || submitting.current) return
    const purchased = Number(purchasedQuantity)
    const usable = Number(usableQuantity)
    const price = Number(totalPrice)
    const usableBaseQuantity = toInventoryBaseQuantity(
      usable,
      usableUnit,
      selectedItem,
    )
    const purchasedBaseQuantity = toInventoryBaseQuantity(
      purchased,
      purchasedUnit,
      selectedItem,
    )
    if (
      !Number.isFinite(purchased) ||
      purchased <= 0 ||
      !Number.isFinite(usable) ||
      usable <= 0 ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      !date ||
      !Number.isFinite(purchasedBaseQuantity) ||
      !Number.isFinite(usableBaseQuantity) ||
      usableBaseQuantity > purchasedBaseQuantity
    ) {
      setError(
        "Enter compatible positive quantities, ensure usable stock does not exceed the purchased amount, and enter a whole-LKR purchase total.",
      )
      return
    }

    submitting.current = true
    setSubmitted(true)
    const accepted = submitPurchaseIfAccepted(
      {
        type: "RECORD_PURCHASE",
        purchase: {
          id: purchaseId,
          inventoryId,
          purchasedQuantity: purchased,
          purchasedUnit,
          usableQuantity: usable,
          usableUnit,
          usableBaseQuantity,
          totalPrice: price,
          date,
          note: note.trim(),
          createdAt: new Date().toISOString(),
        },
      },
      dispatchIfAccepted,
      () => onComplete(inventoryId),
    )
    if (!accepted) {
      submitting.current = false
      setSubmitted(false)
      setError(
        "Purchase was not recorded. Inventory may have changed or the purchase details may be invalid. Review the values and try again.",
      )
    }
  }

  return (
    <div className="focused-flow pb-2">
      <ScreenHeader
        eyebrow="Inventory intake"
        title="Record purchase"
        subtitle="Actual package and usable stock"
        onBack={onCancel}
        backLabel="Cancel purchase"
        compact
      />

      <div className="mt-4 space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-control bg-warning-soft p-3 text-sm text-cocoa"
          >
            {error}
          </div>
        ) : null}

        <Card className="space-y-4">
          <SelectField
            label="Item"
            value={inventoryId}
            onChange={(event) => changeItem(event.target.value)}
            options={purchasableItems.map((item) => ({
              value: item.inventoryId,
              label: item.name,
            }))}
          />
          <div className="grid grid-cols-purchase gap-3">
            <Field
              label="Quantity purchased"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={purchasedQuantity}
              onChange={(event) => setPurchasedQuantity(event.target.value)}
            />
            <SelectField
              label="Unit"
              value={purchasedUnit}
              onChange={(event) => setPurchasedUnit(event.target.value as Unit)}
              options={unitOptions}
            />
          </div>
        </Card>

        <Card tone="sage" className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-cocoa">
              Usable stock received
            </p>
            <p className="mt-1 text-xs text-muted">
              Only this quantity increases inventory.
            </p>
          </div>
          <div className="grid grid-cols-purchase gap-3">
            <Field
              label="Usable quantity"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={usableQuantity}
              onChange={(event) => setUsableQuantity(event.target.value)}
            />
            <SelectField
              label="Unit"
              value={usableUnit}
              onChange={(event) => setUsableUnit(event.target.value as Unit)}
              options={unitOptions}
            />
          </div>
          {selectedItem && Number(usableQuantity) > 0 ? (
            <p className="text-xs font-semibold text-sage-dark">
              Adds{" "}
              {formatQuantity(
                toInventoryBaseQuantity(
                  Number(usableQuantity),
                  usableUnit,
                  selectedItem,
                ),
                selectedItem.unit,
              )}{" "}
              to physical stock
            </p>
          ) : null}
        </Card>

        <Card className="space-y-4">
          <Field
            label="Total price (Rs.)"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={totalPrice}
            onChange={(event) => setTotalPrice(event.target.value)}
          />
          <Field
            label="Purchase date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <TextAreaField
            label="Note"
            placeholder="Package size or purchase note (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Card>
      </div>

      <div className="page-bleed sticky bottom-0 z-20 mt-auto border-t border-warm-border bg-ivory/95 pb-3 pt-3 backdrop-blur-nav">
        <Button
          fullWidth
          disabled={submitted}
          leadingIcon={<PackagePlus aria-hidden="true" size={18} />}
          trailingIcon={<ArrowRight aria-hidden="true" size={17} />}
          onClick={submit}
        >
          Record purchase
        </Button>
      </div>
    </div>
  )
}
