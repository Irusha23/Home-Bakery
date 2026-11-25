import { describe, expect, it, vi } from "vitest"

import { demoData } from "../test/demoFixture"

import { migrateState } from "./AppState"

import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  CURRENT_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
  RECOVERY_STORAGE_PREFIX,
  createBackupEnvelope,
  parseBackup,
  persistAppData,
  readPersistedState,
  restoreBackup,
  serializeAppData,
  serializeBackup,
  startFreshPreservingRaw,
  type StorageLike,
} from "./persistence"

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))

  const storage: StorageLike = {
    getItem: vi.fn((key) => values.get(key) ?? null),

    setItem: vi.fn((key, value) => {
      values.set(key, value)
    }),

    removeItem: vi.fn((key) => {
      values.delete(key)
    }),
  }

  return { storage, values }
}

const load = (storage: StorageLike) =>
  readPersistedState(() => storage, demoData, migrateState)

describe("local persistence recovery", () => {
  it("initializes demo data when all storage keys are empty", () => {
    const { storage } = createStorage()

    const result = load(storage)

    expect(result.kind).toBe("ready")

    if (result.kind !== "ready") return

    expect(result.source).toBe("demo")

    expect(result.data.orders.length).toBeGreaterThan(0)

    expect(result.persistenceEnabled).toBe(true)

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("loads and normalizes valid current data", () => {
    const saved = structuredClone(demoData)

    const { storage } = createStorage({
      [CURRENT_STORAGE_KEY]: serializeAppData(saved),
    })

    const result = load(storage)

    expect(result.kind).toBe("ready")

    if (result.kind !== "ready") return

    expect(result.source).toBe("current")

    expect(result.data.orders).toEqual(migrateState(saved).orders)

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("loads legacy saved data without a refunds collection as empty refund history", () => {
    const legacyData = JSON.parse(
      JSON.stringify(demoData),
    ) as Record<string, unknown>

    delete legacyData.refunds

    const { storage } = createStorage({
      [CURRENT_STORAGE_KEY]: JSON.stringify(legacyData),
    })

    const result = load(storage)

    expect(result.kind).toBe("ready")

    if (result.kind !== "ready") return

    expect(result.data.refunds).toEqual([])
  })

  it("loads v5 local data without expense collections using safe defaults", () => {
    const legacyData = JSON.parse(
      JSON.stringify(demoData),
    ) as Record<string, unknown>

    legacyData.schemaVersion = 5

    delete legacyData.expenseCategories

    delete legacyData.expenses

    delete legacyData.expenseAllocationHistories

    const raw = JSON.stringify(legacyData)

    const { storage, values } = createStorage({
      [LEGACY_STORAGE_KEYS[0]]: raw,
    })

    const result = load(storage)

    expect(result.kind).toBe("ready")

    if (result.kind !== "ready") return

    expect(result.source).toBe("legacy")

    expect(result.data.expenseCategories).toEqual(
      demoData.expenseCategories,
    )

    expect(result.data.expenses).toEqual([])

    expect(result.data.expenseAllocationHistories).toEqual([])

    expect(values.get(LEGACY_STORAGE_KEYS[0])).toBe(raw)
  })

  it("preserves malformed v6 expense data in recovery instead of repairing it", () => {
    const malformed = structuredClone(demoData)

    malformed.expenses.push({
      id: "invalid-expense",

      amount: 10.5,

      paidDate: "2026-10-12",

      categoryId: "expense-category-other",

      description: "Fractional amount",

      attribution: { type: "shared" },

      createdAt: "2026-10-12T08:00:00.000Z",
    })

    const raw = serializeAppData(malformed)

    const { storage } = createStorage({ [CURRENT_STORAGE_KEY]: raw })

    const result = load(storage)

    expect(result.kind).toBe("recovery")

    if (result.kind !== "recovery") return

    expect(result.raw).toBe(raw)

    expect(result.message).toContain(
      "Expense amount must be a positive whole-LKR amount.",
    )

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("migrates recognized legacy data without altering its source value", () => {
    const legacyRaw = JSON.stringify(demoData)

    const { storage, values } = createStorage({
      [LEGACY_STORAGE_KEYS[0]]: legacyRaw,
    })

    const result = load(storage)

    expect(result.kind).toBe("ready")

    if (result.kind !== "ready") return

    expect(result.source).toBe("legacy")

    expect(result.data.orders).toEqual(migrateState(demoData).orders)

    expect(values.get(LEGACY_STORAGE_KEYS[0])).toBe(legacyRaw)

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("preserves malformed JSON and does not write any storage key", () => {
    const raw = "{unreadable"

    const { storage } = createStorage({
      [CURRENT_STORAGE_KEY]: raw,
    })

    const result = load(storage)

    expect(result.kind).toBe("recovery")

    if (result.kind !== "recovery") return

    expect(result.key).toBe(CURRENT_STORAGE_KEY)

    expect(result.raw).toBe(raw)

    expect(result.message).toContain("preserved")

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("preserves valid JSON with an invalid shape or unsupported schema", () => {
    const invalidValues = [
      JSON.stringify({ orders: [], recipes: [], inventory: {} }),

      JSON.stringify({ ...demoData, schemaVersion: 99 }),
    ]

    for (const raw of invalidValues) {
      const { storage } = createStorage({
        [CURRENT_STORAGE_KEY]: raw,
      })

      const result = load(storage)

      expect(result.kind).toBe("recovery")

      if (result.kind !== "recovery") throw new Error("Expected recovery state")

      expect(result.raw).toBe(raw)

      expect(result.message).toContain("invalid or unsupported structure")

      expect(storage.setItem).not.toHaveBeenCalled()
    }
  })

  it("enters recovery when storage reads throw", () => {
    const storage = createStorage().storage

    vi.mocked(storage.getItem).mockImplementation(() => {
      throw new Error("blocked")
    })

    const result = load(storage)

    expect(result.kind).toBe("recovery")

    if (result.kind !== "recovery") return

    expect(result.raw).toBeNull()

    expect(result.message).toContain("could not be read")

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("does not persist when a storage write fails", () => {
    const storage = createStorage().storage

    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new Error("quota exceeded")
    })

    expect(() => persistAppData(() => storage, demoData)).toThrow(
      "quota exceeded",
    )

    expect(storage.setItem).toHaveBeenCalledTimes(1)

    expect(storage.setItem).toHaveBeenCalledWith(
      CURRENT_STORAGE_KEY,

      serializeAppData(demoData),
    )
  })

  it("does not write to the original key while recovery is unresolved", () => {
    const raw = "not-json"

    const { storage } = createStorage({
      [CURRENT_STORAGE_KEY]: raw,
    })

    const result = load(storage)

    expect(result.kind).toBe("recovery")

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("starts fresh only after preserving and verifying the original raw value", () => {
    const raw = "{damaged saved data"

    const { storage, values } = createStorage({
      [CURRENT_STORAGE_KEY]: raw,
    })

    const recovery = load(storage)

    expect(recovery.kind).toBe("recovery")

    if (recovery.kind !== "recovery") return

    const result = startFreshPreservingRaw(
      recovery,

      () => storage,

      demoData,

      migrateState,

      "test-id",
    )

    expect(result.kind).toBe("ready")

    expect(values.get(`${RECOVERY_STORAGE_PREFIX}test-id`)).toBe(raw)

    expect(values.get(CURRENT_STORAGE_KEY)).toBe(
      serializeAppData(migrateState(demoData)),
    )
  })

  it("does not replace the source when preserving it fails", () => {
    const raw = "not-json"

    const { storage, values } = createStorage({
      [CURRENT_STORAGE_KEY]: raw,
    })

    const recovery = load(storage)

    expect(recovery.kind).toBe("recovery")

    if (recovery.kind !== "recovery") return

    vi.mocked(storage.setItem).mockImplementation((key, value) => {
      if (key.startsWith(RECOVERY_STORAGE_PREFIX)) {
        throw new Error("write blocked")
      }

      values.set(key, value)
    })

    const result = startFreshPreservingRaw(
      recovery,

      () => storage,

      demoData,

      migrateState,

      "failed-test",
    )

    expect(result.kind).toBe("recovery")

    if (result.kind !== "recovery") throw new Error("Expected recovery state")

    expect(values.get(CURRENT_STORAGE_KEY)).toBe(raw)

    expect(result.message).toContain("safely preserved")
  })

  it("loads successfully on retry after storage becomes readable", () => {
    const storage = createStorage({
      [CURRENT_STORAGE_KEY]: serializeAppData(demoData),
    }).storage

    vi.mocked(storage.getItem).mockImplementationOnce(() => {
      throw new Error("temporarily unavailable")
    })

    const firstAttempt = load(storage)

    expect(firstAttempt.kind).toBe("recovery")

    const retry = load(storage)

    expect(retry.kind).toBe("ready")

    if (retry.kind !== "ready") return

    expect(retry.source).toBe("current")
  })

  it("exports a versioned round-trip containing every application collection", () => {
    const exportedAt = "2026-10-12T18:26:07.241Z"

    const backup = createBackupEnvelope(demoData, exportedAt)

    const raw = serializeBackup(demoData, exportedAt)

    const restored = parseBackup(raw)

    expect(backup).toMatchObject({
      format: BACKUP_FORMAT,

      backupSchemaVersion: BACKUP_SCHEMA_VERSION,

      exportedAt,
    })

    expect(Object.keys(backup.data).sort()).toEqual(
      Object.keys(demoData).sort(),
    )

    expect(restored).toEqual(demoData)
  })

  it("round-trips expense categories, records, and every allocation version", () => {
    const data = structuredClone(demoData)

    const order = data.orders.find(
      (item) => !item.isQuickOrder && item.customerId !== null,
    )

    expect(order).toBeDefined()

    if (!order) return

    data.expenseCategories.push({
      id: "custom-category-delivery",

      name: "Delivery",

      source: "custom",
    })

    data.expenses.push({
      id: "expense-shared-1",

      amount: 12000,

      paidDate: "2026-10-12",

      categoryId: "expense-category-utilities",

      description: "October electricity bill",

      attribution: { type: "shared" },

      createdAt: "2026-10-12T08:00:00.000Z",
    })

    data.expenseAllocationHistories.push({
      expenseId: "expense-shared-1",

      versions: [
        {
          id: "allocation-version-1",

          expenseId: "expense-shared-1",

          version: 1,

          createdAt: "2026-10-13T08:00:00.000Z",

          allocations: [
            {
              id: "allocation-entry-1",

              orderId: order.id,

              amount: 4000,
            },
          ],
        },

        {
          id: "allocation-version-2",

          expenseId: "expense-shared-1",

          version: 2,

          createdAt: "2026-10-14T08:00:00.000Z",

          reason: "Updated allocation",

          allocations: [
            {
              id: "allocation-entry-2",

              orderId: order.id,

              amount: 6000,
            },
          ],
        },
      ],
    })

    expect(parseBackup(serializeBackup(data))).toEqual(data)
  })

  it("accepts valid refund history in a backup", () => {
    const data = structuredClone(demoData)

    const order = data.orders.find((item) => item.payments.length > 0)

    expect(order).toBeDefined()

    if (!order) return

    const payment = order.payments[0]

    data.refunds.push({
      id: "backup-refund",

      orderId: order.id,

      paymentId: payment.id,

      date: "2026-10-13",

      amount: 1000,

      reason: "Customer return",
    })

    order.paymentStatus = "Unpaid"

    const restored = parseBackup(serializeBackup(data))

    expect(restored.refunds).toEqual(data.refunds)

    expect(
      restored.orders.find((item) => item.id === order.id)?.paymentStatus,
    ).toBe("Part paid")
  })

  it("accepts a v1 backup without refund or expense collections", () => {
    const data = JSON.parse(JSON.stringify(demoData)) as Record<string, unknown>

    delete data.refunds

    delete data.expenseCategories

    delete data.expenses

    delete data.expenseAllocationHistories

    const raw = JSON.stringify({
      format: BACKUP_FORMAT,

      backupSchemaVersion: 1,

      exportedAt: "2026-10-13T00:00:00.000Z",

      data,
    })

    const restored = parseBackup(raw)

    expect(restored.refunds).toEqual([])

    expect(restored.expenseCategories).toEqual(demoData.expenseCategories)

    expect(restored.expenses).toEqual([])

    expect(restored.expenseAllocationHistories).toEqual([])
  })

  it.each([
    [
      "fractional expense amount",
      (data: typeof demoData) => {
        data.expenses.push({
          id: "invalid-expense",

          amount: 10.5,

          paidDate: "2026-10-12",

          categoryId: "expense-category-other",

          description: "Invalid amount",

          attribution: { type: "shared" },

          createdAt: "2026-10-12T08:00:00.000Z",
        })
      },
    ],

    [
      "missing expense category",
      (data: typeof demoData) => {
        data.expenses.push({
          id: "invalid-expense",

          amount: 100,

          paidDate: "2026-10-12",

          categoryId: "missing-category",

          description: "Missing category",

          attribution: { type: "shared" },

          createdAt: "2026-10-12T08:00:00.000Z",
        })
      },
    ],

    [
      "missing built-in category",
      (data: typeof demoData) => {
        data.expenseCategories = data.expenseCategories.filter(
          (category) => category.id !== "expense-category-other",
        )
      },
    ],

    [
      "missing direct order",
      (data: typeof demoData) => {
        data.expenses.push({
          id: "invalid-expense",

          amount: 100,

          paidDate: "2026-10-12",

          categoryId: "expense-category-other",

          description: "Missing order",

          attribution: { type: "direct", orderId: "missing-order" },

          createdAt: "2026-10-12T08:00:00.000Z",
        })
      },
    ],

    [
      "allocation over source amount",
      (data: typeof demoData) => {
        const order = data.orders.find(
          (item) => !item.isQuickOrder && item.customerId !== null,
        )!

        data.expenses.push({
          id: "shared-expense",

          amount: 1000,

          paidDate: "2026-10-12",

          categoryId: "expense-category-other",

          description: "Shared expense",

          attribution: { type: "shared" },

          createdAt: "2026-10-12T08:00:00.000Z",
        })

        data.expenseAllocationHistories.push({
          expenseId: "shared-expense",

          versions: [
            {
              id: "allocation-version-1",

              expenseId: "shared-expense",

              version: 1,

              createdAt: "2026-10-13T08:00:00.000Z",

              allocations: [
                {
                  id: "allocation-entry-1",

                  orderId: order.id,

                  amount: 1001,
                },
              ],
            },
          ],
        })
      },
    ],

    [
      "skipped allocation version",
      (data: typeof demoData) => {
        const order = data.orders.find(
          (item) => !item.isQuickOrder && item.customerId !== null,
        )!

        data.expenses.push({
          id: "shared-expense",

          amount: 1000,

          paidDate: "2026-10-12",

          categoryId: "expense-category-other",

          description: "Shared expense",

          attribution: { type: "shared" },

          createdAt: "2026-10-12T08:00:00.000Z",
        })

        data.expenseAllocationHistories.push({
          expenseId: "shared-expense",

          versions: [
            {
              id: "allocation-version-2",

              expenseId: "shared-expense",

              version: 2,

              createdAt: "2026-10-13T08:00:00.000Z",

              allocations: [
                {
                  id: "allocation-entry-1",

                  orderId: order.id,

                  amount: 500,
                },
              ],
            },
          ],
        })
      },
    ],

    [
      "unknown allocation order",
      (data: typeof demoData) => {
        data.expenses.push({
          id: "shared-expense",

          amount: 1000,

          paidDate: "2026-10-12",

          categoryId: "expense-category-other",

          description: "Shared expense",

          attribution: { type: "shared" },

          createdAt: "2026-10-12T08:00:00.000Z",
        })

        data.expenseAllocationHistories.push({
          expenseId: "shared-expense",

          versions: [
            {
              id: "allocation-version-1",

              expenseId: "shared-expense",

              version: 1,

              createdAt: "2026-10-13T08:00:00.000Z",

              allocations: [
                {
                  id: "allocation-entry-1",

                  orderId: "missing-order",

                  amount: 500,
                },
              ],
            },
          ],
        })
      },
    ],

    [
      "allocation against a direct expense",
      (data: typeof demoData) => {
        const order = data.orders.find(
          (item) => !item.isQuickOrder && item.customerId !== null,
        )!

        data.expenses.push({
          id: "direct-expense",

          amount: 1000,

          paidDate: "2026-10-12",

          categoryId: "expense-category-other",

          description: "Direct expense",

          attribution: { type: "direct", orderId: order.id },

          createdAt: "2026-10-12T08:00:00.000Z",
        })

        data.expenseAllocationHistories.push({
          expenseId: "direct-expense",

          versions: [
            {
              id: "allocation-version-1",

              expenseId: "direct-expense",

              version: 1,

              createdAt: "2026-10-13T08:00:00.000Z",

              allocations: [
                {
                  id: "allocation-entry-1",

                  orderId: order.id,

                  amount: 500,
                },
              ],
            },
          ],
        })
      },
    ],
  ])("rejects a backup with %s", (_label, corrupt) => {
    const data = structuredClone(demoData)

    corrupt(data)

    expect(() => createBackupEnvelope(data)).toThrow()
  })

  it.each([
    [
      "wrong order",
      (data: typeof demoData) => {
        const order = data.orders.find((item) => item.payments.length > 0)!

        data.refunds.push({
          id: "invalid-refund",

          orderId: "missing-order",

          paymentId: order.payments[0].id,

          date: "2026-10-13",

          amount: 1,

          reason: "Invalid link",
        })
      },
    ],

    [
      "missing payment",
      (data: typeof demoData) => {
        const order = data.orders.find((item) => item.payments.length > 0)!

        data.refunds.push({
          id: "invalid-refund",

          orderId: order.id,

          paymentId: "missing-payment",

          date: "2026-10-13",

          amount: 1,

          reason: "Invalid link",
        })
      },
    ],

    [
      "over-refund",
      (data: typeof demoData) => {
        const order = data.orders.find((item) => item.payments.length > 0)!

        const payment = order.payments[0]

        data.refunds.push({
          id: "invalid-refund",

          orderId: order.id,

          paymentId: payment.id,

          date: "2026-10-13",

          amount: payment.amount + 1,

          reason: "Too much",
        })
      },
    ],

    [
      "fractional refund",
      (data: typeof demoData) => {
        const order = data.orders.find((item) => item.payments.length > 0)!

        data.refunds.push({
          id: "invalid-refund",

          orderId: order.id,

          paymentId: order.payments[0].id,

          date: "2026-10-13",

          amount: 1.5,

          reason: "Invalid amount",
        })
      },
    ],

    [
      "duplicate refund ID",
      (data: typeof demoData) => {
        const order = data.orders.find((item) => item.payments.length > 0)!

        const refund = {
          id: "duplicate-refund",

          orderId: order.id,

          paymentId: order.payments[0].id,

          date: "2026-10-13",

          amount: 1,

          reason: "First refund",
        }

        data.refunds.push(refund, { ...refund })
      },
    ],
  ])("rejects backups with a %s", (_label, corrupt) => {
    const data = structuredClone(demoData)

    corrupt(data)

    const raw = JSON.stringify({
      format: BACKUP_FORMAT,

      backupSchemaVersion: BACKUP_SCHEMA_VERSION,

      exportedAt: "2026-10-13T00:00:00.000Z",

      data,
    })

    expect(() => parseBackup(raw)).toThrow()
  })

  it.each([
    ["invalid JSON", "{"],

    [
      "wrong format",

      JSON.stringify({
        format: "other-app",

        backupSchemaVersion: BACKUP_SCHEMA_VERSION,

        exportedAt: "2026-10-12T00:00:00.000Z",

        data: demoData,
      }),
    ],

    [
      "older schema",

      JSON.stringify({
        format: BACKUP_FORMAT,

        backupSchemaVersion: BACKUP_SCHEMA_VERSION - 2,

        exportedAt: "2026-10-12T00:00:00.000Z",

        data: demoData,
      }),
    ],

    [
      "future schema",

      JSON.stringify({
        format: BACKUP_FORMAT,

        backupSchemaVersion: BACKUP_SCHEMA_VERSION + 1,

        exportedAt: "2026-10-12T00:00:00.000Z",

        data: demoData,
      }),
    ],

    [
      "missing collection",

      JSON.stringify({
        format: BACKUP_FORMAT,

        backupSchemaVersion: BACKUP_SCHEMA_VERSION,

        exportedAt: "2026-10-12T00:00:00.000Z",

        data: { ...demoData, shoppingSelections: undefined },
      }),
    ],

    [
      "invalid collection type",

      JSON.stringify({
        format: BACKUP_FORMAT,

        backupSchemaVersion: BACKUP_SCHEMA_VERSION,

        exportedAt: "2026-10-12T00:00:00.000Z",

        data: { ...demoData, orders: {} },
      }),
    ],

    [
      "invalid identifier",

      JSON.stringify({
        format: BACKUP_FORMAT,

        backupSchemaVersion: BACKUP_SCHEMA_VERSION,

        exportedAt: "2026-10-12T00:00:00.000Z",

        data: {
          ...demoData,

          customers: [{ ...demoData.customers[0], id: "" }],
        },
      }),
    ],

    [
      "invalid cross-record reference",

      JSON.stringify({
        format: BACKUP_FORMAT,

        backupSchemaVersion: BACKUP_SCHEMA_VERSION,

        exportedAt: "2026-10-12T00:00:00.000Z",

        data: {
          ...demoData,

          orders: [
            {
              ...demoData.orders[0],

              customerId: "missing-customer",
            },

            ...demoData.orders.slice(1),
          ],
        },
      }),
    ],
  ])("rejects %s without changing storage", (_label, raw) => {
    const previous = serializeAppData(demoData)

    const { storage, values } = createStorage({
      [CURRENT_STORAGE_KEY]: previous,
    })

    const currentInMemoryData = structuredClone(demoData)

    const result = restoreBackup(() => storage, raw)

    expect(result.ok).toBe(false)

    expect(values.get(CURRENT_STORAGE_KEY)).toBe(previous)

    expect(currentInMemoryData).toEqual(demoData)

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("does not commit when restore confirmation is cancelled", () => {
    const previous = serializeAppData(demoData)

    const { storage, values } = createStorage({
      [CURRENT_STORAGE_KEY]: previous,
    })

    const currentState = structuredClone(demoData)

    const parsedForReview = parseBackup(serializeBackup(demoData))

    const confirmed = false

    if (confirmed)
      restoreBackup(() => storage, serializeBackup(parsedForReview))

    expect(currentState).toEqual(demoData)

    expect(values.get(CURRENT_STORAGE_KEY)).toBe(previous)

    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("updates in-memory data only after the restored envelope is persisted", () => {
    const priorData = structuredClone(demoData)

    const backupData = structuredClone(demoData)

    backupData.customers[0].name = "Restored customer"

    const previousRaw = serializeAppData(priorData)

    const { storage, values } = createStorage({
      [CURRENT_STORAGE_KEY]: previousRaw,
    })

    let currentState = priorData

    const result = restoreBackup(
      () => storage,

      serializeBackup(backupData),

      undefined,

      "restore-success",
    )

    if (result.ok) currentState = result.data

    expect(result.ok).toBe(true)

    expect(currentState).toEqual(backupData)

    expect(values.get(CURRENT_STORAGE_KEY)).toBe(serializeAppData(backupData))

    expect(values.get(`${RECOVERY_STORAGE_PREFIX}restore-success`)).toBe(
      previousRaw,
    )
  })

  it("keeps current data and storage when the restored write fails", () => {
    const priorData = structuredClone(demoData)

    const backupData = structuredClone(demoData)

    backupData.customers[0].name = "Not committed"

    const previousRaw = serializeAppData(priorData)

    const { storage, values } = createStorage({
      [CURRENT_STORAGE_KEY]: previousRaw,
    })

    let rejectRestoreWrite = true

    vi.mocked(storage.setItem).mockImplementation((key, value) => {
      if (key === CURRENT_STORAGE_KEY && rejectRestoreWrite) {
        rejectRestoreWrite = false

        throw new Error("simulated quota failure")
      }

      values.set(key, value)
    })

    let currentState = priorData

    const result = restoreBackup(
      () => storage,

      serializeBackup(backupData),

      undefined,

      "restore-failure",
    )

    if (result.ok) currentState = result.data

    expect(result.ok).toBe(false)

    expect(currentState).toEqual(priorData)

    expect(values.get(CURRENT_STORAGE_KEY)).toBe(previousRaw)

    expect(values.get(`${RECOVERY_STORAGE_PREFIX}restore-failure`)).toBe(
      previousRaw,
    )
  })

  it("preserves recovery-source data before restoring a valid backup", () => {
    const preservedRaw = "{corrupt legacy value"

    const { storage, values } = createStorage()

    const result = restoreBackup(
      () => storage,

      serializeBackup(demoData),

      { key: LEGACY_STORAGE_KEYS[0], raw: preservedRaw },

      "restore-from-recovery",
    )

    expect(result.ok).toBe(true)

    expect(values.get(`${RECOVERY_STORAGE_PREFIX}restore-from-recovery`)).toBe(
      preservedRaw,
    )

    expect(values.get(LEGACY_STORAGE_KEYS[0])).toBeUndefined()

    expect(values.get(CURRENT_STORAGE_KEY)).toBe(
      serializeAppData(demoData),
    )
  })

  it("preserves a legacy active storage value before replacing it", () => {
    const legacyRaw = JSON.stringify(demoData)

    const { storage, values } = createStorage({
      [LEGACY_STORAGE_KEYS[0]]: legacyRaw,
    })

    const result = restoreBackup(
      () => storage,

      serializeBackup(demoData),

      undefined,

      "restore-legacy-active",
    )

    expect(result.ok).toBe(true)

    expect(values.get(`${RECOVERY_STORAGE_PREFIX}restore-legacy-active`)).toBe(
      legacyRaw,
    )

    expect(values.get(LEGACY_STORAGE_KEYS[0])).toBe(legacyRaw)

    expect(values.get(CURRENT_STORAGE_KEY)).toBe(serializeAppData(demoData))
  })

  it("does not commit when preservation of the recovery source fails", () => {
    const { storage, values } = createStorage()

    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new Error("storage full")
    })

    const result = restoreBackup(
      () => storage,

      serializeBackup(demoData),

      { key: LEGACY_STORAGE_KEYS[0], raw: "{corrupt" },

      "restore-preserve-failure",
    )

    expect(result.ok).toBe(false)

    expect(values.has(CURRENT_STORAGE_KEY)).toBe(false)

    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  it("migrates v6 local storage data without settings using safe defaults", () => {
    const legacyState = structuredClone(
      demoData,
    ) as unknown as Record<string, unknown>

    delete legacyState.settings

    const legacyRaw = JSON.stringify({ ...legacyState, schemaVersion: 6 })

    const { storage } = createStorage({
      "udenis-specials-demo-v6": legacyRaw,
    })

    const result = readPersistedState(() => storage, demoData, migrateState)

    expect(result.kind).toBe("ready")

    if (result.kind === "ready") {
      expect(result.source).toBe("legacy")

      expect(result.data.settings).toEqual(demoData.settings)
    }
  })

  it("round-trips custom settings in backups and backfills missing settings from legacy backups", () => {
    const customData = {
      ...structuredClone(demoData),

      settings: {
        ...demoData.settings,

        businessName: "Sweet Moments Bakery",

        defaultLabourRatePerHour: 750,

        defaultPricingMode: "markup" as const,

        priceRoundingStep: 100 as const,
      },
    }

    const parsed = parseBackup(serializeBackup(customData))

    expect(parsed.settings.businessName).toBe("Sweet Moments Bakery")

    expect(parsed.settings.defaultLabourRatePerHour).toBe(750)

    expect(parsed.settings.defaultPricingMode).toBe("markup")

    expect(parsed.settings.priceRoundingStep).toBe(100)

    const envelope = createBackupEnvelope(demoData) as unknown as {
      format: string

      backupSchemaVersion: number

      exportedAt: string

      data: Record<string, unknown>
    }

    delete envelope.data.settings

    const restored = parseBackup(JSON.stringify(envelope))

    expect(restored.settings).toEqual(demoData.settings)
  })

  it("rejects backups with invalid settings values", () => {
    const envelope = createBackupEnvelope(demoData)

    envelope.data.settings.defaultMarginPercent = 100

    expect(() => parseBackup(JSON.stringify(envelope))).toThrow()
  })

  it("rejects backups with unsafe or malformed image references", () => {
    const envelope = createBackupEnvelope(demoData)
    envelope.data.orders[0].referencePhoto = "javascript:alert(1)"
    expect(() => parseBackup(JSON.stringify(envelope))).toThrow()
  })

  it("round-trips standalone recipes with no linked product", () => {
    const custom = createBackupEnvelope(demoData).data
    const standalone = {
      ...custom.recipes[0],
      id: "recipe-standalone",
      name: "Mango chutney",
      productId: "",
      variantId: "",
      yieldLabel: "3 jars",
      sellingPrice: 1850,
      pricing: {
        mode: "markup" as const,
        marginPercent: 35,
        markupPercent: 60,
        labourRatePerHour: 500,
        roundingStep: 50 as const,
      },
    }
    const nextData = {
      ...custom,
      products: [],
      orders: [],
      preparationRecords: [],
      extraStockPlans: [],
      extraStockPreparations: [],
      finishedStockBatches: [],
      finishedStockTransactions: [],
      recipes: [standalone],
    }
    const parsed = parseBackup(serializeBackup(nextData))
    expect(parsed.recipes).toHaveLength(1)
    expect(parsed.recipes[0].productId).toBe("")
    expect(parsed.recipes[0].variantId).toBe("")
    expect(parsed.recipes[0].sellingPrice).toBe(1850)
    expect(parsed.recipes[0].pricing?.markupPercent).toBe(60)
  })
})
