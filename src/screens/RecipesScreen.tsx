import { useMemo, useState } from "react"
import {
  BookOpen,
  Clock3,
  History,
  Package,
  Pencil,
  Scale,
  Save,
} from "lucide-react"
import Button from "../components/ui/Button"
import ScreenHeader from "../components/ScreenHeader"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import StatusBadge from "../components/ui/StatusBadge"
import TextAreaField from "../components/ui/TextAreaField"
import { formatLkr, formatQuantity } from "../lib/format"
import { useAppState } from "../state/AppState"

type RecipesScreenProps = {
  onFocusedChange: (focused: boolean) => void
}

export default function RecipesScreen({ onFocusedChange }: RecipesScreenProps) {
  const { state, dispatch } = useAppState()
  const [search, setSearch] = useState("")
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [error, setError] = useState("")

  const recipes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return state.recipes.filter((recipe) => {
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
  }, [search, state.products, state.recipes])

  const selectedRecipe = state.recipes.find(
    (recipe) => recipe.id === selectedRecipeId,
  )

  const openRecipe = (recipeId: string) => {
    setSelectedRecipeId(recipeId)
    setEditing(false)
    setError("")
    onFocusedChange(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const closeRecipe = () => {
    setSelectedRecipeId(null)
    setEditing(false)
    setError("")
    onFocusedChange(false)
  }

  const beginEdit = () => {
    if (!selectedRecipe) return
    setInstructions(selectedRecipe.instructions.join("\n"))
    setEditing(true)
  }

  const saveVersion = () => {
    if (!selectedRecipe) return
    const nextInstructions = instructions
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
    if (!nextInstructions.length) {
      setError("Add at least one preparation instruction.")
      return
    }
    dispatch({
      type: "UPDATE_RECIPE",
      recipe: {
        ...selectedRecipe,
        instructions: nextInstructions,
        version: selectedRecipe.version + 1,
        updatedAt: new Date().toISOString(),
      },
    })
    setEditing(false)
    setError("")
  }

  if (selectedRecipe) {
    const product = state.products.find(
      (item) => item.id === selectedRecipe.productId,
    )
    const variant = product?.variants.find(
      (item) => item.id === selectedRecipe.variantId,
    )

    return (
      <div className="px-page pb-6">
        <ScreenHeader
          eyebrow={`${product?.name} · v${selectedRecipe.version}`}
          title={selectedRecipe.name}
          subtitle={variant?.name}
          onBack={closeRecipe}
          backLabel="Back to recipes"
        />

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <Scale aria-hidden="true" className="mx-auto text-sage" size={18} />
            <p className="mt-2 text-xs font-semibold text-cocoa">
              {selectedRecipe.yieldLabel}
            </p>
          </Card>
          <Card className="p-3 text-center">
            <Clock3
              aria-hidden="true"
              className="mx-auto text-sage"
              size={18}
            />
            <p className="mt-2 text-xs font-semibold text-cocoa">
              {selectedRecipe.preparationMinutes} min
            </p>
          </Card>
          <Card className="p-3 text-center">
            <History
              aria-hidden="true"
              className="mx-auto text-sage"
              size={18}
            />
            <p className="mt-2 text-xs font-semibold text-cocoa">
              Version {selectedRecipe.version}
            </p>
          </Card>
        </div>

        <section className="mt-6">
          <div className="mb-3 text-lg font-semibold text-cocoa">
            Ingredients
          </div>
          <Card className="divide-y divide-warm-border p-0">
            {selectedRecipe.ingredients.map((ingredient) => (
              <div
                key={ingredient.inventoryId}
                className="flex items-center justify-between gap-3 p-4 text-sm"
              >
                <span className="text-muted">{ingredient.name}</span>
                <span className="font-semibold text-cocoa">
                  {formatQuantity(ingredient.quantity, ingredient.unit)}
                </span>
              </div>
            ))}
          </Card>
        </section>

        <section className="mt-6">
          <div className="mb-3 text-lg font-semibold text-cocoa">Packaging</div>
          <Card className="space-y-3">
            {selectedRecipe.packaging.map((item) => (
              <div
                key={item.inventoryId}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Package aria-hidden="true" size={16} />
                  {item.name}
                </span>
                <span className="text-sm font-semibold text-cocoa">
                  {formatQuantity(item.quantity, item.unit)}
                </span>
              </div>
            ))}
          </Card>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-semibold text-cocoa">Preparation</div>
            <StatusBadge tone="neutral">
              Library v{selectedRecipe.version}
            </StatusBadge>
          </div>
          {editing ? (
            <Card>
              <TextAreaField
                label="Preparation instructions"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                error={error || undefined}
                helperText="Use one clear instruction per line."
              />
              <div className="mt-4 space-y-2">
                <Button
                  fullWidth
                  leadingIcon={<Save aria-hidden="true" size={17} />}
                  onClick={saveVersion}
                >
                  Save as version {selectedRecipe.version + 1}
                </Button>
                <Button
                  fullWidth
                  variant="ghost"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <ol className="space-y-4">
                {selectedRecipe.instructions.map((instruction, index) => (
                  <li key={instruction} className="flex items-start gap-3">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-soft text-xs font-bold text-sage-dark">
                      {index + 1}
                    </span>
                    <span className="pt-1 text-sm leading-relaxed text-cocoa">
                      {instruction}
                    </span>
                  </li>
                ))}
              </ol>
              <Button
                className="mt-5"
                fullWidth
                variant="secondary"
                leadingIcon={<Pencil aria-hidden="true" size={17} />}
                onClick={beginEdit}
              >
                Create a new version
              </Button>
            </Card>
          )}
        </section>

        <div className="mt-5 flex items-center gap-2 rounded-control bg-sage-soft px-3 py-2 text-xs text-sage-dark">
          <History aria-hidden="true" size={15} />
          New versions never alter confirmed order snapshots.
        </div>
      </div>
    )
  }

  return (
    <div className="px-page pb-6">
      <ScreenHeader
        eyebrow="Reusable library"
        title="Recipes"
        subtitle="Yields, ingredients and versions"
        icon={<BookOpen aria-hidden="true" size={22} />}
      />

      <div className="mt-4">
        <Field
          label="Search recipes"
          hideLabel
          isSearch
          placeholder="Recipe, product or variant"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mt-5 space-y-3">
        {recipes.map((recipe) => {
          const product = state.products.find(
            (item) => item.id === recipe.productId,
          )
          const variant = product?.variants.find(
            (item) => item.id === recipe.variantId,
          )
          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => openRecipe(recipe.id)}
              className="w-full rounded-card border border-warm-border bg-white p-4 text-left shadow-subtle transition duration-ui hover:-translate-y-0.5 hover:border-sage-border hover:shadow-card active:translate-y-0"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-cocoa">
                    {product?.name}
                  </span>
                  <span className="mt-1 block text-xs font-medium text-muted">
                    {variant?.name} · {recipe.yieldLabel}
                  </span>
                  <span className="mt-2 block truncate text-xs text-sage-dark">
                    {recipe.name}
                  </span>
                </span>
                <StatusBadge tone="neutral">v{recipe.version}</StatusBadge>
              </span>
              <span className="mt-3 grid grid-cols-2 gap-2 rounded-control bg-ivory p-3 text-xs text-muted">
                <span>
                  <span className="block font-semibold text-cocoa">Time</span>
                  <span className="mt-0.5 block">
                    {recipe.preparationMinutes} min
                  </span>
                </span>
                <span>
                  <span className="block font-semibold text-cocoa">Cost</span>
                  <span className="mt-0.5 block">
                    {formatLkr(recipe.estimatedCost)}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
