import { describe, expect, it } from "vitest"
import {
  formatCountdown,
  getBakeTargetMs,
  getCollectionTargetMs,
} from "./countdown"

describe("countdown helpers", () => {
  it("formats positive durations as dd:hh:mm:ss", () => {
    const ms =
      (2 * 86_400 + 5 * 3_600 + 9 * 60 + 4) * 1000
    expect(formatCountdown(ms)).toEqual({
      text: "02:05:09:04",
      overdue: false,
    })
  })

  it("formats sub-day durations with zero-padded days as dd:hh:mm:ss", () => {
    const ms = (1 * 3_600 + 15 * 60) * 1000
    expect(formatCountdown(ms)).toEqual({
      text: "00:01:15:00",
      overdue: false,
    })
  })

  it("marks zero or negative durations as overdue", () => {
    expect(formatCountdown(0)).toEqual({ text: "00:00:00:00", overdue: true })
    expect(formatCountdown(-65_000)).toEqual({
      text: "00:00:01:05",
      overdue: true,
    })
  })

  it("computes collection and bake target timestamps", () => {
    const collectionMs = getCollectionTargetMs("2026-11-18", "15:30")
    expect(collectionMs).toBe(new Date("2026-11-18T15:30:00").getTime())
    expect(getCollectionTargetMs("")).toBeNull()

    const startedAt = "2026-11-17T10:00:00.000Z"
    expect(getBakeTargetMs(startedAt, 90)).toBe(
      new Date(startedAt).getTime() + 90 * 60_000,
    )
    expect(getBakeTargetMs(null, 90)).toBeNull()
  })
})
