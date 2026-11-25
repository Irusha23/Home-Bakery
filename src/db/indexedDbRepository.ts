import type { NotificationPreferences } from "../lib/notificationState"
import type { AppData } from "../types"
import { LATEST_DB_SCHEMA_VERSION } from "./migrator"
import type { AppRepository } from "./repository"

const DB_NAME = "udenis-specials-local-db"
const DB_VERSION = 1
const KV_STORE = "kv"
const IDEMPOTENCY_STORE = "idempotency_keys"
const APP_DATA_KEY = "app_data"
const NOTIFICATION_PREFS_KEY = "notification_prefs"

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is unavailable in this environment."))
      return
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE)
      }
      if (!db.objectStoreNames.contains(IDEMPOTENCY_STORE)) {
        db.createObjectStore(IDEMPOTENCY_STORE, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."))
  })
}

function txRequest<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const request = run(store)
    let result: T
    request.onsuccess = () => {
      result = request.result
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed."))
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted."))
  })
}

/**
 * Browser IndexedDB implementation of `AppRepository` used for fast Chrome
 * development until native Capacitor SQLite runs on Android (Phase 15).
 */
export class IndexedDbAppRepository implements AppRepository {
  readonly backendName = "indexeddb"
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    if (!this.db) {
      this.db = await openIndexedDb()
    }
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.init()
    if (!this.db) {
      throw new Error("IndexedDB could not be initialized.")
    }
    return this.db
  }

  async hasData(): Promise<boolean> {
    const db = await this.ensureDb()
    const existing = await txRequest<unknown>(db, KV_STORE, "readonly", (store) =>
      store.get(APP_DATA_KEY),
    )
    return existing !== undefined && existing !== null
  }

  async loadAppData(): Promise<AppData | null> {
    const db = await this.ensureDb()
    const existing = await txRequest<AppData | undefined>(
      db,
      KV_STORE,
      "readonly",
      (store) => store.get(APP_DATA_KEY),
    )
    return existing ? structuredClone(existing) : null
  }

  async saveAppData(data: AppData): Promise<void> {
    const db = await this.ensureDb()
    await txRequest(db, KV_STORE, "readwrite", (store) =>
      store.put(structuredClone(data), APP_DATA_KEY),
    )
  }

  async loadNotificationPrefs(): Promise<NotificationPreferences | null> {
    const db = await this.ensureDb()
    const existing = await txRequest<NotificationPreferences | undefined>(
      db,
      KV_STORE,
      "readonly",
      (store) => store.get(NOTIFICATION_PREFS_KEY),
    )
    return existing ? structuredClone(existing) : null
  }

  async saveNotificationPrefs(prefs: NotificationPreferences): Promise<void> {
    const db = await this.ensureDb()
    await txRequest(db, KV_STORE, "readwrite", (store) =>
      store.put(structuredClone(prefs), NOTIFICATION_PREFS_KEY),
    )
  }

  async recordIdempotencyKey(key: string, operation: string): Promise<boolean> {
    const db = await this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDEMPOTENCY_STORE, "readwrite")
      const store = tx.objectStore(IDEMPOTENCY_STORE)
      const checkReq = store.get(key)
      let inserted = false
      checkReq.onsuccess = () => {
        if (!checkReq.result) {
          inserted = true
          store.put({ key, operation, createdAt: new Date().toISOString() })
        }
      }
      tx.oncomplete = () => resolve(inserted)
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed."))
    })
  }

  async hasIdempotencyKey(key: string): Promise<boolean> {
    const db = await this.ensureDb()
    const existing = await txRequest<unknown>(
      db,
      IDEMPOTENCY_STORE,
      "readonly",
      (store) => store.get(key),
    )
    return Boolean(existing)
  }

  async getSchemaVersion(): Promise<number> {
    return LATEST_DB_SCHEMA_VERSION
  }

  async close(): Promise<void> {
    this.db?.close()
    this.db = null
  }
}
