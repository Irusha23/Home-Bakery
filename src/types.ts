export type TabId = "today" | "orders" | "kitchen" | "money"

export type PricingMode = "margin" | "markup"

export type AppSettings = {
  businessName: string
  ownerName: string
  defaultLabourRatePerHour: number
  defaultPricingMode: PricingMode
  defaultMarginPercent: number
  defaultMarkupPercent: number
  priceRoundingStep: 1 | 50 | 100
  defaultLowStockThreshold: number
  backupReminderDismissedAt: string | null
  backupReminderSnoozedUntil: string | null
  lastBackupAt: string | null
}

export type StarterAction = "create-order" | "record-sale" | "plan-shopping" | "add-expense" | "continue-preparation" | "view-due"

export type OrderStatus = "Draft" | "Confirmed" | "In Progress" | "Completed" | "Cancelled"
export type PreparationStatus = "Not started" | "Awaiting preparation" | "In progress" | "Ready" | "Completed" | "Cancelled"
export type PaymentStatus = "Unpaid" | "Part paid" | "Paid" | "Refunded"
export type Unit = "g" | "kg" | "ml" | "L" | "tsp" | "tbsp" | "cup" | "unit"
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
  finishedInventoryId?: string
  archived?: boolean
}

export type Product = {
  id: string
  name: string
  image?: string
  variants: ProductVariant[]
  archived?: boolean
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

export type RecipeSnapshot = {
  id: string
  name: string
  image?: string
  productId: string
  variantId: string
  version: number
  yield: number
  yieldLabel: string
  expectedOutput: { quantity: number; unit: "unit" } | null
  preparationMinutes: number
  ingredients: RecipeIngredient[]
  packaging: PackagingRequirement[]
  instructions: string[]
  estimatedCost: number
}

export type Recipe = RecipeSnapshot & {
  updatedAt: string
  archived?: boolean
  notes?: string
  history?: RecipeSnapshot[]
}

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
  pricingMode?: PricingMode
  marginPercent?: number
  markupPercent?: number
  labourMinutes?: number
  labourRatePerHour?: number
  unpricedIngredients?: string[]
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

export type Refund = {
  id: string
  orderId: string
  paymentId: string
  date: string
  amount: number
  reason: string
}

export type ExpenseCategory = {
  id: string
  name: string
  source: "built-in" | "custom"
}

export type ExpenseAttribution =
  | { type: "direct"; orderId: string }
  | {
      type: "shared"
    }

export type Expense = {
  id: string
  amount: number
  paidDate: string
  categoryId: string
  description: string
  note?: string
  attribution: ExpenseAttribution
  createdAt: string
}

export type ExpenseAllocation = {
  readonly id: string
  readonly orderId: string
  readonly amount: number
}

export type ExpenseAllocationVersion = {
  readonly id: string
  readonly expenseId: string
  readonly version: number
  readonly createdAt: string
  readonly reason?: string
  readonly allocations: readonly ExpenseAllocation[]
}

export type ExpenseAllocationHistory = {
  readonly expenseId: string
  readonly versions: readonly ExpenseAllocationVersion[]
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
  collectedAt?: string | null
  cancellationFee?: number
  referencePhoto?: string
}

export type InventoryItem = {
  inventoryId: string
  name: string
  image?: string
  physical: number
  unit: BaseUnit
  category?: InventoryCategory
  unbatchedLegacyQuantity?: number
  lowStockThreshold?: number
  averageUnitCost?: number
  gramsPerTsp?: number
  mlPerTsp?: number
  trackStock?: boolean
  archived?: boolean
}

export type InventoryBalance = InventoryItem

export type InventoryMovementType = "Opening balance" | "Purchase" | "Correction" | "Spoilage" | "Damage" | "Other" | "Preparation consumption" | "Production" | "Finished stock sale" | "Finished stock write-off"

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

export type PreparationProductStatus = "Awaiting preparation" | "In progress" | "Ready" | "Cancelled"

export type PreparationUsage = {
  inventoryId: string
  name: string
  plannedQuantity: number
  actualQuantity: number
  unit: BaseUnit
  category: "ingredient" | "packaging"
  inPantry?: boolean
  toBuyQuantity?: number
  shoppingChecked?: boolean
  boughtQuantity?: number
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

export type ExtraStockPreparationRecord = {
  id: string
  planId: string
  productId: string
  variantId: string
  finishedInventoryId: string
  recipeSnapshot: RecipeSnapshot
  plannedBatches: number
  status: PreparationProductStatus
  actualUsage: PreparationUsage[]
  completedSteps: number[]
  startedAt: string | null
  completedAt: string | null
  actualCost: number | null
  updatedAt: string
}

export type FinishedStockBatch = {
  id: string
  source: "production"
  preparationId: string
  planId: string
  productId: string
  variantId: string
  inventoryId: string
  producedQuantity: number
  remainingQuantity: number
  preparedAt: string
  bestBefore?: string
  actualTotalCost: number
  actualUnitCost: number
} | {
  id: string
  source: "legacy-opening"
  inventoryId: string
  reconciledQuantity: number
  remainingQuantity: number
  reconciledAt: string
  reconciliationReason: string
  unitCost: number
}

export type FinishedStockTransaction = {
  id: string
  type: "sale"
  batchId: string
  inventoryId: string
  quantity: number
  occurredAt: string
  unitCost: number
  totalCost: number
  sellingPrice?: number
  customerId?: string | null
  customerName?: string
  paymentMethod?: string
} | {
  id: string
  type: "write-off"
  batchId: string
  inventoryId: string
  quantity: number
  occurredAt: string
  reason: string
  unitCost: number
  totalCost: number
}

export type DemandSource = {
  id: string
  type: "customer-order" | "extra-stock"
  label: string
  reference: string
  quantity: number
  unitError?: string
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
  unitErrors: string[]
}

export type OrderDraftInput = Omit<Order, "reference" | "status" | "preparationStatus" | "paymentStatus" | "reservations" | "shortages" | "payments" | "createdAt" | "updatedAt" | "confirmedAt"> & {
  id?: string
}

export type BudgetPlan = {
  monthlySalesTarget?: number
  monthlyProfitTarget?: number
  categoryLimits: Record<string, number>
  ingredientSpendLimit?: number
  updatedAt: string
}

export type ShoppingTripItemOrder = {
  orderId: string
  reference: string
  customerName: string
  quantity: number
}

export type ShoppingTripItem = {
  inventoryId: string
  name: string
  category: Exclude<InventoryCategory, "finished">
  quantity: number
  unit: BaseUnit
  estimatedCost: number | null
  orders: ShoppingTripItemOrder[]
}

export type ShoppingTripRecord = {
  id: string
  reference: string
  date: string
  createdAt: string
  totalSpent: number | null
  expenseId?: string
  items: ShoppingTripItem[]
}

export type AppData = {
  customers: Customer[]
  products: Product[]
  recipes: Recipe[]
  orders: Order[]
  inventory: InventoryItem[]
  extraStockPlans: ExtraStockPlan[]
  extraStockPreparations: ExtraStockPreparationRecord[]
  finishedStockBatches: FinishedStockBatch[]
  finishedStockTransactions: FinishedStockTransaction[]
  purchases: PurchaseRecord[]
  refunds: Refund[]
  expenseCategories: ExpenseCategory[]
  expenses: Expense[]
  expenseAllocationHistories: ExpenseAllocationHistory[]
  inventoryMovements: InventoryMovement[]
  shoppingSelections: Record<string, number>
  shoppingTrips?: ShoppingTripRecord[]
  preparationRecords: PreparationRecord[]
  settings: AppSettings
  budgetPlan: BudgetPlan
}
