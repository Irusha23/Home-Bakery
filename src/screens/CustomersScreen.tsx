import { useMemo, useState } from "react"
import { Pencil, Phone, Plus, UsersRound } from "lucide-react"
import CustomerEditorSheet from "../components/domain/CustomerEditorSheet"
import OrderCard from "../components/domain/OrderCard"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import EmptyState from "../components/ui/EmptyState"
import Field from "../components/ui/Field"
import { GroupedList, ListRow } from "../components/ui/GroupedList"
import MoneyText from "../components/ui/MoneyText"
import { PushView } from "../components/ui/MotionPrimitives"
import StatusBadge from "../components/ui/StatusBadge"
import { useToast } from "../components/ui/Toast"
import { outstandingOrderBalance, netRetainedPayments } from "../lib/financials"
import { useAppState } from "../state/AppState"
import type { Customer } from "../types"

type CustomersScreenProps = {
  onBack: () => void
  onOpenOrder: (orderId: string) => void
  onCreateOrderForCustomer?: (customerId: string) => void
}

export default function CustomersScreen({
  onBack,
  onOpenOrder,
  onCreateOrderForCustomer,
}: CustomersScreenProps) {
  const { state } = useAppState()
  const { showToast } = useToast()
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorTarget, setEditorTarget] = useState<Customer | "new" | null>(
    null,
  )

  const customerSummaries = useMemo(() => {
    const query = search.trim().toLowerCase()
    return state.customers
      .filter((customer) =>
        `${customer.name} ${customer.phone}`.toLowerCase().includes(query),
      )
      .map((customer) => {
        const orders = state.orders
          .filter((o) => o.customerId === customer.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const totalNetPaid = orders.reduce(
          (sum, order) => sum + netRetainedPayments(order, state.refunds),
          0,
        )
        const totalOutstanding = orders
          .filter((o) => o.status !== "Cancelled" && o.status !== "Draft")
          .reduce(
            (sum, order) => sum + outstandingOrderBalance(order, state.refunds),
            0,
          )
        return {
          customer,
          orders,
          totalNetPaid,
          totalOutstanding,
        }
      })
  }, [search, state.customers, state.orders, state.refunds])

  const selectedSummary = customerSummaries.find(
    (s) => s.customer.id === selectedId,
  )

  const renderCustomerDetail = () => {
    if (!selectedSummary) return null
    const { customer, orders, totalNetPaid, totalOutstanding } = selectedSummary
    return (
      <div className="space-y-4 pb-8">
          <ScreenHeader
            title={customer.name}
            subtitle={customer.phone || "No phone number"}
            onBack={() => setSelectedId(null)}
            action={
              <Button
                size="compact"
                variant="secondary"
                leadingIcon={<Pencil aria-hidden="true" size={14} />}
                onClick={() => setEditorTarget(customer)}
              >
                Edit
              </Button>
            }
          />

          <div className="mt-4 space-y-4">
            <Card className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-muted">Orders</div>
                <div className="mt-1 text-lg font-bold text-cocoa">
                  {orders.length}
                </div>
              </div>
              <div className="border-l border-warm-border pl-2">
                <div className="text-xs text-muted">Total paid</div>
                <div className="mt-1 text-sm font-bold text-cocoa">
                  <MoneyText amount={totalNetPaid} />
                </div>
              </div>
              <div className="border-l border-warm-border pl-2">
                <div className="text-xs text-muted">Balance due</div>
                <div
                  className={`mt-1 text-sm font-bold ${
                    totalOutstanding > 0 ? "text-warning" : "text-success"
                  }`}
                >
                  <MoneyText amount={totalOutstanding} />
                </div>
              </div>
            </Card>

            <div className="flex gap-2">
              {customer.phone ? (
                <a
                  href={`tel:${customer.phone.replace(/\s+/g, "")}`}
                  className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-control border border-warm-border bg-white px-4 text-sm font-semibold text-cocoa shadow-subtle transition hover:bg-ivory active:scale-button"
                >
                  <Phone aria-hidden="true" size={16} />
                  Call
                </a>
              ) : null}
              {onCreateOrderForCustomer ? (
                <Button
                  className="flex-1"
                  leadingIcon={<Plus aria-hidden="true" size={16} />}
                  onClick={() => onCreateOrderForCustomer(customer.id)}
                >
                  Order
                </Button>
              ) : null}
            </div>

            <div>
              <h2 className="mb-2.5 text-sm font-semibold text-cocoa">
                Order history ({orders.length})
              </h2>
              {orders.length > 0 ? (
                <div className="space-y-2.5">
                  {orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => onOpenOrder(order.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  illustration="customers-wave"
                  title="No orders yet"
                  description="Orders placed for this customer will appear here."
                />
              )}
            </div>
          </div>
        </div>
    )
  }

  const renderCustomerList = () => (
    <div className="space-y-4 pb-8">
        <ScreenHeader
          title="Customers"
          subtitle={`${state.customers.length} saved contacts`}
          onBack={onBack}
          action={
            <Button
              size="compact"
              leadingIcon={<Plus aria-hidden="true" size={16} />}
              onClick={() => setEditorTarget("new")}
            >
              Add
            </Button>
          }
        />

        <div className="mt-4">
          <Field
            label="Search customers"
            hideLabel
            isSearch
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-4">
          {customerSummaries.length > 0 ? (
            <GroupedList>
              {customerSummaries.map(
                ({ customer, orders, totalNetPaid, totalOutstanding }) => (
                  <ListRow
                    key={customer.id}
                    title={customer.name}
                    subtitle={`${customer.phone || "No phone"} · ${orders.length} ${
                      orders.length === 1 ? "order" : "orders"
                    }`}
                    value={<MoneyText amount={totalNetPaid} />}
                    trailing={
                      totalOutstanding > 0 ? (
                        <StatusBadge tone="warning">
                          Due <MoneyText amount={totalOutstanding} />
                        </StatusBadge>
                      ) : null
                    }
                    showChevron
                    onClick={() => setSelectedId(customer.id)}
                  />
                ),
              )}
            </GroupedList>
          ) : (
            <EmptyState
              illustration="customers-wave"
              title="No matching customers"
              description="Add a customer to keep their contact details and order history handy."
              actionLabel="Add customer"
              onAction={() => setEditorTarget("new")}
            />
          )}
        </div>
      </div>
  )

  return (
    <>
      <PushView
        viewKey={
          selectedSummary ? `customer-${selectedSummary.customer.id}` : "list"
        }
        depth={selectedSummary ? 1 : 0}
      >
        {selectedSummary ? renderCustomerDetail() : renderCustomerList()}
      </PushView>

      <CustomerEditorSheet
        open={editorTarget !== null}
        customer={editorTarget === "new" ? null : editorTarget}
        onClose={() => setEditorTarget(null)}
        onSaved={(saved) => {
          showToast(
            editorTarget === "new"
              ? `Saved ${saved.name}`
              : `Updated ${saved.name}`,
          )
          if (editorTarget === "new") setSelectedId(saved.id)
        }}
      />
    </>
  )
}
