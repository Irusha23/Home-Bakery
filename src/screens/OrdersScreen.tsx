import { useEffect, useMemo, useRef, useState } from "react"
import { ClipboardList, Plus, UsersRound } from "lucide-react"
import OrderCard from "../components/domain/OrderCard"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import Illustration from "../components/ui/Illustration"
import {
  AnimatedItem,
  AnimatedList,
  PushView,
} from "../components/ui/MotionPrimitives"
import SegmentedControl from "../components/ui/SegmentedControl"
import { useToast } from "../components/ui/Toast"
import {
  outstandingOrderBalance,
  pendingCancellationRefund,
} from "../lib/financials"
import { canCollectOrder } from "../lib/orderLifecycle"
import { calculateOrderProfit } from "../lib/orderProfit"
import { orderHasUnpurchasedItems } from "../lib/inventory"
import { useAppState } from "../state/AppState"
import type { Order, StarterAction } from "../types"
import CreateOrderFlow from "./CreateOrderFlow"
import CustomersScreen from "./CustomersScreen"
import OrderDetailScreen from "./OrderDetailScreen"
import { PreparationProductScreen } from "./PreparationWorkspaceScreen"

type Filter = "Active" | "Ready" | "Due" | "Done" | "All"
type View = "list" | "detail" | "create" | "preparation-product" | "customers"

function matchesFilter(
  order: Order,
  filter: Filter,
  balanceDue: number,
) {
  if (filter === "All") return true
  if (filter === "Due") {
    return (
      order.status !== "Draft" &&
      order.status !== "Cancelled" &&
      balanceDue > 0
    )
  }
  if (filter === "Done") {
    return order.status === "Completed" || order.status === "Cancelled"
  }
  if (filter === "Ready") {
    return (
      (order.status === "Confirmed" || order.status === "In Progress") &&
      order.preparationStatus === "Ready"
    )
  }
  return (
    order.status === "Draft" ||
    ((order.status === "Confirmed" || order.status === "In Progress") &&
      order.preparationStatus !== "Ready")
  )
}

type OrdersScreenProps = {
  starterAction: StarterAction | null
  initialOrderId?: string
  initialPreparationId?: string
  cookModeIntent?: { preparationId: string; stepIndex: number; key: number }
  onConsumeOrderIntent?: () => void
  onReturnFromIntent?: () => void
  onClearReturnIntent?: () => void
  onConsumeStarterAction: () => void
  onFocusedChange: (focused: boolean) => void
  onOpenShopping: () => void
}

export default function OrdersScreen({
  starterAction,
  initialOrderId,
  initialPreparationId,
  cookModeIntent,
  onConsumeOrderIntent,
  onReturnFromIntent,
  onClearReturnIntent,
  onConsumeStarterAction,
  onFocusedChange,
  onOpenShopping,
}: OrdersScreenProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()
  const [view, setView] = useState<View>(
    initialPreparationId
      ? "preparation-product"
      : initialOrderId
        ? "detail"
        : "list",
  )
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialOrderId ?? null,
  )
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<
    string | undefined
  >(undefined)
  const [selectedPreparationId, setSelectedPreparationId] =
    useState<string | null>(initialPreparationId ?? null)
  const [activeCookModeIntent, setActiveCookModeIntent] = useState<
    { preparationId: string; stepIndex: number; key: number } | undefined
  >(cookModeIntent)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("Active")
  const [repeatNotice, setRepeatNotice] = useState<string | null>(null)
  const [openPaymentOnDetail, setOpenPaymentOnDetail] = useState(false)
  const [openRefundOnDetail, setOpenRefundOnDetail] = useState(false)
  const consumedAction = useRef<StarterAction | null>(null)

  useEffect(() => {
    if (!initialOrderId && !initialPreparationId && !cookModeIntent) return
    if (cookModeIntent) {
      setActiveCookModeIntent(cookModeIntent)
    }
    if (initialPreparationId) {
      setSelectedOrderId(initialOrderId ?? null)
      setSelectedPreparationId(initialPreparationId)
      setView("preparation-product")
    } else if (initialOrderId) {
      setSelectedOrderId(initialOrderId)
      setView("detail")
    }
    onConsumeOrderIntent?.()
  }, [initialOrderId, initialPreparationId, cookModeIntent, onConsumeOrderIntent])

  useEffect(() => {
    if (!starterAction) {
      consumedAction.current = null
      return
    }
    if (consumedAction.current === starterAction) return
    consumedAction.current = starterAction
    if (starterAction === "create-order") {
      setEditingOrderId(null)
      setView("create")
    }
    if (starterAction === "continue-preparation") {
      const currentPreparation =
        state.preparationRecords.find(
          (record) => record.status === "In progress",
        ) ??
        state.preparationRecords.find(
          (record) => record.status === "Awaiting preparation",
        )
      if (currentPreparation) {
        setSelectedOrderId(currentPreparation.orderId)
        setSelectedPreparationId(currentPreparation.id)
        setView("preparation-product")
      } else {
        setView("list")
      }
    }
    if (starterAction === "view-due") {
      setFilter("Due")
      setView("list")
    }
    onConsumeStarterAction()
  }, [starterAction, state.preparationRecords, onConsumeStarterAction])

  useEffect(() => {
    onFocusedChange(view !== "list")
    return () => onFocusedChange(false)
  }, [view, onFocusedChange])

  const dueCount = useMemo(
    () =>
      state.orders.filter(
        (order) =>
          order.status !== "Draft" &&
          order.status !== "Cancelled" &&
          outstandingOrderBalance(order, state.refunds) > 0,
      ).length,
    [state.orders, state.refunds],
  )

  const filters = useMemo<{ value: Filter; label: string }[]>(
    () => [
      { value: "Active", label: "Active" },
      { value: "Ready", label: "Ready" },
      { value: "Due", label: dueCount > 0 ? `Due (${dueCount})` : "Due" },
      { value: "Done", label: "Done" },
      { value: "All", label: "All" },
    ],
    [dueCount],
  )

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = state.orders
      .filter((order) =>
        matchesFilter(order, filter, outstandingOrderBalance(order, state.refunds)),
      )
      .filter((order) => {
        if (!query) return true
        const searchable = [
          order.reference,
          order.customerName,
          ...order.lines.flatMap((line) => [
            line.productName,
            line.variantName,
            line.recipeSnapshot.name,
          ]),
        ]
          .join(" ")
          .toLowerCase()
        return searchable.includes(query)
      })
    if (filter !== "Due") return matches
    return [...matches].sort((a, b) => {
      const rank = (order: Order) =>
        order.status === "Completed"
          ? 0
          : order.paymentStatus === "Part paid"
            ? 1
            : 2
      return rank(a) - rank(b)
    })
  }, [filter, search, state.orders, state.refunds])

  const selectedOrder = state.orders.find(
    (order) => order.id === selectedOrderId,
  )
  const editingOrder = state.orders.find((order) => order.id === editingOrderId)

  const getQuickAction = (order: Order) => {
    if (order.status === "Draft") {
      return {
        label: "Confirm",
        run: () => {
          const ok = dispatchIfAccepted({
            type: "CONFIRM_ORDER",
            orderId: order.id,
          })
          if (ok) {
            showToast({ message: `${order.reference} confirmed`, tone: "success" })
          }
          setSelectedOrderId(order.id)
          setView("detail")
        },
      }
    }

    if (canCollectOrder(state, order)) {
      return {
        label: "Collected",
        run: () => {
          const remaining = outstandingOrderBalance(order, state.refunds)
          const ok = dispatchIfAccepted({
            type: "COLLECT_ORDER",
            orderId: order.id,
          })
          if (ok) {
            showToast({
              message: `${order.customerName}'s order collected`,
              tone: "success",
            })
            if (remaining > 0) {
              setRepeatNotice(null)
              setOpenPaymentOnDetail(true)
              setSelectedOrderId(order.id)
              setView("detail")
            }
          }
        },
      }
    }

    if (
      (order.status === "Confirmed" || order.status === "In Progress") &&
      order.preparationStatus !== "Ready"
    ) {
      if (orderHasUnpurchasedItems(state, order)) {
        return {
          label: "To buy",
          run: onOpenShopping,
        }
      }
      const prepRecord = state.preparationRecords.find(
        (record) => record.orderId === order.id && record.status !== "Ready",
      )
      if (prepRecord) {
        return {
          label: "Prepare",
          run: () => {
            setSelectedOrderId(order.id)
            setSelectedPreparationId(prepRecord.id)
            setView("preparation-product")
          },
        }
      }
    }

    if (
      order.status === "Cancelled" &&
      pendingCancellationRefund(order, state.refunds) > 0
    ) {
      return {
        label: "Record refund",
        run: () => {
          setRepeatNotice(null)
          setOpenPaymentOnDetail(false)
          setOpenRefundOnDetail(true)
          setSelectedOrderId(order.id)
          setView("detail")
        },
      }
    }

    if (
      order.status !== "Cancelled" &&
      outstandingOrderBalance(order, state.refunds) > 0 &&
      (order.status === "Completed" || order.paymentStatus === "Part paid")
    ) {
      return {
        label: "Add payment",
        run: () => {
          setRepeatNotice(null)
          setOpenRefundOnDetail(false)
          setOpenPaymentOnDetail(true)
          setSelectedOrderId(order.id)
          setView("detail")
        },
      }
    }

    return null
  }

  const pushDepth =
    view === "preparation-product" && Boolean(selectedPreparationId)
      ? 2
      : view === "create"
        ? editingOrderId
          ? 2
          : 1
        : (view === "detail" && Boolean(selectedOrder)) || view === "customers"
          ? 1
          : 0

  const pushKey =
    view === "detail" && selectedOrder
      ? `detail-${selectedOrder.id}`
      : view === "preparation-product" && selectedPreparationId
        ? `prep-${selectedPreparationId}`
        : view

  const renderContent = () => {
    if (view === "create") {
      return (
        <CreateOrderFlow
          key={editingOrder?.id ?? preselectedCustomerId ?? "new-order"}
          order={editingOrder}
          initialCustomerId={preselectedCustomerId}
          onCancel={() => {
            setView("list")
            setEditingOrderId(null)
            setPreselectedCustomerId(undefined)
          }}
          onComplete={(orderId) => {
            setSelectedOrderId(orderId)
            setEditingOrderId(null)
            setPreselectedCustomerId(undefined)
            setView("detail")
          }}
        />
      )
    }

    if (view === "detail" && selectedOrder) {
      return (
        <OrderDetailScreen
          order={selectedOrder}
          repeatNotice={repeatNotice}
          openPaymentOnMount={openPaymentOnDetail}
          onPaymentOpenedOnMount={() => setOpenPaymentOnDetail(false)}
          openRefundOnMount={openRefundOnDetail}
          onRefundOpenedOnMount={() => setOpenRefundOnDetail(false)}
          onBack={() => {
            setSelectedOrderId(null)
            setRepeatNotice(null)
            setOpenPaymentOnDetail(false)
            setOpenRefundOnDetail(false)
            if (onReturnFromIntent) {
              onReturnFromIntent()
              return
            }
            setView("list")
          }}
          onBackToActiveOrders={() => {
            setSelectedOrderId(null)
            setRepeatNotice(null)
            setOpenPaymentOnDetail(false)
            setOpenRefundOnDetail(false)
            setFilter("Active")
            setSearch("")
            setView("list")
            onClearReturnIntent?.()
          }}
          onEditDraft={() => {
            setEditingOrderId(selectedOrder.id)
            setView("create")
          }}
          onOpenShopping={onOpenShopping}
          onOpenPreparation={(lineId) => {
            const record = state.preparationRecords.find(
              (item) =>
                item.orderId === selectedOrder.id && item.orderLineId === lineId,
            )
            if (record) {
              setSelectedPreparationId(record.id)
              setView("preparation-product")
            }
          }}
          onRepeatCreated={(newOrderId) => {
            setFilter("Active")
            setSearch("")
            setSelectedOrderId(newOrderId)
            setRepeatNotice(
              `A new draft was created from ${selectedOrder.reference}.`,
            )
          }}
        />
      )
    }

    if (view === "preparation-product" && selectedPreparationId) {
      return (
        <PreparationProductScreen
          preparationId={selectedPreparationId}
          openCookModeIntent={
            activeCookModeIntent?.preparationId === selectedPreparationId
              ? activeCookModeIntent
              : undefined
          }
          onOpenShopping={onOpenShopping}
          onBack={() => {
            setSelectedPreparationId(null)
            setView(selectedOrderId ? "detail" : "list")
          }}
        />
      )
    }

    if (view === "customers") {
      return (
        <CustomersScreen
          onBack={() => setView("list")}
          onOpenOrder={(orderId) => {
            setSelectedOrderId(orderId)
            setView("detail")
          }}
          onCreateOrderForCustomer={(customerId) => {
            setEditingOrderId(null)
            setPreselectedCustomerId(customerId)
            setView("create")
          }}
        />
      )
    }

    return (
      <div className="space-y-4 pb-6">
        <ScreenHeader
          title="Orders"
          action={
            <div className="flex items-center gap-2">
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<UsersRound aria-hidden="true" size={15} />}
                onClick={() => setView("customers")}
              >
                Customers
              </Button>
              <Button
                size="compact"
                leadingIcon={<Plus aria-hidden="true" size={16} />}
                onClick={() => {
                  setEditingOrderId(null)
                  setPreselectedCustomerId(undefined)
                  setView("create")
                }}
              >
                New
              </Button>
            </div>
          }
        />

        <Field
          label="Search orders"
          hideLabel
          isSearch
          placeholder="Search customer or food item..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <SegmentedControl
          label="Filter orders by stage"
          value={filter}
          segments={filters}
          onChange={setFilter}
        />

        {filteredOrders.length ? (
          <AnimatedList className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
            {filteredOrders.map((order, index) => {
              const quickAction = getQuickAction(order)
              const primaryLine = order.lines[0]
              const primaryProduct = state.products.find(
                (p) => p.id === primaryLine?.productId,
              )
              return (
                <AnimatedItem key={order.id} index={index}>
                  <OrderCard
                    order={order}
                    thumbnailImage={
                      primaryLine?.recipeSnapshot.image ?? primaryProduct?.image
                    }
                    balanceDue={outstandingOrderBalance(order, state.refunds)}
                    retainedAmount={
                      order.status === "Cancelled"
                        ? pendingCancellationRefund(order, state.refunds)
                        : undefined
                    }
                    profitLkr={
                      order.status === "Completed"
                        ? calculateOrderProfit(order, state).profitLkr
                        : undefined
                    }
                    quickActionLabel={quickAction?.label}
                    onQuickAction={quickAction?.run}
                    onClick={() => {
                      setRepeatNotice(null)
                      setOpenPaymentOnDetail(false)
                      setOpenRefundOnDetail(false)
                      setSelectedOrderId(order.id)
                      setView("detail")
                    }}
                  />
                </AnimatedItem>
              )
            })}
          </AnimatedList>
        ) : (
          <Card className="px-5 py-8 text-center">
            <Illustration name="cake-box" size="md" />
            <div className="mt-2 text-base font-semibold text-cocoa">
              No {filter === "All" ? "" : `${filter.toLowerCase()} `}orders
            </div>
            <p className="mx-auto mt-1 max-w-empty text-xs leading-relaxed text-muted">
              Tap New above whenever a customer places an order.
            </p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <PushView viewKey={pushKey} depth={pushDepth}>
      {renderContent()}
    </PushView>
  )
}
