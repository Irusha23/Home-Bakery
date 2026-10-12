import { useCallback, useState } from "react"
import AppShell from "./components/AppShell"
import Dialog from "./components/ui/Dialog"
import AppStateProvider from "./state/AppState"
import HomeScreen from "./screens/HomeScreen"
import InventoryScreen from "./screens/InventoryScreen"
import OrdersScreen from "./screens/OrdersScreen"
import PlaceholderScreen from "./screens/PlaceholderScreen"
import RecipesScreen from "./screens/RecipesScreen"
import ShoppingScreen from "./screens/ShoppingScreen"
import type { StarterAction, TabId } from "./types"

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("home")
  const [starterAction, setStarterAction] = useState<StarterAction | null>(null)
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false)
  const [focusedScreen, setFocusedScreen] = useState(false)
  const [inventoryIntent, setInventoryIntent] = useState<string | undefined>()

  const navigate = useCallback(
    (tab: TabId, action: StarterAction | null = null) => {
      setActiveTab(tab)
      setStarterAction(action)
      setFocusedScreen(false)
      window.scrollTo({ top: 0, behavior: "smooth" })
    },
    [],
  )

  const consumeStarterAction = useCallback(() => {
    setStarterAction(null)
  }, [])

  const consumeInventoryIntent = useCallback(() => {
    setInventoryIntent(undefined)
  }, [])

  const renderScreen = () => {
    if (activeTab === "home") {
      return (
        <HomeScreen
          onNavigate={navigate}
          onOpenUpdates={() => setIsUpdatesOpen(true)}
        />
      )
    }
    if (activeTab === "orders") {
      return (
        <OrdersScreen
          starterAction={starterAction}
          onConsumeStarterAction={consumeStarterAction}
          onFocusedChange={setFocusedScreen}
          onOpenShopping={() => navigate("shopping")}
        />
      )
    }
    if (activeTab === "recipes") {
      return <RecipesScreen onFocusedChange={setFocusedScreen} />
    }
    if (activeTab === "shopping") {
      return (
        <ShoppingScreen
          starterAction={starterAction}
          onConsumeStarterAction={consumeStarterAction}
          onFocusedChange={setFocusedScreen}
          onOpenInventory={(inventoryId) => {
            setInventoryIntent(inventoryId)
            navigate("inventory")
          }}
        />
      )
    }
    if (activeTab === "inventory") {
      return (
        <InventoryScreen
          starterAction={starterAction}
          initialInventoryId={inventoryIntent}
          onConsumeStarterAction={consumeStarterAction}
          onConsumeInventoryIntent={consumeInventoryIntent}
          onFocusedChange={setFocusedScreen}
        />
      )
    }
    return <PlaceholderScreen tab={activeTab} starterAction={starterAction} />
  }

  return (
    <>
      <AppShell
        activeTab={activeTab}
        hideNavigation={focusedScreen}
        onNavigate={(tab) => navigate(tab)}
      >
        {renderScreen()}
      </AppShell>

      <Dialog
        open={isUpdatesOpen}
        title="You’re all caught up"
        description="Two reminders are already highlighted on your dashboard."
        onClose={() => setIsUpdatesOpen(false)}
      >
        <div className="space-y-3">
          <div className="rounded-card bg-warning-soft p-4 text-sm text-cocoa">
            Flour is short by 1.47 kg for confirmed orders.
          </div>
          <div className="rounded-card bg-sage-soft p-4 text-sm text-cocoa">
            Nadeesha’s cake is due for collection at 4:30 PM.
          </div>
        </div>
      </Dialog>
    </>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  )
}
