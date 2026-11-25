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
  linkRecipe?: Recipe | null
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
  linkRecipe,
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
    } else if (linkRecipe) {
      setName(linkRecipe.name)
      setImage(linkRecipe.image)
      setVariants([
        {
          id: createId("variant"),
          name: linkRecipe.yieldLabel || "Standard",
          unitLabel: "pack",
          finishedInventoryId: "",
        },
      ])
    } else {
      setName("")
      setImage(undefined)
      setVariants([
        {
          id: createId("variant"),
          name: "Standard",
          unitLabel: "pack",
          finishedInventoryId: "",
        },
      ])
    }
  }, [linkRecipe?.id, open, product?.id])

  const handleAddVariant = () => {
    setVariants((current) => [
      ...current,
      {
        id: createId("variant"),
        name: "",
        unitLabel: "pack",
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
        unitLabel: v.unitLabel.trim() || "pack",
        ...(v.finishedInventoryId
          ? { finishedInventoryId: v.finishedInventoryId }
          : {}),
        ...(v.archived ? { archived: true } : {}),
      }))

    if (!cleanVariants.length || cleanVariants.some((v) => !v.name)) {
      setError(
        "Add at least one size or pack option (e.g., 250g jar, 1 kg, Box of 6).",
      )
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
      setError("Could not save product. Check size/pack options.")
      return
    }

    let createdRecipe: Recipe | undefined
    const primaryVariant = cleanVariants[0]
    if (!product && linkRecipe && primaryVariant) {
      const updatedLink: Recipe = {
        ...structuredClone(linkRecipe),
        productId: nextProduct.id,
        variantId: primaryVariant.id,
        updatedAt: new Date().toISOString(),
      }
      dispatchIfAccepted({ type: "UPDATE_RECIPE", recipe: updatedLink })
    } else if (!product && sourceRecipeId && primaryVariant) {
      const sourceRecipe = state.recipes.find((r) => r.id === sourceRecipeId)
      if (sourceRecipe) {
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
      subtitle="Set the sizes or pack options customers can order"
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
          placeholder="e.g., Chili paste, Chocolate cake, Mango chutney"
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

        {!product && !linkRecipe && activeRecipes.length > 0 ? (
          <SelectField
            label="Copy recipe from (optional)"
            value={sourceRecipeId}
            helperText="Clones ingredients, packaging, and steps to the first option."
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
              Sizes or packs
            </span>
            <Button
              size="compact"
              variant="soft"
              leadingIcon={<Plus aria-hidden="true" size={15} />}
              onClick={handleAddVariant}
            >
              Add option
            </Button>
          </div>

          {variants.map((variant, index) => (
            <div
              key={variant.id}
              className="space-y-2.5 rounded-grouped border border-warm-border bg-ivory/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted">
                  Option {index + 1}
                </span>
                {variants.length > 1 ? (
                  <IconButton
                    label={`Remove option ${index + 1}`}
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
                  label="Size or pack"
                  placeholder="e.g., 250g jar, 1 kg, Box of 6"
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
                  label="Sold as"
                  placeholder="e.g., jar, pack, cake"
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
