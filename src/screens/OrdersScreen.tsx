import { useEffect, useMemo, useRef, useState } from "react"
import { ChefHat, ClipboardList, Plus } from "lucide-react"
import OrderCard from "../components/domain/OrderCard"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Field from "../components/ui/Field"
import SegmentedControl from "../components/ui/SegmentedControl"
import { useAppState } from "../state/AppState"
import type { OrderStatus, StarterAction } from "../types"
import CreateOrderFlow from "./CreateOrderFlow"
import OrderDetailScreen from "./OrderDetailScreen"
import PreparationWorkspaceScreen, {
  PreparationProductScreen,
} from "./PreparationWorkspaceScreen"

type Filter = "All" | OrderStatus
type View = "list" | "detail" | "create" | "preparation" | "preparation-product"

const filters: { value: Filter label: string }[] = [
  { value: "All", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "In Progress", label: "In progress" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
]

type OrdersScreenProps = {
  starterAction: StarterAction | null
  onConsumeStarterAction: () => void
  onFocusedChange: (focused: boolean) => void
  onOpenShopping: () => void
}

export default function OrdersScreen({
  starterAction,
  onConsumeStarterAction,
  onFocusedChange,
  onOpenShopping,
}: OrdersScreenProps) {
  const { state } = useAppState()
  const [view, setView] = useState<View>("list")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [selectedPreparationId, setSelectedPreparationId] =
    useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("All")
  const consumedAction = useRef<StarterAction | null>(null)

  useEffect(() => {
    if (!starterAction || consumedAction.current === starterAction) return
    consumedAction.current = starterAction
    if (starterAction === "create-order") {
      setEditingOrderId(null)
      setView("create")
    }
    if (starterAction === "continue-preparation") {
      const currentPreparation = state.preparationRecords.find(
        (record) => record.status === "In progress",
      )
      if (currentPreparation) {
        setSelectedPreparationId(currentPreparation.id)
        setView("preparation-product")
      } else {
        setView("preparation")
      }
    }
    onConsumeStarterAction()
  }, [starterAction, state.preparationRecords, onConsumeStarterAction])

  useEffect(() => {
    onFocusedChange(view !== "list")
    return () => onFocusedChange(false)
  }, [view, onFocusedChange])

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    return state.orders.filter((order) => {
      const matchesFilter = filter === "All" || order.status === filter
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
      return matchesFilter && (!query || searchable.includes(query))
    })
  }, [filter, search, state.orders])

  const selectedOrder = state.orders.find(
    (order) => order.id === selectedOrderId,
  )
  const editingOrder = state.orders.find((order) => order.id === editingOrderId)

  if (view === "create") {
    return (
      <CreateOrderFlow
        key={editingOrder?.id ?? "new-order"}
        order={editingOrder}
        onCancel={() => {
          setView("list")
          setEditingOrderId(null)
        }}
        onComplete={(orderId) => {
          setSelectedOrderId(orderId)
          setEditingOrderId(null)
          setView("detail")
        }}
      />
    )
  }

  if (view === "detail" && selectedOrder) {
    return (
      <OrderDetailScreen
        order={selectedOrder}
        onBack={() => {
          setSelectedOrderId(null)
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
      />
    )
  }

  if (view === "preparation") {
    return (
      <PreparationWorkspaceScreen
        onBack={() => setView("list")}
        onSelect={(preparationId) => {
          setSelectedPreparationId(preparationId)
          setView("preparation-product")
        }}
      />
    )
  }

  if (view === "preparation-product" && selectedPreparationId) {
    return (
      <PreparationProductScreen
        preparationId={selectedPreparationId}
        onBack={() => {
          setSelectedPreparationId(null)
          setView("preparation")
        }}
      />
    )
  }

  return (
    <div className="px-page pb-6">
      <ScreenHeader
        eyebrow="Customer workflow"
        title="Orders"
        subtitle="Collections, preparation and payments"
        action={
          <Button
            size="compact"
            leadingIcon={<Plus aria-hidden="true" size={17} />}
            onClick={() => {
              setEditingOrderId(null)
              setView("create")
            }}
          >
            New
          </Button>
        }
      />

      <Button
        className="mt-4"
        fullWidth
        variant="soft"
        leadingIcon={<ChefHat aria-hidden="true" size={18} />}
        onClick={() => setView("preparation")}
      >
        Open preparation workspace
      </Button>

      <div className="mt-4">
        <Field
          label="Search orders"
          hideLabel
          isSearch
          placeholder="Customer, product or order number"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mt-4">
        <SegmentedControl
          label="Filter orders by status"
          value={filter}
          segments={filters}
          onChange={setFilter}
        />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-cocoa">
          {filteredOrders.length}{" "}
          {filteredOrders.length === 1 ? "order" : "orders"}
        </p>
        <p className="text-xs text-muted">Newest first</p>
      </div>

      {filteredOrders.length ? (
        <div className="mt-3 space-y-3">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={() => {
                setSelectedOrderId(order.id)
                setView("detail")
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="mt-5 px-5 py-10 text-center">
          <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-sage-soft text-sage-dark">
            <ClipboardList aria-hidden="true" size={25} />
          </span>
          <div className="mt-4 text-lg font-semibold text-cocoa">
            No matching orders
          </div>
          <p className="mx-auto mt-2 max-w-empty text-sm leading-relaxed text-muted">
            Try another search or status filter. Creating a new order will add
            it here as a draft first.
          </p>
        </Card>
      )}
    </div>
  )
}
