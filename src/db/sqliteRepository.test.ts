import { afterEach, describe, expect, it, vi } from "vitest"
import { createEmptyAppData } from "../data/defaults"
import { createStarterData } from "../data/starterData"
import { migrateState } from "../state/AppState"
import {
  CURRENT_STORAGE_KEY,
  serializeAppData,
  type StorageLike,
} from "../state/persistence"
import { demoData } from "../test/demoFixture"
import type { SqliteEngine } from "./engine"
import { NodeSqliteEngine } from "./engines/nodeSqliteEngine"
import { bootstrapAppRepository } from "./legacyImport"
import { migration0001InitialSchema } from "./migrations/0001_initial_schema"
import {
  ALL_MIGRATIONS,
  getAppliedSchemaVersion,
  LATEST_DB_SCHEMA_VERSION,
  runMigrations,
} from "./migrator"
import { SqliteAppRepository } from "./sqliteRepository"

function createMemoryStorage(initial: Record<string, string> = {}): {
  storage: StorageLike
  values: Map<string, string>
} {
  const values = new Map(Object.entries(initial))
  return {
    values,
    storage: {
      getItem: vi.fn((key) => values.get(key) ?? null),
      setItem: vi.fn((key, value) => {
        values.set(key, value)
      }),
      removeItem: vi.fn((key) => {
        values.delete(key)
      }),
    },
  }
}

describe("Phase 13 SQLite schema, migrations, and repository", () => {
  const openEngines: NodeSqliteEngine[] = []

  afterEach(async () => {
    while (openEngines.length > 0) {
      await openEngines.pop()!.close()
    }
  })

  function createRepo() {
    const engine = new NodeSqliteEngine(":memory:")
    openEngines.push(engine)
    return { engine, repo: new SqliteAppRepository(engine) }
  }

  it("applies versioned migrations idempotently", async () => {
    const { engine, repo } = createRepo()
    expect(await getAppliedSchemaVersion(engine)).toBe(0)

    await repo.init()
    expect(await repo.getSchemaVersion()).toBe(LATEST_DB_SCHEMA_VERSION)

    const secondRun = await runMigrations(engine)
    expect(secondRun.appliedVersions).toEqual([])
    expect(secondRun.currentVersion).toBe(LATEST_DB_SCHEMA_VERSION)
  })

  it("round-trips empty, minimal starter, and rich multi-record datasets losslessly", async () => {
    const { repo } = createRepo()
    await repo.init()

    const empty = migrateState(createEmptyAppData())
    await repo.saveAppData(empty)
    expect(await repo.hasData()).toBe(true)
    expect(await repo.loadAppData()).toEqual(empty)

    const starter = migrateState(createStarterData())
    await repo.saveAppData(starter)
    expect(await repo.loadAppData()).toEqual(starter)

    const rich = migrateState(structuredClone(demoData))
    rich.expenseCategories.push({
      id: "cat-delivery",
      name: "Delivery",
      source: "custom",
    })
    rich.expenses.push({
      id: "exp-1",
      amount: 3500,
      paidDate: "2026-10-12",
      categoryId: "cat-delivery",
      description: "Courier delivery",
      note: "Urgent cake box",
      attribution: { type: "direct", orderId: rich.orders[0].id },
      createdAt: "2026-10-12T08:00:00.000Z",
    })
    rich.expenseAllocationHistories.push({
      expenseId: "exp-1",
      versions: [
        {
          id: "ver-1",
          expenseId: "exp-1",
          version: 1,
          createdAt: "2026-10-12T08:10:00.000Z",
          reason: "Initial attribution",
          allocations: [
            {
              id: "alloc-1",
              orderId: rich.orders[0].id,
              amount: 3500,
            },
          ],
        },
      ],
    })
    rich.refunds.push({
      id: "refund-1",
      orderId: rich.orders[0].id,
      paymentId: rich.orders[0].payments[0].id,
      date: "2026-10-13",
      amount: 1000,
      reason: "Price adjustment",
    })
    rich.finishedStockBatches.push({
      id: "batch-1",
      source: "production",
      preparationId: "prep-1",
      planId: "plan-1",
      productId: rich.products[0].id,
      variantId: rich.products[0].variants[0].id,
      inventoryId: "finished-brownie-box",
      producedQuantity: 6,
      remainingQuantity: 4,
      preparedAt: "2026-10-12T09:00:00.000Z",
      bestBefore: "2026-10-16",
      actualTotalCost: 6000,
      actualUnitCost: 1000,
    })
    rich.finishedStockTransactions.push({
      id: "ftx-1",
      type: "sale",
      batchId: "batch-1",
      inventoryId: "finished-brownie-box",
      quantity: 2,
      occurredAt: "2026-10-12T14:00:00.000Z",
      unitCost: 1000,
      totalCost: 2000,
      sellingPrice: 3600,
      customerId: rich.customers[0].id,
      customerName: rich.customers[0].name,
      paymentMethod: "Cash",
    })
    rich.purchases.push({
      id: "pur-1",
      inventoryId: "flour",
      purchasedQuantity: 2,
      purchasedUnit: "kg",
      usableQuantity: 2,
      usableUnit: "kg",
      usableBaseQuantity: 2000,
      totalPrice: 640,
      date: "2026-10-11",
      note: "Fresh pack",
      createdAt: "2026-10-11T09:00:00.000Z",
    })
    rich.shoppingSelections = { flour: 2000, cocoa: 500 }
    rich.shoppingTrips = [
      {
        id: "trip-1",
        reference: "SHP-1001",
        date: "2026-10-11",
        createdAt: "2026-10-11T09:30:00.000Z",
        totalSpent: 640,
        expenseId: "exp-1",
        items: [
          {
            inventoryId: "flour",
            name: "All-purpose flour",
            category: "ingredient",
            quantity: 2000,
            unit: "g",
            estimatedCost: 640,
            orders: [],
          },
        ],
      },
    ]

    await repo.saveAppData(rich)
    const loaded = await repo.loadAppData()
    expect(loaded).toEqual(rich)
  })

  it("enforces SQLite CHECK, UNIQUE, and FOREIGN KEY constraints", async () => {
    const { engine, repo } = createRepo()
    const starter = migrateState(createStarterData())
    await repo.init()
    await repo.saveAppData(starter)

    // Negative physical stock rejected
    await expect(
      engine.run(
        `INSERT INTO inventory_items (inventory_id, name, physical, unit, category)
         VALUES ('bad-stock', 'Sugar', -10, 'g', 'ingredient')`,
      ),
    ).rejects.toThrow()

    // Duplicate order reference rejected
    await expect(
      engine.run(
        `INSERT INTO orders (
          id, reference, customer_id, customer_name, is_quick_order,
          status, preparation_status, payment_status, collection_date,
          collection_time, instructions, agreed_price, cost_snapshot_json,
          reservations_json, shortages_json, created_at, updated_at
        ) VALUES (
          'dup-order', ?, NULL, 'Walk-in', 1,
          'Draft', 'Not started', 'Unpaid', '2026-10-20',
          '12:00', '', 1000, '{}', '[]', '[]',
          '2026-10-12T00:00:00.000Z', '2026-10-12T00:00:00.000Z'
        )`,
        [starter.orders[0].reference],
      ),
    ).rejects.toThrow()

    // Orphan refund referencing non-existent payment rejected by FOREIGN KEY
    await expect(
      engine.run(
        `INSERT INTO refunds (id, order_id, payment_id, date, amount, reason)
         VALUES ('bad-refund', ?, 'missing-payment-id', '2026-10-12', 500, 'Invalid')`,
        [starter.orders[0].id],
      ),
    ).rejects.toThrow()

    // Non-positive payment rejected
    await expect(
      engine.run(
        `INSERT INTO payments (id, order_id, date, amount, method)
         VALUES ('bad-pay', ?, '2026-10-12', 0, 'Cash')`,
        [starter.orders[0].id],
      ),
    ).rejects.toThrow()
  })

  it("rolls back partial writes cleanly when a transaction fails mid-flight", async () => {
    const { engine, repo } = createRepo()
    const starter = migrateState(createStarterData())
    await repo.init()
    await repo.saveAppData(starter)

    await expect(
      engine.transaction(async () => {
        await engine.run(
          "INSERT INTO customers (id, name, phone, sort_order) VALUES ('cust-temp', 'Temp Customer', '0770000000', 99)",
        )
        await engine.run(
          "INSERT INTO inventory_items (inventory_id, name, physical, unit, category) VALUES ('neg-item', 'Bad', -5, 'g', 'ingredient')",
        )
      }),
    ).rejects.toThrow()

    const loaded = await repo.loadAppData()
    expect(loaded?.customers).toEqual(starter.customers)
  })

  it("deduplicates repeated operations with idempotency keys and persists notifications", async () => {
    const { repo } = createRepo()
    await repo.init()

    expect(await repo.hasIdempotencyKey("prep-1-complete")).toBe(false)
    expect(
      await repo.recordIdempotencyKey("prep-1-complete", "COMPLETE_PREPARATION"),
    ).toBe(true)
    expect(await repo.hasIdempotencyKey("prep-1-complete")).toBe(true)
    expect(
      await repo.recordIdempotencyKey("prep-1-complete", "COMPLETE_PREPARATION"),
    ).toBe(false)

    await repo.saveNotificationPrefs({
      readIds: ["due-order-starter-1"],
      dismissedIds: ["backup-weekly"],
    })
    expect(await repo.loadNotificationPrefs()).toEqual({
      readIds: ["due-order-starter-1"],
      dismissedIds: ["backup-weekly"],
    })
  })

  it("performs one-time import from legacy localStorage while protecting corrupted recovery state", async () => {
    const { repo } = createRepo()
    const starter = migrateState(createStarterData())
    starter.customers[0].name = "Legacy Migrated Customer"
    const { storage, values } = createMemoryStorage({
      [CURRENT_STORAGE_KEY]: serializeAppData(starter),
    })

    const firstBoot = await bootstrapAppRepository({
      repository: repo,
      getLegacyStorage: () => storage,
      getFallbackData: () => migrateState(createStarterData()),
      normalize: migrateState,
    })
    expect(firstBoot.kind).toBe("ready")
    if (firstBoot.kind === "ready") {
      expect(firstBoot.data.customers[0].name).toBe("Legacy Migrated Customer")
    }

    // Even if localStorage is later wiped, SQLite retains the imported records
    values.clear()
    const secondBoot = await bootstrapAppRepository({
      repository: repo,
      getLegacyStorage: () => storage,
      getFallbackData: () => migrateState(createEmptyAppData()),
      normalize: migrateState,
    })
    expect(secondBoot.kind).toBe("ready")
    if (secondBoot.kind === "ready") {
      expect(secondBoot.data.customers[0].name).toBe("Legacy Migrated Customer")
    }

    // Corrupted legacy storage on an empty DB must surface recovery without writing to SQLite
    const { repo: freshRepo } = createRepo()
    const { storage: brokenStorage } = createMemoryStorage({
      [CURRENT_STORAGE_KEY]: "{broken-json",
    })
    const recoveryBoot = await bootstrapAppRepository({
      repository: freshRepo,
      getLegacyStorage: () => brokenStorage,
      getFallbackData: () => migrateState(createStarterData()),
      normalize: migrateState,
    })
    expect(recoveryBoot.kind).toBe("recovery")
    expect(await freshRepo.hasData()).toBe(false)
  })

  it("upgrades v1 SQLite databases cleanly to v2 and round-trips order referencePhoto", async () => {
    const { engine, repo } = createRepo()
    await runMigrations(engine, [migration0001InitialSchema])
    expect(await getAppliedSchemaVersion(engine)).toBe(1)

    // Seed an order directly on v1 schema before v2 migration runs
    await engine.run(
      `INSERT INTO app_settings (
        id, business_name, owner_name, default_labour_rate_per_hour,
        default_pricing_mode, default_margin_percent, default_markup_percent,
        price_rounding_step, default_low_stock_threshold
      ) VALUES (1, 'Udeni''s Specials', 'Udeni', 600, 'margin', 45, 80, 50, 2)`,
    )
    await engine.run(
      `INSERT INTO orders (
        id, reference, customer_id, customer_name, is_quick_order,
        status, preparation_status, payment_status, collection_date,
        collection_time, instructions, agreed_price, cost_snapshot_json,
        reservations_json, shortages_json, created_at, updated_at
      ) VALUES (
        'v1-order', 'US-1001', NULL, 'Walk-in', 1,
        'Draft', 'Not started', 'Unpaid', '2026-10-20',
        '14:00', '', 5000, '{"ingredients":2000,"packaging":200,"labour":300,"estimatedTotal":2500,"suggestedPrice":5000}',
        '[]', '[]', '2026-10-12T08:00:00.000Z', '2026-10-12T08:00:00.000Z'
      )`,
    )

    const upgrade = await runMigrations(engine, ALL_MIGRATIONS)
    expect(upgrade.appliedVersions).toEqual([2, 3])
    expect(upgrade.currentVersion).toBe(3)

    const loadedV1 = await repo.loadAppData()
    expect(loadedV1?.orders[0].id).toBe("v1-order")
    expect(loadedV1?.orders[0].referencePhoto).toBeUndefined()

    const withPhoto = migrateState(createStarterData())
    withPhoto.orders[0].referencePhoto = "media:img-ref-123"
    withPhoto.inventory[0].gramsPerTsp = 3.2
    withPhoto.inventory[0].trackStock = false
    await repo.saveAppData(withPhoto)
    const reloaded = await repo.loadAppData()
    expect(reloaded?.orders[0].referencePhoto).toBe("media:img-ref-123")
    expect(reloaded?.inventory[0].gramsPerTsp).toBe(3.2)
    expect(reloaded?.inventory[0].trackStock).toBe(false)
  })

  it("persists mlPerTsp, tsp/cup purchases, and optional catalog-only ingredients across SQLite reloads", async () => {
    const { repo } = createRepo()
    await repo.init()
    const state = migrateState(createEmptyAppData())
    state.inventory.push({
      inventoryId: "vanilla-ext",
      name: "Vanilla essence",
      physical: 0,
      unit: "ml",
      category: "ingredient",
      averageUnitCost: 3.5,
      mlPerTsp: 4.5,
      trackStock: false,
    })
    state.purchases.push({
      id: "pur-cup-1",
      inventoryId: "vanilla-ext",
      purchasedQuantity: 2,
      purchasedUnit: "cup",
      usableQuantity: 2,
      usableUnit: "cup",
      usableBaseQuantity: 500,
      totalPrice: 1750,
      date: "2026-11-25",
      note: "Bottle",
      createdAt: "2026-11-25T09:00:00.000Z",
    })
    await repo.saveAppData(state)
    const loaded = await repo.loadAppData()
    expect(loaded?.inventory[0]).toMatchObject({
      inventoryId: "vanilla-ext",
      mlPerTsp: 4.5,
      trackStock: false,
    })
    expect(loaded?.purchases[0]).toMatchObject({
      purchasedUnit: "cup",
      usableBaseQuantity: 500,
    })
  })

  it("supports batched saveAppData via runBatch and rolls back if any batch statement fails", async () => {
    const { engine } = createRepo()
    const batchSpy = vi.fn(async (statements: readonly { sql: string; params?: readonly (string | number | null)[] }[]) => {
      for (const stmt of statements) {
        await engine.run(stmt.sql, stmt.params)
      }
    })
    ;(engine as SqliteEngine).runBatch = batchSpy

    const repo = new SqliteAppRepository(engine)
    await repo.init()

    const starter = migrateState(createStarterData())
    await repo.saveAppData(starter)
    expect(batchSpy).toHaveBeenCalledTimes(1)
    expect((await repo.loadAppData())?.orders[0].id).toBe(starter.orders[0].id)

    const invalid = migrateState(createStarterData())
    invalid.inventory[0].physical = -5
    await expect(repo.saveAppData(invalid)).rejects.toThrow()
    expect((await repo.loadAppData())?.inventory[0].physical).toBe(
      starter.inventory[0].physical,
    )
  })
})
