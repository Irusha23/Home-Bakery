import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  acquireBodyScrollLock,
  releaseBodyScrollLock,
  resetBodyScrollLockForTests,
} from "./useBodyScrollLock"

function createMockEnv(initialScrollY = 240) {
  const scrollTo = vi.fn()
  const doc = {
    documentElement: {
      style: { overflow: "auto" },
    },
    body: {
      style: {
        overflow: "",
        position: "",
        top: "",
        left: "",
        right: "",
        width: "",
      },
    },
  } as unknown as Document
  const win = {
    scrollY: initialScrollY,
    pageYOffset: initialScrollY,
    scrollTo,
  } as unknown as Window
  return { doc, win, scrollTo }
}

describe("body scroll lock", () => {
  beforeEach(() => {
    resetBodyScrollLockForTests()
  })

  it("locks html and body at the current scroll offset and restores on release", () => {
    const { doc, win, scrollTo } = createMockEnv(320)

    acquireBodyScrollLock(doc, win)
    expect(doc.documentElement.style.overflow).toBe("hidden")
    expect(doc.body.style.overflow).toBe("hidden")
    expect(doc.body.style.position).toBe("fixed")
    expect(doc.body.style.top).toBe("-320px")
    expect(doc.body.style.width).toBe("100%")

    releaseBodyScrollLock(doc, win)
    expect(doc.documentElement.style.overflow).toBe("auto")
    expect(doc.body.style.overflow).toBe("")
    expect(doc.body.style.position).toBe("")
    expect(doc.body.style.top).toBe("")
    expect(scrollTo).toHaveBeenCalledWith(0, 320)
  })

  it("keeps background locked until nested overlays all release", () => {
    const { doc, win, scrollTo } = createMockEnv(150)

    acquireBodyScrollLock(doc, win)
    acquireBodyScrollLock(doc, win)

    releaseBodyScrollLock(doc, win)
    expect(doc.body.style.position).toBe("fixed")
    expect(scrollTo).not.toHaveBeenCalled()

    releaseBodyScrollLock(doc, win)
    expect(doc.body.style.position).toBe("")
    expect(scrollTo).toHaveBeenCalledWith(0, 150)
  })
})
