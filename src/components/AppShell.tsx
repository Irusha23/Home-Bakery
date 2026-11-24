import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { INSTANT_TRANSITION, TAB_TRANSITION } from "../lib/motion"
import type { TabId } from "../types"
import BottomNav from "./BottomNav"

type AppShellProps = {
  activeTab: TabId
  children: ReactNode
  hideNavigation?: boolean
  onNavigate: (tab: TabId) => void
}

export default function AppShell({
  activeTab,
  children,
  hideNavigation = false,
  onNavigate,
}: AppShellProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="mobile-shell min-h-screen bg-ivory text-cocoa">
      <main
        className={`screen-safe-top min-h-screen w-full overflow-x-hidden px-5 ${
          hideNavigation ? "pb-6" : "screen-bottom-padding"
        }`}
      >
        {children}
      </main>
      <AnimatePresence initial={false}>
        {!hideNavigation ? (
          <motion.div
            key="bottom-nav-wrapper"
            initial={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
            transition={reducedMotion ? INSTANT_TRANSITION : TAB_TRANSITION}
            className="bottom-nav-safe pointer-events-none fixed inset-x-0 z-40 flex justify-center"
          >
            <BottomNav activeTab={activeTab} onNavigate={onNavigate} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
