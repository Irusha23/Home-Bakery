import { useCallback, useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"
import { MotionConfig } from "motion/react"
import AppShell from "./components/AppShell"
import ErrorBoundary from "./components/ErrorBoundary"
import Illustration from "./components/ui/Illustration"
import {
  AnimatedItem,
  AnimatedList,
  PushView,
  TabView,
} from "./components/ui/MotionPrimitives"
import Sheet from "./components/ui/Sheet"
import SwipeableRow from "./components/ui/SwipeableRow"
import { ToastProvider, useToast } from "./components/ui/Toast"
import { IOS_TRANSITION } from "./lib/motion"
import {
  clearAllNotifications,
  dismissNotification,
  loadNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  pruneNotificationPreferences,
  restoreNotification,
  saveNotificationPreferences,
} from "./lib/notificationState"
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
  const { showToast } = useToast()
  const { activeTab, starterAction, switchTab, consumeStarterAction } =
    useNavigationStack("today")
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [focusedScreen, setFocusedScreen] = useState(false)
  const [orderIntent, setOrderIntent] = useState<string | undefined>()
  const [orderReturnTab, setOrderReturnTab] = useState<TabId | null>(null)
  const [notifPrefs, setNotifPrefs] = useState(() =>
    loadNotificationPreferences(),
  )

  useEffect(() => {
    saveNotificationPreferences(notifPrefs)
  }, [notifPrefs])

  const allAttentionItems = useMemo(
    () =>
      selectAttentionItems(state).filter((item) => item.kind !== "low-stock"),
    [state],
  )

  useEffect(() => {
    const activeIds = allAttentionItems.map((item) => item.id)
    setNotifPrefs((prev) => pruneNotificationPreferences(prev, activeIds))
  }, [allAttentionItems])
  const readIdSet = useMemo(() => new Set(notifPrefs.readIds), [notifPrefs.readIds])
  const dismissedIdSet = useMemo(
    () => new Set(notifPrefs.dismissedIds),
    [notifPrefs.dismissedIds],
  )
  const attentionItems = useMemo(
    () => allAttentionItems.filter((item) => !dismissedIdSet.has(item.id)),
    [allAttentionItems, dismissedIdSet],
  )
  const unreadAttentionCount = useMemo(
    () => attentionItems.filter((item) => !readIdSet.has(item.id)).length,
    [attentionItems, readIdSet],
  )

  const navigate = useCallback(
    (tab: TabId, action: StarterAction | null = null) => {
      switchTab(tab, action)
      setFocusedScreen(false)
      setOrderReturnTab(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
    },
    [switchTab],
  )

  const openOrder = useCallback(
    (orderId: string) => {
      setNotifPrefs((prev) =>
        markAllNotificationsRead(prev, [`due-${orderId}`, `payment-${orderId}`]),
      )
      if (activeTab !== "orders") {
        setOrderReturnTab(activeTab)
      }
      setOrderIntent(orderId)
      setFocusedScreen(true)
      switchTab("orders")
      window.scrollTo(0, 0)
    },
    [activeTab, switchTab],
  )

  const handleOrderBackToOrigin = useCallback(() => {
    if (!orderReturnTab) return
    const target = orderReturnTab
    setOrderReturnTab(null)
    setFocusedScreen(false)
    switchTab(target)
  }, [orderReturnTab, switchTab])

  const consumeOrderIntent = useCallback(() => {
    setOrderIntent(undefined)
  }, [])

  const renderTabScreen = () => {
    if (activeTab === "today") {
      return (
        <HomeScreen
          onNavigate={navigate}
          onOpenUpdates={() => setIsUpdatesOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenOrder={openOrder}
          unreadAlertCount={unreadAttentionCount}
        />
      )
    }
    if (activeTab === "orders") {
      return (
        <OrdersScreen
          starterAction={starterAction}
          initialOrderId={orderIntent}
          onConsumeOrderIntent={consumeOrderIntent}
          onReturnFromIntent={orderReturnTab ? handleOrderBackToOrigin : undefined}
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
        <PushView
          viewKey={isSettingsOpen ? "settings" : "tabs"}
          isDetail={isSettingsOpen}
        >
          {isSettingsOpen ? (
            <SettingsScreen onBack={() => setIsSettingsOpen(false)} />
          ) : (
            <TabView viewKey={activeTab}>{renderTabScreen()}</TabView>
          )}
        </PushView>
      </AppShell>

      <Sheet
        open={isUpdatesOpen}
        title="Bakery reminders"
        subtitle="Live alerts derived from your orders, stock, and backups"
        onClose={() => setIsUpdatesOpen(false)}
      >
        <div className="space-y-3">
          {attentionItems.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
                <span className="font-medium text-muted">
                  {unreadAttentionCount > 0
                    ? `${unreadAttentionCount} unread`
                    : "All read"}
                </span>
                <div className="flex items-center gap-3">
                  {unreadAttentionCount > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setNotifPrefs((prev) =>
                          markAllNotificationsRead(
                            prev,
                            attentionItems.map((item) => item.id),
                          ),
                        )
                      }
                      className="font-semibold text-sage-dark transition hover:opacity-75"
                    >
                      Mark all read
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setNotifPrefs((prev) =>
                        clearAllNotifications(
                          prev,
                          attentionItems.map((item) => item.id),
                        ),
                      )
                    }
                    className="font-semibold text-muted transition hover:text-error"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              <AnimatedList className="space-y-2.5">
                {attentionItems.map((item, index) => {
                  const isRead = readIdSet.has(item.id)
                  return (
                    <AnimatedItem key={item.id} index={index}>
                      <SwipeableRow
                        actionLabel="Clear"
                        onAction={() => {
                          setNotifPrefs((prev) =>
                            dismissNotification(prev, item.id),
                          )
                          showToast({
                            message: "Reminder cleared",
                            tone: "info",
                            actionLabel: "Undo",
                            onAction: () =>
                              setNotifPrefs((prev) =>
                                restoreNotification(prev, item.id),
                              ),
                          })
                        }}
                      >
                        <div
                          className={`flex items-start gap-2 rounded-card border p-3.5 transition ${
                            isRead
                              ? "border-warm-border/70 bg-neutral-soft/80 opacity-75"
                              : item.tone === "warning"
                                ? "border-warning-border bg-warning-soft"
                                : "border-sage-border bg-sage-soft"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setNotifPrefs((prev) =>
                                markNotificationRead(prev, item.id),
                              )
                              setIsUpdatesOpen(false)
                              if (item.kind === "backup") {
                                setIsSettingsOpen(true)
                              } else if (item.orderId) {
                                openOrder(item.orderId)
                              } else {
                                navigate(
                                  item.targetTab,
                                  item.starterAction ?? null,
                                )
                              }
                            }}
                            className="min-w-0 flex-1 text-left transition active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-1.5">
                              {!isRead ? (
                                <span
                                  aria-hidden="true"
                                  className={`size-2 shrink-0 rounded-full ${
                                    item.tone === "warning"
                                      ? "bg-warning"
                                      : "bg-rose"
                                  }`}
                                />
                              ) : null}
                              <span
                                className={`truncate text-sm ${
                                  isRead
                                    ? "font-medium text-muted"
                                    : "font-semibold text-cocoa"
                                }`}
                              >
                                {item.title}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              {item.detail}
                            </p>
                          </button>

                          {!isRead ? (
                            <button
                              type="button"
                              aria-label={`Mark "${item.title}" as read`}
                              title="Mark as read"
                              onClick={() =>
                                setNotifPrefs((prev) =>
                                  markNotificationRead(prev, item.id),
                                )
                              }
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-warm-border/80 bg-white/80 text-muted transition hover:border-sage-border hover:text-cocoa active:scale-button"
                            >
                              <Check aria-hidden="true" size={14} />
                            </button>
                          ) : null}
                        </div>
                      </SwipeableRow>
                    </AnimatedItem>
                  )
                })}
              </AnimatedList>
            </>
          ) : (
            <div className="rounded-card bg-sage-soft/70 px-4 py-6 text-center text-sm text-cocoa">
              <Illustration name="all-clear-bell" size="md" />
              <p className="mt-2 font-medium">
                Everything looks clear right now — no shortages or overdue bakes.
              </p>
            </div>
          )}
        </div>
      </Sheet>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user" transition={IOS_TRANSITION}>
        <AppStateProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AppStateProvider>
      </MotionConfig>
    </ErrorBoundary>
  )
}
