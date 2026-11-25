import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSqlite = vi.hoisted(() => ({
  createConnection: vi.fn(async () => undefined),
  open: vi.fn(async () => undefined),
  execute: vi.fn(async () => ({ changes: { changes: 0 } })),
  query: vi.fn(async () => ({ values: [{ journal_mode: "wal" }] })),
  run: vi.fn(async () => ({ changes: { changes: 1 } })),
  executeSet: vi.fn(async () => ({ changes: { changes: 1 } })),
  close: vi.fn(async () => undefined),
}))

vi.mock("@capacitor-community/sqlite", () => ({
  CapacitorSQLite: mockSqlite,
}))

import { CapacitorSqliteEngine } from "./capacitorSqliteEngine"

describe("CapacitorSqliteEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("enables WAL mode via query() rather than execute() so Android SQLite does not throw", async () => {
    const engine = new CapacitorSqliteEngine("test_bakery")
    await engine.query("SELECT 1")

    expect(mockSqlite.open).toHaveBeenCalledWith({
      database: "test_bakery",
      readonly: false,
    })
    expect(mockSqlite.execute).toHaveBeenCalledWith({
      database: "test_bakery",
      statements: "PRAGMA foreign_keys = ON;",
      transaction: false,
    })
    expect(mockSqlite.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({
        statements: expect.stringContaining("journal_mode"),
      }),
    )
    expect(mockSqlite.query).toHaveBeenCalledWith({
      database: "test_bakery",
      statement: "PRAGMA journal_mode = WAL;",
      values: [],
    })
  })
})
