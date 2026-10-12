import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CakeSlice,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardPlus,
  Clock3,
  PackageCheck,
  ReceiptText,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import type { StarterAction, TabId } from "../types"
import Button, { IconButton } from "../components/ui/Button"
import Card from "../components/ui/Card"
import StatusBadge from "../components/ui/StatusBadge"

const bakeryImage = "/bakery-cake.jpg"

type HomeScreenProps = {
  onNavigate: (tab: TabId, action?: StarterAction | null) => void
  onOpenUpdates: () => void
}

type QuickActionProps = {
  label: string
  detail: string
  icon: LucideIcon
  onClick: () => void
}

function QuickAction({ label, detail, icon: Icon, onClick }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-quick-action rounded-card border border-warm-border bg-white p-3.5 text-left shadow-subtle transition duration-ui hover:-translate-y-0.5 hover:border-sage-border hover:shadow-card active:translate-y-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/25"
    >
      <span className="mb-3 inline-flex size-9 items-center justify-center rounded-control bg-sage-soft text-sage-dark transition group-hover:bg-sage group-hover:text-white">
        <Icon aria-hidden="true" size={19} />
      </span>
      <span className="block text-sm font-semibold text-cocoa">{label}</span>
      <span className="mt-0.5 block text-xs leading-snug text-muted">
        {detail}
      </span>
    </button>
  )
}

type WorkloadStatProps = {
  value: string
  label: string
  tone: "sage" | "warning" | "success"
}

function WorkloadStat({ value, label, tone }: WorkloadStatProps) {
  const tones = {
    sage: "bg-sage-soft text-sage-dark",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
  }

  return (
    <div className="min-w-0 flex-1 text-center">
      <div
        className={`mx-auto flex size-10 items-center justify-center rounded-full text-base font-bold tabular-nums ${tones[tone]}`}
      >
        {value}
      </div>
      <p className="mt-2 text-xs font-medium leading-tight text-muted">
        {label}
      </p>
    </div>
  )
}

export default function HomeScreen({
  onNavigate,
  onOpenUpdates,
}: HomeScreenProps) {
  return (
    <div className="px-page pb-4">
      <header className="-mx-page mb-4 flex items-center justify-between border-b border-warm-border/75 px-page pb-3">
        <div>
          <p className="text-sm font-medium text-muted">Good morning, Udeni</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-sage text-white">
              <CakeSlice aria-hidden="true" size={15} />
            </span>
            <div className="text-xl font-semibold tracking-tight text-cocoa">
              Udeni’s Specials
            </div>
          </div>
        </div>
        <div className="relative">
          <IconButton label="Open reminders" onClick={onOpenUpdates}>
            <Bell aria-hidden="true" size={19} />
          </IconButton>
          <span className="absolute right-0 top-0 size-2.5 rounded-full border-2 border-white bg-warning" />
        </div>
      </header>

      <section aria-labelledby="next-up-title">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-nav font-bold uppercase tracking-section text-sage-dark">
              Today · Tuesday
            </p>
            <div
              id="next-up-title"
              className="mt-1 text-title font-semibold tracking-tight text-cocoa"
            >
              What needs attention
            </div>
          </div>
          <Sparkles aria-hidden="true" className="text-sage" size={23} />
        </div>

        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-hero">
            <div className="z-10 flex flex-col p-4">
              <StatusBadge tone="warning">Due in 4 hrs</StatusBadge>
              <div className="mt-3 text-lg font-semibold leading-snug text-cocoa">
                Chocolate celebration cake
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Nadeesha Perera · 1.5 kg
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-cocoa">
                <Clock3 aria-hidden="true" className="text-sage" size={15} />
                Collection at 4:30 PM
              </div>
              <Button
                className="mt-4 self-start"
                size="compact"
                trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
                onClick={() => onNavigate("orders", "continue-preparation")}
              >
                Start prep
              </Button>
            </div>
            <div className="relative min-h-hero-image overflow-hidden bg-sage-soft">
              <img
                src={bakeryImage}
                alt="White celebration cake with chocolate drizzle"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <div className="absolute inset-y-0 left-0 w-8 bg-linear-to-r from-white to-transparent" />
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="quick-actions-title">
        <div className="mb-3">
          <div
            id="quick-actions-title"
            className="text-lg font-semibold tracking-tight text-cocoa"
          >
            Quick actions
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            label="Create order"
            detail="Customer & collection"
            icon={ClipboardPlus}
            onClick={() => onNavigate("orders", "create-order")}
          />
          <QuickAction
            label="Record sale"
            detail="Finished stock"
            icon={CircleDollarSign}
            onClick={() => onNavigate("inventory", "record-sale")}
          />
          <QuickAction
            label="Plan shopping"
            detail="Review shortages"
            icon={ShoppingBasket}
            onClick={() => onNavigate("shopping", "plan-shopping")}
          />
          <QuickAction
            label="Add expense"
            detail="Keep costs current"
            icon={ReceiptText}
            onClick={() => onNavigate("finances", "add-expense")}
          />
        </div>
      </section>

      <section className="mt-6" aria-labelledby="workload-title">
        <div className="mb-3 flex items-center justify-between">
          <div id="workload-title" className="text-lg font-semibold text-cocoa">
            Today’s workload
          </div>
          <Button
            variant="ghost"
            size="compact"
            className="min-h-0 px-2 py-1 text-xs"
            trailingIcon={<ChevronRight aria-hidden="true" size={15} />}
            onClick={() => onNavigate("orders")}
          >
            View orders
          </Button>
        </div>
        <Card>
          <div className="flex divide-x divide-warm-border">
            <WorkloadStat value="2" label="Awaiting prep" tone="warning" />
            <WorkloadStat value="1" label="In progress" tone="sage" />
            <WorkloadStat value="2" label="Ready" tone="success" />
          </div>
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="collections-title">
        <div
          id="collections-title"
          className="mb-3 text-lg font-semibold text-cocoa"
        >
          Upcoming collections
        </div>
        <Card className="divide-y divide-warm-border p-0">
          <div className="flex items-center gap-3 p-4">
            <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-control bg-sage-soft text-sage-dark">
              <span className="text-nav font-bold uppercase">Today</span>
              <span className="text-sm font-bold tabular-nums">4:30</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-cocoa">
                Nadeesha Perera
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                Chocolate cake · Balance Rs. 7,500
              </p>
            </div>
            <StatusBadge tone="progress">Preparing</StatusBadge>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-control bg-neutral-soft text-muted">
              <span className="text-nav font-bold uppercase">Wed</span>
              <span className="text-sm font-bold tabular-nums">10:00</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-cocoa">
                Ayesha Fernando
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                2 boxes vanilla cupcakes
              </p>
            </div>
            <StatusBadge tone="success">Ready</StatusBadge>
          </div>
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="alerts-title">
        <div
          id="alerts-title"
          className="mb-3 text-lg font-semibold text-cocoa"
        >
          Needs attention
        </div>
        <div className="space-y-3">
          <Card tone="warning" className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-white/75 text-warning">
              <AlertTriangle aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cocoa">
                Flour is short by 1.47 kg
              </p>
              <p className="mt-0.5 text-xs text-muted">2 confirmed orders</p>
            </div>
            <IconButton
              label="Open shopping plan"
              className="size-9 border-warning-border shadow-none"
              onClick={() => onNavigate("shopping", "plan-shopping")}
            >
              <ChevronRight aria-hidden="true" size={17} />
            </IconButton>
          </Card>
          <Card tone="sage" className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-white/75 text-sage-dark">
              <WalletCards aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cocoa">
                Rs. 11,000 outstanding
              </p>
              <p className="mt-0.5 text-xs text-muted">2 customer orders</p>
            </div>
            <IconButton
              label="Review outstanding payments"
              className="size-9 border-sage-border shadow-none"
              onClick={() => onNavigate("finances")}
            >
              <ChevronRight aria-hidden="true" size={17} />
            </IconButton>
          </Card>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="snapshot-title">
        <div
          id="snapshot-title"
          className="mb-3 text-lg font-semibold text-cocoa"
        >
          This week
        </div>
        <Card className="relative overflow-hidden">
          <div className="absolute right-3 top-3 text-sage/15">
            <TrendingUp aria-hidden="true" size={70} strokeWidth={1.4} />
          </div>
          <div className="relative grid grid-cols-3 gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <CalendarDays aria-hidden="true" size={14} />
                Sales
              </div>
              <p className="mt-2 text-base font-bold tabular-nums text-cocoa">
                38,500
              </p>
            </div>
            <div className="border-l border-warm-border pl-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <PackageCheck aria-hidden="true" size={14} />
                Est. cost
              </div>
              <p className="mt-2 text-base font-bold tabular-nums text-cocoa">
                24,300
              </p>
            </div>
            <div className="border-l border-warm-border pl-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <TrendingUp aria-hidden="true" size={14} />
                Est. profit
              </div>
              <p className="mt-2 text-base font-bold tabular-nums text-success">
                14,200
              </p>
            </div>
          </div>
          <p className="relative mt-3 text-nav font-semibold uppercase tracking-wide text-muted">
            Values in LKR · Profit is separate from cash received
          </p>
        </Card>
      </section>
    </div>
  )
}
