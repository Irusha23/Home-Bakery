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
  listMediaRefs?(): Promise<string[]>
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

  async listMediaRefs(): Promise<string[]> {
    try {
      const db = await this.getDb()
      const keys = await runMediaTx<IDBValidKey[]>(
        db,
        "readonly",
        (store) => store.getAllKeys(),
      )
      return keys.filter((key): key is string => typeof key === "string" && isMediaRef(key))
    } catch {
      return []
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

  async listMediaRefs(): Promise<string[]> {
    try {
      const result = await Filesystem.readdir({
        path: "media",
        directory: Directory.Data,
      })
      return result.files
        .filter((entry) => entry.type === "file" && entry.name.endsWith(".txt"))
        .map((entry) => `${MEDIA_REF_PREFIX}${entry.name.slice(0, -4)}`)
    } catch {
      return []
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

  async listMediaRefs(): Promise<string[]> {
    return Array.from(this.items.keys())
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

async function mapAppDataMediaFields(
  data: AppData,
  transform: (value?: string) => Promise<string | undefined>,
): Promise<AppData> {
  const clone = structuredClone(data)

  for (const product of clone.products) {
    if (product.image) {
      product.image = await transform(product.image)
    }
  }
  for (const recipe of clone.recipes) {
    if (recipe.image) {
      recipe.image = await transform(recipe.image)
    }
    if (recipe.history) {
      for (const snap of recipe.history) {
        if (snap.image) {
          snap.image = await transform(snap.image)
        }
      }
    }
  }
  for (const item of clone.inventory) {
    if (item.image) {
      item.image = await transform(item.image)
    }
  }
  for (const order of clone.orders) {
    if (order.referencePhoto) {
      order.referencePhoto = await transform(order.referencePhoto)
    }
    for (const line of order.lines) {
      if (line.recipeSnapshot.image) {
        line.recipeSnapshot.image = await transform(line.recipeSnapshot.image)
      }
    }
  }
  for (const record of clone.preparationRecords) {
    if (record.recipeSnapshot.image) {
      record.recipeSnapshot.image = await transform(record.recipeSnapshot.image)
    }
  }
  for (const plan of clone.extraStockPlans) {
    if (plan.recipeSnapshot.image) {
      plan.recipeSnapshot.image = await transform(plan.recipeSnapshot.image)
    }
  }
  for (const record of clone.extraStockPreparations) {
    if (record.recipeSnapshot.image) {
      record.recipeSnapshot.image = await transform(record.recipeSnapshot.image)
    }
  }

  return clone
}

/**
 * Hydrates every `media:<id>` image reference inside an `AppData` snapshot into
 * its portable `data:image/...` payload so exported JSON backups work on any device.
 */
export async function resolveAppDataMediaForExport(
  data: AppData,
  store: MediaStore = defaultMediaStore,
): Promise<AppData> {
  return mapAppDataMediaFields(data, async (value) => {
    if (!value || !isMediaRef(value)) return value
    const loaded = await store.loadMedia(value)
    return loaded ?? value
  })
}

/**
 * Moves inline `data:image/...` payloads inside a restored `AppData` snapshot into
 * `MediaStore` (`media:<id>` refs) so SQLite stays lightweight and fast.
 */
export async function ingestAppDataMediaForRestore(
  data: AppData,
  store: MediaStore = defaultMediaStore,
): Promise<AppData> {
  const deduped = new Map<string, string>()
  return mapAppDataMediaFields(data, async (value) => {
    if (!value || !isDataImageUrl(value)) return value
    const existing = deduped.get(value)
    if (existing) return existing
    const ref = await store.saveMedia(value)
    deduped.set(value, ref)
    return ref
  })
}

/**
 * Collects all active `media:<id>` references currently used in `AppData`.
 */
export function collectReferencedMediaRefs(data: AppData): Set<string> {
  const refs = new Set<string>()
  const addIfMedia = (value?: string) => {
    if (isMediaRef(value)) refs.add(value)
  }

  for (const product of data.products) addIfMedia(product.image)
  for (const recipe of data.recipes) {
    addIfMedia(recipe.image)
    for (const snap of recipe.history ?? []) addIfMedia(snap.image)
  }
  for (const item of data.inventory) addIfMedia(item.image)
  for (const order of data.orders) {
    addIfMedia(order.referencePhoto)
    for (const line of order.lines) addIfMedia(line.recipeSnapshot.image)
  }
  for (const record of data.preparationRecords) addIfMedia(record.recipeSnapshot.image)
  for (const plan of data.extraStockPlans) addIfMedia(plan.recipeSnapshot.image)
  for (const record of data.extraStockPreparations) addIfMedia(record.recipeSnapshot.image)

  return refs
}

/**
 * Deletes orphaned `media:<id>` files no longer referenced anywhere in `data`.
 */
export async function pruneUnusedMedia(
  data: AppData,
  store: MediaStore = defaultMediaStore,
): Promise<number> {
  if (!store.listMediaRefs) return 0
  const referenced = collectReferencedMediaRefs(data)
  const storedRefs = await store.listMediaRefs()
  let deleted = 0
  for (const ref of storedRefs) {
    if (!referenced.has(ref)) {
      await store.deleteMedia(ref)
      deleted += 1
    }
  }
  return deleted
}
