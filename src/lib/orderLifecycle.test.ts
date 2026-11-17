import { describe, expect, it } from "vitest"

import {
  canCancelOrder,
  canCollectOrder,
  getOrderCancellationBlockReason,
  getUnreadyOrderLines,
  canRepeatOrder,
  filterOrdersByStatus,
} from "./orderLifecycle"

import {
  createTestAppData,
  createTestOrder,
  createTestOrderLine,
  createTestPreparationRecord,
  createTestInventoryItem,
} from "../test/fixtures"

describe("order lifecycle eligibility", () => {
  it("allows cancellation of an untouched draft but hides terminal states", () => {
    const draft = createTestOrder("lifecycle-draft", [])

    const state = createTestAppData({ orders: [draft] })

    expect(canCancelOrder(state, draft)).toBe(true)

    for (const status of ["Completed", "Cancelled"] as const) {
      const terminal = createTestOrder(`terminal-${status}`, [], { status })

      expect(canCancelOrder(state, terminal)).toBe(false)

      expect(getOrderCancellationBlockReason(state, terminal)).toBeNull()
    }
  })

  it("uses the same cancellation safety rule for in-progress orders", () => {
    const line = createTestOrderLine("blocked-cancel-line")

    const order = createTestOrder("blocked-cancel-order", [line], {
      status: "In Progress",
    })

    const preparation = createTestPreparationRecord(order.id, line, {
      status: "Ready",
    })

    const state = createTestAppData({
      orders: [order],

      preparationRecords: [preparation],
    })

    expect(canCancelOrder(state, order)).toBe(false)

    expect(getOrderCancellationBlockReason(state, order)).toContain(
      "consumed stock or produced finished goods",
    )
  })

  it("offers collection only when every line has a ready preparation", () => {
    const first = createTestOrderLine("collect-first-line")

    const second = createTestOrderLine("collect-second-line")

    const order = createTestOrder("lifecycle-collection", [first, second], {
      status: "In Progress",
    })

    const state = createTestAppData({
      orders: [order],

      preparationRecords: [
        createTestPreparationRecord(order.id, first, { status: "Ready" }),

        createTestPreparationRecord(order.id, second, {
          status: "In progress",
        }),
      ],
    })

    expect(canCollectOrder(state, order)).toBe(false)

    expect(getUnreadyOrderLines(state, order).map((line) => line.id)).toEqual([
      second.id,
    ])
  })

  it("does not make collection eligibility depend on payment balance", () => {
    const line = createTestOrderLine("unpaid-ready-line")

    const order = createTestOrder("unpaid-ready-order", [line], {
      status: "Confirmed",

      agreedPrice: 15000,

      payments: [],
    })

    const state = createTestAppData({
      orders: [order],

      preparationRecords: [
        createTestPreparationRecord(order.id, line, { status: "Ready" }),
      ],
    })

    expect(order.agreedPrice).toBe(15000)

    expect(canCollectOrder(state, order)).toBe(true)
  })

  it("requires an eligible workflow status and non-empty product lines", () => {
    const line = createTestOrderLine("invalid-collection-line")

    const completed = createTestOrder("already-collected", [line], {
      status: "Completed",
    })

    const empty = createTestOrder("empty-order", [], { status: "In Progress" })

    const readyRecord = createTestPreparationRecord(
      completed.id,

      line,

      { status: "Ready" },
    )

    const state = createTestAppData({
      preparationRecords: [readyRecord],

      inventory: [createTestInventoryItem()],
    })

    expect(canCollectOrder(state, completed)).toBe(false)

    expect(canCollectOrder(state, empty)).toBe(false)
  })

  it("allows repeats only for non-draft orders with product lines", () => {
    const line = createTestOrderLine("repeat-visibility-line")

    for (const status of [
      "Confirmed",

      "In Progress",

      "Completed",

      "Cancelled",
    ] as const) {
      expect(
        canRepeatOrder(
          createTestOrder(`repeat-visible-${status}`, [line], { status }),
        ),
      ).toBe(true)
    }

    expect(
      canRepeatOrder(createTestOrder("repeat-hidden-draft", [line])),
    ).toBe(false)

    expect(
      canRepeatOrder(
        createTestOrder("repeat-hidden-empty", [], {
          status: "Completed",
        }),
      ),
    ).toBe(false)
  })

  it("includes a repeated draft in the Draft order filter", () => {
    const draft = createTestOrder("new-repeat-draft", [], { status: "Draft" })

    const completed = createTestOrder("repeat-source-completed", [], {
      status: "Completed",
    })

    expect(filterOrdersByStatus([completed, draft], "Draft")).toEqual([draft])
  })
})
