import type { StarterAction, TabId } from "../types"

export type StackRoute =
  | { id: string; screen: "root" }
  | { id: string; screen: "settings" }
  | { id: string; screen: "order-detail"; orderId: string }
  | { id: string; screen: "create-order"; repeatOrderId?: string }
  | { id: string; screen: "customers" }
  | { id: string; screen: "customer-detail"; customerId: string }
  | {
      id: string
      screen: "kitchen-mode"
      preparationId: string
      kind: "order" | "extra-stock"
    }
  | { id: string; screen: "recipe-detail"; recipeId: string }

export type NavigationStacks = Record<TabId, StackRoute[]>

export type NavigationState = {
  activeTab: TabId
  stacks: NavigationStacks
  starterAction: StarterAction | null
}
