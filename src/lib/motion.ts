export const IOS_EASE = [0.32, 0.72, 0, 1] as const

/**
 * Critically damped UI springs (damping ratio zeta ≈ 1.0, zero overshoot).
 * Larger/heavier elements carry more mass for slower start and settle.
 */
export const SPRING_MICRO = {
  type: "spring",
  stiffness: 520,
  damping: 36,
  mass: 0.6,
} as const

export const SPRING_CONTROL = {
  type: "spring",
  stiffness: 420,
  damping: 37,
  mass: 0.8,
} as const

export const SPRING_PANEL = {
  type: "spring",
  stiffness: 300,
  damping: 35,
  mass: 1.0,
} as const

export const SPRING_SHEET = {
  type: "spring",
  stiffness: 280,
  damping: 37,
  mass: 1.2,
} as const

export const SPRING_PAGE = {
  type: "spring",
  stiffness: 220,
  damping: 35,
  mass: 1.35,
} as const

/**
 * Underdamped springs (1-2 gentle oscillations) for playful or boundary cues.
 */
export const SPRING_ELASTIC = {
  type: "spring",
  stiffness: 420,
  damping: 22,
  mass: 0.8,
} as const

export const SPRING_NUDGE = {
  type: "spring",
  stiffness: 700,
  damping: 24,
  mass: 0.5,
} as const

/**
 * Gentle cross-fade for reduced motion: replaces movement without popping.
 */
export const REDUCED_MOTION_TRANSITION = {
  duration: 0.16,
  ease: [0.25, 0.1, 0.25, 1],
} as const

/**
 * Choreography stagger window (Rule 7: 30-80 ms between related siblings).
 */
export const STAGGER_STEP_SEC = 0.045
export const STAGGER_MAX_DELAY_SEC = 0.27

export function staggerDelay(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0
  return Math.min(index, 6) * STAGGER_STEP_SEC
}

// Semantic aliases preserving backwards compatibility across the codebase
export const IOS_TRANSITION = SPRING_PANEL
export const PUSH_TRANSITION = SPRING_PAGE
export const TAB_TRANSITION = SPRING_PANEL
export const DISCLOSURE_TRANSITION = SPRING_PANEL
export const SHEET_SPRING = SPRING_SHEET
export const DIALOG_SPRING = SPRING_SHEET
export const PILL_SPRING = SPRING_CONTROL
export const TACTILE_SPRING = SPRING_MICRO
export const MICRO_TRANSITION = SPRING_MICRO
export const INSTANT_TRANSITION = REDUCED_MOTION_TRANSITION

export const tabFadeVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
} as const

export const pushDetailVariants = {
  initial: { x: "100%", opacity: 1 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "100%", opacity: 0.96 },
} as const

export const pushRootVariants = {
  initial: { x: "-10%", opacity: 0.88 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "-10%", opacity: 0.88 },
} as const

export const dialogVariants = {
  initial: { opacity: 0, scale: 0.94, y: 14 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
} as const

export const listItemVariants = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
} as const
