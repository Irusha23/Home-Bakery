import { IndexedDbAppRepository } from "./indexedDbRepository"
import type { AppRepository } from "./repository"

/**
 * Creates the browser-safe default `AppRepository` (`IndexedDbAppRepository`).
 * In Phase 15 (Capacitor Android), native platform detection will select
 * `new SqliteAppRepository(new CapacitorSqliteEngine())` on Android devices.
 */
export function createDefaultAppRepository(): AppRepository {
  return new IndexedDbAppRepository()
}
