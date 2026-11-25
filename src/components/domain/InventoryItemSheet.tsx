import { useEffect, useState } from "react"
import { Archive, RotateCcw } from "lucide-react"
import Button from "../ui/Button"
import CheckboxField from "../ui/CheckboxField"
import Disclosure from "../ui/Disclosure"
import Field from "../ui/Field"
import { ImagePickerField } from "../ui/ImagePickerSheet"
import SelectField from "../ui/SelectField"
import Sheet from "../ui/Sheet"
import { createId } from "../../lib/id"
import {
  compatibleUnits,
  fromBaseQuantity,
  getDefaultGramsPerTsp,
  inventoryCategory,
  isStockTracked,
  toBaseQuantity,
} from "../../lib/inventory"
import {
  fromDisplayUnitPrice,
  getDisplayPriceUnitLabel,
  toDisplayUnitPrice,
} from "../../lib/pricing"
import { useAppState } from "../../state/AppState"
import type {
  BaseUnit,
  InventoryCategory,
  InventoryItem,
  Unit,
} from "../../types"

type InventoryItemSheetProps = {
  open: boolean
  item?: InventoryItem | null
  defaultCategory?: Exclude<InventoryCategory, "finished">
  onClose: () => void
  onSaved?: (item: InventoryItem) => void
}

export default function InventoryItemSheet({
  open,
  item,
  defaultCategory = "ingredient",
  onClose,
  onSaved,
}: InventoryItemSheetProps) {
  const { dispatchIfAccepted } = useAppState()
  const [name, setName] = useState("")
  const [image, setImage] = useState<string | undefined>(undefined)
  const [category, setCategory] =
    useState<Exclude<InventoryCategory, "finished">>(defaultCategory)
  const [unit, setUnit] = useState<BaseUnit>("g")
  const [displayPrice, setDisplayPrice] = useState("")
  const [tspSizeInput, setTspSizeInput] = useState("")
  const [trackStock, setTrackStock] = useState(false)
  const [stockQtyInput, setStockQtyInput] = useState("")
  const [stockUnit, setStockUnit] = useState<Unit>("g")
  const [lowStockInput, setLowStockInput] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    if (item) {
      const cat = inventoryCategory(item) === "packaging" ? "packaging" : "ingredient"
      setName(item.name)
      setImage(item.image)
      setCategory(cat)
      setUnit(item.unit)
      const priceVal = toDisplayUnitPrice(item.averageUnitCost, item.unit)
      setDisplayPrice(priceVal !== undefined ? String(priceVal) : "")
      if (item.unit === "g") {
        setTspSizeInput(
          item.gramsPerTsp !== undefined ? String(item.gramsPerTsp) : "",
        )
      } else if (item.unit === "ml") {
        setTspSizeInput(
          item.mlPerTsp !== undefined ? String(item.mlPerTsp) : "",
        )
      } else {
        setTspSizeInput("")
      }
      const tracked = isStockTracked(item)
      setTrackStock(tracked)
      if (item.unit === "g" && item.physical >= 1000) {
        setStockUnit("kg")
        setStockQtyInput(String(fromBaseQuantity(item.physical, "kg", "g")))
      } else if (item.unit === "ml" && item.physical >= 1000) {
        setStockUnit("L")
        setStockQtyInput(String(fromBaseQuantity(item.physical, "L", "ml")))
      } else {
        setStockUnit(item.unit)
        setStockQtyInput(item.physical > 0 ? String(item.physical) : "")
      }
      setLowStockInput(
        item.lowStockThreshold && item.lowStockThreshold > 0
          ? String(item.lowStockThreshold)
          : "",
      )
    } else {
      const defaultUnit: BaseUnit =
        defaultCategory === "ingredient" ? "g" : "unit"
      setName("")
      setImage(undefined)
      setCategory(defaultCategory)
      setUnit(defaultUnit)
      setDisplayPrice("")
      setTspSizeInput("")
      setTrackStock(false)
      setStockQtyInput("")
      setStockUnit(defaultCategory === "ingredient" ? "kg" : "unit")
      setLowStockInput("")
    }
  }, [defaultCategory, item?.inventoryId, open])

  const priceUnitLabel = getDisplayPriceUnitLabel(unit)
  const smartDryDefault = getDefaultGramsPerTsp(name || "")
  const effectiveDefaultTsp = unit === "g" ? smartDryDefault : 5
  const previewTspValue = (() => {
    const num = Number(tspSizeInput)
    return tspSizeInput.trim() && Number.isFinite(num) && num > 0
      ? num
      : effectiveDefaultTsp
  })()

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Enter an ingredient or packaging name.")
      return
    }
    const parsedDisplayPrice = displayPrice.trim()
      ? Number(displayPrice)
      : undefined
    if (
      parsedDisplayPrice !== undefined &&
      (!Number.isFinite(parsedDisplayPrice) || parsedDisplayPrice < 0)
    ) {
      setError(`Price per ${priceUnitLabel} must be 0 or greater.`)
      return
    }
    const baseCost =
      parsedDisplayPrice !== undefined
        ? fromDisplayUnitPrice(parsedDisplayPrice, unit)
        : undefined

    let parsedTspValue: number | undefined
    if ((unit === "g" || unit === "ml") && tspSizeInput.trim()) {
      const num = Number(tspSizeInput)
      if (!Number.isFinite(num) || num <= 0) {
        setError(
          `Teaspoon equivalent must be greater than 0 ${unit === "g" ? "g" : "ml"}.`,
        )
        return
      }
      parsedTspValue = num
    }

    let physicalQty = item?.physical ?? 0
    let lowThreshold = item?.lowStockThreshold ?? 0
    if (trackStock) {
      if (stockQtyInput.trim()) {
        const rawStock = Number(stockQtyInput)
        const baseStock = toBaseQuantity(rawStock, stockUnit, unit, {
          gramsPerTsp: unit === "g" ? (parsedTspValue ?? smartDryDefault) : undefined,
          mlPerTsp: unit === "ml" ? (parsedTspValue ?? 5) : undefined,
        })
        if (!Number.isFinite(baseStock) || baseStock < 0) {
          setError("Enter a valid non-negative available quantity.")
          return
        }
        physicalQty = baseStock
      } else if (!item) {
        physicalQty = 0
      }

      if (lowStockInput.trim()) {
        const parsedLow = Number(lowStockInput)
        if (!Number.isFinite(parsedLow) || parsedLow < 0) {
          setError("Low-stock alert quantity must be 0 or greater.")
          return
        }
        lowThreshold = parsedLow
      } else {
        lowThreshold = 0
      }
    }

    if (item) {
      const ok = dispatchIfAccepted({
        type: "UPDATE_INVENTORY_ITEM",
        inventoryId: item.inventoryId,
        patch: {
          name: trimmedName,
          image: image ?? null,
          ...(baseCost !== undefined ? { averageUnitCost: baseCost } : {}),
          ...(unit === "g"
            ? { gramsPerTsp: parsedTspValue ?? null }
            : unit === "ml"
              ? { mlPerTsp: parsedTspValue ?? null }
              : {}),
          trackStock,
          ...(trackStock
            ? { physical: physicalQty, lowStockThreshold: lowThreshold }
            : {}),
        },
      })
      if (!ok) {
        setError("Could not save changes to this item.")
        return
      }
      const nextItem: InventoryItem = {
        ...item,
        name: trimmedName,
        image,
        trackStock,
        ...(trackStock
          ? { physical: physicalQty, lowStockThreshold: lowThreshold }
          : {}),
        ...(baseCost !== undefined ? { averageUnitCost: baseCost } : {}),
      }
      if (unit === "g") {
        if (parsedTspValue !== undefined) nextItem.gramsPerTsp = parsedTspValue
        else delete nextItem.gramsPerTsp
      } else if (unit === "ml") {
        if (parsedTspValue !== undefined) nextItem.mlPerTsp = parsedTspValue
        else delete nextItem.mlPerTsp
      }
      onSaved?.(nextItem)
      onClose()
      return
    }

    const newItem: InventoryItem = {
      inventoryId: createId(category),
      name: trimmedName,
      ...(image ? { image } : {}),
      physical: trackStock ? physicalQty : 0,
      unit,
      category,
      lowStockThreshold: trackStock ? lowThreshold : 0,
      trackStock,
      ...(unit === "g" && parsedTspValue !== undefined
        ? { gramsPerTsp: parsedTspValue }
        : {}),
      ...(unit === "ml" && parsedTspValue !== undefined
        ? { mlPerTsp: parsedTspValue }
        : {}),
      ...(baseCost !== undefined ? { averageUnitCost: baseCost } : {}),
    }
    const ok = dispatchIfAccepted({ type: "ADD_INVENTORY_ITEM", item: newItem })
    if (!ok) {
      setError("Could not add item.")
      return
    }
    onSaved?.(newItem)
    onClose()
  }

  const toggleArchive = () => {
    if (!item) return
    dispatchIfAccepted({
      type: "UPDATE_INVENTORY_ITEM",
      inventoryId: item.inventoryId,
      patch: { archived: !item.archived },
    })
    onClose()
  }

  return (
    <Sheet
      open={open}
      title={item ? `Edit ${item.name}` : "New ingredient"}
      subtitle="Updating a price automatically updates all recipes using it"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            {item ? "Save changes" : "Add ingredient"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field
          label="Name"
          placeholder="e.g., Icing sugar, Vanilla essence, Glass jar 250g"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError("")
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Type"
            value={category}
            disabled={Boolean(item)}
            options={[
              { value: "ingredient", label: "Ingredient" },
              { value: "packaging", label: "Packaging" },
            ]}
            onChange={(e) => {
              const nextCat = e.target.value as Exclude<
                InventoryCategory,
                "finished"
              >
              setCategory(nextCat)
              if (nextCat === "packaging") {
                setUnit("unit")
                setStockUnit("unit")
              } else if (unit === "unit") {
                setUnit("g")
                setStockUnit("kg")
              }
            }}
          />
          <SelectField
            label="Measured by"
            value={unit}
            disabled={Boolean(item) || category === "packaging"}
            options={[
              { value: "g", label: "Dry / weight (g · kg · tsp)" },
              { value: "ml", label: "Liquid (ml · L · tsp · cup)" },
              { value: "unit", label: "Pieces (unit)" },
            ]}
            onChange={(e) => {
              const nextUnit = e.target.value as BaseUnit
              setUnit(nextUnit)
              setTspSizeInput("")
              setStockUnit(
                nextUnit === "g" ? "kg" : nextUnit === "ml" ? "L" : "unit",
              )
            }}
          />
        </div>

        <Field
          label={`Price per ${priceUnitLabel} (Rs.)`}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder={`e.g., ${priceUnitLabel === "kg" ? "450" : priceUnitLabel === "L" ? "520" : "120"}`}
          value={displayPrice}
          onChange={(e) => {
            setDisplayPrice(e.target.value)
            setError("")
          }}
          helperText={`Used to calculate live recipe costs automatically from Rs. / ${priceUnitLabel}.`}
        />

        <Disclosure
          title="Optional: Spoon conversion, available quantity & photo"
          contentClassName="space-y-4 border-t border-warm-border p-3.5"
        >
          {unit === "g" || unit === "ml" ? (
            <Field
              label={
                unit === "g" ? "1 teaspoon equals (g)" : "1 teaspoon equals (ml)"
              }
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder={String(effectiveDefaultTsp)}
              value={tspSizeInput}
              onChange={(e) => {
                setTspSizeInput(e.target.value)
                setError("")
              }}
              helperText={
                unit === "g"
                  ? `Leave blank for default (${smartDryDefault} g). 1 tbsp = ${Math.round(previewTspValue * 3 * 10) / 10} g.`
                  : `Metric default: 5 ml. 1 tbsp = ${Math.round(previewTspValue * 3 * 10) / 10} ml · 1 cup = 250 ml.`
              }
            />
          ) : null}

          <div className="space-y-3">
            <CheckboxField
              checked={trackStock}
              onChange={setTrackStock}
              label="Track available quantity"
              description="Optional — enable if you want to record how much you currently have on hand."
            />

            {trackStock ? (
              <div className="space-y-3 rounded-control border border-warm-border bg-ivory p-3">
                <div className="grid grid-cols-[1fr_92px] gap-2.5">
                  <Field
                    label="Available quantity"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={stockQtyInput}
                    onChange={(e) => {
                      setStockQtyInput(e.target.value)
                      setError("")
                    }}
                  />
                  <SelectField
                    label="Unit"
                    value={stockUnit}
                    options={compatibleUnits(unit).map((u) => ({
                      value: u,
                      label: u,
                    }))}
                    onChange={(e) => setStockUnit(e.target.value as Unit)}
                  />
                </div>
                <Field
                  label={`Low-stock reminder (${unit})`}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="Optional (0 = off)"
                  value={lowStockInput}
                  onChange={(e) => {
                    setLowStockInput(e.target.value)
                    setError("")
                  }}
                />
              </div>
            ) : null}
          </div>

          <ImagePickerField
            label={
              category === "packaging" ? "Packaging photo" : "Ingredient photo"
            }
            value={image}
            defaultCategory={
              category === "packaging" ? "packaging" : "ingredients"
            }
            onChange={setImage}
          />

          {item ? (
            <Button
              fullWidth
              variant="ghost"
              size="compact"
              leadingIcon={
                item.archived ? (
                  <RotateCcw aria-hidden="true" size={14} />
                ) : (
                  <Archive aria-hidden="true" size={14} />
                )
              }
              onClick={toggleArchive}
            >
              {item.archived ? "Restore item" : "Archive item"}
            </Button>
          ) : null}
        </Disclosure>

        {error ? (
          <p className="text-sm font-medium text-error">{error}</p>
        ) : null}
      </div>
    </Sheet>
  )
}
