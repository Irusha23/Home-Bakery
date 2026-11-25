import { describe, expect, it } from "vitest"
import { createStarterData } from "../data/starterData"
import {
  ingestAppDataMediaForRestore,
  isMediaRef,
  isPhotoRef,
  MemoryMediaStore,
  pruneUnusedMedia,
  resolveAppDataMediaForExport,
} from "./mediaStore"

const SAMPLE_DATA_URL = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA="

describe("MediaStore and backup photo hydration", () => {
  it("stores, loads, and deletes media references cleanly", async () => {
    const store = new MemoryMediaStore()
    const ref = await store.saveMedia(SAMPLE_DATA_URL)

    expect(isMediaRef(ref)).toBe(true)
    expect(isPhotoRef(ref)).toBe(true)
    expect(isPhotoRef(SAMPLE_DATA_URL)).toBe(true)
    expect(isPhotoRef("preset:chocolate-cake")).toBe(false)

    expect(await store.loadMedia(ref)).toBe(SAMPLE_DATA_URL)
    await store.deleteMedia(ref)
    expect(await store.loadMedia(ref)).toBeNull()
  })

  it("hydrates media:<id> references into self-contained data URLs on export without mutating state", async () => {
    const store = new MemoryMediaStore()
    const productRef = await store.saveMedia(SAMPLE_DATA_URL)
    const orderPhotoRef = await store.saveMedia(SAMPLE_DATA_URL)

    const data = createStarterData()
    data.products[0].image = productRef
    data.recipes[0].image = productRef
    data.inventory[0].image = "preset:flour"
    data.orders[0].referencePhoto = orderPhotoRef
    data.orders[0].lines[0].recipeSnapshot.image = productRef

    const exported = await resolveAppDataMediaForExport(data, store)

    expect(exported.products[0].image).toBe(SAMPLE_DATA_URL)
    expect(exported.recipes[0].image).toBe(SAMPLE_DATA_URL)
    expect(exported.inventory[0].image).toBe("preset:flour")
    expect(exported.orders[0].referencePhoto).toBe(SAMPLE_DATA_URL)
    expect(exported.orders[0].lines[0].recipeSnapshot.image).toBe(
      SAMPLE_DATA_URL,
    )

    // Original in-memory state keeps lightweight media:<id> refs
    expect(data.products[0].image).toBe(productRef)
    expect(data.orders[0].referencePhoto).toBe(orderPhotoRef)
  })

  it("re-ingests inline data URLs on restore with deduplication and prunes orphaned media", async () => {
    const store = new MemoryMediaStore()
    const staleRef = await store.saveMedia(SAMPLE_DATA_URL)

    const imported = createStarterData()
    imported.products[0].image = SAMPLE_DATA_URL
    imported.recipes[0].image = SAMPLE_DATA_URL
    imported.orders[0].referencePhoto = SAMPLE_DATA_URL

    const ingested = await ingestAppDataMediaForRestore(imported, store)
    expect(isMediaRef(ingested.products[0].image)).toBe(true)
    expect(ingested.recipes[0].image).toBe(ingested.products[0].image)
    expect(ingested.orders[0].referencePhoto).toBe(ingested.products[0].image)

    // Stale unreferenced media is pruned while active media stays intact
    const prunedCount = await pruneUnusedMedia(ingested, store)
    expect(prunedCount).toBe(1)
    expect(await store.loadMedia(staleRef)).toBeNull()
    expect(await store.loadMedia(ingested.products[0].image!)).toBe(
      SAMPLE_DATA_URL,
    )
  })
})
