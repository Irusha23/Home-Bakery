import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import { Check, Loader2 } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  REDUCED_MOTION_TRANSITION,
  SPRING_CONTROL,
  SPRING_ELASTIC,
  SPRING_MICRO,
  SPRING_NUDGE,
} from "../../lib/motion"
import { TouchRippleLayer, useTouchRipple } from "./TouchRipple"

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost"
type ButtonSize = "default" | "compact"
type ButtonFeedbackState = "idle" | "success" | "error"

type SafeButtonHtmlProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
>

type ButtonProps = SafeButtonHtmlProps & {
  children: ReactNode
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  disabledReason?: string
  loading?: boolean
  feedbackState?: ButtonFeedbackState
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-sage text-white shadow-button hover:bg-sage-dark",
  secondary: "border border-warm-border bg-white text-cocoa hover:bg-ivory",
  soft: "bg-sage-soft text-sage-dark hover:bg-sage-soft-strong",
  ghost: "bg-transparent text-cocoa hover:bg-sage-soft",
}

const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-touch rounded-control px-5 py-3 text-sm",
  compact: "min-h-touch rounded-control px-3.5 py-1.5 text-xs",
}

export default function Button({
  children,
  className = "",
  leadingIcon,
  trailingIcon,
  variant = "primary",
  size = "default",
  fullWidth = false,
  disabled = false,
  disabledReason,
  loading = false,
  feedbackState = "idle",
  type = "button",
  onClick,
  onPointerDown,
  ...props
}: ButtonProps) {
  const reducedMotion = useReducedMotion()
  const { ripples, triggerRipple, removeRipple } = useTouchRipple()
  const [nudgeCount, setNudgeCount] = useState(0)
  const [showReason, setShowReason] = useState(false)
  const reasonTimerRef = useRef<number | null>(null)
  const isBlocked = Boolean(disabled || loading)

  useEffect(() => {
    if (!isBlocked) setNudgeCount(0)
  }, [isBlocked])

  useEffect(() => {
    return () => {
      if (reasonTimerRef.current !== null) {
        window.clearTimeout(reasonTimerRef.current)
      }
    }
  }, [])

  const triggerBlockedFeedback = () => {
    setNudgeCount((c) => c + 1)
    if (disabled) {
      setShowReason(true)
      if (reasonTimerRef.current !== null) {
        window.clearTimeout(reasonTimerRef.current)
      }
      reasonTimerRef.current = window.setTimeout(() => {
        setShowReason(false)
      }, 1800)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    triggerRipple(event)
    onPointerDown?.(event)
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isBlocked) {
      event.preventDefault()
      event.stopPropagation()
      triggerBlockedFeedback()
      return
    }
    onClick?.(event)
  }

  const stateColorOverride =
    feedbackState === "success"
      ? "!bg-success !text-white !border-success"
      : feedbackState === "error"
        ? "!bg-error !text-white !border-error"
        : ""

  const isLightRipple =
    variant === "primary" || feedbackState !== "idle"

  return (
    <motion.button
      type={type}
      aria-disabled={isBlocked || undefined}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      whileTap={
        reducedMotion
          ? undefined
          : { scale: isBlocked ? 0.98 : 0.96 }
      }
      whileHover={
        reducedMotion || isBlocked ? undefined : { y: -0.5 }
      }
      animate={
        isBlocked && nudgeCount > 0
          ? reducedMotion
            ? { opacity: [disabled ? 0.5 : 0.72, 0.78, disabled ? 0.5 : 1] }
            : { x: [0, -5, 4, -2, 0], opacity: disabled ? 0.5 : 1 }
          : feedbackState === "error" && !reducedMotion
            ? { x: [0, -4, 4, -2, 0], opacity: disabled ? 0.5 : 1 }
            : { x: 0, opacity: disabled ? 0.5 : 1 }
      }
      onAnimationComplete={() => {
        if (nudgeCount > 0) setNudgeCount(0)
      }}
      transition={
        isBlocked && nudgeCount > 0 || feedbackState === "error"
          ? SPRING_NUDGE
          : reducedMotion
            ? REDUCED_MOTION_TRANSITION
            : SPRING_CONTROL
      }
      className={`relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-[color,background-color,border-color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30 ${variantClasses[variant]} ${sizeClasses[size]} ${stateColorOverride} ${
        disabled ? "cursor-not-allowed" : ""
      } ${fullWidth ? "w-full" : ""} ${className}`.trim()}
      {...props}
    >
      <TouchRippleLayer
        ripples={ripples}
        onDone={removeRipple}
        tone={isLightRipple ? "light" : "dark"}
      />

      <AnimatePresence>
        {showReason ? (
          <motion.span
            role="status"
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 4, scale: 0.9 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 4, scale: 0.9 }
            }
            transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO}
            className="pointer-events-none absolute -top-9 left-1/2 z-30 origin-bottom -translate-x-1/2 whitespace-nowrap rounded-full bg-cocoa px-2.5 py-1 text-[11px] font-medium text-white shadow-card"
          >
            {disabledReason ?? "Unavailable right now"}
          </motion.span>
        ) : null}
      </AnimatePresence>

      {loading ? (
        <Loader2 aria-hidden="true" size={15} className="animate-spin" />
      ) : feedbackState === "success" ? (
        <motion.span
          initial={reducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_ELASTIC
          }
          className="inline-flex"
        >
          <Check aria-hidden="true" size={15} />
        </motion.span>
      ) : (
        leadingIcon
      )}
      <span className="relative z-10">{children}</span>
      {trailingIcon}
    </motion.button>
  )
}

type IconButtonProps = SafeButtonHtmlProps & {
  label: string
  children: ReactNode
  disabledReason?: string
}

export function IconButton({
  label,
  children,
  className = "",
  disabled = false,
  disabledReason,
  type = "button",
  onClick,
  onPointerDown,
  ...props
}: IconButtonProps) {
  const reducedMotion = useReducedMotion()
  const { ripples, triggerRipple, removeRipple } = useTouchRipple()
  const [nudgeCount, setNudgeCount] = useState(0)
  const [showReason, setShowReason] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!disabled) setNudgeCount(0)
  }, [disabled])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    triggerRipple(event)
    onPointerDown?.(event)
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault()
      event.stopPropagation()
      setNudgeCount((c) => c + 1)
      if (disabledReason) {
        setShowReason(true)
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setShowReason(false), 1800)
      }
      return
    }
    onClick?.(event)
  }

  return (
    <motion.button
      type={type}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      whileTap={reducedMotion ? undefined : { scale: disabled ? 0.97 : 0.94 }}
      whileHover={reducedMotion || disabled ? undefined : { scale: 1.03 }}
      animate={
        disabled && nudgeCount > 0
          ? reducedMotion
            ? { opacity: [0.5, 0.75, 0.5] }
            : { x: [0, -4, 3, 0], opacity: 0.5 }
          : { x: 0, opacity: disabled ? 0.5 : 1 }
      }
      onAnimationComplete={() => {
        if (nudgeCount > 0) setNudgeCount(0)
      }}
      transition={
        disabled && nudgeCount > 0
          ? SPRING_NUDGE
          : reducedMotion
            ? REDUCED_MOTION_TRANSITION
            : SPRING_MICRO
      }
      className={`relative inline-flex size-touch shrink-0 items-center justify-center rounded-full border border-warm-border bg-white text-cocoa shadow-subtle transition-[color,background-color,border-color,box-shadow] duration-200 ease-out hover:bg-sage-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sage/30 ${
        disabled ? "cursor-not-allowed" : ""
      } ${className}`.trim()}
      {...props}
    >
      <TouchRippleLayer ripples={ripples} onDone={removeRipple} tone="dark" />
      <AnimatePresence>
        {showReason && disabledReason ? (
          <motion.span
            role="status"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
            transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_MICRO}
            className="pointer-events-none absolute -top-9 left-1/2 z-30 origin-bottom -translate-x-1/2 whitespace-nowrap rounded-full bg-cocoa px-2.5 py-1 text-[11px] font-medium text-white shadow-card"
          >
            {disabledReason}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <span className="relative z-10 inline-flex items-center justify-center">
        {children}
      </span>
    </motion.button>
  )
}
