import { useMemo, useState } from "react"
import { Archive, Plus } from "lucide-react"
import InventoryItemSheet from "../components/domain/InventoryItemSheet"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import EmptyState from "../components/ui/EmptyState"
import Field from "../components/ui/Field"
import { GroupedList, ListRow } from "../components/ui/GroupedList"
import ItemThumbnail from "../components/ui/ItemThumbnail"
import { AnimatedItem, AnimatedList } from "../components/ui/MotionPrimitives"
import SegmentedControl from "../components/ui/SegmentedControl"
import { useToast } from "../components/ui/Toast"
import { formatLkr, formatQuantity } from "../lib/format"
import {
  getEffectiveGramsPerTsp,
  getEffectiveMlPerTsp,
  inventoryCategory,
  isStockTracked,
} from "../lib/inventory"
import { getDisplayPriceUnitLabel, toDisplayUnitPrice } from "../lib/pricing"
import { useAppState } from "../state/AppState"
import type { InventoryItem } from "../types"

type FilterKind = "all" | "ingredient" | "packaging"

export default function IngredientsScreen() {
  const { state } = useAppState()
  const { showToast } = useToast()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterKind>("all")
  const [showArchived, setShowArchived] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

  const catalogItems = useMemo(
    () =>
      state.inventory.filter(
        (item) => inventoryCategory(item) !== "finished",
      ),
    [state.inventory],
  )

  const archivedCount = useMemo(
    () => catalogItems.filter((item) => item.archived).length,
    [catalogItems],
  )

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return catalogItems
      .filter((item) => {
        if (!showArchived && item.archived) return false
        const cat = inventoryCategory(item)
        if (filter !== "all" && cat !== filter) return false
        if (!query) return true
        return item.name.toLowerCase().includes(query)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [catalogItems, filter, search, showArchived])

  const buildSubtitle = (item: InventoryItem): string => {
    const parts: string[] = []
    if (item.unit === "g") {
      parts.push(`Dry · 1 tsp ≈ ${getEffectiveGramsPerTsp(item)} g`)
    } else if (item.unit === "ml") {
      parts.push(`Liquid · 1 tsp = ${getEffectiveMlPerTsp(item)} ml`)
    } else {
      parts.push("Pieces")
    }
    if (isStockTracked(item)) {
      parts.push(`${formatQuantity(item.physical, item.unit)} on hand`)
    }
    if (item.archived) {
      parts.push("Archived")
    }
    return parts.join(" · ")
  }

  return (
    <div className="space-y-4 pb-6">
      <ScreenHeader
        title="Ingredients"
        action={
          <Button
            size="compact"
            leadingIcon={<Plus aria-hidden="true" size={16} />}
            onClick={() => {
              setEditingItem(null)
              setSheetOpen(true)
            }}
          >
            Add
          </Button>
        }
      />

      <Field
        label="Search ingredients"
        hideLabel
        isSearch
        placeholder="Search ingredients or packaging..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <SegmentedControl
            label="Filter by type"
            value={filter}
            onChange={(val) => setFilter(val as FilterKind)}
            segments={[
              { value: "all", label: "All" },
              { value: "ingredient", label: "Ingredients" },
              { value: "packaging", label: "Packaging" },
            ]}
          />
        </div>
        {archivedCount > 0 ? (
          <Button
            size="compact"
            variant={showArchived ? "soft" : "ghost"}
            leadingIcon={<Archive aria-hidden="true" size={14} />}
            onClick={() => setShowArchived((v) => !v)}
          >
            {archivedCount}
          </Button>
        ) : null}
      </div>

      {visibleItems.length > 0 ? (
        <AnimatedList className="space-y-3">
          <GroupedList>
            {visibleItems.map((item, index) => {
              const displayPrice = toDisplayUnitPrice(
                item.averageUnitCost,
                item.unit,
              )
              const priceLabel = getDisplayPriceUnitLabel(item.unit)
              return (
                <AnimatedItem key={item.inventoryId} index={index}>
                  <ListRow
                    leading={
                      <ItemThumbnail
                        image={item.image}
                        alt={item.name}
                        size="sm"
                      />
                    }
                    title={item.name}
                    subtitle={buildSubtitle(item)}
                    value={
                      displayPrice !== undefined
                        ? `${formatLkr(displayPrice)} / ${priceLabel}`
                        : "Set price"
                    }
                    showChevron
                    onClick={() => {
                      setEditingItem(item)
                      setSheetOpen(true)
                    }}
                  />
                </AnimatedItem>
              )
            })}
          </GroupedList>
        </AnimatedList>
      ) : (
        <EmptyState
          illustration="all-clear-bell"
          title={
            catalogItems.length === 0
              ? "No ingredients added yet"
              : "No matching items"
          }
          description={
            catalogItems.length === 0
              ? "Add ingredients with their price per kg or L so recipes calculate costs automatically."
              : "Try another search word or switch filters."
          }
          actionLabel={catalogItems.length === 0 ? "Add ingredient" : undefined}
          onAction={
            catalogItems.length === 0
              ? () => {
                  setEditingItem(null)
                  setSheetOpen(true)
                }
              : undefined
          }
        />
      )}

      <InventoryItemSheet
        open={sheetOpen}
        item={editingItem}
        defaultCategory={filter === "packaging" ? "packaging" : "ingredient"}
        onClose={() => {
          setSheetOpen(false)
          setEditingItem(null)
        }}
        onSaved={(saved) =>
          showToast({
            message: editingItem
              ? `Updated ${saved.name}`
              : `Added ${saved.name}`,
            tone: "success",
          })
        }
      />
    </div>
  )
}
