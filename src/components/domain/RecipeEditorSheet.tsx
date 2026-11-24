import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Calculator, ChevronDown, Plus, Trash2 } from "lucide-react"
import Button, { IconButton } from "../ui/Button"
import Card from "../ui/Card"
import CheckboxField from "../ui/CheckboxField"
import Field from "../ui/Field"
import { ImagePickerField } from "../ui/ImagePickerSheet"
import MoneyText from "../ui/MoneyText"
import SelectField from "../ui/SelectField"
import Sheet from "../ui/Sheet"
import InventoryItemSheet from "./InventoryItemSheet"
import PricingCalculatorSheet from "./PricingCalculatorSheet"
import { formatLkr } from "../../lib/format"
import { createId } from "../../lib/id"
import { compatibleUnits } from "../../lib/inventory"
import {
  estimateRecipeMaterialCost,
  fromDisplayUnitPrice,
  getDisplayPriceUnitLabel,
  toDisplayUnitPrice,
} from "../../lib/pricing"
import { useAppState } from "../../state/AppState"
import type {
  InventoryCategory,
  InventoryItem,
  PackagingRequirement,
  Recipe,
  RecipeIngredient,
  Unit,
} from "../../types"

type RecipeEditorSheetProps = {
  open: boolean
  recipe?: Recipe | null
  baseRecipe?: Recipe | null
  initialProductId?: string
  initialVariantId?: string
  isOrderCustomMode?: boolean
  onSave: (recipe: Recipe, saveToLibrary: boolean) => void
  onClose: () => void
}

type IngredientRowDraft = {
  key: string
  inventoryId: string
  quantity: string
  unit: Unit
}

type PackagingRowDraft = {
  key: string
  inventoryId: string
  quantity: string
}

export default function RecipeEditorSheet({
  open,
  recipe,
  baseRecipe,
  initialProductId,
  initialVariantId,
  isOrderCustomMode = false,
  onSave,
  onClose,
}: RecipeEditorSheetProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const activeProducts = useMemo(
    () => state.products.filter((p) => !p.archived),
    [state.products],
  )
  const ingredientItems = useMemo(
    () =>
      state.inventory.filter(
        (item) =>
          (item.category ?? "ingredient") === "ingredient" && !item.archived,
      ),
    [state.inventory],
  )
  const packagingItems = useMemo(
    () =>
      state.inventory.filter(
        (item) => item.category === "packaging" && !item.archived,
      ),
    [state.inventory],
  )

  const [name, setName] = useState("")
  const [image, setImage] = useState<string | undefined>(undefined)
  const [productId, setProductId] = useState("")
  const [variantId, setVariantId] = useState("")
  const [yieldCount, setYieldCount] = useState("1")
  const [yieldLabel, setYieldLabel] = useState("")
  const [prepMinutes, setPrepMinutes] = useState("60")
  const [ingredients, setIngredients] = useState<IngredientRowDraft[]>([])
  const [packaging, setPackaging] = useState<PackagingRowDraft[]>([])
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [steps, setSteps] = useState<string[]>([])
  const [newStep, setNewStep] = useState("")
  const [saveToLibrary, setSaveToLibrary] = useState(!isOrderCustomMode)
  const [showCustomPrices, setShowCustomPrices] = useState(false)
  const [error, setError] = useState("")

  const [quickItemCat, setQuickItemCat] = useState<
    Exclude<InventoryCategory, "finished"> | null
  >(null)
  const [pricingOpen, setPricingOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setError("")
    setNewStep("")
    setShowCustomPrices(false)
    const initialPrices: Record<string, string> = {}
    for (const item of state.inventory) {
      const displayVal = toDisplayUnitPrice(item.averageUnitCost, item.unit)
      if (displayVal !== undefined) {
        initialPrices[item.inventoryId] = String(displayVal)
      }
    }
    setPriceDrafts(initialPrices)

    const source = recipe ?? baseRecipe
    if (source) {
      setImage(source.image)
      setName(
        recipe
          ? recipe.name
          : isOrderCustomMode
            ? `${source.name} (custom)`
            : source.name,
      )
      setProductId(initialProductId || source.productId || activeProducts[0]?.id || "")
      setVariantId(
        initialVariantId ||
          source.variantId ||
          activeProducts.find((p) => p.id === (initialProductId || source.productId))
            ?.variants[0]?.id ||
          activeProducts[0]?.variants[0]?.id ||
          "",
      )
      setYieldCount(String(source.yield || 1))
      setYieldLabel(source.yieldLabel || "")
      setPrepMinutes(String(source.preparationMinutes || 60))
      setIngredients(
        source.ingredients.map((item) => ({
          key: `ing-${crypto.randomUUID().slice(0, 8)}`,
          inventoryId: item.inventoryId,
          quantity: String(item.quantity),
          unit: item.unit,
        })),
      )
      setPackaging(
        source.packaging.map((item) => ({
          key: `pkg-${crypto.randomUUID().slice(0, 8)}`,
          inventoryId: item.inventoryId,
          quantity: String(item.quantity),
        })),
      )
      setSteps(source.instructions.length ? [...source.instructions] : [""])
      setSaveToLibrary(!isOrderCustomMode)
    } else {
      const defaultProduct =
        activeProducts.find((p) => p.id === initialProductId) ??
        activeProducts[0]
      const defaultVariant =
        defaultProduct?.variants.find((v) => v.id === initialVariantId) ??
        defaultProduct?.variants[0]
      const firstIng = ingredientItems[0]
      setImage(undefined)
      setName(
        isOrderCustomMode
          ? defaultProduct
            ? `${defaultProduct.name} (custom)`
            : "Custom recipe"
          : "",
      )
      setProductId(defaultProduct?.id ?? "")
      setVariantId(defaultVariant?.id ?? "")
      setYieldCount("1")
      setYieldLabel(
        defaultVariant ? `1 × ${defaultVariant.unitLabel}` : "1 batch",
      )
      setPrepMinutes("60")
      setIngredients(
        firstIng
          ? [
              {
                key: `ing-${crypto.randomUUID().slice(0, 8)}`,
                inventoryId: firstIng.inventoryId,
                quantity: "250",
                unit: firstIng.unit,
              },
            ]
          : [],
      )
      setPackaging([])
      setSteps(isOrderCustomMode ? [] : ["Preheat oven and prepare baking tin."])
      setSaveToLibrary(!isOrderCustomMode)
    }
  }, [
    activeProducts,
    baseRecipe,
    ingredientItems,
    initialProductId,
    initialVariantId,
    isOrderCustomMode,
    open,
    recipe,
    state.inventory,
  ])

  const selectedProduct = activeProducts.find((p) => p.id === productId)
  const variantOptions = (selectedProduct?.variants ?? []).map((v) => ({
    value: v.id,
    label: v.name,
  }))

  const effectiveInventory: InventoryItem[] = useMemo(() => {
    return state.inventory.map((item) => {
      const rawDraft = priceDrafts[item.inventoryId]
      if (rawDraft === undefined || !rawDraft.trim()) return item
      const num = Number(rawDraft)
      if (!Number.isFinite(num) || num < 0) return item
      return {
        ...item,
        averageUnitCost: fromDisplayUnitPrice(num, item.unit),
      }
    })
  }, [priceDrafts, state.inventory])

  const compiledIngredients: RecipeIngredient[] = useMemo(() => {
    const byId = new Map(effectiveInventory.map((i) => [i.inventoryId, i]))
    return ingredients
      .map((row) => {
        const inv = byId.get(row.inventoryId)
        const qty = Number(row.quantity)
        if (!inv || !Number.isFinite(qty) || qty <= 0) return null
        return {
          inventoryId: inv.inventoryId,
          name: inv.name,
          quantity: qty,
          unit: row.unit,
        }
      })
      .filter((item): item is RecipeIngredient => item !== null)
  }, [effectiveInventory, ingredients])

  const compiledPackaging: PackagingRequirement[] = useMemo(() => {
    const byId = new Map(effectiveInventory.map((i) => [i.inventoryId, i]))
    return packaging
      .map((row) => {
        const inv = byId.get(row.inventoryId)
        const qty = Number(row.quantity)
        if (!inv || !Number.isFinite(qty) || qty <= 0) return null
        return {
          inventoryId: inv.inventoryId,
          name: inv.name,
          quantity: qty,
          unit: "unit" as const,
        }
      })
      .filter((item): item is PackagingRequirement => item !== null)
  }, [effectiveInventory, packaging])

  const liveCost = useMemo(
    () =>
      estimateRecipeMaterialCost(
        {
          ingredients: compiledIngredients,
          packaging: compiledPackaging,
          preparationMinutes: Number(prepMinutes) || 0,
        },
        effectiveInventory,
        state.settings.defaultLabourRatePerHour,
      ),
    [
      compiledIngredients,
      compiledPackaging,
      effectiveInventory,
      prepMinutes,
      state.settings.defaultLabourRatePerHour,
    ],
  )

  const handleAddIngredient = () => {
    const unused =
      ingredientItems.find(
        (item) =>
          !ingredients.some((row) => row.inventoryId === item.inventoryId),
      ) ?? ingredientItems[0]
    if (!unused) {
      setQuickItemCat("ingredient")
      return
    }
    setIngredients((current) => [
      ...current,
      {
        key: `ing-${crypto.randomUUID().slice(0, 8)}`,
        inventoryId: unused.inventoryId,
        quantity: unused.unit === "unit" ? "1" : "100",
        unit: unused.unit,
      },
    ])
  }

  const handleAddPackaging = () => {
    const unused =
      packagingItems.find(
        (item) =>
          !packaging.some((row) => row.inventoryId === item.inventoryId),
      ) ?? packagingItems[0]
    if (!unused) {
      setQuickItemCat("packaging")
      return
    }
    setPackaging((current) => [
      ...current,
      {
        key: `pkg-${crypto.randomUUID().slice(0, 8)}`,
        inventoryId: unused.inventoryId,
        quantity: "1",
      },
    ])
  }

  const handleAddStep = () => {
    const text = newStep.trim()
    if (!text) return
    setSteps((current) => [...current, text])
    setNewStep("")
  }

  const moveStep = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta
    if (nextIndex < 0 || nextIndex >= steps.length) return
    setSteps((current) => {
      const copy = [...current]
      const [moved] = copy.splice(index, 1)
      copy.splice(nextIndex, 0, moved)
      return copy
    })
  }

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Give this recipe a clear name.")
      return
    }
    if (!compiledIngredients.length && !compiledPackaging.length) {
      setError("Add at least one ingredient or packaging item.")
      return
    }
    const parsedYield = Number(yieldCount)
    if (!Number.isFinite(parsedYield) || parsedYield <= 0) {
      setError("Recipe yield must be greater than 0.")
      return
    }
    const parsedMinutes = Number(prepMinutes)
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 0) {
      setError("Prep time must be 0 minutes or higher.")
      return
    }

    // Persist any updated unit prices globally across all recipes
    const touchedIds = new Set([
      ...compiledIngredients.map((i) => i.inventoryId),
      ...compiledPackaging.map((p) => p.inventoryId),
    ])
    for (const invId of touchedIds) {
      const invItem = state.inventory.find((i) => i.inventoryId === invId)
      const draftStr = priceDrafts[invId]
      if (!invItem || draftStr === undefined || !draftStr.trim()) continue
      const parsedDisplay = Number(draftStr)
      if (!Number.isFinite(parsedDisplay) || parsedDisplay < 0) {
        setError(
          `Enter a valid price per ${getDisplayPriceUnitLabel(invItem.unit)} for ${invItem.name}.`,
        )
        return
      }
      const nextBaseCost = fromDisplayUnitPrice(parsedDisplay, invItem.unit)
      if (invItem.averageUnitCost !== nextBaseCost) {
        dispatchIfAccepted({
          type: "UPDATE_INVENTORY_ITEM",
          inventoryId: invId,
          patch: { averageUnitCost: nextBaseCost },
        })
      }
    }

    const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean)
    if (newStep.trim()) cleanedSteps.push(newStep.trim())

    const estimatedCost = liveCost.hasLivePricing
      ? liveCost.totalCost
      : recipe?.estimatedCost && recipe.estimatedCost > 0
        ? recipe.estimatedCost
        : Math.max(500, liveCost.labourCost)

    const nextRecipe: Recipe = {
      id: recipe?.id ?? createId("recipe"),
      name: trimmedName,
      ...(image ? { image } : {}),
      productId: productId || activeProducts[0]?.id || "custom-product",
      variantId:
        variantId ||
        activeProducts.find((p) => p.id === productId)?.variants[0]?.id ||
        "custom-variant",
      version: recipe ? recipe.version + 1 : 1,
      yield: parsedYield,
      yieldLabel: yieldLabel.trim() || `${parsedYield} × batch`,
      expectedOutput: recipe?.expectedOutput ?? null,
      preparationMinutes: Math.round(parsedMinutes),
      ingredients: compiledIngredients,
      packaging: compiledPackaging,
      instructions: cleanedSteps.length
        ? cleanedSteps
        : ["Follow standard bakery preparation method."],
      estimatedCost,
      updatedAt: new Date().toISOString(),
      ...(recipe?.history ? { history: recipe.history } : {}),
    }

    onSave(nextRecipe, saveToLibrary)
    onClose()
  }

  return (
    <>
      <Sheet
        open={open}
        title={
          recipe
            ? `Edit ${recipe.name}`
            : isOrderCustomMode
              ? "Customise recipe"
              : "New recipe"
        }
        subtitle={
          isOrderCustomMode
            ? `Est. cost ${formatLkr(liveCost.totalCost)}`
            : "Updating an ingredient price here updates it across all recipes"
        }
        onClose={onClose}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              {isOrderCustomMode
                ? "Apply to item"
                : recipe
                  ? "Save version"
                  : "Save recipe"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {isOrderCustomMode ? (
            <div className="grid grid-cols-[1fr_92px] gap-2.5">
              <Field
                label="Custom name"
                placeholder="e.g., Extra chocolate"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError("")
                }}
              />
              <Field
                label="Prep (min)"
                type="number"
                min="0"
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(e.target.value)}
              />
            </div>
          ) : (
            <>
              <Field
                label="Recipe name"
                placeholder="e.g., Signature ribbon cake"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError("")
                }}
              />

              <ImagePickerField
                label="Recipe photo"
                value={image}
                defaultCategory="bakes"
                onChange={setImage}
              />

              {activeProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Product"
                    value={productId}
                    options={activeProducts.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                    onChange={(e) => {
                      const nextP = activeProducts.find(
                        (p) => p.id === e.target.value,
                      )
                      setProductId(e.target.value)
                      setVariantId(nextP?.variants[0]?.id ?? "")
                    }}
                  />
                  <SelectField
                    label="Variant"
                    value={variantId}
                    options={
                      variantOptions.length
                        ? variantOptions
                        : [{ value: "", label: "Default" }]
                    }
                    onChange={(e) => setVariantId(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Batch yield"
                  type="number"
                  min="1"
                  value={yieldCount}
                  onChange={(e) => setYieldCount(e.target.value)}
                />
                <Field
                  label="Yield label"
                  placeholder="1 × 1 kg cake"
                  value={yieldLabel}
                  onChange={(e) => setYieldLabel(e.target.value)}
                />
                <Field
                  label="Prep (mins)"
                  type="number"
                  min="0"
                  value={prepMinutes}
                  onChange={(e) => setPrepMinutes(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-cocoa">
                Ingredients ({compiledIngredients.length})
              </span>
              <div className="flex items-center gap-1.5">
                {isOrderCustomMode ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomPrices((prev) => !prev)}
                    className="px-1.5 text-xs font-semibold text-muted hover:text-cocoa"
                  >
                    {showCustomPrices ? "Hide prices" : "Prices"}
                  </button>
                ) : null}
                <Button
                  size="compact"
                  variant="ghost"
                  onClick={() => setQuickItemCat("ingredient")}
                >
                  + New
                </Button>
                <Button
                  size="compact"
                  variant="soft"
                  leadingIcon={<Plus aria-hidden="true" size={15} />}
                  onClick={handleAddIngredient}
                >
                  Add
                </Button>
              </div>
            </div>

            {ingredients.map((row) => {
              const selectedItem = state.inventory.find(
                (i) => i.inventoryId === row.inventoryId,
              )
              const unitChoices = selectedItem
                ? compatibleUnits(selectedItem.unit)
                : (["g", "kg", "ml", "L", "unit"] as Unit[])
              const priceUnitLabel = selectedItem
                ? getDisplayPriceUnitLabel(selectedItem.unit)
                : "kg"

              if (isOrderCustomMode) {
                const missingPrice = !(priceDrafts[row.inventoryId] ?? "").trim()
                return (
                  <div
                    key={row.key}
                    className="space-y-2 rounded-control border border-warm-border bg-ivory/60 p-2.5"
                  >
                    <div className="grid grid-cols-[1fr_72px_68px_auto] items-center gap-1.5">
                      <select
                        aria-label="Ingredient"
                        value={row.inventoryId}
                        onChange={(e) => {
                          const nextInv = ingredientItems.find(
                            (i) => i.inventoryId === e.target.value,
                          )
                          setIngredients((current) =>
                            current.map((item) =>
                              item.key === row.key
                                ? {
                                    ...item,
                                    inventoryId: e.target.value,
                                    unit: nextInv ? nextInv.unit : item.unit,
                                  }
                                : item,
                            ),
                          )
                        }}
                        className="min-h-touch w-full rounded-control border border-warm-border bg-white px-2.5 text-sm text-cocoa outline-none focus:border-sage"
                      >
                        {ingredientItems.map((i) => (
                          <option key={i.inventoryId} value={i.inventoryId}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label="Quantity"
                        type="number"
                        min="0"
                        step="any"
                        value={row.quantity}
                        onChange={(e) =>
                          setIngredients((current) =>
                            current.map((item) =>
                              item.key === row.key
                                ? { ...item, quantity: e.target.value }
                                : item,
                            ),
                          )
                        }
                        className="min-h-touch w-full rounded-control border border-warm-border bg-white px-2 text-sm tabular-nums text-cocoa outline-none focus:border-sage"
                      />
                      <select
                        aria-label="Unit"
                        value={row.unit}
                        onChange={(e) =>
                          setIngredients((current) =>
                            current.map((item) =>
                              item.key === row.key
                                ? { ...item, unit: e.target.value as Unit }
                                : item,
                            ),
                          )
                        }
                        className="min-h-touch w-full rounded-control border border-warm-border bg-white px-2 text-sm text-cocoa outline-none focus:border-sage"
                      >
                        {unitChoices.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <IconButton
                        label="Remove ingredient"
                        className="size-9"
                        onClick={() =>
                          setIngredients((current) =>
                            current.filter((item) => item.key !== row.key),
                          )
                        }
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </IconButton>
                    </div>
                    {showCustomPrices || missingPrice ? (
                      <Field
                        label={`Price per ${priceUnitLabel} (Rs.)`}
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Enter price"
                        value={priceDrafts[row.inventoryId] ?? ""}
                        onChange={(e) =>
                          setPriceDrafts((prev) => ({
                            ...prev,
                            [row.inventoryId]: e.target.value,
                          }))
                        }
                      />
                    ) : null}
                  </div>
                )
              }

              return (
                <div
                  key={row.key}
                  className="space-y-2 rounded-control border border-warm-border bg-ivory/60 p-3"
                >
                  <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                    <SelectField
                      label="Ingredient"
                      value={row.inventoryId}
                      options={ingredientItems.map((i) => ({
                        value: i.inventoryId,
                        label: i.name,
                      }))}
                      onChange={(e) => {
                        const nextInv = ingredientItems.find(
                          (i) => i.inventoryId === e.target.value,
                        )
                        setIngredients((current) =>
                          current.map((item) =>
                            item.key === row.key
                              ? {
                                  ...item,
                                  inventoryId: e.target.value,
                                  unit: nextInv ? nextInv.unit : item.unit,
                                }
                              : item,
                          ),
                        )
                      }}
                    />
                    <IconButton
                      label="Remove ingredient"
                      className="size-10"
                      onClick={() =>
                        setIngredients((current) =>
                          current.filter((item) => item.key !== row.key),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </IconButton>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Field
                      label="Qty"
                      type="number"
                      min="0"
                      step="any"
                      value={row.quantity}
                      onChange={(e) =>
                        setIngredients((current) =>
                          current.map((item) =>
                            item.key === row.key
                              ? { ...item, quantity: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <SelectField
                      label="Unit"
                      value={row.unit}
                      options={unitChoices.map((u) => ({ value: u, label: u }))}
                      onChange={(e) =>
                        setIngredients((current) =>
                          current.map((item) =>
                            item.key === row.key
                              ? { ...item, unit: e.target.value as Unit }
                              : item,
                          ),
                        )
                      }
                    />
                    <Field
                      label={`Rs. / ${priceUnitLabel}`}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Price"
                      value={priceDrafts[row.inventoryId] ?? ""}
                      onChange={(e) =>
                        setPriceDrafts((prev) => ({
                          ...prev,
                          [row.inventoryId]: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {isOrderCustomMode ? (
            <details
              open={packaging.length > 0}
              className="rounded-control border border-warm-border bg-white"
            >
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between px-3.5 text-sm font-semibold text-cocoa">
                <span>Packaging ({compiledPackaging.length})</span>
                <ChevronDown
                  aria-hidden="true"
                  size={15}
                  className="text-muted"
                />
              </summary>
              <div className="space-y-2 border-t border-warm-border p-3">
                {packaging.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_72px_auto] items-center gap-1.5"
                  >
                    <select
                      aria-label="Packaging item"
                      value={row.inventoryId}
                      onChange={(e) =>
                        setPackaging((current) =>
                          current.map((item) =>
                            item.key === row.key
                              ? { ...item, inventoryId: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="min-h-touch w-full rounded-control border border-warm-border bg-white px-2.5 text-sm text-cocoa outline-none focus:border-sage"
                    >
                      {packagingItems.map((i) => (
                        <option key={i.inventoryId} value={i.inventoryId}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Packaging quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) =>
                        setPackaging((current) =>
                          current.map((item) =>
                            item.key === row.key
                              ? { ...item, quantity: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="min-h-touch w-full rounded-control border border-warm-border bg-white px-2 text-sm tabular-nums text-cocoa outline-none focus:border-sage"
                    />
                    <IconButton
                      label="Remove packaging"
                      className="size-9"
                      onClick={() =>
                        setPackaging((current) =>
                          current.filter((item) => item.key !== row.key),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </IconButton>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    size="compact"
                    variant="soft"
                    className="flex-1"
                    leadingIcon={<Plus aria-hidden="true" size={14} />}
                    onClick={handleAddPackaging}
                  >
                    Add packaging
                  </Button>
                  <Button
                    size="compact"
                    variant="ghost"
                    onClick={() => setQuickItemCat("packaging")}
                  >
                    + New
                  </Button>
                </div>
              </div>
            </details>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-cocoa">
                  Packaging ({compiledPackaging.length})
                </span>
                <div className="flex gap-1.5">
                  <Button
                    size="compact"
                    variant="ghost"
                    onClick={() => setQuickItemCat("packaging")}
                  >
                    + New box/board
                  </Button>
                  <Button
                    size="compact"
                    variant="soft"
                    leadingIcon={<Plus aria-hidden="true" size={15} />}
                    onClick={handleAddPackaging}
                  >
                    Add row
                  </Button>
                </div>
              </div>

              {packaging.map((row) => (
                <div
                  key={row.key}
                  className="space-y-2 rounded-control border border-warm-border bg-ivory/60 p-3"
                >
                  <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                    <SelectField
                      label="Packaging item"
                      value={row.inventoryId}
                      options={packagingItems.map((i) => ({
                        value: i.inventoryId,
                        label: i.name,
                      }))}
                      onChange={(e) =>
                        setPackaging((current) =>
                          current.map((item) =>
                            item.key === row.key
                              ? { ...item, inventoryId: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <IconButton
                      label="Remove packaging"
                      className="size-10"
                      onClick={() =>
                        setPackaging((current) =>
                          current.filter((item) => item.key !== row.key),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </IconButton>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label="Qty (unit)"
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) =>
                        setPackaging((current) =>
                          current.map((item) =>
                            item.key === row.key
                              ? { ...item, quantity: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Field
                      label="Rs. / unit"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Price"
                      value={priceDrafts[row.inventoryId] ?? ""}
                      onChange={(e) =>
                        setPriceDrafts((prev) => ({
                          ...prev,
                          [row.inventoryId]: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isOrderCustomMode ? (
            <details
              open={steps.length === 0}
              className="rounded-control border border-warm-border bg-white"
            >
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between px-3.5 text-sm font-semibold text-cocoa">
                <span>Preparation steps ({steps.filter((s) => s.trim()).length})</span>
                <ChevronDown
                  aria-hidden="true"
                  size={15}
                  className="text-muted"
                />
              </summary>
              <div className="space-y-2 border-t border-warm-border p-3">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-soft text-xs font-bold text-sage-dark">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={`Step ${index + 1}`}
                      value={step}
                      onChange={(e) =>
                        setSteps((current) =>
                          current.map((s, i) =>
                            i === index ? e.target.value : s,
                          ),
                        )
                      }
                      className="min-h-touch flex-1 rounded-control border border-warm-border bg-white px-3 text-sm text-cocoa outline-none focus:border-sage"
                    />
                    <IconButton
                      label={`Delete step ${index + 1}`}
                      className="size-8"
                      onClick={() =>
                        setSteps((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </IconButton>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a step..."
                    value={newStep}
                    onChange={(e) => setNewStep(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddStep()
                      }
                    }}
                    className="min-h-touch flex-1 rounded-control border border-warm-border bg-white px-3 text-sm text-cocoa outline-none focus:border-sage"
                  />
                  <Button size="compact" variant="soft" onClick={handleAddStep}>
                    Add
                  </Button>
                </div>
              </div>
            </details>
          ) : (
            <div className="space-y-2.5">
              <span className="block text-sm font-semibold text-cocoa">
                Preparation steps
              </span>
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-soft text-xs font-bold text-sage-dark">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    aria-label={`Step ${index + 1}`}
                    value={step}
                    onChange={(e) =>
                      setSteps((current) =>
                        current.map((s, i) => (i === index ? e.target.value : s)),
                      )
                    }
                    className="min-h-touch flex-1 rounded-control border border-warm-border bg-white px-3 text-sm text-cocoa outline-none focus:border-sage"
                  />
                  <IconButton
                    label={`Move step ${index + 1} up`}
                    className="size-8"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" size={14} />
                  </IconButton>
                  <IconButton
                    label={`Move step ${index + 1} down`}
                    className="size-8"
                    disabled={index === steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" size={14} />
                  </IconButton>
                  <IconButton
                    label={`Delete step ${index + 1}`}
                    className="size-8"
                    onClick={() =>
                      setSteps((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </IconButton>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add another step..."
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddStep()
                    }
                  }}
                  className="min-h-touch flex-1 rounded-control border border-warm-border bg-white px-3 text-sm text-cocoa outline-none focus:border-sage"
                />
                <Button size="compact" variant="soft" onClick={handleAddStep}>
                  Add step
                </Button>
              </div>
            </div>
          )}

          {!isOrderCustomMode ? (
            <Card tone="sage" className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-sage-dark">
                  Live batch cost estimate
                </div>
                <div className="mt-0.5 text-base font-bold text-cocoa">
                  <MoneyText amount={liveCost.totalCost} />
                </div>
                <div className="text-[11px] text-muted">
                  Materials{" "}
                  <MoneyText
                    amount={liveCost.ingredientsCost + liveCost.packagingCost}
                  />{" "}
                  + Labour <MoneyText amount={liveCost.labourCost} />
                </div>
              </div>
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<Calculator aria-hidden="true" size={15} />}
                onClick={() => setPricingOpen(true)}
              >
                Price check
              </Button>
            </Card>
          ) : null}

          {isOrderCustomMode ? (
            <CheckboxField
              checked={saveToLibrary}
              onChange={setSaveToLibrary}
              label="Also save to Recipe Library"
              description="Leave off to use this recipe only for this order."
            />
          ) : null}

          {error ? (
            <p className="text-sm font-medium text-error">{error}</p>
          ) : null}
        </div>
      </Sheet>

      <InventoryItemSheet
        open={quickItemCat !== null}
        defaultCategory={quickItemCat ?? "ingredient"}
        onClose={() => setQuickItemCat(null)}
        onSaved={(newItem) => {
          const displayVal = toDisplayUnitPrice(
            newItem.averageUnitCost,
            newItem.unit,
          )
          if (displayVal !== undefined) {
            setPriceDrafts((prev) => ({
              ...prev,
              [newItem.inventoryId]: String(displayVal),
            }))
          }
          if ((newItem.category ?? "ingredient") === "packaging") {
            setPackaging((current) => [
              ...current,
              {
                key: `pkg-${crypto.randomUUID().slice(0, 8)}`,
                inventoryId: newItem.inventoryId,
                quantity: "1",
              },
            ])
          } else {
            setIngredients((current) => [
              ...current,
              {
                key: `ing-${crypto.randomUUID().slice(0, 8)}`,
                inventoryId: newItem.inventoryId,
                quantity: newItem.unit === "unit" ? "1" : "100",
                unit: newItem.unit,
              },
            ])
          }
        }}
      />

      <PricingCalculatorSheet
        open={pricingOpen}
        recipe={{
          name: name.trim() || "Recipe draft",
          ingredients: compiledIngredients,
          packaging: compiledPackaging,
          preparationMinutes: Number(prepMinutes) || 0,
          estimatedCost: liveCost.totalCost,
        }}
        onClose={() => setPricingOpen(false)}
      />
    </>
  )
}
