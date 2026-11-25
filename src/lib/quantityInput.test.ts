import { describe, expect, it } from "vitest"
import {
  convertDraftOnUnitChange,
  formatEditableQuantity,
  sanitizeNumericDraft,
} from "./quantityInput"

describe("sanitizeNumericDraft", () => {
  it("allows clearing to empty string cleanly", () => {
    expect(sanitizeNumericDraft("")).toBe("")
    expect(sanitizeNumericDraft("", false)).toBe("")
  })

  it("allows partial decimal typing while stripping invalid characters", () => {
    expect(sanitizeNumericDraft("0.")).toBe("0.")
    expect(sanitizeNumericDraft(".5")).toBe(".5")
    expect(sanitizeNumericDraft("12.3.4")).toBe("12.34")
    expect(sanitizeNumericDraft("12abc.5")).toBe("12.5")
  })

  it("strips decimals and letters in integer mode", () => {
    expect(sanitizeNumericDraft("150.75", false)).toBe("15075")
    expect(sanitizeNumericDraft("Rs. 2,500", false)).toBe("2500")
  })
})

describe("formatEditableQuantity", () => {
  it("formats numbers without trailing zeros or locale separators", () => {
    expect(formatEditableQuantity(150)).toBe("150")
    expect(formatEditableQuantity(0.5)).toBe("0.5")
    expect(formatEditableQuantity(0.125)).toBe("0.125")
    expect(formatEditableQuantity(1500)).toBe("1500")
    expect(formatEditableQuantity(Number.NaN)).toBe("")
  })
})

describe("convertDraftOnUnitChange", () => {
  it("keeps empty drafts empty on unit switch", () => {
    expect(
      convertDraftOnUnitChange("", "g", "kg", {
        name: "All-purpose flour",
        unit: "g",
      }),
    ).toBe("")
  })

  it("auto-converts dry quantities across g, kg, and tsp using item density", () => {
    const flour = { name: "All-purpose flour", unit: "g" as const }
    expect(convertDraftOnUnitChange("500", "g", "kg", flour)).toBe("0.5")
    expect(convertDraftOnUnitChange("1", "kg", "g", flour)).toBe("1000")
    expect(convertDraftOnUnitChange("150", "g", "tsp", flour)).toBe("50")
    expect(convertDraftOnUnitChange("10", "tsp", "g", flour)).toBe("30")
  })

  it("auto-converts liquid quantities using mlPerTsp and 250ml cup standard", () => {
    const milk = { name: "Fresh milk", unit: "ml" as const, mlPerTsp: 5 }
    expect(convertDraftOnUnitChange("250", "ml", "cup", milk)).toBe("1")
    expect(convertDraftOnUnitChange("2", "cup", "L", milk)).toBe("0.5")
    expect(convertDraftOnUnitChange("15", "ml", "tbsp", milk)).toBe("1")
  })

  it("handles base unit string targets cleanly", () => {
    expect(convertDraftOnUnitChange("125", "g", "kg", "g")).toBe("0.125")
  })
})
