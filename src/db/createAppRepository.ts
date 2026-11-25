import { Capacitor } from "@capacitor/core"
import { CapacitorSqliteEngine } from "./engines/capacitorSqliteEngine"
import { IndexedDbAppRepository } from "./indexedDbRepository"
import type { AppRepository } from "./repository"
import { SqliteAppRepository } from "./sqliteRepository"

/**
 * Selects native on-device SQLite (`@capacitor-community/sqlite`) when running
 * inside the Capacitor Android APK, and IndexedDB when running in Chrome/Web.
 */
export function createDefaultAppRepository(): AppRepository {
  if (Capacitor.isNativePlatform()) {
    return new SqliteAppRepository(new CapacitorSqliteEngine())
  }
  return new IndexedDbAppRepository()
}
