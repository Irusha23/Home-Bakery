import { describe, expect, it } from "vitest"
import {
  REDUCED_MOTION_TRANSITION,
  SPRING_CONTROL,
  SPRING_ELASTIC,
  SPRING_MICRO,
  SPRING_NUDGE,
  SPRING_PAGE,
  SPRING_PANEL,
  SPRING_SHEET,
  STAGGER_MAX_DELAY_SEC,
  STAGGER_STEP_SEC,
  staggerDelay,
} from "./motion"

function dampingRatio(spring: {
  stiffness: number
  damping: number
  mass: number
}): number {
  return spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass))
}

describe("motion physics tokens", () => {
  it("calibrates UI springs near critical damping without overshoot", () => {
    for (const spring of [
      SPRING_MICRO,
      SPRING_CONTROL,
      SPRING_PANEL,
      SPRING_SHEET,
      SPRING_PAGE,
    ]) {
      const zeta = dampingRatio(spring)
      expect(zeta).toBeGreaterThanOrEqual(0.95)
      expect(zeta).toBeLessThanOrEqual(1.15)
    }
  })

  it("scales mass monotonically from micro elements up to full pages", () => {
    expect(SPRING_MICRO.mass).toBeLessThan(SPRING_CONTROL.mass)
    expect(SPRING_CONTROL.mass).toBeLessThan(SPRING_PANEL.mass)
    expect(SPRING_PANEL.mass).toBeLessThan(SPRING_SHEET.mass)
    expect(SPRING_SHEET.mass).toBeLessThan(SPRING_PAGE.mass)
  })

  it("uses underdamped springs for playful and boundary feedback moments", () => {
    for (const spring of [SPRING_ELASTIC, SPRING_NUDGE]) {
      const zeta = dampingRatio(spring)
      expect(zeta).toBeGreaterThanOrEqual(0.5)
      expect(zeta).toBeLessThan(0.85)
    }
  })

  it("keeps reduced-motion transitions as gentle cross-fades instead of instant pops", () => {
    expect(REDUCED_MOTION_TRANSITION.duration).toBeGreaterThanOrEqual(0.12)
    expect(REDUCED_MOTION_TRANSITION.duration).toBeLessThanOrEqual(0.22)
  })

  it("provides 30-80 ms choreography staggers capped for responsiveness", () => {
    expect(STAGGER_STEP_SEC).toBeGreaterThanOrEqual(0.03)
    expect(STAGGER_STEP_SEC).toBeLessThanOrEqual(0.08)
    expect(staggerDelay(0)).toBe(0)
    expect(staggerDelay(2)).toBeCloseTo(STAGGER_STEP_SEC * 2)
    expect(staggerDelay(20)).toBe(STAGGER_MAX_DELAY_SEC)
  })
})
