import { useMemo, useState } from "react"
import { PackagePlus, Save } from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import QuantityControl from "../components/ui/QuantityControl"
import SelectField from "../components/ui/SelectField"
import { formatQuantity } from "../lib/format"
import { createId } from "../lib/id"
import { snapshotRecipe, useAppState } from "../state/AppState"
import type { ExtraStockPlan } from "../types"

type ExtraStockPlanFormProps = {
  plan?: ExtraStockPlan
  onCancel: () => void
  onComplete: () => void
}

export default function ExtraStockPlanForm({
  plan,
  onCancel,
  onComplete,
}: ExtraStockPlanFormProps) {
  const { state, dispatch } = useAppState()
  const initialProduct =
    state.products.find((product) => product.id === plan?.productId) ??
    state.products[0]
  const initialVariant =
    initialProduct?.variants.find(
      (variant) => variant.id === plan?.variantId,
    ) ??
    initialProduct?.variants.find((variant) =>
      state.recipes.some(
        (recipe) =>
          recipe.productId === initialProduct.id &&
          recipe.variantId === variant.id,
      ),
    ) ??
    initialProduct?.variants[0]
  const [productId, setProductId] = useState(initialProduct?.id ?? "")
  const [variantId, setVariantId] = useState(initialVariant?.id ?? "")
  const [recipeId, setRecipeId] = useState(plan?.recipeId ?? "")
  const [quantity, setQuantity] = useState(plan?.quantity ?? 1)
  const [bestBefore, setBestBefore] = useState(plan?.bestBefore ?? "")
  const [error, setError] = useState("")

  const product = state.products.find((item) => item.id === productId)
  const recipes = useMemo(
    () =>
      state.recipes.filter(
        (recipe) =>
          recipe.productId === productId && recipe.variantId === variantId,
      ),
    [productId, state.recipes, variantId],
  )
  const recipe =
    recipes.find((item) => item.id === recipeId) ?? recipes[0] ?? null

  const changeProduct = (nextId: string) => {
    const nextProduct = state.products.find((item) => item.id === nextId)
    const nextVariant =
      nextProduct?.variants.find((variant) =>
        state.recipes.some(
          (recipe) =>
            recipe.productId === nextProduct.id &&
            recipe.variantId === variant.id,
        ),
      )?.id ??
      nextProduct?.variants[0]?.id ??
      ""
    setProductId(nextId)
    setVariantId(nextVariant)
    setRecipeId("")
    setError("")
  }

  const save = () => {
    if (!product || !variantId || !recipe || quantity < 1) {
      setError(
        "Choose a product variant with a saved recipe and a positive quantity.",
      )
      return
    }
    const now = new Date().toISOString()
    dispatch({
      type: "UPSERT_EXTRA_STOCK_PLAN",
      plan: {
        id: plan?.id ?? createId("extra-plan"),
        productId,
        variantId,
        recipeId: recipe.id,
        recipeSnapshot: snapshotRecipe(recipe),
        quantity,
        bestBefore,
        createdAt: plan?.createdAt ?? now,
        updatedAt: now,
      },
    })
    onComplete()
  }

  const requirements = recipe
    ? [...recipe.ingredients, ...recipe.packaging]
    : []

  return (
    <div className="focused-flow pb-2">
      <ScreenHeader
        eyebrow="Future sales"
        title={plan ? "Edit extra-stock plan" : "Plan extra stock"}
        subtitle="Planning only · no stock is reserved"
        onBack={onCancel}
        backLabel="Cancel extra-stock plan"
        compact
      />

      <div className="mt-4 space-y-4">
        {error ? (
          <div className="rounded-control bg-warning-soft p-3 text-sm text-cocoa">
            {error}
          </div>
        ) : null}
        <Card className="space-y-4">
          <SelectField
            label="Product"
            value={productId}
            onChange={(event) => changeProduct(event.target.value)}
            options={state.products.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          <SelectField
            label="Variant"
            value={variantId}
            onChange={(event) => {
              setVariantId(event.target.value)
              setRecipeId("")
            }}
            options={(product?.variants ?? []).map((variant) => ({
              value: variant.id,
              label: variant.name,
            }))}
          />
          <SelectField
            label="Saved recipe"
            value={recipe?.id ?? ""}
            onChange={(event) => setRecipeId(event.target.value)}
            options={
              recipes.length
                ? recipes.map((item) => ({
                    value: item.id,
                    label: `${item.name} · v${item.version}`,
                  }))
                : [
                    {
                      value: "",
                      label: "No saved recipe for this variant",
                      disabled: true,
                    },
                  ]
            }
          />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cocoa">
                Planned quantity
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Products for future sale
              </p>
            </div>
            <QuantityControl
              label="planned extra-stock quantity"
              value={quantity}
              min={1}
              onChange={setQuantity}
            />
          </div>
          <Field
            label="Best-before date"
            type="date"
            value={bestBefore}
            onChange={(event) => setBestBefore(event.target.value)}
            helperText="Optional planning reference."
          />
        </Card>

        {recipe ? (
          <Card tone="sage">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cocoa">Requirements</p>
                <p className="mt-0.5 text-xs text-muted">
                  Recipe v{recipe.version} × {quantity}
                </p>
              </div>
              <PackagePlus
                aria-hidden="true"
                className="text-sage-dark"
                size={20}
              />
            </div>
            <div className="mt-3 divide-y divide-sage-border">
              {requirements.map((item) => (
                <div
                  key={item.inventoryId}
                  className="flex items-center justify-between gap-3 py-2.5 text-xs"
                >
                  <span className="text-cocoa">{item.name}</span>
                  <span className="font-semibold text-sage-dark">
                    {formatQuantity(item.quantity * quantity, item.unit)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-20 -mx-5 mt-auto border-t border-warm-border bg-ivory/95 px-5 pb-3 pt-3 backdrop-blur-nav">
        <Button
          fullWidth
          leadingIcon={<Save aria-hidden="true" size={17} />}
          onClick={save}
        >
          {plan ? "Update plan" : "Save plan"}
        </Button>
      </div>
    </div>
  )
}
