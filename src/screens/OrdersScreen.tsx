import { useEffect, useMemo, useRef, useState } from "react"
import { ClipboardList, Plus, UsersRound } from "lucide-react"
import OrderCard from "../components/domain/OrderCard"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import SegmentedControl from "../components/ui/SegmentedControl"
import { useToast } from "../components/ui/Toast"
import { outstandingOrderBalance } from "../lib/financials"
import { canCollectOrder } from "../lib/orderLifecycle"
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
  onConsumeOrderIntent?: () => void
  onConsumeStarterAction: () => void
  onFocusedChange: (focused: boolean) => void
  onOpenShopping: () => void
}

export default function OrdersScreen({
  starterAction,
  initialOrderId,
  onConsumeOrderIntent,
  onConsumeStarterAction,
  onFocusedChange,
  onOpenShopping,
}: OrdersScreenProps) {
  const { state, dispatchIfAccepted } = useAppState()
  const { showToast } = useToast()
  const [view, setView] = useState<View>(initialOrderId ? "detail" : "list")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialOrderId ?? null,
  )
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<
    string | undefined
  >(undefined)
  const [selectedPreparationId, setSelectedPreparationId] =
    useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("Active")
  const [repeatNotice, setRepeatNotice] = useState<string | null>(null)
  const [openPaymentOnDetail, setOpenPaymentOnDetail] = useState(false)
  const consumedAction = useRef<StarterAction | null>(null)

  useEffect(() => {
    if (!initialOrderId) return
    setSelectedOrderId(initialOrderId)
    setView("detail")
    onConsumeOrderIntent?.()
  }, [initialOrderId, onConsumeOrderIntent])

  useEffect(() => {
    if (!starterAction || consumedAction.current === starterAction) return
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
          } else {
            setSelectedOrderId(order.id)
            setView("detail")
          }
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
          label: "Bake",
          run: () => {
            setSelectedOrderId(order.id)
            setSelectedPreparationId(prepRecord.id)
            setView("preparation-product")
          },
        }
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
          setOpenPaymentOnDetail(true)
          setSelectedOrderId(order.id)
          setView("detail")
        },
      }
    }

    return null
  }

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
        onBack={() => {
          setSelectedOrderId(null)
          setRepeatNotice(null)
          setOpenPaymentOnDetail(false)
          setView("list")
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
        placeholder="Search customer or cake..."
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
        <div className="space-y-3 pt-1">
          {filteredOrders.map((order) => {
            const quickAction = getQuickAction(order)
            return (
              <OrderCard
                key={order.id}
                order={order}
                balanceDue={outstandingOrderBalance(order, state.refunds)}
                quickActionLabel={quickAction?.label}
                onQuickAction={quickAction?.run}
                onClick={() => {
                  setRepeatNotice(null)
                  setOpenPaymentOnDetail(false)
                  setSelectedOrderId(order.id)
                  setView("detail")
                }}
              />
            )
          })}
        </div>
      ) : (
        <Card className="px-5 py-10 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-sage-soft text-cocoa">
            <ClipboardList aria-hidden="true" size={22} />
          </span>
          <div className="mt-3 text-base font-semibold text-cocoa">
            No {filter === "All" ? "" : `${filter.toLowerCase()} `}orders
          </div>
          <p className="mx-auto mt-1 max-w-empty text-xs leading-relaxed text-muted">
            Tap New above whenever a customer requests a bake.
          </p>
        </Card>
      )}
    </div>
  )
}
