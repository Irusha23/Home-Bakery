import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearBackHandlers,
  dispatchHardwareBack,
  getBackHandlerCount,
  registerBackHandler,
} from "./backStack"

describe("Android hardware back stack", () => {
  afterEach(() => {
    clearBackHandlers()
  })

  it("invokes handlers in LIFO order so topmost Dialog/Sheet wins over screen back", () => {
    const screenBack = vi.fn(() => true)
    const sheetClose = vi.fn(() => true)
    const dialogClose = vi.fn(() => true)

    const unregScreen = registerBackHandler(screenBack)
    const unregSheet = registerBackHandler(sheetClose)
    const unregDialog = registerBackHandler(dialogClose)
    expect(getBackHandlerCount()).toBe(3)

    expect(dispatchHardwareBack()).toBe(true)
    expect(dialogClose).toHaveBeenCalledTimes(1)
    expect(sheetClose).not.toHaveBeenCalled()
    expect(screenBack).not.toHaveBeenCalled()

    unregDialog()
    expect(dispatchHardwareBack()).toBe(true)
    expect(sheetClose).toHaveBeenCalledTimes(1)
    expect(screenBack).not.toHaveBeenCalled()

    unregSheet()
    expect(dispatchHardwareBack()).toBe(true)
    expect(screenBack).toHaveBeenCalledTimes(1)

    unregScreen()
    expect(dispatchHardwareBack()).toBe(false)
  })

  it("falls through to earlier handlers when a handler explicitly returns false", () => {
    const earlier = vi.fn(() => true)
    const passthrough = vi.fn(() => false)

    registerBackHandler(earlier)
    registerBackHandler(passthrough)

    expect(dispatchHardwareBack()).toBe(true)
    expect(passthrough).toHaveBeenCalledTimes(1)
    expect(earlier).toHaveBeenCalledTimes(1)
  })
})
