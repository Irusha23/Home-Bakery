import { motion, useReducedMotion } from "motion/react"
import Illustration from "./Illustration"

type AppLoaderProps = {
  label?: string
  className?: string
}

/**
 * Appealing animated bakery loading indicator for splash and async states.
 */
export default function AppLoader({
  label = "Getting your kitchen ready...",
  className = "",
}: AppLoaderProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center py-8 text-center ${className}`.trim()}
    >
      <motion.div
        animate={
          reducedMotion
            ? undefined
            : {
                y: [0, -6, 0],
              }
        }
        transition={
          reducedMotion
            ? undefined
            : {
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      >
        <Illustration name="loading-cupcake" size="md" />
      </motion.div>
      <p className="mt-2 text-xs font-semibold tracking-wide text-muted">
        {label}
      </p>
    </div>
  )
}
