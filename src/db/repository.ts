import type { NotificationPreferences } from "../lib/notificationState"
import type { AppData } from "../types"

export interface AppRepository {
  readonly backendName: string
  init(): Promise<void>
  hasData(): Promise<boolean>
  loadAppData(): Promise<AppData | null>
  saveAppData(data: AppData): Promise<void>
  loadNotificationPrefs(): Promise<NotificationPreferences | null>
  saveNotificationPrefs(prefs: NotificationPreferences): Promise<void>
  recordIdempotencyKey(key: string, operation: string): Promise<boolean>
  hasIdempotencyKey(key: string): Promise<boolean>
  getSchemaVersion(): Promise<number>
  close(): Promise<void>
}
