import { Capacitor } from "@capacitor/core"
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem"
import { useEffect, useState } from "react"
import type { AppData } from "../types"
import { createId } from "./id"
import { isDataImageUrl } from "./imageLibrary"

export const MEDIA_REF_PREFIX = "media:"

const MEDIA_DB_NAME = "udenis-specials-media-db"
const MEDIA_DB_VERSION = 1
const MEDIA_STORE_NAME = "media"

const resolvedCache = new Map<string, string>()

export function isMediaRef(value?: string): value is string {
  return typeof value === "string" && value.startsWith(MEDIA_REF_PREFIX)
}

export function isPhotoRef(value?: string): value is string {
  return isDataImageUrl(value) || isMediaRef(value)
}

export function getCachedMediaUrl(ref?: string): string | undefined {
  if (!ref) return undefined
  if (isDataImageUrl(ref)) return ref
  return resolvedCache.get(ref)
}

export interface MediaStore {
  readonly backendName: string
  saveMedia(dataUrl: string): Promise<string>
  loadMedia(ref: string): Promise<string | null>
  deleteMedia(ref: string): Promise<void>
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is unavailable for media storage."))
      return
    }
    const request = window.indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        db.createObjectStore(MEDIA_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open media database."))
  })
}

function runMediaTx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, mode)
    const store = tx.objectStore(MEDIA_STORE_NAME)
    const request = fn(store)
    let result: T
    request.onsuccess = () => {
      result = request.result
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error ?? new Error("Media transaction failed."))
    tx.onabort = () => reject(tx.error ?? new Error("Media transaction aborted."))
  })
}

/**
 * Stores compressed image blobs in IndexedDB keyed by `media:<id>` so
 * `AppData` records stay lightweight and fast. Capacitor `@capacitor/filesystem`
 * swaps behind `MediaStore` cleanly in Phase 15.
 */
export class IndexedDbMediaStore implements MediaStore {
  readonly backendName = "indexeddb-media"
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openMediaDb().catch((error) => {
        this.dbPromise = null
        throw error
      })
    }
    return this.dbPromise
  }

  async saveMedia(dataUrl: string): Promise<string> {
    const ref = `${MEDIA_REF_PREFIX}${createId("img")}`
    resolvedCache.set(ref, dataUrl)
    try {
      const db = await this.getDb()
      await runMediaTx(db, "readwrite", (store) => store.put(dataUrl, ref))
      return ref
    } catch {
      // Fallback gracefully to inline dataUrl if IndexedDB is blocked
      return dataUrl
    }
  }

  async loadMedia(ref: string): Promise<string | null> {
    if (isDataImageUrl(ref)) return ref
    const cached = resolvedCache.get(ref)
    if (cached) return cached
    if (!isMediaRef(ref)) return null
    try {
      const db = await this.getDb()
      const stored = await runMediaTx<string | undefined>(
        db,
        "readonly",
        (store) => store.get(ref),
      )
      if (typeof stored === "string" && isDataImageUrl(stored)) {
        resolvedCache.set(ref, stored)
        return stored
      }
      return null
    } catch {
      return null
    }
  }

  async deleteMedia(ref: string): Promise<void> {
    resolvedCache.delete(ref)
    if (!isMediaRef(ref)) return
    try {
      const db = await this.getDb()
      await runMediaTx(db, "readwrite", (store) => store.delete(ref))
    } catch {
      // Ignore deletion errors for missing or unavailable stores
    }
  }
}

/**
 * Native Android Filesystem `MediaStore` persisting compressed image payloads
 * under `Directory.Data/media/<id>.txt` so photos survive app restarts and
 * keep SQLite records lightweight.
 */
export class CapacitorFilesystemMediaStore implements MediaStore {
  readonly backendName = "capacitor-filesystem"

  private toFilePath(ref: string): string {
    const cleanId = ref
      .slice(MEDIA_REF_PREFIX.length)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
    return `media/${cleanId}.txt`
  }

  async saveMedia(dataUrl: string): Promise<string> {
    const ref = `${MEDIA_REF_PREFIX}${createId("img")}`
    resolvedCache.set(ref, dataUrl)
    try {
      await Filesystem.writeFile({
        path: this.toFilePath(ref),
        data: dataUrl,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true,
      })
      return ref
    } catch {
      return dataUrl
    }
  }

  async loadMedia(ref: string): Promise<string | null> {
    if (isDataImageUrl(ref)) return ref
    const cached = resolvedCache.get(ref)
    if (cached) return cached
    if (!isMediaRef(ref)) return null
    try {
      const result = await Filesystem.readFile({
        path: this.toFilePath(ref),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      })
      if (typeof result.data === "string" && isDataImageUrl(result.data)) {
        resolvedCache.set(ref, result.data)
        return result.data
      }
      return null
    } catch {
      return null
    }
  }

  async deleteMedia(ref: string): Promise<void> {
    resolvedCache.delete(ref)
    if (!isMediaRef(ref)) return
    try {
      await Filesystem.deleteFile({
        path: this.toFilePath(ref),
        directory: Directory.Data,
      })
    } catch {
      // Ignore deletion errors for missing files
    }
  }
}

/**
 * In-memory `MediaStore` implementation used by deterministic Vitest tests.
 */
export class MemoryMediaStore implements MediaStore {
  readonly backendName = "memory-media"
  private readonly items = new Map<string, string>()

  async saveMedia(dataUrl: string): Promise<string> {
    const ref = `${MEDIA_REF_PREFIX}${createId("img")}`
    this.items.set(ref, dataUrl)
    return ref
  }

  async loadMedia(ref: string): Promise<string | null> {
    if (isDataImageUrl(ref)) return ref
    return this.items.get(ref) ?? null
  }

  async deleteMedia(ref: string): Promise<void> {
    this.items.delete(ref)
  }
}

export const defaultMediaStore: MediaStore = Capacitor.isNativePlatform()
  ? new CapacitorFilesystemMediaStore()
  : new IndexedDbMediaStore()

/**
 * Resolves either inline `data:image/...` strings or `media:<id>` references
 * for safe `<img>` rendering across components.
 */
export function useResolvedImageSrc(image?: string): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(() =>
    getCachedMediaUrl(image),
  )

  useEffect(() => {
    if (!image) {
      setResolved(undefined)
      return
    }
    if (isDataImageUrl(image)) {
      setResolved(image)
      return
    }
    if (!isMediaRef(image)) {
      setResolved(undefined)
      return
    }
    const cached = resolvedCache.get(image)
    if (cached) {
      setResolved(cached)
      return
    }
    let cancelled = false
    void defaultMediaStore.loadMedia(image).then((loaded) => {
      if (!cancelled) {
        setResolved(loaded ?? undefined)
      }
    })
    return () => {
      cancelled = true
    }
  }, [image])

  return resolved
}

/**
 * Hydrates every `media:<id>` image reference inside an `AppData` snapshot into
 * its portable `data:image/...` payload so exported JSON backups work on any device.
 */
export async function resolveAppDataMediaForExport(
  data: AppData,
  store: MediaStore = defaultMediaStore,
): Promise<AppData> {
  const clone = structuredClone(data)

  const resolveOptional = async (value?: string): Promise<string | undefined> => {
    if (!value || !isMediaRef(value)) return value
    const loaded = await store.loadMedia(value)
    return loaded ?? value
  }

  for (const product of clone.products) {
    if (product.image) {
      product.image = await resolveOptional(product.image)
    }
  }
  for (const recipe of clone.recipes) {
    if (recipe.image) {
      recipe.image = await resolveOptional(recipe.image)
    }
    if (recipe.history) {
      for (const snap of recipe.history) {
        if (snap.image) {
          snap.image = await resolveOptional(snap.image)
        }
      }
    }
  }
  for (const item of clone.inventory) {
    if (item.image) {
      item.image = await resolveOptional(item.image)
    }
  }
  for (const order of clone.orders) {
    if (order.referencePhoto) {
      order.referencePhoto = await resolveOptional(order.referencePhoto)
    }
    for (const line of order.lines) {
      if (line.recipeSnapshot.image) {
        line.recipeSnapshot.image = await resolveOptional(
          line.recipeSnapshot.image,
        )
      }
    }
  }
  for (const record of clone.preparationRecords) {
    if (record.recipeSnapshot.image) {
      record.recipeSnapshot.image = await resolveOptional(
        record.recipeSnapshot.image,
      )
    }
  }
  for (const plan of clone.extraStockPlans) {
    if (plan.recipeSnapshot.image) {
      plan.recipeSnapshot.image = await resolveOptional(
        plan.recipeSnapshot.image,
      )
    }
  }
  for (const record of clone.extraStockPreparations) {
    if (record.recipeSnapshot.image) {
      record.recipeSnapshot.image = await resolveOptional(
        record.recipeSnapshot.image,
      )
    }
  }

  return clone
}
