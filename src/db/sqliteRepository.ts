import type { NotificationPreferences } from "../lib/notificationState"
import type {
  AppData,
  AppSettings,
  BaseUnit,
  BudgetPlan,
  Customer,
  Expense,
  ExpenseAllocation,
  ExpenseAllocationHistory,
  ExpenseAllocationVersion,
  ExpenseCategory,
  ExtraStockPlan,
  ExtraStockPreparationRecord,
  FinishedStockBatch,
  FinishedStockTransaction,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  Order,
  OrderLine,
  OrderStatus,
  Payment,
  PaymentStatus,
  PreparationProductStatus,
  PreparationRecord,
  PreparationStatus,
  PricingMode,
  Product,
  ProductVariant,
  PurchaseRecord,
  Recipe,
  RecipeSnapshot,
  Refund,
  ShoppingTripItem,
  ShoppingTripRecord,
  Unit,
} from "../types"
import type { SqliteEngine, SqlParam, SqlRow, SqlStatement } from "./engine"
import { getAppliedSchemaVersion, runMigrations } from "./migrator"
import type { AppRepository } from "./repository"

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export class SqliteAppRepository implements AppRepository {
  readonly backendName: string

  constructor(private readonly engine: SqliteEngine) {
    this.backendName = engine.driverName
  }

  async init(): Promise<void> {
    await this.engine.exec("PRAGMA foreign_keys = ON;")
    await runMigrations(this.engine)
  }

  async hasData(): Promise<boolean> {
    const rows = await this.engine.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM app_settings",
    )
    return Number(rows[0]?.count ?? 0) > 0
  }

  async getSchemaVersion(): Promise<number> {
    return getAppliedSchemaVersion(this.engine)
  }

  async recordIdempotencyKey(key: string, operation: string): Promise<boolean> {
    const result = await this.engine.run(
      "INSERT OR IGNORE INTO idempotency_keys (key, operation, created_at) VALUES (?, ?, ?)",
      [key, operation, new Date().toISOString()],
    )
    return result.changes > 0
  }

  async hasIdempotencyKey(key: string): Promise<boolean> {
    const rows = await this.engine.query<{ found: number }>(
      "SELECT 1 AS found FROM idempotency_keys WHERE key = ? LIMIT 1",
      [key],
    )
    return rows.length > 0
  }

  async loadNotificationPrefs(): Promise<NotificationPreferences | null> {
    const rows = await this.engine.query<SqlRow>(
      "SELECT read_ids_json, dismissed_ids_json FROM notification_preferences WHERE id = 1",
    )
    const row = rows[0]
    if (!row) return null
    return {
      readIds: parseJson<string[]>(row.read_ids_json, []),
      dismissedIds: parseJson<string[]>(row.dismissed_ids_json, []),
    }
  }

  async saveNotificationPrefs(prefs: NotificationPreferences): Promise<void> {
    await this.engine.run(
      `INSERT INTO notification_preferences (id, read_ids_json, dismissed_ids_json, updated_at)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         read_ids_json = excluded.read_ids_json,
         dismissed_ids_json = excluded.dismissed_ids_json,
         updated_at = excluded.updated_at`,
      [
        JSON.stringify(prefs.readIds),
        JSON.stringify(prefs.dismissedIds),
        new Date().toISOString(),
      ],
    )
  }

  async saveAppData(data: AppData): Promise<void> {
    await this.engine.transaction(async () => {
      const statements: SqlStatement[] = []
      const enqueue = (sql: string, params?: readonly SqlParam[]) => {
        statements.push(params ? { sql, params } : { sql })
      }

      // Clear child tables before parent tables so PRAGMA foreign_keys = ON holds
      const clearStatements = [
        "DELETE FROM expense_allocations",
        "DELETE FROM expense_allocation_versions",
        "DELETE FROM expenses",
        "DELETE FROM expense_categories",
        "DELETE FROM finished_stock_transactions",
        "DELETE FROM finished_stock_batches",
        "DELETE FROM extra_stock_preparations",
        "DELETE FROM extra_stock_plans",
        "DELETE FROM preparation_records",
        "DELETE FROM refunds",
        "DELETE FROM payments",
        "DELETE FROM order_lines",
        "DELETE FROM orders",
        "DELETE FROM recipes",
        "DELETE FROM product_variants",
        "DELETE FROM products",
        "DELETE FROM inventory_movements",
        "DELETE FROM purchases",
        "DELETE FROM shopping_trips",
        "DELETE FROM shopping_selections",
        "DELETE FROM inventory_items",
        "DELETE FROM customers",
        "DELETE FROM budget_plans",
        "DELETE FROM app_settings",
      ]
      for (const stmt of clearStatements) {
        enqueue(stmt)
      }

      const s = data.settings
      enqueue(
        `INSERT INTO app_settings (
          id, business_name, owner_name, default_labour_rate_per_hour,
          default_pricing_mode, default_margin_percent, default_markup_percent,
          price_rounding_step, default_low_stock_threshold,
          backup_reminder_dismissed_at, backup_reminder_snoozed_until, last_backup_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.businessName,
          s.ownerName,
          s.defaultLabourRatePerHour,
          s.defaultPricingMode,
          s.defaultMarginPercent,
          s.defaultMarkupPercent,
          s.priceRoundingStep,
          s.defaultLowStockThreshold,
          s.backupReminderDismissedAt,
          s.backupReminderSnoozedUntil,
          s.lastBackupAt,
        ],
      )

      const b = data.budgetPlan
      enqueue(
        `INSERT INTO budget_plans (
          id, monthly_sales_target, monthly_profit_target,
          ingredient_spend_limit, category_limits_json, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?)`,
        [
          b.monthlySalesTarget ?? null,
          b.monthlyProfitTarget ?? null,
          b.ingredientSpendLimit ?? null,
          JSON.stringify(b.categoryLimits),
          b.updatedAt,
        ],
      )

      for (const [index, c] of data.customers.entries()) {
        enqueue(
          "INSERT INTO customers (id, name, phone, sort_order) VALUES (?, ?, ?, ?)",
          [c.id, c.name, c.phone, index],
        )
      }

      for (const [index, item] of data.inventory.entries()) {
        enqueue(
          `INSERT INTO inventory_items (
            inventory_id, name, image, physical, unit, category,
            unbatched_legacy_quantity, low_stock_threshold, average_unit_cost,
            grams_per_tsp, ml_per_tsp, track_stock, archived, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.inventoryId,
            item.name,
            item.image ?? null,
            item.physical,
            item.unit,
            item.category ?? "ingredient",
            item.unbatchedLegacyQuantity ?? null,
            item.lowStockThreshold ?? null,
            item.averageUnitCost ?? null,
            item.gramsPerTsp ?? null,
            item.mlPerTsp ?? null,
            item.trackStock === true ? 1 : item.trackStock === false ? 0 : null,
            item.archived ? 1 : 0,
            index,
          ],
        )
      }

      for (const [pIndex, product] of data.products.entries()) {
        enqueue(
          "INSERT INTO products (id, name, image, archived, sort_order) VALUES (?, ?, ?, ?, ?)",
          [
            product.id,
            product.name,
            product.image ?? null,
            product.archived ? 1 : 0,
            pIndex,
          ],
        )
        for (const [vIndex, variant] of product.variants.entries()) {
          enqueue(
            `INSERT INTO product_variants (
              id, product_id, name, unit_label, finished_inventory_id, archived, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              variant.id,
              product.id,
              variant.name,
              variant.unitLabel,
              variant.finishedInventoryId ?? null,
              variant.archived ? 1 : 0,
              vIndex,
            ],
          )
        }
      }

      for (const [index, recipe] of data.recipes.entries()) {
        enqueue(
          `INSERT INTO recipes (
            id, name, image, product_id, variant_id, version, yield, yield_label,
            expected_output_json, preparation_minutes, ingredients_json, packaging_json,
            instructions_json, estimated_cost, selling_price, pricing_json,
            updated_at, archived, notes, history_json, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recipe.id,
            recipe.name,
            recipe.image ?? null,
            recipe.productId,
            recipe.variantId,
            recipe.version,
            recipe.yield,
            recipe.yieldLabel,
            recipe.expectedOutput ? JSON.stringify(recipe.expectedOutput) : null,
            recipe.preparationMinutes,
            JSON.stringify(recipe.ingredients),
            JSON.stringify(recipe.packaging),
            JSON.stringify(recipe.instructions),
            recipe.estimatedCost,
            recipe.sellingPrice ?? null,
            recipe.pricing ? JSON.stringify(recipe.pricing) : null,
            recipe.updatedAt,
            recipe.archived ? 1 : 0,
            recipe.notes ?? null,
            recipe.history ? JSON.stringify(recipe.history) : null,
            index,
          ],
        )
      }

      for (const [oIndex, order] of data.orders.entries()) {
        enqueue(
          `INSERT INTO orders (
            id, reference, customer_id, customer_name, is_quick_order,
            status, preparation_status, payment_status, collection_date, collection_time,
            instructions, agreed_price, cost_snapshot_json, reservations_json, shortages_json,
            created_at, updated_at, confirmed_at, collected_at, cancellation_fee, reference_photo, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            order.id,
            order.reference,
            order.customerId,
            order.customerName,
            order.isQuickOrder ? 1 : 0,
            order.status,
            order.preparationStatus,
            order.paymentStatus,
            order.collectionDate,
            order.collectionTime,
            order.instructions,
            order.agreedPrice,
            JSON.stringify(order.costSnapshot),
            JSON.stringify(order.reservations),
            JSON.stringify(order.shortages),
            order.createdAt,
            order.updatedAt,
            order.confirmedAt,
            order.collectedAt ?? null,
            order.cancellationFee ?? null,
            order.referencePhoto ?? null,
            oIndex,
          ],
        )

        for (const [lIndex, line] of order.lines.entries()) {
          enqueue(
            `INSERT INTO order_lines (
              id, order_id, product_id, product_name, variant_id, variant_name,
              quantity, recipe_id, recipe_snapshot_json, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              line.id,
              order.id,
              line.productId,
              line.productName,
              line.variantId,
              line.variantName,
              line.quantity,
              line.recipeId,
              JSON.stringify(line.recipeSnapshot),
              lIndex,
            ],
          )
        }

        for (const [payIndex, payment] of order.payments.entries()) {
          enqueue(
            `INSERT INTO payments (
              id, order_id, date, amount, method, note, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              payment.id,
              order.id,
              payment.date,
              payment.amount,
              payment.method,
              payment.note ?? null,
              payIndex,
            ],
          )
        }
      }

      for (const [index, refund] of data.refunds.entries()) {
        enqueue(
          `INSERT INTO refunds (
            id, order_id, payment_id, date, amount, reason, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            refund.id,
            refund.orderId,
            refund.paymentId,
            refund.date,
            refund.amount,
            refund.reason,
            index,
          ],
        )
      }

      for (const [index, p] of data.purchases.entries()) {
        enqueue(
          `INSERT INTO purchases (
            id, inventory_id, purchased_quantity, purchased_unit,
            usable_quantity, usable_unit, usable_base_quantity, total_price,
            date, note, created_at, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.inventoryId,
            p.purchasedQuantity,
            p.purchasedUnit,
            p.usableQuantity,
            p.usableUnit,
            p.usableBaseQuantity,
            p.totalPrice,
            p.date,
            p.note,
            p.createdAt,
            index,
          ],
        )
      }

      for (const [index, m] of data.inventoryMovements.entries()) {
        enqueue(
          `INSERT INTO inventory_movements (
            id, inventory_id, type, quantity_delta, unit, balance_after,
            date, reason, purchase_id, created_at, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m.id,
            m.inventoryId,
            m.type,
            m.quantityDelta,
            m.unit,
            m.balanceAfter,
            m.date,
            m.reason,
            m.purchaseId ?? null,
            m.createdAt,
            index,
          ],
        )
      }

      for (const [index, rec] of data.preparationRecords.entries()) {
        enqueue(
          `INSERT INTO preparation_records (
            id, order_id, order_line_id, status, recipe_snapshot_json,
            planned_quantity, actual_usage_json, completed_steps_json,
            started_at, completed_at, actual_cost, updated_at, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rec.id,
            rec.orderId,
            rec.orderLineId,
            rec.status,
            JSON.stringify(rec.recipeSnapshot),
            rec.plannedQuantity,
            JSON.stringify(rec.actualUsage),
            JSON.stringify(rec.completedSteps),
            rec.startedAt,
            rec.completedAt,
            rec.actualCost,
            rec.updatedAt,
            index,
          ],
        )
      }

      for (const [index, plan] of data.extraStockPlans.entries()) {
        enqueue(
          `INSERT INTO extra_stock_plans (
            id, product_id, variant_id, recipe_id, recipe_snapshot_json,
            quantity, best_before, created_at, updated_at, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            plan.id,
            plan.productId,
            plan.variantId,
            plan.recipeId,
            JSON.stringify(plan.recipeSnapshot),
            plan.quantity,
            plan.bestBefore,
            plan.createdAt,
            plan.updatedAt,
            index,
          ],
        )
      }

      for (const [index, rec] of data.extraStockPreparations.entries()) {
        enqueue(
          `INSERT INTO extra_stock_preparations (
            id, plan_id, product_id, variant_id, finished_inventory_id,
            recipe_snapshot_json, planned_batches, status, actual_usage_json,
            completed_steps_json, started_at, completed_at, actual_cost, updated_at, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rec.id,
            rec.planId,
            rec.productId,
            rec.variantId,
            rec.finishedInventoryId,
            JSON.stringify(rec.recipeSnapshot),
            rec.plannedBatches,
            rec.status,
            JSON.stringify(rec.actualUsage),
            JSON.stringify(rec.completedSteps),
            rec.startedAt,
            rec.completedAt,
            rec.actualCost,
            rec.updatedAt,
            index,
          ],
        )
      }

      for (const [index, batch] of data.finishedStockBatches.entries()) {
        enqueue(
          `INSERT INTO finished_stock_batches (
            id, source, inventory_id, remaining_quantity, payload_json, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            batch.id,
            batch.source,
            batch.inventoryId,
            batch.remainingQuantity,
            JSON.stringify(batch),
            index,
          ],
        )
      }

      for (const [index, tx] of data.finishedStockTransactions.entries()) {
        enqueue(
          `INSERT INTO finished_stock_transactions (
            id, type, batch_id, inventory_id, quantity, occurred_at,
            unit_cost, total_cost, payload_json, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tx.id,
            tx.type,
            tx.batchId,
            tx.inventoryId,
            tx.quantity,
            tx.occurredAt,
            tx.unitCost,
            tx.totalCost,
            JSON.stringify(tx),
            index,
          ],
        )
      }

      for (const [index, cat] of data.expenseCategories.entries()) {
        enqueue(
          "INSERT INTO expense_categories (id, name, source, sort_order) VALUES (?, ?, ?, ?)",
          [cat.id, cat.name, cat.source, index],
        )
      }

      for (const [index, exp] of data.expenses.entries()) {
        enqueue(
          `INSERT INTO expenses (
            id, amount, paid_date, category_id, description, note,
            attribution_type, attribution_order_id, created_at, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            exp.id,
            exp.amount,
            exp.paidDate,
            exp.categoryId,
            exp.description,
            exp.note ?? null,
            exp.attribution.type,
            exp.attribution.type === "direct" ? exp.attribution.orderId : null,
            exp.createdAt,
            index,
          ],
        )
      }

      for (const history of data.expenseAllocationHistories) {
        for (const [vIndex, version] of history.versions.entries()) {
          enqueue(
            `INSERT INTO expense_allocation_versions (
              id, expense_id, version, created_at, reason, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              version.id,
              version.expenseId,
              version.version,
              version.createdAt,
              version.reason ?? null,
              vIndex,
            ],
          )
          for (const [aIndex, alloc] of version.allocations.entries()) {
            enqueue(
              `INSERT INTO expense_allocations (
                id, version_id, order_id, amount, sort_order
              ) VALUES (?, ?, ?, ?, ?)`,
              [alloc.id, version.id, alloc.orderId, alloc.amount, aIndex],
            )
          }
        }
      }

      for (const [inventoryId, quantity] of Object.entries(
        data.shoppingSelections,
      )) {
        enqueue(
          "INSERT INTO shopping_selections (inventory_id, quantity) VALUES (?, ?)",
          [inventoryId, quantity],
        )
      }

      for (const [index, trip] of (data.shoppingTrips ?? []).entries()) {
        enqueue(
          `INSERT INTO shopping_trips (
            id, reference, date, created_at, total_spent, expense_id, items_json, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            trip.id,
            trip.reference,
            trip.date,
            trip.createdAt,
            trip.totalSpent,
            trip.expenseId ?? null,
            JSON.stringify(trip.items),
            index,
          ],
        )
      }

      if (this.engine.runBatch) {
        await this.engine.runBatch(statements)
      } else {
        for (const stmt of statements) {
          await this.engine.run(stmt.sql, stmt.params)
        }
      }
    })
  }

  async loadAppData(): Promise<AppData | null> {
    const settingsRows = await this.engine.query<SqlRow>(
      "SELECT * FROM app_settings WHERE id = 1",
    )
    const settingsRow = settingsRows[0]
    if (!settingsRow) return null

    const settings: AppSettings = {
      businessName: asString(settingsRow.business_name),
      ownerName: asString(settingsRow.owner_name),
      defaultLabourRatePerHour: asNumber(
        settingsRow.default_labour_rate_per_hour,
      ),
      defaultPricingMode: asString(
        settingsRow.default_pricing_mode,
        "margin",
      ) as PricingMode,
      defaultMarginPercent: asNumber(settingsRow.default_margin_percent),
      defaultMarkupPercent: asNumber(settingsRow.default_markup_percent),
      priceRoundingStep: asNumber(settingsRow.price_rounding_step, 50) as
        | 1
        | 50
        | 100,
      defaultLowStockThreshold: asNumber(
        settingsRow.default_low_stock_threshold,
      ),
      backupReminderDismissedAt: asNullableString(
        settingsRow.backup_reminder_dismissed_at,
      ),
      backupReminderSnoozedUntil: asNullableString(
        settingsRow.backup_reminder_snoozed_until,
      ),
      lastBackupAt: asNullableString(settingsRow.last_backup_at),
    }

    const budgetRows = await this.engine.query<SqlRow>(
      "SELECT * FROM budget_plans WHERE id = 1",
    )
    const budgetRow = budgetRows[0]
    const monthlySalesTarget = asNullableNumber(budgetRow?.monthly_sales_target)
    const monthlyProfitTarget = asNullableNumber(
      budgetRow?.monthly_profit_target,
    )
    const ingredientSpendLimit = asNullableNumber(
      budgetRow?.ingredient_spend_limit,
    )
    const budgetPlan: BudgetPlan = {
      ...(monthlySalesTarget !== null ? { monthlySalesTarget } : {}),
      ...(monthlyProfitTarget !== null ? { monthlyProfitTarget } : {}),
      ...(ingredientSpendLimit !== null ? { ingredientSpendLimit } : {}),
      categoryLimits: parseJson<Record<string, number>>(
        budgetRow?.category_limits_json,
        {},
      ),
      updatedAt: asString(
        budgetRow?.updated_at,
        "2026-01-01T00:00:00.000Z",
      ),
    }

    const customerRows = await this.engine.query<SqlRow>(
      "SELECT * FROM customers ORDER BY sort_order ASC",
    )
    const customers: Customer[] = customerRows.map((row) => ({
      id: asString(row.id),
      name: asString(row.name),
      phone: asString(row.phone),
    }))

    const inventoryRows = await this.engine.query<SqlRow>(
      "SELECT * FROM inventory_items ORDER BY sort_order ASC",
    )
    const inventory: InventoryItem[] = inventoryRows.map((row) => {
      const image = asNullableString(row.image)
      const unbatchedLegacyQuantity = asNullableNumber(
        row.unbatched_legacy_quantity,
      )
      const lowStockThreshold = asNullableNumber(row.low_stock_threshold)
      const averageUnitCost = asNullableNumber(row.average_unit_cost)
      const gramsPerTsp = asNullableNumber(row.grams_per_tsp)
      const mlPerTsp = asNullableNumber(row.ml_per_tsp)
      const rawTrackStock = asNullableNumber(row.track_stock)
      const physical = asNumber(row.physical)
      const category = asString(row.category, "ingredient") as InventoryCategory
      return {
        inventoryId: asString(row.inventory_id),
        name: asString(row.name),
        ...(image !== null ? { image } : {}),
        physical,
        unit: asString(row.unit, "unit") as BaseUnit,
        category,
        ...(unbatchedLegacyQuantity !== null
          ? { unbatchedLegacyQuantity }
          : {}),
        ...(lowStockThreshold !== null ? { lowStockThreshold } : {}),
        ...(averageUnitCost !== null ? { averageUnitCost } : {}),
        ...(gramsPerTsp !== null && gramsPerTsp > 0 ? { gramsPerTsp } : {}),
        ...(mlPerTsp !== null && mlPerTsp > 0 ? { mlPerTsp } : {}),
        ...(rawTrackStock === 1
          ? { trackStock: true }
          : rawTrackStock === 0
            ? { trackStock: false }
            : {}),
        ...(asNumber(row.archived) === 1 ? { archived: true } : {}),
      }
    })

    const variantRows = await this.engine.query<SqlRow>(
      "SELECT * FROM product_variants ORDER BY sort_order ASC",
    )
    const variantsByProduct = new Map<string, ProductVariant[]>()
    for (const row of variantRows) {
      const productId = asString(row.product_id)
      const finishedInventoryId = asNullableString(row.finished_inventory_id)
      const variant: ProductVariant = {
        id: asString(row.id),
        name: asString(row.name),
        unitLabel: asString(row.unit_label),
        ...(finishedInventoryId !== null ? { finishedInventoryId } : {}),
        ...(asNumber(row.archived) === 1 ? { archived: true } : {}),
      }
      const list = variantsByProduct.get(productId) ?? []
      list.push(variant)
      variantsByProduct.set(productId, list)
    }

    const productRows = await this.engine.query<SqlRow>(
      "SELECT * FROM products ORDER BY sort_order ASC",
    )
    const products: Product[] = productRows.map((row) => {
      const id = asString(row.id)
      const image = asNullableString(row.image)
      return {
        id,
        name: asString(row.name),
        ...(image !== null ? { image } : {}),
        variants: variantsByProduct.get(id) ?? [],
        ...(asNumber(row.archived) === 1 ? { archived: true } : {}),
      }
    })

    const recipeRows = await this.engine.query<SqlRow>(
      "SELECT * FROM recipes ORDER BY sort_order ASC",
    )
    const recipes: Recipe[] = recipeRows.map((row) => {
      const image = asNullableString(row.image)
      const notes = asNullableString(row.notes)
      const history =
        typeof row.history_json === "string"
          ? parseJson<RecipeSnapshot[]>(row.history_json, [])
          : null
      const sellingPrice = asNullableNumber(row.selling_price)
      const pricing =
        typeof row.pricing_json === "string"
          ? parseJson<Recipe["pricing"]>(row.pricing_json, undefined)
          : undefined
      return {
        id: asString(row.id),
        name: asString(row.name),
        ...(image !== null ? { image } : {}),
        productId: asString(row.product_id),
        variantId: asString(row.variant_id),
        version: asNumber(row.version, 1),
        yield: asNumber(row.yield, 1),
        yieldLabel: asString(row.yield_label),
        expectedOutput:
          typeof row.expected_output_json === "string"
            ? parseJson<{ quantity: number; unit: "unit" } | null>(
                row.expected_output_json,
                null,
              )
            : null,
        preparationMinutes: asNumber(row.preparation_minutes),
        ingredients: parseJson(row.ingredients_json, []),
        packaging: parseJson(row.packaging_json, []),
        instructions: parseJson(row.instructions_json, []),
        estimatedCost: asNumber(row.estimated_cost),
        ...(sellingPrice !== null ? { sellingPrice } : {}),
        ...(pricing !== undefined ? { pricing } : {}),
        updatedAt: asString(row.updated_at),
        ...(asNumber(row.archived) === 1 ? { archived: true } : {}),
        ...(notes !== null ? { notes } : {}),
        ...(history !== null ? { history } : {}),
      }
    })

    const lineRows = await this.engine.query<SqlRow>(
      "SELECT * FROM order_lines ORDER BY sort_order ASC",
    )
    const linesByOrder = new Map<string, OrderLine[]>()
    for (const row of lineRows) {
      const orderId = asString(row.order_id)
      const line: OrderLine = {
        id: asString(row.id),
        productId: asString(row.product_id),
        productName: asString(row.product_name),
        variantId: asString(row.variant_id),
        variantName: asString(row.variant_name),
        quantity: asNumber(row.quantity, 1),
        recipeId: asNullableString(row.recipe_id),
        recipeSnapshot: parseJson(
          row.recipe_snapshot_json,
          {} as RecipeSnapshot,
        ),
      }
      const list = linesByOrder.get(orderId) ?? []
      list.push(line)
      linesByOrder.set(orderId, list)
    }

    const paymentRows = await this.engine.query<SqlRow>(
      "SELECT * FROM payments ORDER BY sort_order ASC",
    )
    const paymentsByOrder = new Map<string, Payment[]>()
    for (const row of paymentRows) {
      const orderId = asString(row.order_id)
      const note = asNullableString(row.note)
      const payment: Payment = {
        id: asString(row.id),
        date: asString(row.date),
        amount: asNumber(row.amount),
        method: asString(row.method),
        ...(note !== null ? { note } : {}),
      }
      const list = paymentsByOrder.get(orderId) ?? []
      list.push(payment)
      paymentsByOrder.set(orderId, list)
    }

    const orderRows = await this.engine.query<SqlRow>(
      "SELECT * FROM orders ORDER BY sort_order ASC",
    )
    const orders: Order[] = orderRows.map((row) => {
      const id = asString(row.id)
      const cancellationFee = asNullableNumber(row.cancellation_fee)
      const referencePhoto = asNullableString(row.reference_photo)
      return {
        id,
        reference: asString(row.reference),
        customerId: asNullableString(row.customer_id),
        customerName: asString(row.customer_name),
        isQuickOrder: asNumber(row.is_quick_order) === 1,
        status: asString(row.status) as OrderStatus,
        preparationStatus: asString(
          row.preparation_status,
        ) as PreparationStatus,
        paymentStatus: asString(row.payment_status) as PaymentStatus,
        collectionDate: asString(row.collection_date),
        collectionTime: asString(row.collection_time),
        instructions: asString(row.instructions),
        lines: linesByOrder.get(id) ?? [],
        agreedPrice: asNumber(row.agreed_price),
        costSnapshot: parseJson(row.cost_snapshot_json, {
          ingredients: 0,
          packaging: 0,
          labour: 0,
          estimatedTotal: 0,
          suggestedPrice: 0,
        }),
        reservations: parseJson(row.reservations_json, []),
        shortages: parseJson(row.shortages_json, []),
        payments: paymentsByOrder.get(id) ?? [],
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at),
        confirmedAt: asNullableString(row.confirmed_at),
        collectedAt: asNullableString(row.collected_at),
        ...(cancellationFee !== null ? { cancellationFee } : {}),
        ...(referencePhoto !== null ? { referencePhoto } : {}),
      }
    })

    const refundRows = await this.engine.query<SqlRow>(
      "SELECT * FROM refunds ORDER BY sort_order ASC",
    )
    const refunds: Refund[] = refundRows.map((row) => ({
      id: asString(row.id),
      orderId: asString(row.order_id),
      paymentId: asString(row.payment_id),
      date: asString(row.date),
      amount: asNumber(row.amount),
      reason: asString(row.reason),
    }))

    const purchaseRows = await this.engine.query<SqlRow>(
      "SELECT * FROM purchases ORDER BY sort_order ASC",
    )
    const purchases: PurchaseRecord[] = purchaseRows.map((row) => ({
      id: asString(row.id),
      inventoryId: asString(row.inventory_id),
      purchasedQuantity: asNumber(row.purchased_quantity),
      purchasedUnit: asString(row.purchased_unit) as Unit,
      usableQuantity: asNumber(row.usable_quantity),
      usableUnit: asString(row.usable_unit) as Unit,
      usableBaseQuantity: asNumber(row.usable_base_quantity),
      totalPrice: asNumber(row.total_price),
      date: asString(row.date),
      note: asString(row.note),
      createdAt: asString(row.created_at),
    }))

    const movementRows = await this.engine.query<SqlRow>(
      "SELECT * FROM inventory_movements ORDER BY sort_order ASC",
    )
    const inventoryMovements: InventoryMovement[] = movementRows.map((row) => {
      const purchaseId = asNullableString(row.purchase_id)
      return {
        id: asString(row.id),
        inventoryId: asString(row.inventory_id),
        type: asString(row.type) as InventoryMovementType,
        quantityDelta: asNumber(row.quantity_delta),
        unit: asString(row.unit) as BaseUnit,
        balanceAfter: asNumber(row.balance_after),
        date: asString(row.date),
        reason: asString(row.reason),
        ...(purchaseId !== null ? { purchaseId } : {}),
        createdAt: asString(row.created_at),
      }
    })

    const prepRows = await this.engine.query<SqlRow>(
      "SELECT * FROM preparation_records ORDER BY sort_order ASC",
    )
    const preparationRecords: PreparationRecord[] = prepRows.map((row) => ({
      id: asString(row.id),
      orderId: asString(row.order_id),
      orderLineId: asString(row.order_line_id),
      status: asString(row.status) as PreparationProductStatus,
      recipeSnapshot: parseJson(
        row.recipe_snapshot_json,
        {} as RecipeSnapshot,
      ),
      plannedQuantity: asNumber(row.planned_quantity),
      actualUsage: parseJson(row.actual_usage_json, []),
      completedSteps: parseJson(row.completed_steps_json, []),
      startedAt: asNullableString(row.started_at),
      completedAt: asNullableString(row.completed_at),
      actualCost: asNullableNumber(row.actual_cost),
      updatedAt: asString(row.updated_at),
    }))

    const extraPlanRows = await this.engine.query<SqlRow>(
      "SELECT * FROM extra_stock_plans ORDER BY sort_order ASC",
    )
    const extraStockPlans: ExtraStockPlan[] = extraPlanRows.map((row) => ({
      id: asString(row.id),
      productId: asString(row.product_id),
      variantId: asString(row.variant_id),
      recipeId: asString(row.recipe_id),
      recipeSnapshot: parseJson(
        row.recipe_snapshot_json,
        {} as RecipeSnapshot,
      ),
      quantity: asNumber(row.quantity),
      bestBefore: asString(row.best_before),
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
    }))

    const extraPrepRows = await this.engine.query<SqlRow>(
      "SELECT * FROM extra_stock_preparations ORDER BY sort_order ASC",
    )
    const extraStockPreparations: ExtraStockPreparationRecord[] =
      extraPrepRows.map((row) => ({
        id: asString(row.id),
        planId: asString(row.plan_id),
        productId: asString(row.product_id),
        variantId: asString(row.variant_id),
        finishedInventoryId: asString(row.finished_inventory_id),
        recipeSnapshot: parseJson(
          row.recipe_snapshot_json,
          {} as RecipeSnapshot,
        ),
        plannedBatches: asNumber(row.planned_batches),
        status: asString(row.status) as PreparationProductStatus,
        actualUsage: parseJson(row.actual_usage_json, []),
        completedSteps: parseJson(row.completed_steps_json, []),
        startedAt: asNullableString(row.started_at),
        completedAt: asNullableString(row.completed_at),
        actualCost: asNullableNumber(row.actual_cost),
        updatedAt: asString(row.updated_at),
      }))

    const batchRows = await this.engine.query<SqlRow>(
      "SELECT payload_json FROM finished_stock_batches ORDER BY sort_order ASC",
    )
    const finishedStockBatches: FinishedStockBatch[] = batchRows.map((row) =>
      parseJson(row.payload_json, {} as FinishedStockBatch),
    )

    const txRows = await this.engine.query<SqlRow>(
      "SELECT payload_json FROM finished_stock_transactions ORDER BY sort_order ASC",
    )
    const finishedStockTransactions: FinishedStockTransaction[] = txRows.map(
      (row) => parseJson(row.payload_json, {} as FinishedStockTransaction),
    )

    const catRows = await this.engine.query<SqlRow>(
      "SELECT * FROM expense_categories ORDER BY sort_order ASC",
    )
    const expenseCategories: ExpenseCategory[] = catRows.map((row) => ({
      id: asString(row.id),
      name: asString(row.name),
      source: asString(row.source) as "built-in" | "custom",
    }))

    const expRows = await this.engine.query<SqlRow>(
      "SELECT * FROM expenses ORDER BY sort_order ASC",
    )
    const expenses: Expense[] = expRows.map((row) => {
      const note = asNullableString(row.note)
      const attributionType = asString(row.attribution_type)
      return {
        id: asString(row.id),
        amount: asNumber(row.amount),
        paidDate: asString(row.paid_date),
        categoryId: asString(row.category_id),
        description: asString(row.description),
        ...(note !== null ? { note } : {}),
        attribution:
          attributionType === "direct"
            ? { type: "direct", orderId: asString(row.attribution_order_id) }
            : { type: "shared" },
        createdAt: asString(row.created_at),
      }
    })

    const allocRows = await this.engine.query<SqlRow>(
      "SELECT * FROM expense_allocations ORDER BY sort_order ASC",
    )
    const allocsByVersion = new Map<string, ExpenseAllocation[]>()
    for (const row of allocRows) {
      const versionId = asString(row.version_id)
      const list = allocsByVersion.get(versionId) ?? []
      list.push({
        id: asString(row.id),
        orderId: asString(row.order_id),
        amount: asNumber(row.amount),
      })
      allocsByVersion.set(versionId, list)
    }

    const verRows = await this.engine.query<SqlRow>(
      "SELECT * FROM expense_allocation_versions ORDER BY sort_order ASC",
    )
    const versionsByExpense = new Map<string, ExpenseAllocationVersion[]>()
    for (const row of verRows) {
      const expenseId = asString(row.expense_id)
      const id = asString(row.id)
      const reason = asNullableString(row.reason)
      const version: ExpenseAllocationVersion = {
        id,
        expenseId,
        version: asNumber(row.version, 1),
        createdAt: asString(row.created_at),
        ...(reason !== null ? { reason } : {}),
        allocations: allocsByVersion.get(id) ?? [],
      }
      const list = versionsByExpense.get(expenseId) ?? []
      list.push(version)
      versionsByExpense.set(expenseId, list)
    }

    const expenseAllocationHistories: ExpenseAllocationHistory[] = Array.from(
      versionsByExpense.entries(),
    ).map(([expenseId, versions]) => ({
      expenseId,
      versions,
    }))

    const selRows = await this.engine.query<SqlRow>(
      "SELECT * FROM shopping_selections",
    )
    const shoppingSelections: Record<string, number> = {}
    for (const row of selRows) {
      shoppingSelections[asString(row.inventory_id)] = asNumber(row.quantity)
    }

    const tripRows = await this.engine.query<SqlRow>(
      "SELECT * FROM shopping_trips ORDER BY sort_order ASC",
    )
    const shoppingTrips: ShoppingTripRecord[] = tripRows.map((row) => {
      const expenseId = asNullableString(row.expense_id)
      return {
        id: asString(row.id),
        reference: asString(row.reference),
        date: asString(row.date),
        createdAt: asString(row.created_at),
        totalSpent: asNullableNumber(row.total_spent),
        ...(expenseId !== null ? { expenseId } : {}),
        items: parseJson<ShoppingTripItem[]>(row.items_json, []),
      }
    })

    return {
      customers,
      products,
      recipes,
      orders,
      inventory,
      extraStockPlans,
      extraStockPreparations,
      finishedStockBatches,
      finishedStockTransactions,
      purchases,
      refunds,
      expenseCategories,
      expenses,
      expenseAllocationHistories,
      inventoryMovements,
      shoppingSelections,
      shoppingTrips,
      preparationRecords,
      settings,
      budgetPlan,
    }
  }

  async close(): Promise<void> {
    await this.engine.close()
  }
}
