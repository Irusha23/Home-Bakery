import { useEffect, useRef, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  INSTANT_TRANSITION,
  listItemVariants,
  PUSH_TRANSITION,
  TAB_TRANSITION,
} from "../../lib/motion"

type TabViewProps = {
  viewKey: string
  children: ReactNode
  className?: string
}

/**
 * Crisp iOS tab/segment settle without exit-wait blank gaps.
 */
export function TabView({ viewKey, children, className }: TabViewProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      key={viewKey}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? INSTANT_TRANSITION : TAB_TRANSITION}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const directionalPushVariants = {
  initial: (direction: number) => ({
    x: direction >= 0 ? "100%" : "-16%",
    opacity: direction >= 0 ? 1 : 0.88,
  }),
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? "-16%" : "100%",
    opacity: direction >= 0 ? 0.88 : 0.96,
  }),
}

type PushViewProps = {
  viewKey: string
  depth?: number
  isDetail?: boolean
  children: ReactNode
  className?: string
}

/**
 * iOS-style directional horizontal push/pop container for drill-down screens.
 * Increasing `depth` pushes forward from the right; decreasing `depth` pops back.
 */
export function PushView({
  viewKey,
  depth,
  isDetail,
  children,
  className = "",
}: PushViewProps) {
  const reducedMotion = useReducedMotion()
  const effectiveDepth = depth ?? (isDetail ? 1 : 0)
  const prevDepthRef = useRef(effectiveDepth)
  const direction = effectiveDepth >= prevDepthRef.current ? 1 : -1

  useEffect(() => {
    if (effectiveDepth > prevDepthRef.current && typeof window !== "undefined") {
      window.scrollTo(0, 0)
    }
    prevDepthRef.current = effectiveDepth
  }, [effectiveDepth, viewKey])

  return (
    <div className="relative w-full">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={viewKey}
          custom={direction}
          variants={reducedMotion ? undefined : directionalPushVariants}
          initial={reducedMotion ? { opacity: 0 } : "initial"}
          animate={reducedMotion ? { opacity: 1 } : "animate"}
          exit={reducedMotion ? { opacity: 0 } : "exit"}
          transition={reducedMotion ? INSTANT_TRANSITION : PUSH_TRANSITION}
          className={`w-full ${effectiveDepth > 0 ? "relative z-10 bg-ivory" : ""} ${className}`.trim()}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

type AnimatedListProps = {
  children: ReactNode
  className?: string
}

/**
 * Smoothly reflows list items when rows are added, removed, or filtered.
 */
export function AnimatedList({ children, className = "" }: AnimatedListProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </div>
  )
}

type AnimatedItemProps = {
  children: ReactNode
  className?: string
}

export function AnimatedItem({ children, className = "" }: AnimatedItemProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      layout={!reducedMotion}
      variants={reducedMotion ? undefined : listItemVariants}
      initial={reducedMotion ? false : "initial"}
      animate="animate"
      exit={reducedMotion ? { opacity: 0 } : "exit"}
      transition={reducedMotion ? INSTANT_TRANSITION : TAB_TRANSITION}
      className={`w-full ${className}`.trim()}
    >
      {children}
    </motion.div>
  )
}
