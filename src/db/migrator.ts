import type { SqliteEngine } from "./engine"
import {
  migration0001InitialSchema,
  type SqlMigration,
} from "./migrations/0001_initial_schema"
import { migration0002OrderReferencePhoto } from "./migrations/0002_order_reference_photo"

export const ALL_MIGRATIONS: readonly SqlMigration[] = [
  migration0001InitialSchema,
  migration0002OrderReferencePhoto,
]

export const LATEST_DB_SCHEMA_VERSION =
  ALL_MIGRATIONS[ALL_MIGRATIONS.length - 1]?.version ?? 0

const CREATE_MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);`

export type MigrationRunResult = {
  currentVersion: number
  appliedVersions: number[]
}

export async function getAppliedSchemaVersion(
  engine: SqliteEngine,
): Promise<number> {
  await engine.exec(CREATE_MIGRATIONS_TABLE_SQL)
  const rows = await engine.query<{ max_version: number | null }>(
    "SELECT MAX(version) AS max_version FROM schema_migrations",
  )
  const maxVersion = rows[0]?.max_version
  return typeof maxVersion === "number" ? maxVersion : 0
}

/**
 * Applies all pending numbered migrations in ascending version order inside
 * explicit transactions. Safe across repeated boots and `.apk` in-place upgrades.
 */
export async function runMigrations(
  engine: SqliteEngine,
  migrations: readonly SqlMigration[] = ALL_MIGRATIONS,
): Promise<MigrationRunResult> {
  await engine.exec("PRAGMA foreign_keys = ON;")
  await engine.exec(CREATE_MIGRATIONS_TABLE_SQL)

  const appliedRows = await engine.query<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version ASC",
  )
  const appliedSet = new Set(appliedRows.map((row) => Number(row.version)))
  const ordered = [...migrations].sort((a, b) => a.version - b.version)
  const appliedVersions: number[] = []

  for (const migration of ordered) {
    if (appliedSet.has(migration.version)) continue

    await engine.transaction(async () => {
      await engine.exec(migration.sql)
      await engine.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [migration.version, migration.name, new Date().toISOString()],
      )
    })
    appliedVersions.push(migration.version)
  }

  const currentVersion = await getAppliedSchemaVersion(engine)
  return { currentVersion, appliedVersions }
}
