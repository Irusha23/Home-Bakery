import { describe, expect, it } from "vitest"
import { createTestAppData, createTestOrder, createTestOrderLine } from "../test/fixtures"
import { buildOrdersCsv } from "./csv"

describe("CSV export builders", () => {
  it("reports PaidLKR net of issued refunds", () => {
    const order = createTestOrder("csv-order", [createTestOrderLine("l1")], {
      reference: "US-1001",
      status: "Confirmed",
      agreedPrice: 10000,
      payments: [
        { id: "p1", date: "2026-10-10", amount: 6000, method: "Cash" },
      ],
    })
    const state = createTestAppData({
      orders: [order],
      refunds: [
        {
          id: "r1",
          orderId: order.id,
          paymentId: "p1",
          date: "2026-10-12",
          amount: 1500,
          reason: "Adjustment",
        },
      ],
    })

    const csv = buildOrdersCsv(state)
    const rows = csv.split("\r\n")
    expect(rows[0]).toContain("PaidLKR")
    const cols = rows[1].split(",")
    // Header order: Reference(0), Customer(1), Status(2), PrepStatus(3), PaymentStatus(4), CollectionDate(5), CollectionTime(6), AgreedPriceLKR(7), PaidLKR(8)
    expect(cols[8]).toBe("4500")
  })
})
