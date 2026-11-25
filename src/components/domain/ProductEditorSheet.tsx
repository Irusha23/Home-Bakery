import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import Button, { IconButton } from "../ui/Button"
import Field from "../ui/Field"
import { ImagePickerField } from "../ui/ImagePickerSheet"
import SelectField from "../ui/SelectField"
import Sheet from "../ui/Sheet"
import { createId } from "../../lib/id"
import { useAppState } from "../../state/AppState"
import type { Product, ProductVariant, Recipe } from "../../types"

type ProductEditorSheetProps = {
  open: boolean
  product?: Product | null
  onClose: () => void
  onSaved?: (product: Product, createdRecipe?: Recipe) => void
}

type VariantDraft = {
  id: string
  name: string
  unitLabel: string
  finishedInventoryId: string
  archived?: boolean
}

export default function ProductEditorSheet({
  open,
  product,
  onClose,
  onSaved,
}: ProductEditorSheetProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const activeRecipes = state.recipes.filter((r) => !r.archived)
  const [name, setName] = useState("")
  const [image, setImage] = useState<string | undefined>(undefined)
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [sourceRecipeId, setSourceRecipeId] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    setSourceRecipeId("")
    if (product) {
      setName(product.name)
      setImage(product.image)
      setVariants(
        product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          unitLabel: v.unitLabel,
          finishedInventoryId: v.finishedInventoryId ?? "",
          archived: v.archived,
        })),
      )
    } else {
      setName("")
      setImage(undefined)
      setVariants([
        {
          id: createId("variant"),
          name: "Standard size",
          unitLabel: "unit",
          finishedInventoryId: "",
        },
      ])
    }
  }, [open, product?.id])

  const handleAddVariant = () => {
    setVariants((current) => [
      ...current,
      {
        id: createId("variant"),
        name: "",
        unitLabel: "unit",
        finishedInventoryId: "",
      },
    ])
  }

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Enter a product name.")
      return
    }
    const cleanVariants: ProductVariant[] = variants
      .filter((v) => v.name.trim() || v.unitLabel.trim())
      .map((v) => ({
        id: v.id,
        name: v.name.trim(),
        unitLabel: v.unitLabel.trim() || "unit",
        ...(v.finishedInventoryId
          ? { finishedInventoryId: v.finishedInventoryId }
          : {}),
        ...(v.archived ? { archived: true } : {}),
      }))

    if (!cleanVariants.length || cleanVariants.some((v) => !v.name)) {
      setError("Add at least one variant with a name (e.g., 1 kg, Box of 6).")
      return
    }

    const nextProduct: Product = {
      id: product?.id ?? createId("product"),
      name: trimmedName,
      ...(image ? { image } : {}),
      variants: cleanVariants,
      ...(product?.archived ? { archived: product.archived } : {}),
    }

    const accepted = dispatchIfAccepted(
      product
        ? { type: "UPDATE_PRODUCT", product: nextProduct }
        : { type: "ADD_PRODUCT", product: nextProduct },
    )
    if (!accepted) {
      setError("Could not save product. Check variant details.")
      return
    }

    let createdRecipe: Recipe | undefined
    if (!product && sourceRecipeId) {
      const sourceRecipe = state.recipes.find((r) => r.id === sourceRecipeId)
      const primaryVariant = cleanVariants[0]
      if (sourceRecipe && primaryVariant) {
        const candidate: Recipe = {
          ...structuredClone(sourceRecipe),
          id: createId("recipe"),
          name:
            cleanVariants.length === 1
              ? trimmedName
              : `${trimmedName} · ${primaryVariant.name}`,
          productId: nextProduct.id,
          variantId: primaryVariant.id,
          version: 1,
          yieldLabel: `${sourceRecipe.yield} × ${primaryVariant.name} ${primaryVariant.unitLabel}`.trim(),
          updatedAt: new Date().toISOString(),
          history: [],
        }
        if (dispatchIfAccepted({ type: "ADD_RECIPE", recipe: candidate })) {
          createdRecipe = candidate
        }
      }
    }

    onSaved?.(nextProduct, createdRecipe)
    onClose()
  }

  return (
    <Sheet
      open={open}
      title={product ? "Edit product" : "New product"}
      subtitle="Define sizes or pack variants customers can order"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            Save product
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field
          label="Product name"
          placeholder="e.g., Chocolate cake, Chicken pizza, Chili paste"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError("")
          }}
        />

        <ImagePickerField
          label="Product photo"
          value={image}
          defaultCategory="bakes"
          onChange={setImage}
        />

        {!product && activeRecipes.length > 0 ? (
          <SelectField
            label="Copy recipe from (optional)"
            value={sourceRecipeId}
            helperText="Clones ingredients, packaging, and steps to the first variant."
            options={[
              { value: "", label: "None — add recipe later" },
              ...activeRecipes.map((r) => ({
                value: r.id,
                label: `${r.name} · v${r.version}`,
              })),
            ]}
            onChange={(e) => setSourceRecipeId(e.target.value)}
          />
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-cocoa">
              Sizes & variants
            </span>
            <Button
              size="compact"
              variant="soft"
              leadingIcon={<Plus aria-hidden="true" size={15} />}
              onClick={handleAddVariant}
            >
              Add variant
            </Button>
          </div>

          {variants.map((variant, index) => (
            <div
              key={variant.id}
              className="space-y-2.5 rounded-grouped border border-warm-border bg-ivory/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted">
                  Variant {index + 1}
                </span>
                {variants.length > 1 ? (
                  <IconButton
                    label={`Remove variant ${index + 1}`}
                    className="size-8"
                    onClick={() =>
                      setVariants((current) =>
                        current.filter((item) => item.id !== variant.id),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </IconButton>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Variant name"
                  placeholder="1 kg / Box of 6"
                  value={variant.name}
                  onChange={(e) =>
                    setVariants((current) =>
                      current.map((item) =>
                        item.id === variant.id
                          ? { ...item, name: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <Field
                  label="Unit label"
                  placeholder="cake / box"
                  value={variant.unitLabel}
                  onChange={(e) =>
                    setVariants((current) =>
                      current.map((item) =>
                        item.id === variant.id
                          ? { ...item, unitLabel: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>

        {error ? (
          <p className="text-sm font-medium text-error">{error}</p>
        ) : null}
      </div>
    </Sheet>
  )
}
