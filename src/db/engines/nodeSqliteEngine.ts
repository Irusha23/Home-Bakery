import { DatabaseSync } from "node:sqlite"
import type { SqliteEngine, SqlParam, SqlRow, SqlRunResult } from "../engine"

/**
 * Node.js built-in `node:sqlite` implementation used by Vitest unit and
 * integration tests. Never import this module from browser entrypoints.
 */
export class NodeSqliteEngine implements SqliteEngine {
  readonly driverName = "node-sqlite" as const
  private readonly db: DatabaseSync
  private transactionDepth = 0
  private savepointCounter = 0

  constructor(filename = ":memory:") {
    this.db = new DatabaseSync(filename)
    this.db.exec("PRAGMA foreign_keys = ON;")
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql)
  }

  async run(
    sql: string,
    params: readonly SqlParam[] = [],
  ): Promise<SqlRunResult> {
    const result = this.db.prepare(sql).run(...params)
    return { changes: Number(result.changes) }
  }

  async query<T extends SqlRow = SqlRow>(
    sql: string,
    params: readonly SqlParam[] = [],
  ): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as unknown as T[]
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.transactionDepth === 0) {
      this.db.exec("BEGIN IMMEDIATE;")
      this.transactionDepth = 1
      try {
        const result = await fn()
        this.db.exec("COMMIT;")
        return result
      } catch (error) {
        this.db.exec("ROLLBACK;")
        throw error
      } finally {
        this.transactionDepth = 0
      }
    }

    const savepoint = `sp_${++this.savepointCounter}`
    this.db.exec(`SAVEPOINT ${savepoint};`)
    this.transactionDepth += 1
    try {
      const result = await fn()
      this.db.exec(`RELEASE SAVEPOINT ${savepoint};`)
      return result
    } catch (error) {
      this.db.exec(`ROLLBACK TO SAVEPOINT ${savepoint};`)
      this.db.exec(`RELEASE SAVEPOINT ${savepoint};`)
      throw error
    } finally {
      this.transactionDepth -= 1
    }
  }

  async close(): Promise<void> {
    this.db.close()
  }
}
