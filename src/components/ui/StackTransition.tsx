import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { INSTANT_TRANSITION, IOS_TRANSITION } from "../../lib/motion"

type StackTransitionProps = {
  routeKey: string
  direction?: 1 | -1
  children: ReactNode
}

export default function StackTransition({
  routeKey,
  direction = 1,
  children,
}: StackTransitionProps) {
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={
          reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * 24 }
        }
        animate={{ opacity: 1, x: 0 }}
        exit={
          reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -18 }
        }
        transition={reducedMotion ? INSTANT_TRANSITION : IOS_TRANSITION}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
