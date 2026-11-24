import { describe, expect, it } from "vitest"
import {
  getImagePreset,
  getImagePresetsByCategory,
  IMAGE_PRESETS,
  isValidImageValue,
} from "./imageLibrary"

describe("imageLibrary", () => {
  it("provides presets across bakes, ingredients, and packaging", () => {
    expect(IMAGE_PRESETS.length).toBeGreaterThanOrEqual(24)
    expect(getImagePresetsByCategory("bakes").length).toBeGreaterThan(0)
    expect(getImagePresetsByCategory("ingredients").length).toBeGreaterThan(0)
    expect(getImagePresetsByCategory("packaging").length).toBeGreaterThan(0)
  })

  it("validates preset IDs and compressed image data URLs", () => {
    expect(getImagePreset("preset:chocolate-cake")?.label).toBe(
      "Chocolate cake",
    )
    expect(isValidImageValue("preset:flour")).toBe(true)
    expect(
      isValidImageValue("data:image/webp;base64,UklGRh4AAABXRUJQVlA4"),
    ).toBe(true)
    expect(isValidImageValue("preset:does-not-exist")).toBe(false)
    expect(isValidImageValue("https://example.com/evil.png")).toBe(false)
    expect(isValidImageValue("javascript:alert(1)")).toBe(false)
  })
})
