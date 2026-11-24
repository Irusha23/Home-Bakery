export const IOS_EASE = [0.32, 0.72, 0, 1] as const

export const IOS_TRANSITION = {
  duration: 0.34,
  ease: IOS_EASE,
} as const

export const PUSH_TRANSITION = {
  duration: 0.34,
  ease: IOS_EASE,
} as const

export const TAB_TRANSITION = {
  duration: 0.2,
  ease: IOS_EASE,
} as const

export const DISCLOSURE_TRANSITION = {
  duration: 0.26,
  ease: IOS_EASE,
} as const

export const SHEET_SPRING = {
  type: "spring",
  damping: 32,
  stiffness: 380,
  mass: 0.85,
} as const

export const DIALOG_SPRING = {
  type: "spring",
  damping: 30,
  stiffness: 420,
  mass: 0.8,
} as const

export const PILL_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 38,
} as const

export const TACTILE_SPRING = {
  type: "spring",
  stiffness: 600,
  damping: 32,
} as const

export const MICRO_TRANSITION = {
  duration: 0.18,
  ease: IOS_EASE,
} as const

export const INSTANT_TRANSITION = {
  duration: 0.01,
} as const

export const tabFadeVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
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
  initial: { opacity: 0, scale: 1.05, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 4 },
} as const

export const listItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98 },
} as const
