import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  BookOpen,
  Calculator,
  Copy,
  History,
  Layers,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
} from "lucide-react"
import InventoryItemSheet from "../components/domain/InventoryItemSheet"
import ProductEditorSheet from "../components/domain/ProductEditorSheet"
import PricingCalculatorSheet from "../components/domain/PricingCalculatorSheet"
import RecipeEditorSheet from "../components/domain/RecipeEditorSheet"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import EmptyState from "../components/ui/EmptyState"
import Field from "../components/ui/Field"
import { GroupedList, ListRow } from "../components/ui/GroupedList"
import ItemThumbnail from "../components/ui/ItemThumbnail"
import MoneyText from "../components/ui/MoneyText"
import { PushView, TabView } from "../components/ui/MotionPrimitives"
import SegmentedControl from "../components/ui/SegmentedControl"
import StatusBadge from "../components/ui/StatusBadge"
import Stepper from "../components/ui/Stepper"
import { useToast } from "../components/ui/Toast"
import { formatDualQuantity, formatLkr, formatQuantity } from "../lib/format"
import { createId } from "../lib/id"
import { convertInventoryUnitQuantity } from "../lib/inventory"
import {
  calculateItemRecipeCost,
  getDisplayPriceUnitLabel,
  resolveRecipeSellingPrice,
  toDisplayUnitPrice,
} from "../lib/pricing"
import { useAppState } from "../state/AppState"
import type { InventoryItem, Product, Recipe, Unit } from "../types"

type RecipesScreenProps = {
  onFocusedChange: (focused: boolean) => void
}

type RecipesTabSection = "recipes" | "products"

export default function RecipesScreen({ onFocusedChange }: RecipesScreenProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()

  const [section, setSection] = useState<RecipesTabSection>("recipes")
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [scaleMultiplier, setScaleMultiplier] = useState(1)
  const [unitView, setUnitView] = useState<"recipe" | "base" | "tsp">("recipe")
  const [showHistory, setShowHistory] = useState(false)

  const [recipeEditorTarget, setRecipeEditorTarget] =
    useState<Recipe | "new" | null>(null)
  const [productEditorTarget, setProductEditorTarget] =
    useState<Product | "new" | null>(null)
  const [linkRecipeTarget, setLinkRecipeTarget] = useState<Recipe | null>(null)
  const [pricingTarget, setPricingTarget] = useState<Recipe | null>(null)
  const [editingPriceItem, setEditingPriceItem] =
    useState<InventoryItem | null>(null)

  const recipes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return state.recipes.filter((recipe) => {
      if (!showArchived && recipe.archived) return false
      if (!query) return true
      const product = state.products.find(
        (item) => item.id === recipe.productId,
      )
      const variant = product?.variants.find(
        (item) => item.id === recipe.variantId,
      )
      return [recipe.name, product?.name, variant?.name]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [search, showArchived, state.products, state.recipes])

  const products = useMemo(() => {
    const query = search.trim().toLowerCase()
    return state.products.filter((product) => {
      if (!showArchived && product.archived) return false
      if (!query) return true
      return [product.name, ...product.variants.map((v) => v.name)]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [search, showArchived, state.products])

  const selectedRecipe = state.recipes.find(
    (recipe) => recipe.id === selectedRecipeId,
  )

  useEffect(() => {
    onFocusedChange(Boolean(selectedRecipe))
    return () => onFocusedChange(false)
  }, [selectedRecipe, onFocusedChange])

  const openRecipe = (recipeId: string) => {
    setSelectedRecipeId(recipeId)
    setScaleMultiplier(1)
    setShowHistory(false)
  }

  const closeRecipe = () => {
    setSelectedRecipeId(null)
    setShowHistory(false)
  }

  const handleDuplicateRecipe = (source: Recipe) => {
    const clone: Recipe = {
      ...structuredClone(source),
      id: createId("recipe"),
      name: `${source.name} (Copy)`,
      version: 1,
      archived: false,
      history: [],
      updatedAt: new Date().toISOString(),
    }
    if (dispatchIfAccepted({ type: "ADD_RECIPE", recipe: clone })) {
      showToast("Recipe duplicated")
      openRecipe(clone.id)
    }
  }

  const renderRecipeDetail = () => {
    if (!selectedRecipe) return null
    const product = state.products.find(
      (item) => item.id === selectedRecipe.productId,
    )
    const variant = product?.variants.find(
      (item) => item.id === selectedRecipe.variantId,
    )
    const resolvedPrice = resolveRecipeSellingPrice(
      selectedRecipe,
      state.inventory,
      state.settings,
    )
    const effectiveCost = resolvedPrice.effectiveCost

    return (
      <div className="focused-flow pb-10">
          <ScreenHeader
            title={selectedRecipe.name}
            subtitle={`${product ? product.name : "Standalone recipe"}${
              variant ? ` · ${variant.name}` : ""
            } · v${selectedRecipe.version}`}
            onBack={closeRecipe}
            action={
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<Pencil aria-hidden="true" size={14} />}
                onClick={() => setRecipeEditorTarget(selectedRecipe)}
              >
                Edit
              </Button>
            }
          />

          <div className="space-y-4">
            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="neutral">
                    {selectedRecipe.yieldLabel}
                  </StatusBadge>
                  <StatusBadge tone="progress">
                    {selectedRecipe.preparationMinutes} mins
                  </StatusBadge>
                  {selectedRecipe.archived ? (
                    <StatusBadge tone="warning">Archived</StatusBadge>
                  ) : null}
                </div>
                <ItemThumbnail
                  image={selectedRecipe.image ?? product?.image}
                  alt={selectedRecipe.name}
                  size="md"
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-warm-border pt-3">
                <div>
                  <div className="text-xs text-muted">
                    {resolvedPrice.source === "saved"
                      ? scaleMultiplier === 1
                        ? "Selling price"
                        : `Selling price (${scaleMultiplier}×)`
                      : scaleMultiplier === 1
                        ? "Suggested price"
                        : `Suggested price (${scaleMultiplier}×)`}
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-cocoa">
                    <MoneyText
                      amount={Math.round(
                        resolvedPrice.sellingPrice * scaleMultiplier,
                      )}
                    />
                  </div>
                  <div className="text-[11px] text-muted">
                    Est. cost{" "}
                    <MoneyText
                      amount={Math.round(effectiveCost * scaleMultiplier)}
                    />{" "}
                    · {resolvedPrice.marginPercent}% margin
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!product && !selectedRecipe.archived ? (
                    <Button
                      size="compact"
                      variant="secondary"
                      leadingIcon={<Plus aria-hidden="true" size={14} />}
                      onClick={() => {
                        setLinkRecipeTarget(selectedRecipe)
                        setProductEditorTarget("new")
                      }}
                    >
                      Add to Products
                    </Button>
                  ) : null}
                  <Button
                    size="compact"
                    variant="soft"
                    leadingIcon={<Calculator aria-hidden="true" size={15} />}
                    onClick={() => setPricingTarget(selectedRecipe)}
                  >
                    Price
                  </Button>
                </div>
              </div>
            </Card>

            <Card
              tone="sage"
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-cocoa">
                <Scale aria-hidden="true" size={16} />
                Scale recipe
              </div>
              <Stepper
                label="Recipe scale multiplier"
                value={scaleMultiplier}
                min={0.5}
                max={10}
                step={0.5}
                unit="×"
                onChange={setScaleMultiplier}
              />
            </Card>

            <div className="space-y-2">
              <SegmentedControl
                label="Measure display units"
                value={unitView}
                onChange={(val) => setUnitView(val as "recipe" | "base" | "tsp")}
                segments={[
                  { value: "recipe", label: "Recipe units" },
                  { value: "base", label: "g / ml" },
                  { value: "tsp", label: "Teaspoons" },
                ]}
              />
              <GroupedList title={`Ingredients (${selectedRecipe.ingredients.length})`}>
                {selectedRecipe.ingredients.map((item) => {
                  const invItem = state.inventory.find(
                    (i) => i.inventoryId === item.inventoryId,
                  )
                  const unitPrice = invItem
                    ? toDisplayUnitPrice(invItem.averageUnitCost, invItem.unit)
                    : undefined
                  const priceUnitLabel = invItem
                    ? getDisplayPriceUnitLabel(invItem.unit)
                    : "kg"
                  const lineCost = calculateItemRecipeCost(
                    item.quantity * scaleMultiplier,
                    item.unit,
                    invItem,
                  )
                  const scaledQty = item.quantity * scaleMultiplier
                  let displayQty = scaledQty
                  let displayUnit: Unit = item.unit
                  if (invItem && (invItem.unit === "g" || invItem.unit === "ml")) {
                    const targetUnit: Unit | null =
                      unitView === "base"
                        ? invItem.unit
                        : unitView === "tsp"
                          ? "tsp"
                          : null
                    if (targetUnit) {
                      const converted = convertInventoryUnitQuantity(
                        scaledQty,
                        item.unit,
                        targetUnit,
                        invItem,
                      )
                      if (Number.isFinite(converted)) {
                        displayQty = converted
                        displayUnit = targetUnit
                      }
                    }
                  }
                  const roundedQty = Number(displayQty.toFixed(2))
                  const dual = formatDualQuantity(roundedQty, displayUnit, invItem)
                  return (
                    <ListRow
                      key={`${item.inventoryId}-${item.name}`}
                      leading={
                        <ItemThumbnail
                          image={invItem?.image}
                          alt={invItem?.name ?? item.name}
                          size="sm"
                        />
                      }
                      title={invItem?.name ?? item.name}
                      subtitle={
                        unitPrice !== undefined
                          ? `${formatLkr(unitPrice)} / ${priceUnitLabel}${
                              lineCost !== null ? ` · Cost ${formatLkr(lineCost)}` : ""
                            }`
                          : "Tap to set price per " + priceUnitLabel
                      }
                      value={
                        dual.secondary
                          ? `${dual.primary} (${dual.secondary})`
                          : dual.primary
                      }
                      showChevron={Boolean(invItem)}
                      onClick={
                        invItem ? () => setEditingPriceItem(invItem) : undefined
                      }
                    />
                  )
                })}
              </GroupedList>
            </div>

            {selectedRecipe.packaging.length > 0 ? (
              <GroupedList
                title={`Packaging (${selectedRecipe.packaging.length})`}
              >
                {selectedRecipe.packaging.map((item) => {
                  const invItem = state.inventory.find(
                    (i) => i.inventoryId === item.inventoryId,
                  )
                  const unitPrice = invItem
                    ? toDisplayUnitPrice(invItem.averageUnitCost, invItem.unit)
                    : undefined
                  const lineCost = calculateItemRecipeCost(
                    item.quantity * scaleMultiplier,
                    item.unit,
                    invItem,
                  )
                  return (
                    <ListRow
                      key={`${item.inventoryId}-${item.name}`}
                      leading={
                        invItem?.image ? (
                          <ItemThumbnail
                            image={invItem.image}
                            alt={invItem.name}
                            size="sm"
                          />
                        ) : (
                          <Package
                            aria-hidden="true"
                            size={16}
                            className="text-muted"
                          />
                        )
                      }
                      title={invItem?.name ?? item.name}
                      subtitle={
                        unitPrice !== undefined
                          ? `${formatLkr(unitPrice)} / unit${
                              lineCost !== null
                                ? ` · Cost ${formatLkr(lineCost)}`
                                : ""
                            }`
                          : "Tap to set price per unit"
                      }
                      value={formatQuantity(
                        Number((item.quantity * scaleMultiplier).toFixed(2)),
                        item.unit,
                      )}
                      showChevron={Boolean(invItem)}
                      onClick={
                        invItem ? () => setEditingPriceItem(invItem) : undefined
                      }
                    />
                  )
                })}
              </GroupedList>
            ) : null}

            <Card className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-cocoa">
                <BookOpen aria-hidden="true" size={16} />
                Preparation instructions
              </div>
              <ol className="space-y-2.5 text-sm text-cocoa">
                {selectedRecipe.instructions.map((step, index) => (
                  <li key={index} className="flex gap-2.5">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-soft text-xs font-bold text-sage-dark">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>

            {selectedRecipe.history && selectedRecipe.history.length > 0 ? (
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cocoa">
                    <History aria-hidden="true" size={16} />
                    Previous versions ({selectedRecipe.history.length})
                  </div>
                  <Button
                    size="compact"
                    variant="ghost"
                    onClick={() => setShowHistory((v) => !v)}
                  >
                    {showHistory ? "Hide" : "Show"}
                  </Button>
                </div>
                {showHistory ? (
                  <div className="space-y-2 border-t border-warm-border pt-2">
                    {selectedRecipe.history.map((snap) => (
                      <div
                        key={`v-${snap.version}`}
                        className="flex items-center justify-between rounded-control bg-ivory p-2.5 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-cocoa">
                            v{snap.version} · {snap.yieldLabel}
                          </div>
                          <div className="text-muted">
                            {snap.ingredients.length} ingredients ·{" "}
                            {snap.preparationMinutes} mins
                          </div>
                        </div>
                        <MoneyText amount={snap.estimatedCost} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <Button
                variant="secondary"
                leadingIcon={<Copy aria-hidden="true" size={15} />}
                onClick={() => handleDuplicateRecipe(selectedRecipe)}
              >
                Duplicate
              </Button>
              <Button
                variant="secondary"
                leadingIcon={
                  selectedRecipe.archived ? (
                    <RotateCcw aria-hidden="true" size={15} />
                  ) : (
                    <Archive aria-hidden="true" size={15} />
                  )
                }
                onClick={() => {
                  const nextArchived = !selectedRecipe.archived
                  if (
                    dispatchIfAccepted({
                      type: "ARCHIVE_RECIPE",
                      recipeId: selectedRecipe.id,
                      archived: nextArchived,
                    })
                  ) {
                    showToast(
                      nextArchived ? "Recipe archived" : "Recipe restored",
                    )
                  }
                }}
              >
                {selectedRecipe.archived ? "Restore" : "Archive"}
              </Button>
            </div>
          </div>
        </div>
    )
  }

  const renderList = () => (
    <div className="space-y-4 pb-6">
        <ScreenHeader
          title="Recipes"
          action={
            <Button
              size="compact"
              leadingIcon={<Plus aria-hidden="true" size={16} />}
              onClick={() =>
                section === "recipes"
                  ? setRecipeEditorTarget("new")
                  : setProductEditorTarget("new")
              }
            >
              {section === "recipes" ? "Recipe" : "Product"}
            </Button>
          }
        />

        <div className="flex items-center justify-between gap-2">
          <SegmentedControl
            label="Recipes section"
            value={section}
            onChange={(value) => setSection(value as RecipesTabSection)}
            segments={[
              { value: "recipes", label: `Recipes (${recipes.length})` },
              { value: "products", label: `Products (${products.length})` },
            ]}
          />
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="shrink-0 text-xs font-semibold text-muted hover:text-cocoa"
          >
            {showArchived ? "Hide archived" : "Archived"}
          </button>
        </div>

        <Field
          label="Search recipes or products"
          hideLabel
          isSearch
          placeholder={
            section === "recipes"
              ? "Search recipes..."
              : "Search products..."
          }
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <TabView viewKey={section}>
          {section === "recipes" ? (
          recipes.length > 0 ? (
            <div className="grid-cards">
              {recipes.map((recipe) => {
                const product = state.products.find(
                  (item) => item.id === recipe.productId,
                )
                const variant = product?.variants.find(
                  (item) => item.id === recipe.variantId,
                )
                const resolvedCardPrice = resolveRecipeSellingPrice(
                  recipe,
                  state.inventory,
                  state.settings,
                )
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => openRecipe(recipe.id)}
                    className="group block h-full min-w-0 w-full rounded-card text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30"
                  >
                    <Card className="flex h-full flex-col justify-between transition duration-ui group-hover:border-sage-border group-active:scale-button">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <ItemThumbnail
                            image={recipe.image ?? product?.image}
                            alt={recipe.name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h2 className="text-base font-semibold text-cocoa">
                                {recipe.name}
                              </h2>
                              {recipe.archived ? (
                                <StatusBadge tone="warning">Archived</StatusBadge>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              {product
                                ? `${product.name}${variant ? ` · ${variant.name}` : ""} · `
                                : ""}
                              v{recipe.version}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-cocoa">
                            <MoneyText amount={resolvedCardPrice.sellingPrice} />
                          </div>
                          <div className="text-[11px] text-muted">
                            Cost <MoneyText amount={resolvedCardPrice.effectiveCost} /> ·{" "}
                            {recipe.preparationMinutes} mins
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-warm-border/70 pt-2.5 text-xs text-muted">
                        <span>{recipe.ingredients.length} ingredients</span>
                        <span>·</span>
                        <span>{recipe.packaging.length} packaging</span>
                        <span>·</span>
                        <span>{recipe.yieldLabel}</span>
                      </div>
                    </Card>
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyState
              illustration="recipe-book"
              title="No matching recipes"
              description="Create your first recipe to track exact ingredient weights, preparation time, and live cost."
              actionLabel="Create recipe"
              onAction={() => setRecipeEditorTarget("new")}
            />
          )
        ) : products.length > 0 ? (
          <div className="grid-cards">
            {products.map((product) => (
              <Card key={product.id} className="flex h-full min-w-0 flex-col justify-between space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <ItemThumbnail
                      image={product.image}
                      alt={product.name}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold leading-snug text-cocoa">
                          {product.name}
                        </h2>
                        {product.archived ? (
                          <StatusBadge tone="warning">Archived</StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {product.variants.length}{" "}
                        {product.variants.length === 1 ? "option" : "options"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="compact"
                      variant="secondary"
                      onClick={() => setProductEditorTarget(product)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="compact"
                      variant="ghost"
                      onClick={() => {
                        const nextArchived = !product.archived
                        dispatchIfAccepted({
                          type: "ARCHIVE_PRODUCT",
                          productId: product.id,
                          archived: nextArchived,
                        })
                        showToast(
                          nextArchived
                            ? "Product archived"
                            : "Product restored",
                        )
                      }}
                    >
                      {product.archived ? "Restore" : "Archive"}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.variants.map((variant) => (
                    <span
                      key={variant.id}
                      className="rounded-full bg-ivory px-2.5 py-1 text-xs font-medium text-cocoa"
                    >
                      {variant.name} ({variant.unitLabel})
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            illustration="recipe-book"
            title="No products yet"
            description="Add the items, jars, or treats you sell so customer orders stay organized."
            actionLabel="Add product"
            onAction={() => setProductEditorTarget("new")}
          />
        )}
        </TabView>
      </div>
  )

  return (
    <>
      <PushView
        viewKey={selectedRecipe ? `recipe-${selectedRecipe.id}` : "list"}
        depth={selectedRecipe ? 1 : 0}
      >
        {selectedRecipe ? renderRecipeDetail() : renderList()}
      </PushView>

      <RecipeEditorSheet
        open={recipeEditorTarget !== null}
        recipe={recipeEditorTarget === "new" ? null : recipeEditorTarget}
        onSave={(saved) => {
          if (recipeEditorTarget === "new") {
            if (!dispatchIfAccepted({ type: "ADD_RECIPE", recipe: saved })) {
              showToast({ message: "Could not create recipe", tone: "warning" })
              return
            }
            showToast("Recipe created")
          } else {
            if (!dispatchIfAccepted({ type: "UPDATE_RECIPE", recipe: saved })) {
              showToast({ message: "Could not save recipe", tone: "warning" })
              return
            }
            showToast(`Saved ${saved.name} v${saved.version}`)
          }
        }}
        onClose={() => setRecipeEditorTarget(null)}
      />

      <ProductEditorSheet
        open={productEditorTarget !== null}
        product={productEditorTarget === "new" ? null : productEditorTarget}
        linkRecipe={linkRecipeTarget}
        onClose={() => {
          setProductEditorTarget(null)
          setLinkRecipeTarget(null)
        }}
        onSaved={(saved) =>
          showToast(
            linkRecipeTarget
              ? `Added ${saved.name} to Products and linked recipe`
              : `Saved ${saved.name}`,
          )
        }
      />

      <PricingCalculatorSheet
        open={pricingTarget !== null}
        recipe={pricingTarget ?? undefined}
        quantity={scaleMultiplier >= 1 ? Math.round(scaleMultiplier) : 1}
        currentSellingPrice={
          pricingTarget
            ? resolveRecipeSellingPrice(
                pricingTarget,
                state.inventory,
                state.settings,
              ).sellingPrice *
              (scaleMultiplier >= 1 ? Math.round(scaleMultiplier) : 1)
            : undefined
        }
        allowSaveDefaults
        applyLabel="Save price"
        onApplyPricing={({ sellingPrice, pricing, saveAsDefault }) => {
          if (!pricingTarget) return
          const updatedRecipe: Recipe = {
            ...structuredClone(pricingTarget),
            sellingPrice,
            pricing,
            updatedAt: new Date().toISOString(),
          }
          if (dispatchIfAccepted({ type: "UPDATE_RECIPE", recipe: updatedRecipe })) {
            showToast({
              message: `Saved selling price ${formatLkr(sellingPrice)}`,
              tone: "success",
            })
          }
          if (saveAsDefault) {
            dispatchIfAccepted({
              type: "UPDATE_SETTINGS",
              patch: {
                defaultPricingMode: pricing.mode,
                defaultMarginPercent: pricing.marginPercent,
                defaultMarkupPercent: pricing.markupPercent,
                defaultLabourRatePerHour: pricing.labourRatePerHour,
                priceRoundingStep: pricing.roundingStep,
              },
            })
          }
        }}
        onClose={() => setPricingTarget(null)}
      />

      <InventoryItemSheet
        open={editingPriceItem !== null}
        item={editingPriceItem}
        onClose={() => setEditingPriceItem(null)}
        onSaved={(saved) =>
          showToast(`Updated ${saved.name} price across all recipes`)
        }
      />
    </>
  )
}
