import {
  ChefHat,
  ClipboardList,
  Home,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { INSTANT_TRANSITION, PILL_SPRING } from "../lib/motion"
import type { TabId } from "../types"

type NavItem = {
  id: TabId
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: "today", label: "Today", icon: Home },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "kitchen", label: "Kitchen", icon: ChefHat },
  { id: "money", label: "Money", icon: WalletCards },
]

type BottomNavProps = {
  activeTab: TabId
  onNavigate: (tab: TabId) => void
}

export default function BottomNav({ activeTab, onNavigate }: BottomNavProps) {
  const reducedMotion = useReducedMotion()

  return (
    <nav
      className="pointer-events-auto w-nav rounded-nav border border-warm-border/90 bg-white/95 p-1.5 shadow-nav backdrop-blur-nav"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-4 gap-1">
        {navItems.map(({ id, label, icon: Icon }) => {
          const selected = activeTab === id
          return (
            <motion.button
              key={id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onNavigate(id)}
              whileTap={reducedMotion ? undefined : { scale: 0.95 }}
              className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-nav-item px-2 py-2 transition-colors duration-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/30 ${
                selected
                  ? "text-white"
                  : "text-muted hover:text-cocoa"
              }`}
            >
              {selected ? (
                <motion.span
                  layoutId="bottom-nav-active-pill"
                  transition={reducedMotion ? INSTANT_TRANSITION : PILL_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-nav-item bg-sage"
                />
              ) : null}
              <Icon
                aria-hidden="true"
                size={20}
                strokeWidth={selected ? 2.25 : 1.9}
                className="relative z-10"
              />
              <span className="relative z-10 text-[11px] font-semibold leading-none tracking-tight">
                {label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
