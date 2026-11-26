import { describe, expect, it } from "vitest"
import {
  clearAllNotifications,
  dismissNotification,
  loadNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  pruneNotificationPreferences,
  restoreNotification,
  saveNotificationPreferences,
} from "./notificationState"
import { applySystemReminderEvent } from "./systemNotifications"

function createMemoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

describe("notificationState", () => {
  it("marks individual notifications as read without duplicating IDs", () => {
    const initial = { readIds: [], dismissedIds: [] }
    const once = markNotificationRead(initial, "due-1")
    const twice = markNotificationRead(once, "due-1")

    expect(once.readIds).toEqual(["due-1"])
    expect(twice).toBe(once)
  })

  it("dismisses and restores single notifications", () => {
    const initial = { readIds: [], dismissedIds: [] }
    const dismissed = dismissNotification(initial, "due-1")
    expect(dismissed.dismissedIds).toEqual(["due-1"])
    expect(dismissed.readIds).toEqual(["due-1"])

    const restored = restoreNotification(dismissed, "due-1")
    expect(restored.dismissedIds).toEqual([])
    expect(restored.readIds).toEqual(["due-1"])
  })

  it("prunes resolved notification IDs while keeping active ones", () => {
    const prefs = {
      readIds: ["due-1", "resolved-2"],
      dismissedIds: ["shortage-3", "resolved-4"],
    }
    const pruned = pruneNotificationPreferences(prefs, ["due-1", "shortage-3"])
    expect(pruned).toEqual({
      readIds: ["due-1"],
      dismissedIds: ["shortage-3"],
    })
  })

  it("marks all notifications as read and clears all notifications", () => {
    const initial = { readIds: ["due-1"], dismissedIds: [] }
    const allRead = markAllNotificationsRead(initial, ["due-1", "shortage-2"])
    expect(allRead.readIds).toEqual(["due-1", "shortage-2"])

    const cleared = clearAllNotifications(allRead, ["due-1", "shortage-2"])
    expect(cleared.dismissedIds).toEqual(["due-1", "shortage-2"])
    expect(cleared.readIds).toEqual(["due-1", "shortage-2"])
  })

  it("persists and reloads preferences safely", () => {
    const storage = createMemoryStorage()
    saveNotificationPreferences(
      { readIds: ["a"], dismissedIds: ["b"] },
      storage,
    )
    expect(loadNotificationPreferences(storage)).toEqual({
      readIds: ["a"],
      dismissedIds: ["b"],
    })
  })

  it("syncs phone notification actions (read, open, clear, clear-all) cleanly", () => {
    const start = { readIds: [], dismissedIds: [] }
    const afterRead = applySystemReminderEvent(start, {
      action: "read",
      id: "due-order-1",
    })
    expect(afterRead).toEqual({ readIds: ["due-order-1"], dismissedIds: [] })

    const afterOpen = applySystemReminderEvent(afterRead, {
      action: "open",
      id: "backup-weekly",
    })
    expect(afterOpen.readIds).toEqual(["due-order-1", "backup-weekly"])

    const afterClear = applySystemReminderEvent(afterOpen, {
      action: "clear",
      id: "due-order-1",
    })
    expect(afterClear.dismissedIds).toEqual(["due-order-1"])

    const afterClearAll = applySystemReminderEvent(afterClear, {
      action: "clear-all",
      ids: ["backup-weekly", "shortage-2"],
    })
    expect(afterClearAll.dismissedIds).toEqual([
      "due-order-1",
      "backup-weekly",
      "shortage-2",
    ])
    expect(afterClearAll.readIds).toContain("shortage-2")

    const unchanged = applySystemReminderEvent(afterClearAll, {
      action: "open-alarm",
      id: "prep-1::2",
    })
    expect(unchanged).toBe(afterClearAll)
  })
})
