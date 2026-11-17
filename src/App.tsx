import { useCallback, useState } from "react"
import AppShell from "./components/AppShell"
import Sheet from "./components/ui/Sheet"
import { ToastProvider } from "./components/ui/Toast"
import { selectAttentionItems } from "./lib/selectors/todaySelectors"
import { useNavigationStack } from "./navigation/useNavigationStack"
import AppStateProvider, { useAppState } from "./state/AppState"
import HomeScreen from "./screens/HomeScreen"
import KitchenScreen from "./screens/KitchenScreen"
import MoneyScreen from "./screens/MoneyScreen"
import OrdersScreen from "./screens/OrdersScreen"
import SettingsScreen from "./screens/SettingsScreen"
import type { StarterAction, TabId } from "./types"

function AppContent() {
  const { state } = useAppState()
  const { activeTab, starterAction, switchTab, consumeStarterAction } =
    useNavigationStack("today")
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [focusedScreen, setFocusedScreen] = useState(false)
  const [orderIntent, setOrderIntent] = useState<string | undefined>()

  const attentionItems = selectAttentionItems(state).filter(
    (item) => item.kind !== "low-stock",
  )

  const navigate = useCallback(
    (tab: TabId, action: StarterAction | null = null) => {
      switchTab(tab, action)
      setFocusedScreen(false)
      window.scrollTo({ top: 0, behavior: "smooth" })
    },
    [switchTab],
  )

  const openOrder = useCallback(
    (orderId: string) => {
      setOrderIntent(orderId)
      navigate("orders")
    },
    [navigate],
  )

  const consumeOrderIntent = useCallback(() => {
    setOrderIntent(undefined)
  }, [])

  const renderScreen = () => {
    if (isSettingsOpen) {
      return <SettingsScreen onBack={() => setIsSettingsOpen(false)} />
    }
    if (activeTab === "today") {
      return (
        <HomeScreen
          onNavigate={navigate}
          onOpenUpdates={() => setIsUpdatesOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenOrder={openOrder}
        />
      )
    }
    if (activeTab === "orders") {
      return (
        <OrdersScreen
          starterAction={starterAction}
          initialOrderId={orderIntent}
          onConsumeOrderIntent={consumeOrderIntent}
          onConsumeStarterAction={consumeStarterAction}
          onFocusedChange={setFocusedScreen}
          onOpenShopping={() => navigate("kitchen", "plan-shopping")}
        />
      )
    }
    if (activeTab === "kitchen") {
      return (
        <KitchenScreen
          starterAction={starterAction}
          onConsumeStarterAction={consumeStarterAction}
          onFocusedChange={setFocusedScreen}
        />
      )
    }
    if (activeTab === "money") {
      return (
        <MoneyScreen
          starterAction={starterAction}
          onOpenOrder={openOrder}
          onViewDueOrders={() => navigate("orders", "view-due")}
        />
      )
    }
    return null
  }

  return (
    <>
      <AppShell
        activeTab={activeTab}
        hideNavigation={focusedScreen || isSettingsOpen}
        onNavigate={(tab) => {
          setIsSettingsOpen(false)
          navigate(tab)
        }}
      >
        {renderScreen()}
      </AppShell>

      <Sheet
        open={isUpdatesOpen}
        title="Bakery reminders"
        subtitle="Live alerts derived from your orders, stock, and backups"
        onClose={() => setIsUpdatesOpen(false)}
      >
        <div className="space-y-2.5">
          {attentionItems.length > 0 ? (
            attentionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIsUpdatesOpen(false)
                  if (item.kind === "backup") {
                    setIsSettingsOpen(true)
                  } else if (item.orderId) {
                    openOrder(item.orderId)
                  } else {
                    navigate(item.targetTab, item.starterAction ?? null)
                  }
                }}
                className={`w-full rounded-card border p-3.5 text-left transition active:scale-button ${item.tone === "warning"
                    ? "border-warning-border bg-warning-soft text-cocoa"
                    : "border-sage-border bg-sage-soft text-cocoa"
                  }`}
              >
                <div className="text-sm font-semibold">{item.title}</div>
                <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
              </button>
            ))
          ) : (
            <div className="rounded-card bg-sage-soft p-4 text-sm text-cocoa">
              Everything looks clear right now — no shortages or overdue bakes.
            </div>
          )}
        </div>
      </Sheet>
    </>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AppStateProvider>
  )
}
