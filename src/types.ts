export type TabId = "home" | "orders" | "recipes" | "shopping" | "inventory" | "finances"

export type StarterAction = "create-order" | "record-sale" | "plan-shopping" | "add-expense" | "continue-preparation"

export type OrderStatus = "Draft" | "Confirmed" | "In Progress" | "Completed" | "Cancelled"
export type PreparationStatus = "Not started" | "Awaiting preparation" | "In progress" | "Ready" | "Completed" | "Cancelled"
export type PaymentStatus = "Unpaid" | "Part paid" | "Paid" | "Refunded"
export type Unit = "g" | "kg" | "ml" | "L" | "unit"
export type BaseUnit = "g" | "ml" | "unit"
export type InventoryCategory = "ingredient" | "packaging" | "finished"

export type Customer = {
  id: string
  name: string
  phone: string
}

export type ProductVariant = {
  id: string
  name: string
  unitLabel: string
}

export type Product = {
  id: string
  name: string
  variants: ProductVariant[]
}

export type RecipeIngredient = {
  inventoryId: string
  name: string
  quantity: number
  unit: Unit
}

export type PackagingRequirement = {
  inventoryId: string
  name: string
  quantity: number
  unit: "unit"
}

export type Recipe = {
  id: string
  name: string
  productId: string
  variantId: string
  version: number
  yield: number
  yieldLabel: string
  preparationMinutes: number
  ingredients: RecipeIngredient[]
  packaging: PackagingRequirement[]
  instructions: string[]
  estimatedCost: number
  updatedAt: string
}

export type RecipeSnapshot = Omit<Recipe, "updatedAt">

export type OrderLine = {
  id: string
  productId: string
  productName: string
  variantId: string
  variantName: string
  quantity: number
  recipeId: string | null
  recipeSnapshot: RecipeSnapshot
}

export type CostSnapshot = {
  ingredients: number
  packaging: number
  labour: number
  estimatedTotal: number
  suggestedPrice: number
}

export type StockRequirement = {
  inventoryId: string
  lineId?: string
  name: string
  required: number
  availableAtConfirmation: number
  reserved: number
  shortage: number
  unit: Unit
}

export type Payment = {
  id: string
  date: string
  amount: number
  method: string
  note?: string
}

export type Order = {
  id: string
  reference: string
  customerId: string | null
  customerName: string
  isQuickOrder: boolean
  status: OrderStatus
  preparationStatus: PreparationStatus
  paymentStatus: PaymentStatus
  collectionDate: string
  collectionTime: string
  instructions: string
  lines: OrderLine[]
  agreedPrice: number
  costSnapshot: CostSnapshot
  reservations: StockRequirement[]
  shortages: StockRequirement[]
  payments: Payment[]
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
}

export type InventoryItem = {
  inventoryId: string
  name: string
  physical: number
  unit: BaseUnit
  category?: InventoryCategory
  lowStockThreshold?: number
  averageUnitCost?: number
}

export type InventoryBalance = InventoryItem

export type InventoryMovementType = "Opening balance" | "Purchase" | "Correction" | "Spoilage" | "Damage" | "Other" | "Preparation consumption"

export type InventoryMovement = {
  id: string
  inventoryId: string
  type: InventoryMovementType
  quantityDelta: number
  unit: BaseUnit
  balanceAfter: number
  date: string
  reason: string
  purchaseId?: string
  createdAt: string
}

export type PurchaseRecord = {
  id: string
  inventoryId: string
  purchasedQuantity: number
  purchasedUnit: Unit
  usableQuantity: number
  usableUnit: Unit
  usableBaseQuantity: number
  totalPrice: number
  date: string
  note: string
  createdAt: string
}

export type ExtraStockPlan = {
  id: string
  productId: string
  variantId: string
  recipeId: string
  recipeSnapshot: RecipeSnapshot
  quantity: number
  bestBefore: string
  createdAt: string
  updatedAt: string
}

export type PreparationProductStatus = "Awaiting preparation" | "In progress" | "Ready"

export type PreparationUsage = {
  inventoryId: string
  name: string
  plannedQuantity: number
  actualQuantity: number
  unit: BaseUnit
  category: "ingredient" | "packaging"
}

export type PreparationRecord = {
  id: string
  orderId: string
  orderLineId: string
  status: PreparationProductStatus
  recipeSnapshot: RecipeSnapshot
  plannedQuantity: number
  actualUsage: PreparationUsage[]
  completedSteps: number[]
  startedAt: string | null
  completedAt: string | null
  actualCost: number | null
  updatedAt: string
}

export type DemandSource = {
  id: string
  type: "customer-order" | "extra-stock"
  label: string
  reference: string
  quantity: number
}

export type ShoppingRequirement = {
  inventoryId: string
  name: string
  category: Exclude<InventoryCategory, "finished">
  unit: BaseUnit
  required: number
  physical: number
  reserved: number
  available: number
  shortage: number
  suggestedPurchase: number
  selectedPurchase: number
  sources: DemandSource[]
}

export type OrderDraftInput = Omit<Order, "reference" | "status" | "preparationStatus" | "paymentStatus" | "reservations" | "shortages" | "payments" | "createdAt" | "updatedAt" | "confirmedAt"> & {
  id?: string
}

export type AppData = {
  customers: Customer[]
  products: Product[]
  recipes: Recipe[]
  orders: Order[]
  inventory: InventoryItem[]
  extraStockPlans: ExtraStockPlan[]
  purchases: PurchaseRecord[]
  inventoryMovements: InventoryMovement[]
  shoppingSelections: Record<string, number>
  preparationRecords: PreparationRecord[]
}
