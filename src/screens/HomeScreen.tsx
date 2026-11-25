import {
  ArrowRight,
  Bell,
  ChefHat,
  Clock3,
  CreditCard,
  Plus,
  Settings,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import Button, { IconButton } from "../components/ui/Button"
import Card from "../components/ui/Card"
import EmptyState from "../components/ui/EmptyState"
import { GroupedList, ListRow } from "../components/ui/GroupedList"
import ItemThumbnail from "../components/ui/ItemThumbnail"
import { StaggerSection } from "../components/ui/MotionPrimitives"
import StatusBadge from "../components/ui/StatusBadge"
import { selectMonthlyBudgetReport } from "../lib/budget"
import { outstandingOrderBalance } from "../lib/financials"
import { formatLkr } from "../lib/format"
import {
  orderHasUnpurchasedItems,
  selectManualShoppingList,
} from "../lib/inventory"
import {
  selectAttentionItems,
  selectGreeting,
  selectNextUp,
  selectUpcomingCollections,
  selectWorkload,
} from "../lib/selectors/todaySelectors"
import { useAppState } from "../state/AppState"
import type { StarterAction, TabId } from "../types"

type HomeScreenProps = {
  onNavigate: (tab: TabId, action?: StarterAction | null) => void
  onOpenUpdates: () => void
  onOpenSettings?: () => void
  onOpenOrder?: (orderId: string) => void
  onStartPreparation?: (orderId: string, preparationId: string) => void
  unreadAlertCount?: number
}

export default function HomeScreen({
  onNavigate,
  onOpenUpdates,
  onOpenSettings,
  onOpenOrder,
  onStartPreparation,
  unreadAlertCount,
}: HomeScreenProps) {
  const { state } = useAppState()
  const now = new Date()
  const { greeting, subtitle, todayIso } = selectGreeting(state, now)
  const nextUp = selectNextUp(state, now)
  const workload = selectWorkload(state, todayIso)
  const toBuyCount = selectManualShoppingList(state).length
  const upcoming = selectUpcomingCollections(state, todayIso, 3)
  const attentionItems = selectAttentionItems(state, now).filter(
    (item) => item.kind !== "low-stock",
  )
  const badgeCount = unreadAlertCount ?? attentionItems.length
  const budget = selectMonthlyBudgetReport(state, now)
  const dueOrders = state.orders
    .filter((order) => order.status !== "Draft" && order.status !== "Cancelled")
    .map((order) => ({
      order,
      balance: outstandingOrderBalance(order, state.refunds),
    }))
    .filter((item) => item.balance > 0)
  const collectedDueCount = dueOrders.filter(
    (item) => item.order.status === "Completed",
  ).length
  const totalDueLkr = dueOrders.reduce((sum, item) => sum + item.balance, 0)

  return (
    <div className="space-y-6 pb-4">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">
            {state.settings.businessName}
          </p>
          <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight text-cocoa">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <div className="relative">
            <IconButton label="Notifications" onClick={onOpenUpdates}>
              <Bell aria-hidden="true" size={18} />
            </IconButton>
            {badgeCount > 0 ? (
              <span
                aria-label={`${badgeCount} unread alerts`}
                className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1.5 text-[10px] font-bold leading-none text-white"
              >
                {badgeCount}
              </span>
            ) : null}
          </div>
          {onOpenSettings ? (
            <IconButton label="Settings" onClick={onOpenSettings}>
              <Settings aria-hidden="true" size={18} />
            </IconButton>
          ) : null}
        </div>
      </header>

      <StaggerSection index={0}>
        <section aria-label="Up next">
        {nextUp ? (
          (() => {
            const activeLine = nextUp.preparationRecord
              ? nextUp.order.lines.find(
                  (line) => line.id === nextUp.preparationRecord!.orderLineId,
                )
              : nextUp.order.lines[0]
            const extraCount = Math.max(0, nextUp.order.lines.length - 1)
            return (
              <Card className="border-warm-border bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-rose">
                    <Sparkles aria-hidden="true" size={12} className="shrink-0" />
                    <span>Up next</span>
                  </span>
                  <StatusBadge
                    tone={
                      nextUp.kind === "prep-in-progress"
                        ? "progress"
                        : nextUp.kind === "ready-collection"
                          ? "success"
                          : "warning"
                    }
                  >
                    {nextUp.statusLabel}
                  </StatusBadge>
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold leading-snug tracking-tight text-cocoa">
                      {activeLine ? activeLine.productName : nextUp.itemTitle}
                      {extraCount > 0 ? (
                        <span className="ml-1.5 text-sm font-semibold text-muted">
                          +{extraCount}
                        </span>
                      ) : null}
                    </h2>
                    <p className="mt-1 text-sm leading-snug text-muted">
                      {activeLine
                        ? `${nextUp.customerName} · ${activeLine.variantName} · Qty ${activeLine.quantity}`
                        : nextUp.customerName}
                    </p>
                  </div>
                  <ItemThumbnail
                    image={
                      activeLine?.recipeSnapshot.image ??
                      state.products.find((p) => p.id === activeLine?.productId)
                        ?.image
                    }
                    alt={activeLine ? activeLine.productName : nextUp.itemTitle}
                    size="md"
                  />
                </div>
                <p
                  className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${
                    nextUp.dueLabel.startsWith("Overdue")
                      ? "text-rose"
                      : "text-muted"
                  }`}
                >
                  <Clock3 aria-hidden="true" size={13} className="shrink-0" />
                  <span>{nextUp.dueLabel}</span>
                </p>

                <div className="mt-4">
                  <Button
                    fullWidth
                    trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
                    onClick={() => {
                      if (
                        (nextUp.kind === "ready-collection" ||
                          orderHasUnpurchasedItems(state, nextUp.order)) &&
                        onOpenOrder
                      ) {
                        onOpenOrder(nextUp.order.id)
                      } else if (nextUp.preparationRecord && onStartPreparation) {
                        onStartPreparation(
                          nextUp.order.id,
                          nextUp.preparationRecord.id,
                        )
                      } else if (onOpenOrder) {
                        onOpenOrder(nextUp.order.id)
                      } else {
                        onNavigate("orders", "continue-preparation")
                      }
                    }}
                  >
                    {orderHasUnpurchasedItems(state, nextUp.order)
                      ? "Shop first"
                      : nextUp.ctaLabel}
                  </Button>
                </div>
              </Card>
            )
          })()
        ) : (
          <EmptyState
            illustration="caught-up-cupcake"
            title="All caught up"
            description="No bakes queued right now."
            actionLabel="New order"
            onAction={() => onNavigate("orders", "create-order")}
          />
        )}
        </section>
      </StaggerSection>

      <StaggerSection index={1}>
        <Button
          fullWidth
          variant="secondary"
          leadingIcon={<Plus aria-hidden="true" size={17} />}
          onClick={() => onNavigate("orders", "create-order")}
        >
          New order
        </Button>
      </StaggerSection>

      {dueOrders.length > 0 ? (
        <StaggerSection index={2}>
          <button
            type="button"
            onClick={() => {
              if (dueOrders.length === 1 && onOpenOrder) {
                onOpenOrder(dueOrders[0].order.id)
              } else {
                onNavigate("orders", "view-due")
              }
            }}
            className="flex w-full items-center justify-between gap-3 rounded-card border border-warning-border bg-warning-soft/75 p-4 text-left shadow-subtle transition-[border-color,background-color,box-shadow] duration-200 hover:border-warning active:scale-button"
          >
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-warning">
              <CreditCard aria-hidden="true" size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-cocoa">
                {collectedDueCount > 0
                  ? `${collectedDueCount} collected ${
                      collectedDueCount === 1 ? "order" : "orders"
                    } awaiting payment`
                  : `${dueOrders.length} ${
                      dueOrders.length === 1 ? "order" : "orders"
                    } with balance due`}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-muted">
                {dueOrders.length === 1
                  ? `${dueOrders[0].order.customerName} · ${formatLkr(totalDueLkr)} due`
                  : `${dueOrders.length} orders · ${formatLkr(totalDueLkr)} total due`}
              </p>
            </div>
          </div>
            <ArrowRight aria-hidden="true" size={16} className="shrink-0 text-warning" />
          </button>
        </StaggerSection>
      ) : null}

      <StaggerSection index={3}>
        <section aria-label="Snapshot">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate("orders")}
            className="rounded-card border border-warm-border bg-white p-4 text-left shadow-subtle transition hover:border-sage-border active:scale-button"
          >
            <span className="text-xs font-medium text-muted">Due today</span>
            <span className="mt-2 block text-2xl font-bold tabular-nums text-cocoa">
              {workload.dueTodayCount}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {workload.inProgressCount > 0
                ? `${workload.inProgressCount} baking now`
                : "Schedule"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("orders")}
            className="rounded-card border border-warm-border bg-white p-4 text-left shadow-subtle transition hover:border-sage-border active:scale-button"
          >
            <span className="text-xs font-medium text-muted">Ready</span>
            <span className="mt-2 block text-2xl font-bold tabular-nums text-success">
              {workload.readyCount}
            </span>
            <span className="mt-0.5 block text-xs text-muted">For pickup</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("kitchen", "plan-shopping")}
            className={`rounded-card border p-4 text-left shadow-subtle transition active:scale-button ${
              toBuyCount > 0
                ? "border-warning-border bg-warning-soft/70"
                : "border-warm-border bg-white hover:border-sage-border"
            }`}
          >
            <span className="flex items-center justify-between text-xs font-medium text-muted">
              To buy
              <ShoppingBasket aria-hidden="true" size={14} />
            </span>
            <span
              className={`mt-2 block text-2xl font-bold tabular-nums ${
                toBuyCount > 0 ? "text-warning" : "text-cocoa"
              }`}
            >
              {toBuyCount}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {toBuyCount > 0 ? "Items to buy" : "Shopping clear"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("money")}
            className="rounded-card border border-warm-border bg-white p-4 text-left shadow-subtle transition hover:border-sage-border active:scale-button"
          >
            <span className="flex items-center justify-between text-xs font-medium text-muted">
              This month
              <TrendingUp aria-hidden="true" size={14} className="text-success" />
            </span>
            <span className="mt-2 block text-lg font-bold leading-tight tabular-nums text-cocoa">
              {formatLkr(budget.sales.actual)}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Sales collected
            </span>
          </button>
        </div>
      </section>
      </StaggerSection>

      {upcoming.length > 0 ? (
        <StaggerSection index={4}>
          <GroupedList
          title="Upcoming pickups"
          action={
            <button
              type="button"
              onClick={() => onNavigate("orders")}
              className="text-xs font-semibold text-cocoa hover:underline"
            >
              All orders
            </button>
          }
        >
          {upcoming.map((item) => (
            <ListRow
              key={item.orderId}
              title={item.customerName}
              subtitle={`${item.timeLabel} · ${item.itemSummary}`}
              value={formatLkr(item.agreedPrice)}
              showChevron
              onClick={() =>
                onOpenOrder ? onOpenOrder(item.orderId) : onNavigate("orders")
              }
            />
          ))}
          </GroupedList>
        </StaggerSection>
      ) : null}
    </div>
  )
}
