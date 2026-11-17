import { describe, expect, it } from "vitest"
import {
  selectAttentionItems,
  selectGreeting,
  selectNextUp,
  selectUpcomingCollections,
  selectWorkload,
} from "./todaySelectors"
import {
  createTestAppData,
  createTestInventoryItem,
  createTestOrder,
  createTestOrderLine,
  createTestPreparationRecord,
  createTestStockRequirement,
} from "../../test/fixtures"

describe("todaySelectors", () => {
  it("computes Colombo time-of-day greeting and active summary", () => {
    const state = createTestAppData({
      orders: [
        createTestOrder("o-1", [createTestOrderLine("l-1")], {
          status: "Confirmed",
          collectionDate: "2026-04-12",
          collectionTime: "16:00",
        }),
      ],
    })
    // 2026-04-12T04:00:00.000Z = 09:30 Asia/Colombo (morning)
    const morning = selectGreeting(state, new Date("2026-04-12T04:00:00.000Z"))
    expect(morning.greeting).toBe("Good morning, Udeni")
    expect(morning.todayIso).toBe("2026-04-12")
    expect(morning.subtitle).toContain("1 order due today")

    // 2026-04-12T13:30:00.000Z = 19:00 Asia/Colombo (evening)
    const evening = selectGreeting(state, new Date("2026-04-12T13:30:00.000Z"))
    expect(evening.greeting).toBe("Good evening, Udeni")
  })

  it("prioritizes in-progress preparation first, then earliest unready confirmed order", () => {
    const lineProg = createTestOrderLine("l-prog")
    const lineUrg = createTestOrderLine("l-urg")
    const inProgressOrder = createTestOrder("o-prog", [lineProg], {
      customerName: "Dilani",
      status: "In Progress",
      preparationStatus: "In progress",
      collectionDate: "2026-04-13",
      collectionTime: "10:00",
    })
    const urgentConfirmed = createTestOrder("o-urg", [lineUrg], {
      customerName: "Kamala",
      status: "Confirmed",
      preparationStatus: "Not started",
      collectionDate: "2026-04-12",
      collectionTime: "15:00",
    })
    const state = createTestAppData({
      orders: [urgentConfirmed, inProgressOrder],
      preparationRecords: [
        createTestPreparationRecord("o-prog", lineProg, {
          status: "In progress",
        }),
      ],
    })

    const next = selectNextUp(state, new Date("2026-04-12T05:00:00.000Z"))
    expect(next?.kind).toBe("prep-in-progress")
    expect(next?.order.id).toBe("o-prog")
    expect(next?.ctaLabel).toBe("Continue prep")
  })

  it("returns null hero and zero workload when there are no active orders", () => {
    const draft = createTestOrder("o-draft", [createTestOrderLine("l-draft")], {
      status: "Draft",
      collectionDate: "2026-04-12",
    })
    const cancelled = createTestOrder(
      "o-cancel",
      [createTestOrderLine("l-cancel")],
      {
        status: "Cancelled",
        collectionDate: "2026-04-12",
      },
    )
    const state = createTestAppData({ orders: [draft, cancelled] })

    expect(selectNextUp(state, new Date("2026-04-12T05:00:00.000Z"))).toBeNull()
    expect(selectWorkload(state, "2026-04-12")).toEqual({
      dueTodayCount: 0,
      inProgressCount: 0,
      readyCount: 0,
      shortagesCount: 0,
    })
    expect(selectUpcomingCollections(state, "2026-04-12")).toEqual([])
  })

  it("derives live attention alerts from shortages, low stock, due orders, and unpaid collected orders", () => {
    const confirmedShort = createTestOrder(
      "o-short",
      [createTestOrderLine("l-short", undefined, { quantity: 3 })],
      {
        status: "Confirmed",
        collectionDate: "2026-04-12",
        collectionTime: "16:30",
        shortages: [
          createTestStockRequirement({
            lineId: "l-short",
            inventoryId: "flour",
            name: "All-purpose flour",
            required: 1500,
            availableAtConfirmation: 30,
            reserved: 30,
            shortage: 1470,
            unit: "g",
          }),
        ],
      },
    )
    const unpaidCollected = createTestOrder(
      "o-unpaid",
      [createTestOrderLine("l-unpaid")],
      {
        customerName: "Ruwan",
        status: "Completed",
        agreedPrice: 4500,
        payments: [],
      },
    )
    const state = createTestAppData({
      inventory: [
        createTestInventoryItem({
          inventoryId: "flour",
          name: "All-purpose flour",
          physical: 500,
          lowStockThreshold: 1000,
          category: "ingredient",
        }),
        createTestInventoryItem({
          inventoryId: "butter",
          name: "Unsalted butter",
          physical: 250,
          lowStockThreshold: 300,
          category: "ingredient",
        }),
      ],
      orders: [confirmedShort, unpaidCollected],
      preparationRecords: [
        createTestPreparationRecord(
          confirmedShort.id,
          confirmedShort.lines[0],
        ),
      ],
      settings: {
        ...createTestAppData().settings,
        lastBackupAt: "2026-04-11T10:00:00.000Z",
      },
    })

    const alerts = selectAttentionItems(
      state,
      new Date("2026-04-12T06:00:00.000Z"),
    )
    expect(alerts.some((a) => a.id === "shortage-flour")).toBe(true)
    expect(alerts.some((a) => a.id === "low-butter")).toBe(false)
    expect(alerts.some((a) => a.id === "due-o-short")).toBe(true)
    expect(alerts.some((a) => a.id === "unpaid-o-unpaid")).toBe(true)
    expect(alerts.some((a) => a.id === "backup-reminder")).toBe(false)
  })
})
