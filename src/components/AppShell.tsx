import type { ReactNode } from "react"
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
  return (
    <div className="mobile-shell min-h-screen bg-ivory text-cocoa shadow-shell">
      <main
        className={`screen-safe-top min-h-screen ${
          hideNavigation ? "pb-6" : "screen-bottom-padding"
        }`}
      >
        {children}
      </main>
      {hideNavigation ? null : (
        <BottomNav activeTab={activeTab} onNavigate={onNavigate} />
      )}
    </div>
  )
}
