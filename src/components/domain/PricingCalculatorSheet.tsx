import { useMemo, useState } from "react"
import { Calculator } from "lucide-react"
import Button from "../ui/Button"
import Card from "../ui/Card"
import Field from "../ui/Field"
import MoneyText from "../ui/MoneyText"
import SegmentedControl from "../ui/SegmentedControl"
import Sheet from "../ui/Sheet"
import {
  calculatePriceMetricsAtSellingPrice,
  calculateSuggestedPrice,
  estimateRecipeMaterialCost,
} from "../../lib/pricing"
import { useAppState } from "../../state/AppState"
import type { PricingMode, RecipeSnapshot } from "../../types"

type PricingCalculatorSheetProps = {
  open: boolean
  title?: string
  recipe?: Pick<RecipeSnapshot, "name" | "ingredients" | "packaging" | "preparationMinutes" | "estimatedCost">
  quantity?: number
  currentSellingPrice?: number
  onApplyPrice?: (price: number) => void
  onClose: () => void
}

export default function PricingCalculatorSheet({
  open,
  title,
  recipe,
  quantity = 1,
  currentSellingPrice,
  onApplyPrice,
  onClose,
}: PricingCalculatorSheetProps) {
  const { state } = useAppState()
  const [mode, setMode] = useState<PricingMode>(
    state.settings.defaultPricingMode,
  )
  const [marginText, setMarginText] = useState(
    String(state.settings.defaultMarginPercent),
  )
  const [markupText, setMarkupText] = useState(
    String(state.settings.defaultMarkupPercent),
  )
  const [roundingStep, setRoundingStep] = useState<1 | 50 | 100>(
    state.settings.priceRoundingStep,
  )
  const [labourRateText, setLabourRateText] = useState(
    String(state.settings.defaultLabourRatePerHour),
  )

  const labourRate = Math.max(0, Number(labourRateText) || 0)
  const safeQty = Math.max(1, quantity)

  const breakdown = useMemo(() => {
    if (!recipe) {
      return {
        ingredientsCost: 0,
        packagingCost: 0,
        labourCost: 0,
        totalCost: 0,
        unpricedItems: [] as string[],
        hasLivePricing: false,
      }
    }
    const perBatch = estimateRecipeMaterialCost(
      recipe,
      state.inventory,
      labourRate,
    )
    const fallbackPerBatch =
      !perBatch.hasLivePricing && recipe.estimatedCost > 0
        ? recipe.estimatedCost
        : perBatch.totalCost
    const ing = perBatch.hasLivePricing
      ? perBatch.ingredientsCost
      : Math.round(fallbackPerBatch * 0.82)
    const pkg = perBatch.hasLivePricing
      ? perBatch.packagingCost
      : Math.round(fallbackPerBatch * 0.1)
    const lab = perBatch.hasLivePricing
      ? perBatch.labourCost
      : Math.max(0, fallbackPerBatch - ing - pkg)
    return {
      ingredientsCost: ing * safeQty,
      packagingCost: pkg * safeQty,
      labourCost: lab * safeQty,
      totalCost: (ing + pkg + lab) * safeQty,
      unpricedItems: perBatch.unpricedItems,
      hasLivePricing: perBatch.hasLivePricing,
    }
  }, [labourRate, recipe, safeQty, state.inventory])

  const result = useMemo(
    () =>
      calculateSuggestedPrice(breakdown.totalCost, {
        mode,
        marginPercent: Number(marginText),
        markupPercent: Number(markupText),
        roundingStep,
      }),
    [breakdown.totalCost, marginText, markupText, mode, roundingStep],
  )

  const activePrice =
    currentSellingPrice && currentSellingPrice > 0
      ? currentSellingPrice
      : result.valid
        ? result.suggestedPrice
        : 0

  const currentMetrics = useMemo(
    () => calculatePriceMetricsAtSellingPrice(breakdown.totalCost, activePrice),
    [activePrice, breakdown.totalCost],
  )

  return (
    <Sheet
      open={open}
      title={title ?? "Pricing calculator"}
      subtitle={
        recipe
          ? `${recipe.name}${safeQty > 1 ? ` × ${safeQty}` : ""}`
          : "Cost breakdown & profit check"
      }
      onClose={onClose}
      footer={
        onApplyPrice && result.valid ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onApplyPrice(result.suggestedPrice)
                onClose()
              }}
            >
              Use <MoneyText amount={result.suggestedPrice} />
            </Button>
          </div>
        ) : (
          <Button fullWidth onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <Card className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-section text-muted">
            <Calculator aria-hidden="true" size={14} />
            Cost estimate
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-sm">
            <div>
              <div className="text-xs text-muted">Ingredients</div>
              <div className="mt-0.5 font-semibold text-cocoa">
                <MoneyText amount={breakdown.ingredientsCost} />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Packaging</div>
              <div className="mt-0.5 font-semibold text-cocoa">
                <MoneyText amount={breakdown.packagingCost} />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Labour</div>
              <div className="mt-0.5 font-semibold text-cocoa">
                <MoneyText amount={breakdown.labourCost} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-warm-border pt-2.5 text-sm font-semibold text-cocoa">
            <span>Total estimated cost</span>
            <MoneyText amount={breakdown.totalCost} />
          </div>
          {breakdown.unpricedItems.length > 0 ? (
            <p className="text-xs text-warning">
              No unit price set for: {breakdown.unpricedItems.join(", ")}. Tap
              them in Recipes to set Rs./kg or unit price.
            </p>
          ) : null}
        </Card>

        <div className="space-y-3">
          <div>
            <span className="mb-2 block text-sm font-semibold text-cocoa">
              Pricing method
            </span>
            <SegmentedControl
              label="Pricing method"
              value={mode}
              onChange={(next) => setMode(next)}
              segments={[
                { value: "margin", label: "Target margin %" },
                { value: "markup", label: "Cost markup %" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {mode === "margin" ? (
              <Field
                label="Target margin (%)"
                type="number"
                min="0"
                max="99"
                step="1"
                value={marginText}
                onChange={(e) => setMarginText(e.target.value)}
                error={!result.valid ? result.error : undefined}
              />
            ) : (
              <Field
                label="Markup on cost (%)"
                type="number"
                min="0"
                step="5"
                value={markupText}
                onChange={(e) => setMarkupText(e.target.value)}
                error={!result.valid ? result.error : undefined}
              />
            )}
            <Field
              label="Labour (Rs./hr)"
              type="number"
              min="0"
              step="50"
              value={labourRateText}
              onChange={(e) => setLabourRateText(e.target.value)}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-cocoa">
              Price rounding
            </span>
            <SegmentedControl
              label="Price rounding"
              value={String(roundingStep)}
              onChange={(value) =>
                setRoundingStep(Number(value) as 1 | 50 | 100)
              }
              segments={[
                { value: "1", label: "Exact Rs." },
                { value: "50", label: "Nearest 50" },
                { value: "100", label: "Nearest 100" },
              ]}
            />
          </div>
        </div>

        {result.valid ? (
          <Card tone="sage" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-cocoa">
                Suggested selling price
              </span>
              <span className="text-xl font-bold text-sage-dark">
                <MoneyText amount={result.suggestedPrice} />
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
              <span>
                Exact formula:{" "}
                <strong className="text-cocoa">
                  Rs. {result.rawSuggestedPrice.toLocaleString("en-US")}
                </strong>
              </span>
              <span>
                Profit:{" "}
                <strong className="text-success">
                  <MoneyText amount={result.profitAtSuggested} />
                </strong>{" "}
                ({result.actualMarginPercent}% margin)
              </span>
            </div>
          </Card>
        ) : null}

        {currentSellingPrice && currentSellingPrice > 0 ? (
          <Card className="flex items-center justify-between text-xs">
            <span className="text-muted">
              At your entered price (<MoneyText amount={currentSellingPrice} />
              ):
            </span>
            <span
              className={`font-semibold ${
                currentMetrics.profitLkr >= 0 ? "text-success" : "text-error"
              }`}
            >
              <MoneyText amount={currentMetrics.profitLkr} signed /> (
              {currentMetrics.marginPercent}% margin)
            </span>
          </Card>
        ) : null}
      </div>
    </Sheet>
  )
}
