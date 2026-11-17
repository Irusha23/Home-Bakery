import { useEffect, useMemo, useState } from "react"
import SegmentedControl from "../components/ui/SegmentedControl"
import { selectManualShoppingList } from "../lib/inventory"
import { useAppState } from "../state/AppState"
import type { StarterAction } from "../types"
import RecipesScreen from "./RecipesScreen"
import ShoppingScreen from "./ShoppingScreen"

type KitchenSection = "shopping" | "recipes"

type KitchenScreenProps = {
  starterAction: StarterAction | null
  initialSection?: KitchenSection
  onConsumeStarterAction: () => void
  onFocusedChange: (focused: boolean) => void
}

export default function KitchenScreen({
  starterAction,
  initialSection,
  onConsumeStarterAction,
  onFocusedChange,
}: KitchenScreenProps) {
  const { state } = useAppState()
  const [section, setSection] = useState<KitchenSection>(
    initialSection ?? "shopping",
  )
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (starterAction === "plan-shopping") {
      setSection("shopping")
    }
  }, [starterAction])

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection)
    }
  }, [initialSection])

  const toBuyCount = useMemo(
    () => selectManualShoppingList(state).length,
    [state],
  )

  const handleFocusedChange = (nextFocused: boolean) => {
    setFocused(nextFocused)
    onFocusedChange(nextFocused)
  }

  return (
    <div className="space-y-5">
      {!focused ? (
        <div className="sticky top-0 z-10 -mx-5 border-b border-warm-border/70 bg-ivory/95 px-5 pb-3 pt-1 backdrop-blur-sm">
          <SegmentedControl
            label="Kitchen section"
            value={section}
            onChange={(value) => setSection(value as KitchenSection)}
            segments={[
              {
                value: "shopping",
                label: toBuyCount > 0 ? `To buy (${toBuyCount})` : "To buy",
              },
              { value: "recipes", label: "Recipes" },
            ]}
          />
        </div>
      ) : null}

      {section === "shopping" ? (
        <ShoppingScreen
          starterAction={starterAction}
          onConsumeStarterAction={onConsumeStarterAction}
        />
      ) : (
        <RecipesScreen onFocusedChange={handleFocusedChange} />
      )}
    </div>
  )
}
