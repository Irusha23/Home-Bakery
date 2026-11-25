import { useEffect, useRef, useState } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Sun,
  X,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Button from "../ui/Button"
import { useBackHandler } from "../../lib/backStack"
import { INSTANT_TRANSITION, IOS_TRANSITION } from "../../lib/motion"
import { useBodyScrollLock } from "../../lib/useBodyScrollLock"

type KitchenModeOverlayProps = {
  open: boolean
  title: string
  subtitle?: string
  steps: string[]
  completedSteps: number[]
  onToggleStep: (stepIndex: number) => void
  onFinishAll?: () => void
  onClose: () => void
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

export default function KitchenModeOverlay({
  open,
  title,
  subtitle,
  steps,
  completedSteps,
  onToggleStep,
  onFinishAll,
  onClose,
}: KitchenModeOverlayProps) {
  const reducedMotion = useReducedMotion()
  const [stepIndex, setStepIndex] = useState(0)
  const [wakeLocked, setWakeLocked] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  useBackHandler(onClose, open)
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const firstIncomplete = steps.findIndex(
      (_, idx) => !completedSteps.includes(idx),
    )
    setStepIndex(firstIncomplete >= 0 ? firstIncomplete : 0)
  }, [open, steps.length])

  useEffect(() => {
    if (!open) return
    let active = true
    const requestWakeLock = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {
            request: (
              type: "screen",
            ) => Promise<{ release: () => Promise<void> }>
          }
        }
        if (nav.wakeLock) {
          const lock = await nav.wakeLock.request("screen")
          if (!active) {
            await lock.release()
            return
          }
          wakeLockRef.current = lock
          setWakeLocked(true)
        }
      } catch {
        setWakeLocked(false)
      }
    }
    void requestWakeLock()
    return () => {
      active = false
      setWakeLocked(false)
      void wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) {
      if (timerSeconds <= 0 && timerRunning) setTimerRunning(false)
      return
    }
    const id = window.setInterval(() => {
      setTimerSeconds((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerRunning, timerSeconds])

  if (!open) return null

  const totalSteps = Math.max(1, steps.length)
  const currentText =
    steps[stepIndex] ?? "Complete preparation and log final ingredients."
  const isCurrentDone = completedSteps.includes(stepIndex)
  const allDone =
    steps.length > 0 && steps.every((_, idx) => completedSteps.includes(idx))

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-cocoa text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Kitchen Mode: ${title}`}
    >
      <div className="screen-safe-top flex items-center justify-between gap-3 border-b border-white/15 px-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-section text-sage-soft">
            <Flame aria-hidden="true" size={14} />
            Kitchen Mode
            {wakeLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                <Sun aria-hidden="true" size={10} /> Screen awake
              </span>
            ) : null}
          </div>
          <h2 className="mt-0.5 truncate text-base font-semibold text-white">
            {title}
          </h2>
          {subtitle ? (
            <p className="truncate text-xs text-white/75">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit kitchen mode"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-button"
        >
          <X aria-hidden="true" size={22} />
        </button>
      </div>

      <div className="border-b border-white/10 bg-black/15 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tabular-nums tracking-tight">
              {formatTimer(timerSeconds)}
            </span>
            <button
              type="button"
              onClick={() => {
                if (timerSeconds === 0) setTimerSeconds(300)
                setTimerRunning((r) => !r)
              }}
              aria-label={timerRunning ? "Pause timer" : "Start timer"}
              className="inline-flex size-10 items-center justify-center rounded-full bg-sage text-white"
            >
              {timerRunning ? (
                <Pause aria-hidden="true" size={16} />
              ) : (
                <Play aria-hidden="true" size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false)
                setTimerSeconds(0)
              }}
              aria-label="Reset timer"
              className="inline-flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <RotateCcw aria-hidden="true" size={16} />
            </button>
          </div>
          <div className="flex gap-1.5">
            {[5, 10, 15].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setTimerSeconds((prev) => prev + mins * 60)
                  setTimerRunning(true)
                }}
                className="min-h-10 rounded-full bg-white/15 px-3 text-xs font-semibold text-white active:scale-button"
              >
                +{mins}m
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between px-5 py-6">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-section text-sage-soft">
            <span>
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <span>
              {completedSteps.length}/{steps.length} done
            </span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Go to step ${idx + 1}`}
                onClick={() => setStepIndex(idx)}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  idx === stepIndex
                    ? "bg-white"
                    : completedSteps.includes(idx)
                      ? "bg-sage"
                      : "bg-white/25"
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
            transition={reducedMotion ? INSTANT_TRANSITION : IOS_TRANSITION}
            className="my-auto rounded-card bg-white/10 p-6"
          >
            <p className="text-2xl font-semibold leading-snug text-white">
              {currentText}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="pb-safe-bottom space-y-3">
          <button
            type="button"
            onClick={() => {
              onToggleStep(stepIndex)
              if (!isCurrentDone && stepIndex < steps.length - 1) {
                setStepIndex(stepIndex + 1)
              }
            }}
            className={`flex min-h-kitchen-touch w-full items-center justify-center gap-2 rounded-control px-5 text-base font-semibold transition active:scale-button ${
              isCurrentDone ? "bg-success text-white" : "bg-white text-cocoa"
            }`}
          >
            <Check aria-hidden="true" size={20} />
            {isCurrentDone ? "Step completed" : "Mark step done"}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              className="min-h-kitchen-touch border-white/25 bg-white/15 text-white hover:bg-white/20"
              disabled={stepIndex === 0}
              leadingIcon={<ChevronLeft aria-hidden="true" size={20} />}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              Previous
            </Button>
            {stepIndex < steps.length - 1 ? (
              <Button
                variant="secondary"
                className="min-h-kitchen-touch border-white/25 bg-white/15 text-white hover:bg-white/20"
                trailingIcon={<ChevronRight aria-hidden="true" size={20} />}
                onClick={() =>
                  setStepIndex((i) => Math.min(steps.length - 1, i + 1))
                }
              >
                Next step
              </Button>
            ) : (
              <Button
                className="min-h-kitchen-touch"
                disabled={!allDone}
                onClick={() => {
                  onClose()
                  onFinishAll?.()
                }}
              >
                Mark ready
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
