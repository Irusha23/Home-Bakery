export const IOS_EASE = [0.32, 0.72, 0, 1] as const

export const IOS_TRANSITION = {
  duration: 0.34,
  ease: IOS_EASE,
} as const

export const SHEET_SPRING = {
  type: "spring",
  damping: 32,
  stiffness: 380,
  mass: 0.85,
} as const

export const PILL_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 38,
} as const

export const MICRO_TRANSITION = {
  duration: 0.18,
  ease: IOS_EASE,
} as const

export const INSTANT_TRANSITION = {
  duration: 0.01,
} as const
