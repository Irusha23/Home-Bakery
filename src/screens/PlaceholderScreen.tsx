import {
  ClipboardList,
  ReceiptText,
  Search,
  ShoppingBasket,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import type { StarterAction, TabId } from "../types"
import ScreenHeader from "../components/ScreenHeader"
import Card from "../components/ui/Card"
import StatusBadge from "../components/ui/StatusBadge"

type ScreenMeta = {
  title: string
  eyebrow: string
  description: string
  icon: LucideIcon
  emptyTitle: string
  emptyDescription: string
}

const screenMeta: Record<Exclude<TabId, "home" | "orders" | "recipes" | "shopping" | "inventory">, ScreenMeta> =
  {
    finances: {
      title: "Finances",
      eyebrow: "Business clarity",
      description: "Revenue, costs, payments and profit",
      icon: WalletCards,
      emptyTitle: "Financial clarity, without the clutter",
      emptyDescription:
        "Financial records will remain separate and reviewable.",
    },
  }

const actionCopy: Record<StarterAction, {
  title: string
  description: string
  icon: LucideIcon
}> = {
  "create-order": {
    title: "Create a new order",
    description:
      "Customer selection, products, pricing and stock review will be connected in the dedicated order-flow phase.",
    icon: ClipboardList,
  },
  "record-sale": {
    title: "Record a finished-stock sale",
    description:
      "Stock will change only when the sale transition is implemented.",
    icon: ReceiptText,
  },
  "plan-shopping": {
    title: "Plan today’s shopping",
    description: "Requirements will appear when Shopping is implemented.",
    icon: ShoppingBasket,
  },
  "add-expense": {
    title: "Add an expense",
    description: "Expense entry arrives with the Finances workflow.",
    icon: ReceiptText,
  },
  "continue-preparation": {
    title: "Prepare Nadeesha’s cake",
    description: "Preparation has not started and no stock was deducted.",
    icon: Sparkles,
  },
}

type PlaceholderScreenProps = {
  tab: Exclude<TabId, "home" | "orders" | "recipes" | "shopping" | "inventory">
  starterAction: StarterAction | null
}

export default function PlaceholderScreen({
  tab,
  starterAction,
}: PlaceholderScreenProps) {
  const meta = screenMeta[tab]
  const Icon = meta.icon
  const action = starterAction ? actionCopy[starterAction] : null
  const ActionIcon = action?.icon

  return (
    <div className="px-page pb-6">
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        subtitle={meta.description}
        icon={<Icon aria-hidden="true" size={22} />}
      />

      {action && ActionIcon ? (
        <Card tone="sage" className="mt-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-white text-sage-dark shadow-subtle">
              <ActionIcon aria-hidden="true" size={20} />
            </span>
            <div>
              <StatusBadge tone="progress">
                Starting point connected
              </StatusBadge>
              <div className="mt-2 text-base font-semibold text-cocoa">
                {action.title}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {action.description}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mt-4 px-5 py-8 text-center">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-ivory text-sage">
          <Search aria-hidden="true" size={25} />
        </span>
        <div className="mt-4 text-lg font-semibold text-cocoa">
          {meta.emptyTitle}
        </div>
        <p className="mx-auto mt-2 max-w-empty text-sm leading-snug text-muted">
          {meta.emptyDescription}
        </p>
        <div className="mt-5 inline-flex rounded-full bg-neutral-soft px-3 py-1.5 text-xs font-semibold text-muted">
          Planned for the next phase
        </div>
      </Card>
    </div>
  )
}
