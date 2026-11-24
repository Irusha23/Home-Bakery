import { useEffect, useRef } from "react"

export type BackHandler = () => boolean | void

type BackEntry = {
  id: number
  invoke: BackHandler
}

let nextHandlerId = 1
const backStack: BackEntry[] = []

/**
 * Registers a hardware back handler on a LIFO stack (newest overlay wins).
 * Returning `false` from a handler passes control down to the previous handler.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  const id = nextHandlerId++
  backStack.push({ id, invoke: handler })
  return () => {
    const index = backStack.findIndex((entry) => entry.id === id)
    if (index !== -1) {
      backStack.splice(index, 1)
    }
  }
}

export function dispatchHardwareBack(): boolean {
  for (let i = backStack.length - 1; i >= 0; i -= 1) {
    const handled = backStack[i].invoke()
    if (handled !== false) {
      return true
    }
  }
  return false
}

export function getBackHandlerCount(): number {
  return backStack.length
}

export function clearBackHandlers(): void {
  backStack.length = 0
}

/**
 * React hook that binds Android's hardware/gesture back button while `enabled`
 * is true. Uses a ref so parent callback updates never reorder the LIFO stack.
 */
export function useBackHandler(
  handler: BackHandler | undefined,
  enabled = true,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled || !handlerRef.current) return
    return registerBackHandler(() => handlerRef.current?.())
  }, [enabled])
}
