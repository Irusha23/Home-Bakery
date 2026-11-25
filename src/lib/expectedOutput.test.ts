import { describe, expect, it } from "vitest"

import { parseExpectedOutputQuantity } from "./expectedOutput"

describe("parseExpectedOutputQuantity", () => {
  it("accepts a positive whole-unit output", () => {
    expect(parseExpectedOutputQuantity("12")).toEqual({
      valid: true,

      value: { quantity: 12, unit: "unit" },
    })
  })

  it("allows the typed output to be cleared", () => {
    expect(parseExpectedOutputQuantity("")).toEqual({
      valid: true,

      value: null,
    })
  })

  it.each(["0", "-2", "1.5", "1e2", " 2", "9007199254740992"])(
    "rejects invalid whole-unit output %s",

    (value) => {
      expect(parseExpectedOutputQuantity(value)).toEqual({ valid: false })
    },
  )
})
