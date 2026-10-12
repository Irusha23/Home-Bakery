import {
  BookOpen,
  ClipboardList,
  Home,
  Package,
  ShoppingBasket,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import type { TabId } from "../types"

type NavItem = {
  id: TabId
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "recipes", label: "Recipes", icon: BookOpen },
  { id: "shopping", label: "Shopping", icon: ShoppingBasket },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "finances", label: "Finances", icon: WalletCards },
]

type BottomNavProps = {
  activeTab: TabId
  onNavigate: (tab: TabId) => void
}

export default function BottomNav({ activeTab, onNavigate }: BottomNavProps) {
  return (
    <nav
      className="bottom-nav-safe fixed left-1/2 z-40 w-nav -translate-x-1/2 rounded-nav border border-white/80 bg-white/95 px-1 py-1.5 shadow-nav backdrop-blur-nav"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-6">
        {navItems.map(({ id, label, icon: Icon }) => {
          const selected = activeTab === id
          return (
            <button
              key={id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onNavigate(id)}
              className={`group flex min-h-nav-item min-w-0 flex-col items-center justify-center gap-1 rounded-nav-item transition duration-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/30 ${
                selected
                  ? "bg-sage-soft text-sage-dark"
                  : "text-muted hover:bg-ivory hover:text-cocoa"
              }`}
            >
              <Icon
                aria-hidden="true"
                size={19}
                strokeWidth={selected ? 2.4 : 2}
              />
              <span className="max-w-full text-nav font-semibold leading-none tracking-tight">
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
