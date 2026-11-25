import { useCallback, useEffect, useRef, useState } from "react"
import type { StarterAction, TabId } from "../types"
import type { NavigationStacks, NavigationState, StackRoute } from "./types"

function createInitialStacks(): NavigationStacks {
  return {
    today: [{ id: "root-today", screen: "root" }],
    orders: [{ id: "root-orders", screen: "root" }],
    kitchen: [{ id: "root-kitchen", screen: "root" }],
    money: [{ id: "root-money", screen: "root" }],
  }
}

function makeRouteId(screen: string) {
  return `${screen}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export type RouteInput =
  | { screen: "root" }
  | { screen: "settings" }
  | { screen: "order-detail"; orderId: string }
  | { id?: string; screen: "create-order"; repeatOrderId?: string }
  | { screen: "customers" }
  | { screen: "customer-detail"; customerId: string }
  | {
      screen: "kitchen-mode"
      preparationId: string
      kind: "order" | "extra-stock"
    }
  | { screen: "recipe-detail"; recipeId: string }

export function createNavigationReducerState(
  initialTab: TabId = "today",
): NavigationState {
  return {
    activeTab: initialTab,
    stacks: createInitialStacks(),
    starterAction: null,
  }
}

export function useNavigationStack(initialTab: TabId = "today") {
  const [navState, setNavState] = useState<NavigationState>(() =>
    createNavigationReducerState(initialTab),
  )
  const historySyncing = useRef(false)

  const syncHistory = useCallback((next: NavigationState) => {
    if (
      typeof window === "undefined" ||
      typeof window.history?.pushState !== "function"
    ) {
      return
    }
    const activeStack = next.stacks[next.activeTab]
    if (activeStack.length > 1) {
      window.history.pushState(
        {
          bakeryNav: true,
          tab: next.activeTab,
          depth: activeStack.length,
        },
        "",
      )
    }
  }, [])

  const switchTab = useCallback(
    (tab: TabId, action: StarterAction | null = null) => {
      setNavState((prev) => {
        if (prev.activeTab === tab && !action) {
          const currentStack = prev.stacks[tab]
          if (currentStack.length <= 1) return prev
          return {
            ...prev,
            stacks: {
              ...prev.stacks,
              [tab]: [currentStack[0]],
            },
          }
        }
        return {
          ...prev,
          activeTab: tab,
          starterAction: action,
        }
      })
    },
    [],
  )

  const push = useCallback(
    (route: RouteInput, tab?: TabId) => {
      setNavState((prev) => {
        const targetTab = tab ?? prev.activeTab
        const nextRoute = {
          ...route,
          id: "id" in route && route.id ? route.id : makeRouteId(route.screen),
        } as StackRoute
        const next: NavigationState = {
          ...prev,
          activeTab: targetTab,
          stacks: {
            ...prev.stacks,
            [targetTab]: [...prev.stacks[targetTab], nextRoute],
          },
        }
        if (!historySyncing.current) {
          syncHistory(next)
        }
        return next
      })
    },
    [syncHistory],
  )

  const pop = useCallback(() => {
    setNavState((prev) => {
      const stack = prev.stacks[prev.activeTab]
      if (stack.length <= 1) return prev
      return {
        ...prev,
        stacks: {
          ...prev.stacks,
          [prev.activeTab]: stack.slice(0, -1),
        },
      }
    })
  }, [])

  const replace = useCallback((route: RouteInput) => {
    setNavState((prev) => {
      const stack = prev.stacks[prev.activeTab]
      const nextRoute = {
        ...route,
        id: "id" in route && route.id ? route.id : makeRouteId(route.screen),
      } as StackRoute
      return {
        ...prev,
        stacks: {
          ...prev.stacks,
          [prev.activeTab]: [...stack.slice(0, -1), nextRoute],
        },
      }
    })
  }, [])

  const resetTab = useCallback((tab?: TabId) => {
    setNavState((prev) => {
      const targetTab = tab ?? prev.activeTab
      const stack = prev.stacks[targetTab]
      if (stack.length <= 1) return prev
      return {
        ...prev,
        stacks: {
          ...prev.stacks,
          [targetTab]: [stack[0]],
        },
      }
    })
  }, [])

  const consumeStarterAction = useCallback(() => {
    setNavState((prev) =>
      prev.starterAction === null ? prev : { ...prev, starterAction: null },
    )
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handlePopState = () => {
      historySyncing.current = true
      pop()
      queueMicrotask(() => {
        historySyncing.current = false
      })
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [pop])

  const activeStack = navState.stacks[navState.activeTab]
  const currentRoute = activeStack[activeStack.length - 1]
  const canGoBack = activeStack.length > 1

  return {
    activeTab: navState.activeTab,
    starterAction: navState.starterAction,
    stacks: navState.stacks,
    activeStack,
    currentRoute,
    canGoBack,
    switchTab,
    push,
    pop,
    replace,
    resetTab,
    consumeStarterAction,
  }
}
