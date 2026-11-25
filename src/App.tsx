import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, X } from "lucide-react"
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
import { exitNativeApp, initNativeAndroidChrome } from "./lib/nativeBridge"
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
import SettingsScreen, { type SettingsSection } from "./screens/SettingsScreen"
import type { StarterAction, TabId } from "./types"

function AppContent() {
  const { state, repository } = useAppState()
  const { showToast } = useToast()
  const { activeTab, starterAction, switchTab, consumeStarterAction } =
    useNavigationStack("today")
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("root")
  const [focusedScreen, setFocusedScreen] = useState(false)
  const [orderIntent, setOrderIntent] = useState<string | undefined>()
  const [preparationIntent, setPreparationIntent] = useState<string | undefined>()
  const [orderReturnTab, setOrderReturnTab] = useState<TabId | null>(null)
  const [notifPrefs, setNotifPrefs] = useState(() =>
    loadNotificationPreferences(),
  )
  const notifHydratedRef = useRef(false)

  useEffect(() => {
    if (!repository) {
      notifHydratedRef.current = true
      return
    }
    let cancelled = false
    void repository
      .loadNotificationPrefs()
      .then((loaded) => {
        if (cancelled) return
        if (loaded) {
          setNotifPrefs(loaded)
        }
        notifHydratedRef.current = true
      })
      .catch(() => {
        notifHydratedRef.current = true
      })
    return () => {
      cancelled = true
    }
  }, [repository])

  useEffect(() => {
    saveNotificationPreferences(notifPrefs)
    if (repository && notifHydratedRef.current) {
      void repository.saveNotificationPrefs(notifPrefs).catch(() => undefined)
    }
  }, [notifPrefs, repository])

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
        markAllNotificationsRead(prev, [
          `due-${orderId}`,
          `unpaid-${orderId}`,
          `payment-${orderId}`,
          `shortage-${orderId}`,
        ]),
      )
      if (activeTab !== "orders") {
        setOrderReturnTab(activeTab)
      }
      setPreparationIntent(undefined)
      setOrderIntent(orderId)
      setFocusedScreen(true)
      switchTab("orders")
      window.scrollTo(0, 0)
    },
    [activeTab, switchTab],
  )

  const openPreparation = useCallback(
    (orderId: string, preparationId: string) => {
      setNotifPrefs((prev) =>
        markAllNotificationsRead(prev, [
          `due-${orderId}`,
          `unpaid-${orderId}`,
          `payment-${orderId}`,
          `shortage-${orderId}`,
        ]),
      )
      if (activeTab !== "orders") {
        setOrderReturnTab(activeTab)
      }
      setOrderIntent(orderId)
      setPreparationIntent(preparationId)
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
    setPreparationIntent(undefined)
  }, [])

  const lastBackPressRef = useRef(0)
  const rootBackRef = useRef<() => void>(() => {})
  rootBackRef.current = () => {
    if (isUpdatesOpen) {
      setIsUpdatesOpen(false)
      return
    }
    if (isSettingsOpen) {
      setIsSettingsOpen(false)
      setSettingsSection("root")
      return
    }
    if (activeTab !== "today") {
      navigate("today")
      return
    }
    const now = Date.now()
    if (now - lastBackPressRef.current < 2000) {
      exitNativeApp()
      return
    }
    lastBackPressRef.current = now
    showToast({ message: "Press back again to exit", tone: "info" })
  }

  useEffect(() => {
    return initNativeAndroidChrome({
      onRootBack: () => rootBackRef.current(),
    })
  }, [])

  const renderTabScreen = () => {
    if (activeTab === "today") {
      return (
        <HomeScreen
          onNavigate={navigate}
          onOpenUpdates={() => setIsUpdatesOpen(true)}
          onOpenSettings={() => {
            setSettingsSection("root")
            setIsSettingsOpen(true)
          }}
          onOpenOrder={openOrder}
          onStartPreparation={openPreparation}
          unreadAlertCount={unreadAttentionCount}
        />
      )
    }
    if (activeTab === "orders") {
      return (
        <OrdersScreen
          starterAction={starterAction}
          initialOrderId={orderIntent}
          initialPreparationId={preparationIntent}
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
          setSettingsSection("root")
          navigate(tab)
        }}
      >
        <PushView
          viewKey={isSettingsOpen ? "settings" : "tabs"}
          isDetail={isSettingsOpen}
        >
          {isSettingsOpen ? (
            <SettingsScreen
              initialSection={settingsSection}
              onBack={() => {
                setIsSettingsOpen(false)
                setSettingsSection("root")
              }}
            />
          ) : (
            <TabView viewKey={activeTab}>{renderTabScreen()}</TabView>
          )}
        </PushView>
      </AppShell>

      <Sheet
        open={isUpdatesOpen}
        title="Kitchen reminders"
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
                                setSettingsSection("backup")
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

                          <div className="flex shrink-0 items-center gap-1.5">
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
                            <button
                              type="button"
                              aria-label={`Dismiss "${item.title}"`}
                              title="Dismiss"
                              onClick={() => {
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
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-warm-border/80 bg-white/80 text-muted transition hover:border-error/40 hover:text-error active:scale-button"
                            >
                              <X aria-hidden="true" size={14} />
                            </button>
                          </div>
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
                Everything looks clear right now — no shortages or overdue orders.
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
