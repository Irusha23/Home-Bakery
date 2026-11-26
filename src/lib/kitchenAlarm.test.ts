import { afterEach, describe, expect, it } from "vitest"
import {
  addTimeToStepTimer,
  clearStepTimer,
  dismissRingingAlarm,
  getRemainingSeconds,
  getStepTimers,
  makeStepAlarmId,
  moveStepTimers,
  parseStepAlarmId,
  pauseStepTimer,
  resetKitchenAlarmsForTests,
  resumeStepTimer,
  shiftStepTimersOnInsert,
  startStepTimer,
} from "./kitchenAlarm"

describe("kitchenAlarm step timer manager", () => {
  afterEach(() => {
    resetKitchenAlarmsForTests()
  })

  it("creates, pauses, resumes, adds time, and clears independent step timers", async () => {
    const prepId = "prep-1"
    await startStepTimer({
      preparationId: prepId,
      stepIndex: 0,
      durationSeconds: 300,
      title: "Chocolate cake",
      stepLabel: "Step 1: Bake sponge",
    })
    await startStepTimer({
      preparationId: prepId,
      stepIndex: 1,
      durationSeconds: 120,
      title: "Chocolate cake",
      stepLabel: "Step 2: Ganache",
    })

    const id0 = makeStepAlarmId(prepId, 0)
    const id1 = makeStepAlarmId(prepId, 1)
    expect(Object.keys(getStepTimers())).toHaveLength(2)

    await pauseStepTimer(id0)
    expect(getStepTimers()[id0].status).toBe("paused")
    expect(getStepTimers()[id1].status).toBe("running")

    await addTimeToStepTimer(id0, 60)
    expect(getRemainingSeconds(getStepTimers()[id0])).toBeGreaterThanOrEqual(355)

    await resumeStepTimer(id0)
    expect(getStepTimers()[id0].status).toBe("running")

    await clearStepTimer(id1)
    expect(getStepTimers()[id1]).toBeUndefined()
    expect(getStepTimers()[id0]).toBeDefined()

    await dismissRingingAlarm(id0)
    expect(getStepTimers()[id0]).toBeUndefined()
  })

  it("shifts and reorders step timers when steps are inserted or moved", async () => {
    const prepId = "prep-2"
    await startStepTimer({
      preparationId: prepId,
      stepIndex: 1,
      durationSeconds: 180,
      title: "Cake",
      stepLabel: "Step 2",
    })

    shiftStepTimersOnInsert(prepId, 1)
    expect(getStepTimers()[makeStepAlarmId(prepId, 1)]).toBeUndefined()
    expect(getStepTimers()[makeStepAlarmId(prepId, 2)]?.stepIndex).toBe(2)

    moveStepTimers(prepId, 2, 0)
    expect(getStepTimers()[makeStepAlarmId(prepId, 2)]).toBeUndefined()
    expect(getStepTimers()[makeStepAlarmId(prepId, 0)]?.stepIndex).toBe(0)

    expect(parseStepAlarmId(makeStepAlarmId("prep-xyz", 4))).toEqual({
      preparationId: "prep-xyz",
      stepIndex: 4,
    })
    expect(parseStepAlarmId("invalid")).toBeNull()
  })
})
