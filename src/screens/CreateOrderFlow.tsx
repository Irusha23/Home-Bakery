import { useMemo, useState } from "react"
import { Calculator, Check, Plus, Save, Trash2 } from "lucide-react"
import PricingCalculatorSheet from "../components/domain/PricingCalculatorSheet"
import ProductEditorSheet from "../components/domain/ProductEditorSheet"
import RecipeEditorSheet from "../components/domain/RecipeEditorSheet"
import ScreenHeader from "../components/ScreenHeader"
import Button, { IconButton } from "../components/ui/Button"
import Card from "../components/ui/Card"
import CheckboxField from "../components/ui/CheckboxField"
import Dialog from "../components/ui/Dialog"
import Field from "../components/ui/Field"
import MoneyText from "../components/ui/MoneyText"
import QuantityControl from "../components/ui/QuantityControl"
import SegmentedControl from "../components/ui/SegmentedControl"
import SelectField from "../components/ui/SelectField"
import TextAreaField from "../components/ui/TextAreaField"
import { useToast } from "../components/ui/Toast"
import { formatLkr } from "../lib/format"
import { createId } from "../lib/id"
import { PAYMENT_METHOD_OPTIONS, isValidMoneyAmount } from "../lib/financials"
import { calculateCostSnapshot, getRecipeUnitIssues } from "../lib/orders"
import { makeReference, snapshotRecipe, useAppState } from "../state/AppState"
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

function shiftLocalDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

type CreateOrderFlowProps = {
  order?: Order
  initialCustomerId?: string
  onCancel: () => void
  onComplete: (orderId: string) => void
}

export default function CreateOrderFlow({
  order,
  initialCustomerId,
  onCancel,
  onComplete,
}: CreateOrderFlowProps) {
  const { state, dispatch, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()

  const activeProducts = useMemo(
    () => state.products.filter((p) => !p.archived),
    [state.products],
  )
  const activeRecipes = useMemo(
    () => state.recipes.filter((r) => !r.archived),
    [state.recipes],
  )

  const [error, setError] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showNotes, setShowNotes] = useState(Boolean(order?.instructions))
  const [draftId] = useState(() => order?.id ?? createId("order"))
  const [customerMode, setCustomerMode] = useState<CustomerMode>(
    order?.isQuickOrder ? "quick" : "existing",
  )
  const [customerId, setCustomerId] = useState(
    order?.customerId ?? initialCustomerId ?? state.customers[0]?.id ?? "",
  )
  const [newCustomer, setNewCustomer] = useState(() => ({
    id: createId("customer"),
    name: "",
    phone: "",
  }))

  const findDefaultRecipeId = (productId: string, variantId: string) =>
    activeRecipes.find(
      (r) => r.productId === productId && r.variantId === variantId,
    )?.id ??
    activeRecipes.find((r) => r.productId === productId)?.id ??
    ""

  const [lines, setLines] = useState<FormLine[]>(() => {
    if (order) {
      return order.lines.map((line) => ({
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
    }
    const defaultProduct = activeProducts[0]
    const defaultVariant = defaultProduct?.variants[0]
    return [
      {
        id: createId("line"),
        productId: defaultProduct?.id ?? "",
        variantId: defaultVariant?.id ?? "",
        quantity: 1,
        recipeId:
          defaultProduct && defaultVariant
            ? findDefaultRecipeId(defaultProduct.id, defaultVariant.id)
            : "",
      },
    ]
  })

  const [collectionDate, setCollectionDate] = useState(
    order?.collectionDate || shiftLocalDate(1),
  )
  const [collectionTime, setCollectionTime] = useState(
    order?.collectionTime || "15:00",
  )
  const [instructions, setInstructions] = useState(order?.instructions ?? "")
  const [agreedPrice, setAgreedPrice] = useState(
    order?.agreedPrice ? String(order.agreedPrice) : "",
  )

  const [recordDeposit, setRecordDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")
  const [depositMethod, setDepositMethod] = useState("Cash")
  const [depositOtherMethod, setDepositOtherMethod] = useState("")

  const [customEditorLineId, setCustomEditorLineId] = useState<string | null>(
    null,
  )
  const [productEditorOpen, setProductEditorOpen] = useState(false)
  const [pricingSheetOpen, setPricingSheetOpen] = useState(false)

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
    () => calculateCostSnapshot(resolvedLines, state),
    [resolvedLines, state],
  )
  const unitIssues = useMemo(
    () => getRecipeUnitIssues(state, resolvedLines, order?.id),
    [state, resolvedLines, order?.id],
  )

  const setLine = (id: string, change: Partial<FormLine>) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...change } : line)),
    )
  }

  const addLine = () => {
    const product = activeProducts[0] ?? state.products[0]
    const variant = product?.variants[0]
    setLines((current) => [
      ...current,
      {
        id: createId("line"),
        productId: product?.id ?? "",
        variantId: variant?.id ?? "",
        quantity: 1,
        recipeId:
          product && variant ? findDefaultRecipeId(product.id, variant.id) : "",
      },
    ])
  }

  const effectiveAgreedPrice = Number(
    agreedPrice || costSnapshot.suggestedPrice,
  )

  const validateAll = () => {
    if (customerMode === "existing" && !customerId) {
      setError("Choose a customer or switch to Quick order.")
      return false
    }
    if (
      customerMode === "new" &&
      (!newCustomer.name.trim() || !newCustomer.phone.trim())
    ) {
      setError("Enter both a customer name and phone number.")
      return false
    }
    if (
      !lines.length ||
      lines.some(
        (line) =>
          !line.productId ||
          !line.variantId ||
          line.quantity < 1 ||
          (!line.recipeId && !line.customRecipe),
      )
    ) {
      setError("Select a product, size, quantity, and recipe for every item.")
      return false
    }
    if (!collectionDate || !collectionTime) {
      setError("Choose a pickup date and time.")
      return false
    }
    if (!Number.isFinite(effectiveAgreedPrice) || effectiveAgreedPrice <= 0) {
      setError("Enter a selling price greater than zero.")
      return false
    }
    if (unitIssues.length) {
      setError(
        `Order cannot be confirmed until recipe units match inventory: ${unitIssues.join(" ")}`,
      )
      return false
    }
    if (recordDeposit) {
      const amountNum = Number(depositAmount)
      if (!isValidMoneyAmount(amountNum)) {
        setError("Deposit must be a positive whole LKR amount.")
        return false
      }
      if (amountNum > Math.round(effectiveAgreedPrice)) {
        setError("Deposit cannot exceed the agreed selling price.")
        return false
      }
    }
    setError("")
    return true
  }

  const buildDraft = (): OrderDraftInput | null => {
    if (!validateAll()) return null
    const selectedCustomer = state.customers.find(
      (item) => item.id === customerId,
    )
    const customer =
      customerMode === "new"
        ? {
            id: newCustomer.id,
            name: newCustomer.name.trim(),
            phone: newCustomer.phone.trim(),
          }
        : customerMode === "existing"
          ? selectedCustomer
          : null
    if (customerMode !== "quick" && !customer) {
      setError("Choose or create a customer before saving.")
      return null
    }
    if (customerMode === "new" && customer) {
      dispatch({ type: "ADD_CUSTOMER", customer })
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
      agreedPrice: Math.round(effectiveAgreedPrice),
      costSnapshot,
    }
  }

  const saveDraft = () => {
    const draft = buildDraft()
    if (!draft) return
    dispatch({ type: "UPSERT_DRAFT", payload: draft })
    showToast({ message: "Draft saved", tone: "info" })
    onComplete(draftId)
  }

  const confirmOrder = () => {
    if (unitIssues.length) {
      setError(
        `Order cannot be confirmed until recipe units match inventory: ${unitIssues.join(" ")}`,
      )
      setShowConfirmDialog(false)
      return
    }
    if (recordDeposit) {
      const amountNum = Number(depositAmount)
      if (!isValidMoneyAmount(amountNum)) {
        setError("Deposit must be a positive whole LKR amount.")
        setShowConfirmDialog(false)
        return
      }
      if (amountNum > effectiveAgreedPrice) {
        setError("Deposit cannot exceed the agreed selling price.")
        setShowConfirmDialog(false)
        return
      }
    }
    const draft = buildDraft()
    if (!draft) {
      setShowConfirmDialog(false)
      return
    }
    const resolvedReference = order?.reference ?? makeReference(state.orders)
    dispatch({ type: "UPSERT_DRAFT", payload: draft })
    const confirmed = dispatchIfAccepted({
      type: "CONFIRM_ORDER",
      orderId: draftId,
    })
    if (!confirmed) {
      setShowConfirmDialog(false)
      setError("Could not confirm order. Check item details and try again.")
      return
    }
    for (const line of draft.lines) {
      dispatch({
        type: "MARK_ALL_PANTRY_CHECKLIST",
        preparationId: `preparation-${draftId}-${line.id}`,
        inPantry: true,
      })
    }
    if (recordDeposit && isValidMoneyAmount(Number(depositAmount))) {
      dispatchIfAccepted({
        type: "RECORD_PAYMENT",
        orderId: draftId,
        orderReference: resolvedReference,
        payment: {
          id: createId("pay"),
          date: new Date().toISOString().slice(0, 10),
          amount: Number(depositAmount),
          method:
            depositMethod === "Other"
              ? depositOtherMethod.trim() || "Other"
              : depositMethod,
          note: "Order deposit",
        },
      })
    }
    setShowConfirmDialog(false)
    showToast({ message: "Order confirmed", tone: "success" })
    onComplete(draftId)
  }

  const editingCustomLine = lines.find((l) => l.id === customEditorLineId)

  const combinedRecipeForCalculator =
    useMemo<RecipeSnapshot | undefined>(() => {
      if (!resolvedLines.length) return undefined
      if (resolvedLines.length === 1) return resolvedLines[0].recipeSnapshot
      return {
        ...resolvedLines[0].recipeSnapshot,
        name: `${resolvedLines.length} order items`,
        ingredients: resolvedLines.flatMap((line) =>
          line.recipeSnapshot.ingredients.map((ing) => ({
            ...ing,
            quantity: ing.quantity * Math.max(1, line.quantity),
          })),
        ),
        packaging: resolvedLines.flatMap((line) =>
          line.recipeSnapshot.packaging.map((pkg) => ({
            ...pkg,
            quantity: pkg.quantity * Math.max(1, line.quantity),
          })),
        ),
        preparationMinutes: resolvedLines.reduce(
          (sum, l) =>
            sum + l.recipeSnapshot.preparationMinutes * Math.max(1, l.quantity),
          0,
        ),
        estimatedCost: costSnapshot.estimatedTotal,
      }
    }, [costSnapshot.estimatedTotal, resolvedLines])

  const selectedCustomerName =
    customerMode === "quick"
      ? "Quick order"
      : customerMode === "new"
        ? newCustomer.name || "New customer"
        : state.customers.find((item) => item.id === customerId)?.name ||
          "Customer"

  return (
    <div className="space-y-4 pb-8">
      <ScreenHeader
        title={order ? `Edit ${order.reference}` : "New order"}
        onBack={() => setShowCancelDialog(true)}
        backLabel="Cancel"
      />

      <Card className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-section text-muted">
          Customer
        </div>
        <SegmentedControl
          label="Customer type"
          value={customerMode}
          segments={[
            { value: "existing", label: "Existing" },
            { value: "new", label: "New" },
            { value: "quick", label: "Walk-in" },
          ]}
          onChange={setCustomerMode}
        />

        {customerMode === "existing" ? (
          <SelectField
            label="Saved customer"
            value={customerId}
            options={
              state.customers.length > 0
                ? state.customers.map((c) => ({
                    value: c.id,
                    label: c.phone ? `${c.name} · ${c.phone}` : c.name,
                  }))
                : [{ value: "", label: "No saved customers yet" }]
            }
            onChange={(event) => setCustomerId(event.target.value)}
          />
        ) : null}

        {customerMode === "new" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              placeholder="Full name"
              value={newCustomer.name}
              onChange={(event) =>
                setNewCustomer((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            <Field
              label="Phone"
              placeholder="077 000 0000"
              type="tel"
              value={newCustomer.phone}
              onChange={(event) =>
                setNewCustomer((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const product =
            state.products.find((item) => item.id === line.productId) ??
            activeProducts[0]
          const variants = product?.variants.filter((v) => !v.archived) ?? []
          const variantRecipes = activeRecipes.filter(
            (item) =>
              item.productId === line.productId &&
              item.variantId === line.variantId,
          )

          return (
            <Card key={line.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-section text-muted">
                  Item {index + 1}
                </span>
                {lines.length > 1 ? (
                  <IconButton
                    label={`Remove item ${index + 1}`}
                    className="size-8"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((item) => item.id !== line.id),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </IconButton>
                ) : null}
              </div>

              <SelectField
                label="Product"
                value={line.productId}
                options={activeProducts.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(event) => {
                  const nextProduct = activeProducts.find(
                    (item) => item.id === event.target.value,
                  )
                  const nextVar = nextProduct?.variants[0]
                  setLine(line.id, {
                    productId: event.target.value,
                    variantId: nextVar?.id ?? "",
                    recipeId:
                      nextProduct && nextVar
                        ? findDefaultRecipeId(nextProduct.id, nextVar.id)
                        : "",
                    customRecipe: undefined,
                  })
                }}
              />

              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <SelectField
                  label="Size"
                  value={line.variantId}
                  options={variants.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  onChange={(event) =>
                    setLine(line.id, {
                      variantId: event.target.value,
                      recipeId: findDefaultRecipeId(
                        line.productId,
                        event.target.value,
                      ),
                      customRecipe: undefined,
                    })
                  }
                />
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-cocoa">
                    Qty
                  </span>
                  <QuantityControl
                    label={`Quantity for item ${index + 1}`}
                    min={1}
                    value={line.quantity}
                    onChange={(quantity) => setLine(line.id, { quantity })}
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-warm-border/75 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Recipe</span>
                  <button
                    type="button"
                    onClick={() => setCustomEditorLineId(line.id)}
                    className="text-xs font-semibold text-rose hover:underline"
                  >
                    {line.customRecipe ? "Edit custom" : "+ Customise"}
                  </button>
                </div>

                {line.customRecipe ? (
                  <div className="flex items-center justify-between rounded-control bg-sage-soft px-3 py-2 text-xs">
                    <span className="font-semibold text-cocoa">
                      {line.customRecipe.name} ·{" "}
                      {formatLkr(line.customRecipe.estimatedCost)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLine(line.id, { customRecipe: undefined })
                      }
                      className="font-semibold text-muted underline"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <SelectField
                    label="Saved recipe"
                    value={line.recipeId}
                    options={[
                      ...(variantRecipes.length
                        ? variantRecipes
                        : activeRecipes
                      ).map((item) => ({
                        value: item.id,
                        label: `${item.name} · v${item.version}`,
                      })),
                      { value: "", label: "Choose a recipe..." },
                    ]}
                    onChange={(event) =>
                      setLine(line.id, {
                        recipeId: event.target.value,
                        customRecipe: undefined,
                      })
                    }
                  />
                )}
              </div>
            </Card>
          )
        })}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="compact"
            className="flex-1"
            leadingIcon={<Plus aria-hidden="true" size={15} />}
            onClick={addLine}
          >
            Item
          </Button>
          <Button
            variant="ghost"
            size="compact"
            leadingIcon={<Plus aria-hidden="true" size={14} />}
            onClick={() => setProductEditorOpen(true)}
          >
            Product
          </Button>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-section text-muted">
          Pickup & Price
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "Today 4 PM", date: shiftLocalDate(0), time: "16:00" },
            { label: "Tomorrow 10 AM", date: shiftLocalDate(1), time: "10:00" },
            { label: "Tomorrow 4 PM", date: shiftLocalDate(1), time: "16:00" },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setCollectionDate(preset.date)
                setCollectionTime(preset.time)
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                collectionDate === preset.date && collectionTime === preset.time
                  ? "border-sage bg-sage text-white"
                  : "border-warm-border bg-white text-muted"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Pickup date"
            type="date"
            value={collectionDate}
            onChange={(event) => setCollectionDate(event.target.value)}
          />
          <Field
            label="Time"
            type="time"
            value={collectionTime}
            onChange={(event) => setCollectionTime(event.target.value)}
          />
        </div>

        <div className="space-y-2 border-t border-warm-border/75 pt-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setAgreedPrice(String(costSnapshot.suggestedPrice))
              }
              className="rounded-full bg-sage-soft px-2.5 py-1 text-xs font-semibold text-cocoa"
            >
              Suggested {formatLkr(costSnapshot.suggestedPrice)}
            </button>
            <Button
              size="compact"
              variant="ghost"
              leadingIcon={<Calculator aria-hidden="true" size={14} />}
              onClick={() => setPricingSheetOpen(true)}
            >
              Calculator
            </Button>
          </div>
          <Field
            label="Agreed price (Rs.)"
            type="number"
            min="1"
            inputMode="numeric"
            value={agreedPrice || String(costSnapshot.suggestedPrice)}
            onChange={(event) => setAgreedPrice(event.target.value)}
            helperText={`Est. cost ${formatLkr(costSnapshot.estimatedTotal)} · Profit ${formatLkr(effectiveAgreedPrice - costSnapshot.estimatedTotal)}`}
          />
        </div>

        {showNotes ? (
          <TextAreaField
            label="Special notes"
            placeholder="Inscription, sugar level, packaging notes..."
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-xs font-semibold text-muted hover:text-cocoa"
          >
            + Add special notes
          </button>
        )}
      </Card>

      <Card className="space-y-3">
        <CheckboxField
          checked={recordDeposit}
          onChange={setRecordDeposit}
          label="Record deposit now"
        />
        {recordDeposit ? (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field
              label="Amount (Rs.)"
              type="number"
              min="1"
              step="1"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <SelectField
              label="Method"
              value={depositMethod}
              options={[...PAYMENT_METHOD_OPTIONS]}
              onChange={(e) => {
                setDepositMethod(e.target.value)
                if (e.target.value !== "Other") setDepositOtherMethod("")
              }}
            />
            {depositMethod === "Other" ? (
              <div className="col-span-2">
                <Field
                  label="Specify method (optional)"
                  placeholder="Card, cheque, etc."
                  value={depositOtherMethod}
                  onChange={(e) => setDepositOtherMethod(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {error ? (
        <p role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      ) : null}

      <div className="space-y-2.5 pt-2">
        <Button
          fullWidth
          leadingIcon={<Check aria-hidden="true" size={17} />}
          onClick={() => {
            if (validateAll()) setShowConfirmDialog(true)
          }}
        >
          Confirm · <MoneyText amount={effectiveAgreedPrice} />
        </Button>
        {!order || order.status === "Draft" ? (
          <Button
            fullWidth
            variant="secondary"
            leadingIcon={<Save aria-hidden="true" size={16} />}
            onClick={saveDraft}
          >
            Save draft
          </Button>
        ) : null}
      </div>

      <RecipeEditorSheet
        open={customEditorLineId !== null}
        recipe={editingCustomLine?.customRecipe ?? null}
        baseRecipe={
          !editingCustomLine?.customRecipe && editingCustomLine?.recipeId
            ? (state.recipes.find((r) => r.id === editingCustomLine.recipeId) ??
              null)
            : null
        }
        initialProductId={editingCustomLine?.productId}
        initialVariantId={editingCustomLine?.variantId}
        isOrderCustomMode
        onSave={(saved, alsoSaveToLibrary) => {
          if (!editingCustomLine) return
          if (alsoSaveToLibrary) {
            dispatchIfAccepted({ type: "ADD_RECIPE", recipe: saved })
            setLine(editingCustomLine.id, {
              recipeId: saved.id,
              customRecipe: undefined,
            })
            showToast("Custom recipe saved to library")
          } else {
            setLine(editingCustomLine.id, {
              recipeId: "",
              customRecipe: saved,
            })
          }
          setCustomEditorLineId(null)
        }}
        onClose={() => setCustomEditorLineId(null)}
      />

      <ProductEditorSheet
        open={productEditorOpen}
        onClose={() => setProductEditorOpen(false)}
        onSaved={(product, createdRecipe) => {
          showToast(
            createdRecipe
              ? `Added ${product.name} with recipe`
              : `Added ${product.name}`,
          )
          if (lines.length === 1 && !lines[0].recipeId) {
            setLine(lines[0].id, {
              productId: product.id,
              variantId: product.variants[0]?.id ?? "",
              ...(createdRecipe
                ? { recipeId: createdRecipe.id, customRecipe: undefined }
                : {}),
            })
          }
        }}
      />

      <PricingCalculatorSheet
        open={pricingSheetOpen}
        recipe={combinedRecipeForCalculator}
        currentSellingPrice={effectiveAgreedPrice}
        onApplyPrice={(price) => setAgreedPrice(String(price))}
        onClose={() => setPricingSheetOpen(false)}
      />

      <Dialog
        open={showCancelDialog}
        title="Leave order?"
        description="Unsaved changes will be lost."
        onClose={() => setShowCancelDialog(false)}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep editing
            </Button>
            <Button className="flex-1" onClick={onCancel}>
              Discard
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          You can also save this order as a draft to finish later.
        </p>
      </Dialog>

      <Dialog
        open={showConfirmDialog}
        title="Confirm order?"
        description="Locks in price and creates the pantry checklist for preparation."
        onClose={() => setShowConfirmDialog(false)}
        footer={
          <div className="space-y-2.5">
            <Button fullWidth onClick={confirmOrder}>
              Confirm order
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setShowConfirmDialog(false)}
            >
              Go back
            </Button>
          </div>
        }
      >
        <div className="rounded-control bg-sage-soft p-3.5 text-sm text-cocoa">
          {selectedCustomerName} · {formatLkr(effectiveAgreedPrice)}
        </div>
      </Dialog>
    </div>
  )
}
