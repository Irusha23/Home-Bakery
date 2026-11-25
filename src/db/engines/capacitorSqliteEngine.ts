import { CapacitorSQLite } from "@capacitor-community/sqlite"
import type {
  SqliteEngine,
  SqlParam,
  SqlRow,
  SqlRunResult,
  SqlStatement,
} from "../engine"

const DEFAULT_DB_NAME = "udenis_specials"

/**
 * On-device Android SQLite implementation wrapping `@capacitor-community/sqlite`.
 * Enables foreign-key enforcement and WAL journaling for crash resilience.
 */
export class CapacitorSqliteEngine implements SqliteEngine {
  readonly driverName = "capacitor-sqlite" as const
  private opened = false
  private openPromise: Promise<void> | null = null
  private transactionDepth = 0
  private savepointCounter = 0

  constructor(private readonly database = DEFAULT_DB_NAME) {}

  private async ensureOpen(): Promise<void> {
    if (this.opened) return
    if (this.openPromise) {
      await this.openPromise
      return
    }

    this.openPromise = (async () => {
      try {
        await CapacitorSQLite.createConnection({
          database: this.database,
          version: 1,
          encrypted: false,
          mode: "no-encryption",
          readonly: false,
        })
      } catch {
        // Connection may already exist across hot-reloads; verify with open()
      }
      await CapacitorSQLite.open({
        database: this.database,
        readonly: false,
      })
      await CapacitorSQLite.execute({
        database: this.database,
        statements: "PRAGMA foreign_keys = ON;",
        transaction: false,
      })
      try {
        // Android SQLite/SQLCipher forbids row-returning PRAGMAs in execSQL();
        // PRAGMA journal_mode = WAL returns the active mode row and must use query().
        await CapacitorSQLite.query({
          database: this.database,
          statement: "PRAGMA journal_mode = WAL;",
          values: [],
        })
      } catch {
        // Best-effort: continue with default journal mode if WAL cannot be enabled
      }
      this.opened = true
    })().finally(() => {
      this.openPromise = null
    })

    await this.openPromise
  }

  async exec(sql: string): Promise<void> {
    await this.ensureOpen()
    await CapacitorSQLite.execute({
      database: this.database,
      statements: sql,
      transaction: false,
    })
  }

  async run(
    sql: string,
    params: readonly SqlParam[] = [],
  ): Promise<SqlRunResult> {
    await this.ensureOpen()
    const result = await CapacitorSQLite.run({
      database: this.database,
      statement: sql,
      values: [...params],
      transaction: false,
    })
    return { changes: Number(result.changes?.changes ?? 0) }
  }

  async runBatch(statements: readonly SqlStatement[]): Promise<void> {
    if (statements.length === 0) return
    await this.ensureOpen()
    const chunkSize = 250
    for (let i = 0; i < statements.length; i += chunkSize) {
      const chunk = statements.slice(i, i + chunkSize)
      await CapacitorSQLite.executeSet({
        database: this.database,
        set: chunk.map((stmt) => ({
          statement: stmt.sql,
          values: [...(stmt.params ?? [])],
        })),
        transaction: false,
      })
    }
  }

  async query<T extends SqlRow = SqlRow>(
    sql: string,
    params: readonly SqlParam[] = [],
  ): Promise<T[]> {
    await this.ensureOpen()
    const result = await CapacitorSQLite.query({
      database: this.database,
      statement: sql,
      values: [...params],
    })
    return (result.values ?? []) as T[]
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureOpen()

    if (this.transactionDepth === 0) {
      await CapacitorSQLite.beginTransaction({ database: this.database })
      this.transactionDepth = 1
      try {
        const result = await fn()
        await CapacitorSQLite.commitTransaction({ database: this.database })
        return result
      } catch (error) {
        await CapacitorSQLite.rollbackTransaction({
          database: this.database,
        }).catch(() => undefined)
        throw error
      } finally {
        this.transactionDepth = 0
      }
    }

    const savepoint = `sp_${++this.savepointCounter}`
    await this.exec(`SAVEPOINT ${savepoint};`)
    this.transactionDepth += 1
    try {
      const result = await fn()
      await this.exec(`RELEASE SAVEPOINT ${savepoint};`)
      return result
    } catch (error) {
      await this.exec(`ROLLBACK TO SAVEPOINT ${savepoint};`).catch(
        () => undefined,
      )
      await this.exec(`RELEASE SAVEPOINT ${savepoint};`).catch(() => undefined)
      throw error
    } finally {
      this.transactionDepth -= 1
    }
  }

  async close(): Promise<void> {
    if (!this.opened) return
    await CapacitorSQLite.close({ database: this.database }).catch(
      () => undefined,
    )
    await CapacitorSQLite.closeConnection({ database: this.database }).catch(
      () => undefined,
    )
    this.opened = false
  }
}
