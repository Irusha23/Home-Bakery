import { describe, expect, it, vi } from "vitest"

import { submitPurchaseIfAccepted } from "./purchaseSubmission"

describe("purchase submission acceptance", () => {
  it("calls the success callback exactly once after an accepted action", () => {
    const action = { type: "RECORD_PURCHASE", id: "purchase-1" }

    const dispatchIfAccepted = vi.fn(() => true)

    const onAccepted = vi.fn()

    const accepted = submitPurchaseIfAccepted(
      action,

      dispatchIfAccepted,

      onAccepted,
    )

    expect(accepted).toBe(true)

    expect(dispatchIfAccepted).toHaveBeenCalledTimes(1)

    expect(dispatchIfAccepted).toHaveBeenCalledWith(action)

    expect(onAccepted).toHaveBeenCalledTimes(1)
  })

  it("does not run success callback after rejection, so the form can stay open and retain input", () => {
    const action = { type: "RECORD_PURCHASE", id: "purchase-rejected" }

    const dispatchIfAccepted = vi.fn(() => false)

    const onAccepted = vi.fn()

    const accepted = submitPurchaseIfAccepted(
      action,

      dispatchIfAccepted,

      onAccepted,
    )

    expect(accepted).toBe(false)

    expect(dispatchIfAccepted).toHaveBeenCalledTimes(1)

    expect(onAccepted).not.toHaveBeenCalled()
  })
})
