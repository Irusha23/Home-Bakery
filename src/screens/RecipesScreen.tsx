import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  BookOpen,
  Calculator,
  Clock3,
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
import { formatLkr, formatQuantity } from "../lib/format"
import { createId } from "../lib/id"
import {
  calculateItemRecipeCost,
  estimateRecipeMaterialCost,
  getDisplayPriceUnitLabel,
  toDisplayUnitPrice,
} from "../lib/pricing"
import { useAppState } from "../state/AppState"
import type { InventoryItem, Product, Recipe } from "../types"

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
  const [showHistory, setShowHistory] = useState(false)

  const [recipeEditorTarget, setRecipeEditorTarget] =
    useState<Recipe | "new" | null>(null)
  const [productEditorTarget, setProductEditorTarget] =
    useState<Product | "new" | null>(null)
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
    const liveBreakdown = estimateRecipeMaterialCost(
      selectedRecipe,
      state.inventory,
      state.settings.defaultLabourRatePerHour,
    )
    const effectiveCost = liveBreakdown.hasLivePricing
      ? liveBreakdown.totalCost
      : selectedRecipe.estimatedCost

    return (
      <div className="focused-flow pb-10">
          <ScreenHeader
            title={selectedRecipe.name}
            subtitle={`${product?.name ?? "Custom product"}${
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
                    <Clock3 aria-hidden="true" size={12} />{" "}
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

              <div className="grid grid-cols-2 gap-3 border-t border-warm-border pt-3">
                <div>
                  <div className="text-xs text-muted">Live cost (1× batch)</div>
                  <div className="mt-0.5 text-lg font-bold text-cocoa">
                    <MoneyText
                      amount={Math.round(effectiveCost * scaleMultiplier)}
                    />
                  </div>
                  {scaleMultiplier !== 1 ? (
                    <div className="text-[11px] text-muted">
                      Scaled ×{scaleMultiplier}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-end">
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
                Batch scale
              </div>
              <Stepper
                label="Batch scale multiplier"
                value={scaleMultiplier}
                min={0.5}
                max={10}
                step={0.5}
                unit="×"
                onChange={setScaleMultiplier}
              />
            </Card>

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
              ? "Search recipes, pizzas, pastes..."
              : "Search products..."
          }
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <TabView viewKey={section}>
          {section === "recipes" ? (
          recipes.length > 0 ? (
            <div className="space-y-3">
              {recipes.map((recipe) => {
                const product = state.products.find(
                  (item) => item.id === recipe.productId,
                )
                const variant = product?.variants.find(
                  (item) => item.id === recipe.variantId,
                )
                const cost = estimateRecipeMaterialCost(
                  recipe,
                  state.inventory,
                  state.settings.defaultLabourRatePerHour,
                )
                const displayCost = cost.hasLivePricing
                  ? cost.totalCost
                  : recipe.estimatedCost
                return (
                  <Card
                    key={recipe.id}
                    className="cursor-pointer transition duration-ui hover:border-sage-border active:scale-button"
                    onClick={() => openRecipe(recipe.id)}
                  >
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
                            {product?.name ?? "Custom"}
                            {variant ? ` · ${variant.name}` : ""} · v
                            {recipe.version}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-cocoa">
                          <MoneyText amount={displayCost} />
                        </div>
                        <div className="text-[11px] text-muted">
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
          <div className="space-y-3">
            {products.map((product) => (
              <Card key={product.id} className="space-y-2.5">
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
                        {product.variants.length === 1 ? "variant" : "variants"}
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
            description="Add the cakes, boxes, or treats you sell so orders and recipes stay organized."
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
            dispatchIfAccepted({ type: "ADD_RECIPE", recipe: saved })
            showToast("Recipe created")
          } else {
            dispatchIfAccepted({ type: "UPDATE_RECIPE", recipe: saved })
            showToast(`Saved ${saved.name} v${saved.version}`)
          }
        }}
        onClose={() => setRecipeEditorTarget(null)}
      />

      <ProductEditorSheet
        open={productEditorTarget !== null}
        product={productEditorTarget === "new" ? null : productEditorTarget}
        onClose={() => setProductEditorTarget(null)}
        onSaved={(saved) => showToast(`Saved ${saved.name}`)}
      />

      <PricingCalculatorSheet
        open={pricingTarget !== null}
        recipe={pricingTarget ?? undefined}
        quantity={scaleMultiplier >= 1 ? Math.round(scaleMultiplier) : 1}
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
