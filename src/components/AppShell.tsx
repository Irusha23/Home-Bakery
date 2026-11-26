import { useEffect, useState, type ReactNode } from "react"
import { Capacitor, type PluginListenerHandle } from "@capacitor/core"
import { Keyboard } from "@capacitor/keyboard"
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
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let mounted = true
    const handles: PluginListenerHandle[] = []
    const register = async () => {
      handles.push(
        await Keyboard.addListener("keyboardWillShow", () => {
          if (mounted) setKeyboardOpen(true)
        }),
        await Keyboard.addListener("keyboardDidShow", () => {
          if (mounted) setKeyboardOpen(true)
        }),
        await Keyboard.addListener("keyboardWillHide", () => {
          if (mounted) setKeyboardOpen(false)
        }),
        await Keyboard.addListener("keyboardDidHide", () => {
          if (mounted) setKeyboardOpen(false)
        }),
      )
    }
    void register().catch(() => undefined)
    return () => {
      mounted = false
      for (const handle of handles) {
        void handle.remove()
      }
    }
  }, [])

  const navHidden = hideNavigation || keyboardOpen

  return (
    <div className="mobile-shell min-h-dvh bg-ivory text-cocoa">
      <main
        className={`screen-safe-top page-x min-h-dvh w-full overflow-x-clip ${
          navHidden ? "pb-safe-bottom" : "screen-bottom-padding"
        }`}
      >
        {children}
      </main>
      <AnimatePresence initial={false}>
        {!navHidden ? (
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
