export type SqlParam = string | number | null

export type SqlRow = Record<string, SqlParam>

export type SqlRunResult = {
  changes: number
}

export type SqlStatement = {
  sql: string
  params?: readonly SqlParam[]
}

/**
 * Minimal cross-platform SQLite engine contract shared by Node (`node:sqlite`
 * in automated tests) and Android (`@capacitor-community/sqlite` in Phase 15).
 */
export interface SqliteEngine {
  readonly driverName: "node-sqlite" | "capacitor-sqlite"
  exec(sql: string): Promise<void>
  run(sql: string, params?: readonly SqlParam[]): Promise<SqlRunResult>
  runBatch?(statements: readonly SqlStatement[]): Promise<void>
  query<T extends SqlRow = SqlRow>(
    sql: string,
    params?: readonly SqlParam[],
  ): Promise<T[]>
  transaction<T>(fn: () => Promise<T>): Promise<T>
  close(): Promise<void>
}
