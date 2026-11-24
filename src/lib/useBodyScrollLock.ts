import { useEffect } from "react"

type SavedStyles = {
  htmlOverflow: string
  bodyOverflow: string
  bodyPosition: string
  bodyTop: string
  bodyLeft: string
  bodyRight: string
  bodyWidth: string
  scrollY: number
}

let activeLockCount = 0
let savedStyles: SavedStyles | null = null

export function acquireBodyScrollLock(
  doc: Document = document,
  win: Window = window,
): void {
  if (activeLockCount === 0) {
    const { body, documentElement } = doc
    const scrollY = win.scrollY || win.pageYOffset || 0
    savedStyles = {
      htmlOverflow: documentElement.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      scrollY,
    }
    documentElement.style.overflow = "hidden"
    body.style.overflow = "hidden"
    body.style.position = "fixed"
    body.style.top = `-${scrollY}px`
    body.style.left = "0"
    body.style.right = "0"
    body.style.width = "100%"
  }
  activeLockCount += 1
}

export function releaseBodyScrollLock(
  doc: Document = document,
  win: Window = window,
): void {
  if (activeLockCount <= 0) return
  activeLockCount -= 1
  if (activeLockCount > 0 || !savedStyles) return

  const { body, documentElement } = doc
  const restore = savedStyles
  savedStyles = null

  documentElement.style.overflow = restore.htmlOverflow
  body.style.overflow = restore.bodyOverflow
  body.style.position = restore.bodyPosition
  body.style.top = restore.bodyTop
  body.style.left = restore.bodyLeft
  body.style.right = restore.bodyRight
  body.style.width = restore.bodyWidth
  win.scrollTo(0, restore.scrollY)
}

export function resetBodyScrollLockForTests(): void {
  activeLockCount = 0
  savedStyles = null
}

/**
 * Reference-counted iOS-safe body scroll lock. Prevents background pages
 * from scrolling on mobile Safari/Chrome while a Sheet or Dialog is open.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === "undefined" || typeof window === "undefined") {
      return
    }
    acquireBodyScrollLock(document, window)
    return () => {
      releaseBodyScrollLock(document, window)
    }
  }, [locked])
}
