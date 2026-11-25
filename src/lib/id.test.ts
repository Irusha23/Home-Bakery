import { afterEach, describe, expect, it, vi } from "vitest"
import { createId } from "./id"

describe("createId", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("prefixes generated IDs when a prefix is provided", () => {
    const id = createId("order")
    expect(id.startsWith("order-")).toBe(true)
    expect(id.length).toBeGreaterThan("order-".length + 8)
  })

  it("falls back to crypto.getRandomValues when crypto.randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i += 1) arr[i] = i + 1
      return arr
    })
    vi.stubGlobal("crypto", { getRandomValues })

    const id = createId("trip")
    expect(getRandomValues).toHaveBeenCalledTimes(1)
    expect(id).toMatch(
      /^trip-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it("falls back cleanly when crypto is completely unavailable", () => {
    vi.stubGlobal("crypto", undefined)

    const a = createId("exp")
    const b = createId("exp")
    expect(a.startsWith("exp-")).toBe(true)
    expect(b.startsWith("exp-")).toBe(true)
    expect(a).not.toBe(b)
  })
})
