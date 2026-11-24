import { useEffect, useState } from "react"
import Button from "../ui/Button"
import Field from "../ui/Field"
import { ImagePickerField } from "../ui/ImagePickerSheet"
import SelectField from "../ui/SelectField"
import Sheet from "../ui/Sheet"
import { createId } from "../../lib/id"
import {
  fromDisplayUnitPrice,
  getDisplayPriceUnitLabel,
  toDisplayUnitPrice,
} from "../../lib/pricing"
import { useAppState } from "../../state/AppState"
import type { BaseUnit, InventoryCategory, InventoryItem } from "../../types"

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
  const [category, setCategory] = useState<Exclude<InventoryCategory, "finished">>(
    defaultCategory,
  )
  const [unit, setUnit] = useState<BaseUnit>("g")
  const [displayPrice, setDisplayPrice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    if (item) {
      setName(item.name)
      setImage(item.image)
      setCategory(item.category === "packaging" ? "packaging" : "ingredient")
      setUnit(item.unit)
      const priceVal = toDisplayUnitPrice(item.averageUnitCost, item.unit)
      setDisplayPrice(priceVal !== undefined ? String(priceVal) : "")
    } else {
      setName("")
      setImage(undefined)
      setCategory(defaultCategory)
      setUnit(defaultCategory === "ingredient" ? "g" : "unit")
      setDisplayPrice("")
    }
  }, [defaultCategory, item, open])

  const priceUnitLabel = getDisplayPriceUnitLabel(unit)

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

    if (item) {
      const ok = dispatchIfAccepted({
        type: "UPDATE_INVENTORY_ITEM",
        inventoryId: item.inventoryId,
        patch: {
          name: trimmedName,
          image: image ?? null,
          ...(baseCost !== undefined ? { averageUnitCost: baseCost } : {}),
        },
      })
      if (!ok) {
        setError("Could not save changes to this item.")
        return
      }
      onSaved?.({
        ...item,
        name: trimmedName,
        image,
        ...(baseCost !== undefined ? { averageUnitCost: baseCost } : {}),
      })
      onClose()
      return
    }

    const newItem: InventoryItem = {
      inventoryId: createId(category),
      name: trimmedName,
      ...(image ? { image } : {}),
      physical: 0,
      unit,
      category,
      lowStockThreshold: 0,
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

  return (
    <Sheet
      open={open}
      title={item ? `Edit ${item.name}` : "New ingredient or packaging"}
      subtitle="Changes to the unit price automatically update all recipes using this item"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            {item ? "Save price & name" : "Add item"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field
          label="Name"
          placeholder="e.g., Mozzarella, Dried chili, Glass jar 250g"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError("")
          }}
        />

        <ImagePickerField
          label={category === "packaging" ? "Packaging photo" : "Ingredient photo"}
          value={image}
          defaultCategory={category === "packaging" ? "packaging" : "ingredients"}
          onChange={setImage}
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
              if (nextCat === "packaging") setUnit("unit")
            }}
          />
          <SelectField
            label="Measured by"
            value={unit}
            disabled={Boolean(item) || category === "packaging"}
            options={[
              { value: "g", label: "Weight (g / kg)" },
              { value: "ml", label: "Volume (ml / L)" },
              { value: "unit", label: "Pieces (unit)" },
            ]}
            onChange={(e) => setUnit(e.target.value as BaseUnit)}
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
          helperText={`Used across all recipes to calculate live cost per ${priceUnitLabel}.`}
        />

        {error ? (
          <p className="text-sm font-medium text-error">{error}</p>
        ) : null}
      </div>
    </Sheet>
  )
}
