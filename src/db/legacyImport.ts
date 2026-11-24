import { loadNotificationPreferences } from "../lib/notificationState"
import {
  readPersistedState,
  type PersistenceBootstrap,
  type StorageLike,
} from "../state/persistence"
import type { AppData } from "../types"
import type { AppRepository } from "./repository"

export type BootstrapRepositoryOptions = {
  repository: AppRepository
  getLegacyStorage: () => StorageLike
  getFallbackData: () => AppData
  normalize: (data: AppData) => AppData
}

/**
 * Boots the application from `AppRepository`, performing a safe one-time import
 * from legacy `localStorage` on first launch while never discarding corrupted
 * legacy data that requires user recovery.
 */
export async function bootstrapAppRepository({
  repository,
  getLegacyStorage,
  getFallbackData,
  normalize,
}: BootstrapRepositoryOptions): Promise<PersistenceBootstrap> {
  await repository.init()

  const existing = await repository.loadAppData()
  if (existing !== null) {
    return {
      kind: "ready",
      data: normalize(existing),
      source: "current",
      persistenceEnabled: true,
    }
  }

  const legacy = readPersistedState(
    getLegacyStorage,
    getFallbackData(),
    normalize,
  )
  if (legacy.kind === "recovery") {
    return legacy
  }

  await repository.saveAppData(legacy.data)

  try {
    const legacyStorage = getLegacyStorage()
    const existingPrefs = await repository.loadNotificationPrefs()
    if (!existingPrefs) {
      const legacyPrefs = loadNotificationPreferences(legacyStorage)
      if (
        legacyPrefs.readIds.length > 0 ||
        legacyPrefs.dismissedIds.length > 0
      ) {
        await repository.saveNotificationPrefs(legacyPrefs)
      }
    }
  } catch {
    // Notification preferences import is best-effort
  }

  return {
    kind: "ready",
    data: legacy.data,
    source: legacy.source,
    persistenceEnabled: true,
  }
}
