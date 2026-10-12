import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleUserRound,
  PackageCheck,
  Plus,
  Save,
  Trash2,
  UserRoundPlus,
  UsersRound,
} from "lucide-react"
import ScreenHeader from "../components/ScreenHeader"
import Button, { IconButton } from "../components/ui/Button"
import Card from "../components/ui/Card"
import CheckboxField from "../components/ui/CheckboxField"
import Dialog from "../components/ui/Dialog"
import Field from "../components/ui/Field"
import QuantityControl from "../components/ui/QuantityControl"
import SelectField from "../components/ui/SelectField"
import StatusBadge from "../components/ui/StatusBadge"
import TextAreaField from "../components/ui/TextAreaField"
import { formatLkr, formatQuantity } from "../lib/format"
import { calculateCostSnapshot, calculateRequirements } from "../lib/orders"
import { snapshotRecipe, useAppState } from "../state/AppState"
import type {
  Order,
  OrderDraftInput,
  OrderLine,
  Recipe,
  RecipeSnapshot,
} from "../types"

type CustomerMode = "existing" | "new" | "quick"

type FormLine = {
  id: string
  productId: string
  variantId: string
  quantity: number
  recipeId: string
  customRecipe?: Recipe
}

type CustomRecipeDraft = {
  lineId: string
  name: string
  flour: string
  sugar: string
  butter: string
  packaging: string
  estimatedCost: string
  instructions: string
  saveToLibrary: boolean
}

const steps = ["Customer", "Products", "Recipe", "Collection", "Price", "Stock"]
const progressClasses = ["w-1/6", "w-2/6", "w-3/6", "w-4/6", "w-5/6", "w-full"]

function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

type CreateOrderFlowProps = {
  order?: Order
  onCancel: () => void
  onComplete: (orderId: string) => void
}

export default function CreateOrderFlow({
  order,
  onCancel,
  onComplete,
}: CreateOrderFlowProps) {
  const { state, dispatch } = useAppState()
  const [step, setStep] = useState(order ? 4 : 0)
  const [error, setError] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [draftId] = useState(() => order?.id ?? `order-${crypto.randomUUID()}`)
  const [customerMode, setCustomerMode] = useState<CustomerMode>(
    order?.isQuickOrder ? "quick" : order?.customerId ? "existing" : "existing",
  )
  const [customerId, setCustomerId] = useState(
    order?.customerId ?? state.customers[0]?.id ?? "",
  )
  const [newCustomer, setNewCustomer] = useState({
    id: `customer-${crypto.randomUUID()}`,
    name: "",
    phone: "",
  })
  const [lines, setLines] = useState<FormLine[]>(() =>
    order
      ? order.lines.map((line) => ({
          id: line.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          recipeId: line.recipeId ?? "",
          customRecipe: line.recipeId
            ? undefined
            : {
                ...line.recipeSnapshot,
                updatedAt: order.updatedAt,
              } satisfies Recipe,
        }))
      : [
          {
            id: `line-${crypto.randomUUID()}`,
            productId: state.products[0]?.id ?? "",
            variantId: state.products[0]?.variants[0]?.id ?? "",
            quantity: 1,
            recipeId: "",
          },
        ],
  )
  const [collectionDate, setCollectionDate] = useState(
    order?.collectionDate ?? tomorrow(),
  )
  const [collectionTime, setCollectionTime] = useState(
    order?.collectionTime ?? "15:00",
  )
  const [instructions, setInstructions] = useState(order?.instructions ?? "")
  const [agreedPrice, setAgreedPrice] = useState(
    order?.agreedPrice ? String(order.agreedPrice) : "",
  )
  const [customRecipeDraft, setCustomRecipeDraft] =
    useState<CustomRecipeDraft | null>(null)
  const [recipeError, setRecipeError] = useState("")

  const resolvedLines = useMemo<OrderLine[]>(() => {
    return lines.flatMap((line) => {
      const product = state.products.find((item) => item.id === line.productId)
      const variant = product?.variants.find(
        (item) => item.id === line.variantId,
      )
      const recipe =
        line.customRecipe ??
        state.recipes.find((item) => item.id === line.recipeId)
      if (!product || !variant || !recipe) return []
      return [
        {
          id: line.id,
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          variantName: variant.name,
          quantity: line.quantity,
          recipeId: line.recipeId || null,
          recipeSnapshot: snapshotRecipe(recipe),
        },
      ]
    })
  }, [lines, state.products, state.recipes])

  const costSnapshot = useMemo(
    () => calculateCostSnapshot(resolvedLines),
    [resolvedLines],
  )
  const requirements = useMemo(
    () => calculateRequirements(state, resolvedLines, order?.id),
    [state, resolvedLines, order?.id],
  )
  const shortages = requirements.filter((item) => item.shortage > 0)

  const setLine = (id: string, change: Partial<FormLine>) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...change } : line)),
    )
  }

  const addLine = () => {
    const product = state.products[0]
    setLines((current) => [
      ...current,
      {
        id: `line-${crypto.randomUUID()}`,
        productId: product?.id ?? "",
        variantId: product?.variants[0]?.id ?? "",
        quantity: 1,
        recipeId: "",
      },
    ])
  }

  const validateStep = () => {
    if (step === 0) {
      if (customerMode === "existing" && !customerId) {
        setError("Choose a customer before continuing.")
        return false
      }
      if (
        customerMode === "new" &&
        (!newCustomer.name.trim() || !newCustomer.phone.trim())
      ) {
        setError("Enter both a customer name and phone number.")
        return false
      }
    }
    if (step === 1) {
      if (
        !lines.length ||
        lines.some(
          (line) => !line.productId || !line.variantId || line.quantity < 1,
        )
      ) {
        setError("Every product needs a variant and quantity of at least one.")
        return false
      }
    }
    if (step === 2 && resolvedLines.length !== lines.length) {
      setError("Choose or create a recipe for every product.")
      return false
    }
    if (step === 3 && (!collectionDate || !collectionTime)) {
      setError("Set both a collection date and time.")
      return false
    }
    if (step === 4 && Number(agreedPrice) <= 0) {
      setError("Enter an agreed selling price greater than zero.")
      return false
    }
    setError("")
    return true
  }

  const next = () => {
    if (!validateStep()) return
    if (step === 3 && !agreedPrice) {
      setAgreedPrice(String(costSnapshot.suggestedPrice))
    }
    setStep((current) => Math.min(steps.length - 1, current + 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const back = () => {
    setError("")
    setStep((current) => Math.max(0, current - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const buildDraft = (): OrderDraftInput | null => {
    if (resolvedLines.length !== lines.length || Number(agreedPrice) <= 0) {
      setError("Complete all recipe and price details before saving.")
      return null
    }
    const selectedCustomer = state.customers.find(
      (item) => item.id === customerId,
    )
    const customer =
      customerMode === "new"
        ? newCustomer
        : customerMode === "existing"
          ? selectedCustomer
          : null
    if (customerMode !== "quick" && !customer) {
      setError("Choose or create a customer before saving.")
      return null
    }
    if (customerMode === "new") {
      dispatch({ type: "ADD_CUSTOMER", customer: newCustomer })
    }
    return {
      id: draftId,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? "Quick order",
      isQuickOrder: customerMode === "quick",
      collectionDate,
      collectionTime,
      instructions: instructions.trim(),
      lines: resolvedLines,
      agreedPrice: Number(agreedPrice),
      costSnapshot,
    }
  }

  const saveDraft = () => {
    const draft = buildDraft()
    if (!draft) return
    dispatch({ type: "UPSERT_DRAFT", payload: draft })
    onComplete(draftId)
  }

  const confirmOrder = () => {
    const draft = buildDraft()
    if (!draft) {
      setShowConfirmDialog(false)
      return
    }
    dispatch({ type: "UPSERT_DRAFT", payload: draft })
    dispatch({ type: "CONFIRM_ORDER", orderId: draftId })
    setShowConfirmDialog(false)
    onComplete(draftId)
  }

  const beginCustomRecipe = (line: FormLine) => {
    const product = state.products.find((item) => item.id === line.productId)
    const variant = product?.variants.find((item) => item.id === line.variantId)
    setCustomRecipeDraft({
      lineId: line.id,
      name: `${product?.name ?? "New recipe"} · ${variant?.name ?? "variant"}`,
      flour: "300",
      sugar: "250",
      butter: "250",
      packaging: "1",
      estimatedCost: "2800",
      instructions: "",
      saveToLibrary: false,
    })
    setRecipeError("")
  }

  const saveCustomRecipe = () => {
    if (!customRecipeDraft) return
    const line = lines.find((item) => item.id === customRecipeDraft.lineId)
    if (!line) return
    if (
      !customRecipeDraft.name.trim() ||
      Number(customRecipeDraft.estimatedCost) <= 0 ||
      !customRecipeDraft.instructions.trim()
    ) {
      setRecipeError(
        "Give the recipe a name, estimated cost and preparation instructions.",
      )
      return
    }
    const recipe: Recipe = {
      id: `recipe-${crypto.randomUUID()}`,
      name: customRecipeDraft.name.trim(),
      productId: line.productId,
      variantId: line.variantId,
      version: 1,
      yield: 1,
      yieldLabel: "1 selected product",
      preparationMinutes: 90,
      ingredients: [
        {
          inventoryId: "flour",
          name: "All-purpose flour",
          quantity: Number(customRecipeDraft.flour) || 0,
          unit: "g",
        },
        {
          inventoryId: "sugar",
          name: "Caster sugar",
          quantity: Number(customRecipeDraft.sugar) || 0,
          unit: "g",
        },
        {
          inventoryId: "butter",
          name: "Unsalted butter",
          quantity: Number(customRecipeDraft.butter) || 0,
          unit: "g",
        },
      ],
      packaging: [
        {
          inventoryId: "cake-box-medium",
          name: "Product box",
          quantity: Number(customRecipeDraft.packaging) || 1,
          unit: "unit",
        },
      ],
      instructions: customRecipeDraft.instructions
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      estimatedCost: Number(customRecipeDraft.estimatedCost),
      updatedAt: new Date().toISOString(),
    }
    if (customRecipeDraft.saveToLibrary) {
      dispatch({ type: "ADD_RECIPE", recipe })
    }
    setLine(line.id, {
      recipeId: customRecipeDraft.saveToLibrary ? recipe.id : "",
      customRecipe: recipe,
    })
    setCustomRecipeDraft(null)
    setRecipeError("")
  }

  const renderCustomerStep = () => (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setCustomerMode("existing")}
        className={`w-full rounded-card border p-4 text-left transition ${
          customerMode === "existing"
            ? "border-sage bg-sage-soft"
            : "border-warm-border bg-white"
        }`}
      >
        <span className="flex items-center gap-3">
          <UsersRound aria-hidden="true" className="text-sage-dark" size={20} />
          <span>
            <span className="block text-sm font-semibold text-cocoa">
              Existing customer
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Use saved contact details and history
            </span>
          </span>
        </span>
      </button>
      {customerMode === "existing" ? (
        <SelectField
          label="Customer"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          options={state.customers.map((customer) => ({
            value: customer.id,
            label: `${customer.name} · ${customer.phone}`,
          }))}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setCustomerMode("new")}
        className={`w-full rounded-card border p-4 text-left transition ${
          customerMode === "new"
            ? "border-sage bg-sage-soft"
            : "border-warm-border bg-white"
        }`}
      >
        <span className="flex items-center gap-3">
          <UserRoundPlus
            aria-hidden="true"
            className="text-sage-dark"
            size={20}
          />
          <span>
            <span className="block text-sm font-semibold text-cocoa">
              Create customer
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Save their name and phone number
            </span>
          </span>
        </span>
      </button>
      {customerMode === "new" ? (
        <Card className="space-y-4">
          <Field
            label="Customer name"
            value={newCustomer.name}
            onChange={(event) =>
              setNewCustomer((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
          <Field
            label="Phone number"
            type="tel"
            placeholder="07X XXX XXXX"
            value={newCustomer.phone}
            onChange={(event) =>
              setNewCustomer((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
          />
        </Card>
      ) : null}

      <button
        type="button"
        onClick={() => setCustomerMode("quick")}
        className={`w-full rounded-card border p-4 text-left transition ${
          customerMode === "quick"
            ? "border-sage bg-sage-soft"
            : "border-warm-border bg-white"
        }`}
      >
        <span className="flex items-center gap-3">
          <CircleUserRound
            aria-hidden="true"
            className="text-sage-dark"
            size={20}
          />
          <span>
            <span className="block text-sm font-semibold text-cocoa">
              Quick order
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Continue without customer details
            </span>
          </span>
        </span>
      </button>
    </div>
  )

  const renderProductsStep = () => (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const product = state.products.find(
          (item) => item.id === line.productId,
        )
        return (
          <Card key={line.id}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-cocoa">
                Product {index + 1}
              </p>
              {lines.length > 1 ? (
                <IconButton
                  label={`Remove product ${index + 1}`}
                  className="size-9 border-error/20 text-error shadow-none"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((item) => item.id !== line.id),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" size={16} />
                </IconButton>
              ) : null}
            </div>
            <div className="space-y-4">
              <SelectField
                label="Product"
                value={line.productId}
                onChange={(event) => {
                  const nextProduct = state.products.find(
                    (item) => item.id === event.target.value,
                  )
                  setLine(line.id, {
                    productId: event.target.value,
                    variantId: nextProduct?.variants[0]?.id ?? "",
                    recipeId: "",
                    customRecipe: undefined,
                  })
                }}
                options={state.products.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Variant"
                value={line.variantId}
                onChange={(event) =>
                  setLine(line.id, {
                    variantId: event.target.value,
                    recipeId: "",
                    customRecipe: undefined,
                  })
                }
                options={(product?.variants ?? []).map((variant) => ({
                  value: variant.id,
                  label: variant.name,
                }))}
              />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-cocoa">Quantity</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Number of {product?.variants[0]?.unitLabel ?? "items"}
                  </p>
                </div>
                <QuantityControl
                  label={`product ${index + 1} quantity`}
                  value={line.quantity}
                  min={1}
                  onChange={(quantity) => setLine(line.id, { quantity })}
                />
              </div>
            </div>
          </Card>
        )
      })}
      <Button
        fullWidth
        variant="secondary"
        leadingIcon={<Plus aria-hidden="true" size={17} />}
        onClick={addLine}
      >
        Add another product
      </Button>
    </div>
  )

  const renderRecipesStep = () => (
    <div className="space-y-4">
      {lines.map((line, index) => {
        const product = state.products.find(
          (item) => item.id === line.productId,
        )
        const compatible = state.recipes.filter(
          (recipe) =>
            recipe.productId === line.productId &&
            recipe.variantId === line.variantId,
        )
        return (
          <Card key={line.id}>
            <p className="text-xs font-semibold uppercase tracking-section text-sage-dark">
              Product {index + 1}
            </p>
            <p className="mt-1 text-base font-semibold text-cocoa">
              {product?.name}
            </p>
            <div className="mt-4 space-y-2">
              {compatible.map((recipe) => {
                const selected =
                  line.recipeId === recipe.id && !line.customRecipe
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() =>
                      setLine(line.id, {
                        recipeId: recipe.id,
                        customRecipe: undefined,
                      })
                    }
                    className={`w-full rounded-control border p-3 text-left transition ${
                      selected
                        ? "border-sage bg-sage-soft"
                        : "border-warm-border bg-white"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-sm font-semibold text-cocoa">
                          {recipe.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {recipe.yieldLabel} · {recipe.preparationMinutes} min
                          · v{recipe.version}
                        </span>
                      </span>
                      {selected ? (
                        <Check
                          aria-hidden="true"
                          className="shrink-0 text-sage-dark"
                          size={18}
                        />
                      ) : null}
                    </span>
                  </button>
                )
              })}
              {line.customRecipe ? (
                <div className="rounded-control border border-sage bg-sage-soft p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-cocoa">
                        {line.customRecipe.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        New recipe · v1
                        {line.recipeId
                          ? " · Saved to library"
                          : " · This order only"}
                      </p>
                    </div>
                    <Check
                      aria-hidden="true"
                      className="text-sage-dark"
                      size={18}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <Button
              className="mt-3"
              fullWidth
              variant="secondary"
              leadingIcon={<BookOpen aria-hidden="true" size={17} />}
              onClick={() => beginCustomRecipe(line)}
            >
              Create a new recipe
            </Button>
          </Card>
        )
      })}
    </div>
  )

  const renderCollectionStep = () => (
    <Card className="space-y-4">
      <Field
        label="Collection date"
        type="date"
        value={collectionDate}
        onChange={(event) => setCollectionDate(event.target.value)}
      />
      <Field
        label="Collection time"
        type="time"
        value={collectionTime}
        onChange={(event) => setCollectionTime(event.target.value)}
      />
      <TextAreaField
        label="Instructions"
        placeholder="Decoration, message, allergies or collection notes"
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        helperText="Keep operational notes clear and specific."
      />
    </Card>
  )

  const renderPriceStep = () => (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-semibold text-cocoa">
          Requirements and estimated cost
        </p>
        <div className="mt-4 space-y-3">
          {requirements.slice(0, 5).map((item) => (
            <div
              key={item.inventoryId}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-muted">{item.name}</span>
              <span className="font-semibold text-cocoa">
                {formatQuantity(item.required, item.unit)}
              </span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between text-muted">
            <span>Ingredients</span>
            <span>{formatLkr(costSnapshot.ingredients)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Packaging</span>
            <span>{formatLkr(costSnapshot.packaging)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Labour allowance</span>
            <span>{formatLkr(costSnapshot.labour)}</span>
          </div>
          <div className="flex justify-between border-t border-warm-border pt-3 font-semibold text-cocoa">
            <span>Estimated cost</span>
            <span>{formatLkr(costSnapshot.estimatedTotal)}</span>
          </div>
          <div className="flex justify-between rounded-control bg-sage-soft p-3 font-semibold text-sage-dark">
            <span>Suggested price</span>
            <span>{formatLkr(costSnapshot.suggestedPrice)}</span>
          </div>
        </div>
      </Card>
      <Field
        label="Agreed selling price (Rs.)"
        type="number"
        min="1"
        inputMode="numeric"
        value={agreedPrice}
        onChange={(event) => setAgreedPrice(event.target.value)}
        error={
          agreedPrice && Number(agreedPrice) <= 0
            ? "Price must be greater than zero."
            : undefined
        }
        helperText="This value will be frozen when the order is confirmed."
      />
    </div>
  )

  const renderStockStep = () => (
    <div className="space-y-4">
      {shortages.length ? (
        <Card tone="warning">
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-warning"
              size={20}
            />
            <div>
              <p className="text-sm font-semibold text-cocoa">
                {shortages.length} stock{" "}
                {shortages.length === 1 ? "shortage" : "shortages"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                You can still confirm. Shortages will be preserved for the
                Shopping workflow.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card tone="sage" className="flex items-start gap-3">
          <PackageCheck
            aria-hidden="true"
            className="mt-0.5 text-success"
            size={20}
          />
          <div>
            <p className="text-sm font-semibold text-cocoa">
              Stock is available
            </p>
            <p className="mt-1 text-xs text-muted">
              Confirmation will create reservations without deducting stock.
            </p>
          </div>
        </Card>
      )}
      <Card className="divide-y divide-warm-border p-0">
        {requirements.map((item) => (
          <div key={item.inventoryId} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cocoa">{item.name}</p>
                <p className="mt-1 text-xs text-muted">
                  Available{" "}
                  {formatQuantity(item.availableAtConfirmation, item.unit)}
                </p>
              </div>
              {item.shortage > 0 ? (
                <StatusBadge tone="warning">
                  Short {formatQuantity(item.shortage, item.unit)}
                </StatusBadge>
              ) : (
                <StatusBadge tone="success">Available</StatusBadge>
              )}
            </div>
            <div className="mt-3 flex justify-between rounded-control bg-ivory p-2.5 text-xs">
              <span className="text-muted">Required</span>
              <span className="font-semibold text-cocoa">
                {formatQuantity(item.required, item.unit)}
              </span>
            </div>
          </div>
        ))}
      </Card>
      <Card>
        <p className="text-sm font-semibold text-cocoa">Order consequence</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Confirming freezes the agreed price of{" "}
          {formatLkr(Number(agreedPrice))}, initial cost estimate and recipe
          versions. It creates reservations but does not consume ingredients or
          mark the order as paid.
        </p>
      </Card>
    </div>
  )

  return (
    <>
      <div className="focused-flow px-page pb-2">
        <ScreenHeader
          eyebrow={order ? `Edit ${order.reference}` : "New order"}
          title={steps[step]}
          subtitle={`Step ${step + 1} of ${steps.length}`}
          onBack={step === 0 ? () => setShowCancelDialog(true) : back}
          backLabel={step === 0 ? "Cancel order" : "Previous step"}
          compact
        />

        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-soft"
          aria-label={`Step ${step + 1} of ${steps.length}`}
        >
          <div
            className={`h-full rounded-full bg-sage transition-all duration-ui ${progressClasses[step]}`}
          />
        </div>

        {error ? (
          <Card tone="warning" className="mt-4 flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-warning"
              size={19}
            />
            <p className="text-sm leading-relaxed text-cocoa">{error}</p>
          </Card>
        ) : null}

        <div className="mt-5">
          {step === 0 ? renderCustomerStep() : null}
          {step === 1 ? renderProductsStep() : null}
          {step === 2 ? renderRecipesStep() : null}
          {step === 3 ? renderCollectionStep() : null}
          {step === 4 ? renderPriceStep() : null}
          {step === 5 ? renderStockStep() : null}
        </div>

        <div className="sticky bottom-0 z-20 -mx-page mt-auto space-y-2 border-t border-warm-border bg-ivory/95 px-page pb-3 pt-3 backdrop-blur-nav">
          {step < steps.length - 1 ? (
            <Button
              fullWidth
              trailingIcon={<ArrowRight aria-hidden="true" size={17} />}
              onClick={next}
            >
              Continue
            </Button>
          ) : (
            <Button
              fullWidth
              trailingIcon={<ChevronRight aria-hidden="true" size={17} />}
              onClick={() => setShowConfirmDialog(true)}
            >
              Confirm order
            </Button>
          )}
          <div className={step >= 3 ? "grid grid-cols-2 gap-2" : ""}>
            {step >= 3 ? (
              <Button
                fullWidth
                variant="secondary"
                leadingIcon={<Save aria-hidden="true" size={17} />}
                onClick={saveDraft}
              >
                Save draft
              </Button>
            ) : null}
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={showCancelDialog}
        title="Leave this order?"
        description="Unsaved changes will be discarded. No order or reservation will be created."
        onClose={() => setShowCancelDialog(false)}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep editing
            </Button>
            <Button className="bg-error hover:bg-error" onClick={onCancel}>
              Discard
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Save a draft from the Collection, Price or Stock step if you want to
          return later.
        </p>
      </Dialog>

      <Dialog
        open={showConfirmDialog}
        title="Confirm this order?"
        description="This freezes the agreed price, cost estimate and recipe versions."
        onClose={() => setShowConfirmDialog(false)}
        footer={
          <div className="space-y-3">
            <Button fullWidth onClick={confirmOrder}>
              Confirm order
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setShowConfirmDialog(false)}
            >
              Review again
            </Button>
          </div>
        }
      >
        {shortages.length ? (
          <div className="rounded-card bg-warning-soft p-4">
            <p className="text-sm font-semibold text-cocoa">
              Confirmation allowed with shortages
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {shortages.length} shortage{" "}
              {shortages.length === 1 ? "will" : "will"} be recorded for
              shopping.
            </p>
          </div>
        ) : (
          <div className="rounded-card bg-sage-soft p-4 text-sm text-cocoa">
            Required stock can be reserved.
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(customRecipeDraft)}
        title="Create recipe"
        description="This recipe belongs to the selected product variant."
        onClose={() => setCustomRecipeDraft(null)}
        footer={
          <div className="space-y-3">
            <Button fullWidth onClick={saveCustomRecipe}>
              Use this recipe
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setCustomRecipeDraft(null)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        {customRecipeDraft ? (
          <div className="max-h-dialog-content space-y-4 overflow-y-auto pr-1">
            {recipeError ? (
              <div className="rounded-control bg-warning-soft p-3 text-sm leading-relaxed text-cocoa">
                {recipeError}
              </div>
            ) : null}
            <Field
              label="Recipe name"
              value={customRecipeDraft.name}
              onChange={(event) =>
                setCustomRecipeDraft((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
            />
            <div className="grid grid-cols-3 gap-2">
              <Field
                label="Flour (g)"
                type="number"
                min="0"
                value={customRecipeDraft.flour}
                onChange={(event) =>
                  setCustomRecipeDraft((current) =>
                    current
                      ? { ...current, flour: event.target.value }
                      : current,
                  )
                }
              />
              <Field
                label="Sugar (g)"
                type="number"
                min="0"
                value={customRecipeDraft.sugar}
                onChange={(event) =>
                  setCustomRecipeDraft((current) =>
                    current
                      ? { ...current, sugar: event.target.value }
                      : current,
                  )
                }
              />
              <Field
                label="Butter (g)"
                type="number"
                min="0"
                value={customRecipeDraft.butter}
                onChange={(event) =>
                  setCustomRecipeDraft((current) =>
                    current
                      ? { ...current, butter: event.target.value }
                      : current,
                  )
                }
              />
            </div>
            <Field
              label="Packaging units"
              type="number"
              min="1"
              value={customRecipeDraft.packaging}
              onChange={(event) =>
                setCustomRecipeDraft((current) =>
                  current
                    ? { ...current, packaging: event.target.value }
                    : current,
                )
              }
            />
            <Field
              label="Estimated cost (Rs.)"
              type="number"
              min="1"
              value={customRecipeDraft.estimatedCost}
              onChange={(event) =>
                setCustomRecipeDraft((current) =>
                  current
                    ? { ...current, estimatedCost: event.target.value }
                    : current,
                )
              }
            />
            <TextAreaField
              label="Preparation instructions"
              placeholder="Add one instruction per line"
              value={customRecipeDraft.instructions}
              onChange={(event) =>
                setCustomRecipeDraft((current) =>
                  current
                    ? { ...current, instructions: event.target.value }
                    : current,
                )
              }
            />
            <CheckboxField
              checked={customRecipeDraft.saveToLibrary}
              onChange={(saveToLibrary) =>
                setCustomRecipeDraft((current) =>
                  current ? { ...current, saveToLibrary } : current,
                )
              }
              label="Also save to Recipe Library"
              description="Leave this off to use the recipe only for this order."
            />
          </div>
        ) : (
          <div />
        )}
      </Dialog>
    </>
  )
}
