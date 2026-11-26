import { useEffect, useRef, useState } from "react"
import {
  AlarmClock,
  BellOff,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
  Utensils,
  X,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Illustration from "../ui/Illustration"
import ItemThumbnail from "../ui/ItemThumbnail"
import { useBackHandler } from "../../lib/backStack"
import { formatQuantity } from "../../lib/format"
import { compatibleUnits, fromBaseQuantity, toBaseQuantity } from "../../lib/inventory"
import {
  convertDraftOnUnitChange,
  formatEditableQuantity,
  sanitizeNumericDraft,
} from "../../lib/quantityInput"
import {
  addTimeToStepTimer,
  clearStepTimer,
  dismissRingingAlarm,
  getRemainingSeconds,
  makeStepAlarmId,
  moveStepTimers,
  pauseStepTimer,
  resumeStepTimer,
  setKeepScreenOn,
  shiftStepTimersOnInsert,
  startStepTimer,
  useKitchenAlarms,
} from "../../lib/kitchenAlarm"
import {
  INSTANT_TRANSITION,
  IOS_TRANSITION,
  REDUCED_MOTION_TRANSITION,
  SPRING_SHEET,
} from "../../lib/motion"
import { setCookModeStatusBar } from "../../lib/nativeBridge"
import { useBodyScrollLock } from "../../lib/useBodyScrollLock"
import type { BaseUnit, Unit } from "../../types"

export type CookModeIngredientItem = {
  inventoryId: string
  name: string
  baseQuantity: number
  plannedBaseQuantity: number
  baseUnit: BaseUnit
  gramsPerTsp: number
  mlPerTsp: number
  image?: string
}

type KitchenModeOverlayProps = {
  open: boolean
  preparationId: string
  jumpToStep?: { index: number; key: number }
  title: string
  subtitle?: string
  productImage?: string
  orderInstructions?: string
  ingredients?: CookModeIngredientItem[]
  steps: string[]
  customStepIndexes?: number[]
  completedSteps: number[]
  canSaveToRecipe?: boolean
  onToggleStep: (stepIndex: number) => void
  onUpdateIngredientQuantity?: (inventoryId: string, baseQuantity: number) => void
  onAddOptionalStep?: (
    text: string,
    saveToRecipe: boolean,
    insertAfterIndex?: number,
  ) => void
  onEditStep?: (stepIndex: number, text: string, saveToRecipe: boolean) => void
  onRemoveOptionalStep?: (stepIndex: number) => void
  onMoveStep?: (fromIndex: number, toIndex: number) => void
  onFinishAll?: () => void
  onClose: () => void
}

function formatTimer(seconds: number) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

const TIMER_PRESETS_MIN = [5, 10, 15, 30]

export default function KitchenModeOverlay({
  open,
  preparationId,
  jumpToStep,
  title,
  subtitle,
  productImage,
  orderInstructions,
  ingredients = [],
  steps,
  customStepIndexes = [],
  completedSteps,
  canSaveToRecipe = false,
  onToggleStep,
  onUpdateIngredientQuantity,
  onAddOptionalStep,
  onEditStep,
  onRemoveOptionalStep,
  onMoveStep,
  onFinishAll,
  onClose,
}: KitchenModeOverlayProps) {
  const reducedMotion = useReducedMotion()
  const [stepIndex, setStepIndex] = useState(0)
  const [wakeLocked, setWakeLocked] = useState(false)
  const [showOrderNote, setShowOrderNote] = useState(false)
  const [showTimerPicker, setShowTimerPicker] = useState(false)
  const [customMinutes, setCustomMinutes] = useState("20")
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [showIngredients, setShowIngredients] = useState(false)
  const [checkedIngredientIds, setCheckedIngredientIds] = useState<string[]>([])
  const [ingredientUnits, setIngredientUnits] = useState<Record<string, Unit>>(
    {},
  )
  const [ingredientDrafts, setIngredientDrafts] = useState<
    Record<string, string>
  >({})
  const [stepEditor, setStepEditor] = useState<
    { kind: "add" } | { kind: "edit"; index: number } | null
  >(null)
  const [stepDraftText, setStepDraftText] = useState("")
  const [saveToRecipe, setSaveToRecipe] = useState(false)
  const [inspectingStepsWhenDone, setInspectingStepsWhenDone] = useState(false)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  const { timers, nowMs } = useKitchenAlarms()

  useBackHandler(() => {
    if (stepEditor) {
      setStepEditor(null)
      return
    }
    if (showIngredients) {
      setShowIngredients(false)
      return
    }
    if (showAllSteps) {
      setShowAllSteps(false)
      return
    }
    onClose()
  }, open)
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (stepEditor) {
          setStepEditor(null)
        } else if (showIngredients) {
          setShowIngredients(false)
        } else if (showAllSteps) {
          setShowAllSteps(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose, stepEditor, showAllSteps, showIngredients])

  useEffect(() => {
    if (!open) return
    setCookModeStatusBar(true, "#FAF5ED", true)
    void setKeepScreenOn(true)
    return () => {
      setCookModeStatusBar(false)
      void setKeepScreenOn(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const firstIncomplete = steps.findIndex(
      (_, idx) => !completedSteps.includes(idx),
    )
    setStepIndex(
      firstIncomplete >= 0 ? firstIncomplete : Math.max(0, steps.length - 1),
    )
    setInspectingStepsWhenDone(false)
    setShowTimerPicker(false)
  }, [open])

  useEffect(() => {
    if (!open || !jumpToStep) return
    const safeIdx = Math.max(0, Math.min(steps.length - 1, jumpToStep.index))
    setStepIndex(safeIdx)
    setInspectingStepsWhenDone(true)
    setShowTimerPicker(false)
    setShowAllSteps(false)
    setShowIngredients(false)
    setStepEditor(null)
  }, [open, jumpToStep?.key])

  useEffect(() => {
    if (stepIndex >= steps.length && steps.length > 0) {
      setStepIndex(steps.length - 1)
    }
  }, [steps.length, stepIndex])

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
        } else {
          setWakeLocked(true)
        }
      } catch {
        setWakeLocked(true)
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

  if (!open) return null

  const totalSteps = Math.max(1, steps.length)
  const currentText =
    steps[stepIndex] ?? "Complete preparation and log final ingredients."
  const isCurrentDone = completedSteps.includes(stepIndex)
  const isCurrentCustom = customStepIndexes.includes(stepIndex)
  const allDone =
    steps.length > 0 && steps.every((_, idx) => completedSteps.includes(idx))
  const showCelebration = allDone && !inspectingStepsWhenDone

  const prepTimers = timers.filter((t) => t.preparationId === preparationId)
  const currentAlarmId = makeStepAlarmId(preparationId, stepIndex)
  const currentTimer =
    prepTimers.find((t) => t.alarmId === currentAlarmId) ?? null
  const currentRemaining = currentTimer
    ? getRemainingSeconds(currentTimer, nowMs)
    : 0
  const timerProgress =
    currentTimer && currentTimer.totalSeconds > 0
      ? Math.max(
          0,
          Math.min(100, (currentRemaining / currentTimer.totalSeconds) * 100),
        )
      : 0

  const startCurrentStepTimer = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return
    void startStepTimer({
      preparationId,
      stepIndex,
      durationSeconds: Math.round(minutes * 60),
      title,
      stepLabel: `Step ${stepIndex + 1}: ${currentText.slice(0, 48)}`,
    })
    setShowTimerPicker(false)
  }

  const insertAfterIndex = showCelebration ? steps.length - 1 : stepIndex
  const insertAtIndex = Math.max(0, Math.min(steps.length, insertAfterIndex + 1))

  const openAddStepSheet = () => {
    setStepDraftText("")
    setSaveToRecipe(false)
    setStepEditor({ kind: "add" })
  }

  const openEditStepSheet = (index: number) => {
    setStepDraftText(steps[index] ?? "")
    setSaveToRecipe(false)
    setStepEditor({ kind: "edit", index })
  }

  const handleSaveStepEditor = () => {
    const trimmed = stepDraftText.trim()
    if (!trimmed || !stepEditor) return

    if (stepEditor.kind === "add" && onAddOptionalStep) {
      shiftStepTimersOnInsert(preparationId, insertAtIndex)
      onAddOptionalStep(trimmed, saveToRecipe, insertAfterIndex)
      setInspectingStepsWhenDone(true)
      setStepIndex(insertAtIndex)
    } else if (stepEditor.kind === "edit" && onEditStep) {
      onEditStep(stepEditor.index, trimmed, saveToRecipe)
    }

    setStepDraftText("")
    setSaveToRecipe(false)
    setStepEditor(null)
  }

  const handleMove = (fromIndex: number, toIndex: number) => {
    if (!onMoveStep) return
    if (toIndex < 0 || toIndex >= steps.length || fromIndex === toIndex) return
    moveStepTimers(preparationId, fromIndex, toIndex)
    onMoveStep(fromIndex, toIndex)
    if (stepIndex === fromIndex) {
      setStepIndex(toIndex)
    } else if (
      fromIndex < toIndex &&
      stepIndex > fromIndex &&
      stepIndex <= toIndex
    ) {
      setStepIndex(stepIndex - 1)
    } else if (
      fromIndex > toIndex &&
      stepIndex >= toIndex &&
      stepIndex < fromIndex
    ) {
      setStepIndex(stepIndex + 1)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#FAF5ED] text-[#3B2F26]"
      role="dialog"
      aria-modal="true"
      aria-label={`Cook Mode: ${title}`}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col">
      {/* Minimalistic Light Header */}
      <div className="screen-safe-top page-x border-b border-[#EAE0D0] pb-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-section text-[#78685B]">
            <span>Cook Mode</span>
            {wakeLocked ? (
              <span
                title="Screen stays awake"
                className="inline-block size-2 rounded-full bg-amber-500"
              />
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowIngredients(true)}
              aria-label="View ingredients"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#E2D4C0] bg-[#EFE6D8] px-3.5 text-xs font-semibold text-[#3B2F26] transition active:scale-button"
            >
              <Utensils aria-hidden="true" size={14} className="text-amber-700" />
              <span>Ingredients</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAllSteps(true)}
              aria-label="View all steps"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#E2D4C0] bg-[#EFE6D8] px-3.5 text-xs font-semibold text-[#3B2F26] transition active:scale-button"
            >
              <ListChecks aria-hidden="true" size={14} className="text-amber-700" />
              <span>Steps</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Exit cook mode"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[#E2D4C0] bg-[#EFE6D8] text-[#3B2F26] transition active:scale-button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {productImage ? (
            <div className="shrink-0 rounded-2xl border border-[#EAE0D0] bg-white p-1 shadow-subtle">
              <ItemThumbnail image={productImage} alt={title} size="xs" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug text-[#3B2F26]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-[#78685B]">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {orderInstructions && orderInstructions.trim().length > 0 ? (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setShowOrderNote((v) => !v)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900"
            >
              <StickyNote
                aria-hidden="true"
                size={13}
                className="shrink-0 text-amber-600"
              />
              <span className={showOrderNote ? "text-left" : "truncate"}>
                {orderInstructions}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Main Content */}
      <div className="page-x mx-auto flex w-full max-w-2xl flex-1 flex-col justify-between overflow-y-auto py-5">
        {/* Progress & Active Timers Strip */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-section text-[#78685B]">
              <span>
                Step {stepIndex + 1} of {totalSteps}
              </span>
              <span className="tabular-nums text-emerald-700">
                {completedSteps.length}/{steps.length} done
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to step ${idx + 1}`}
                  onClick={() => {
                    setInspectingStepsWhenDone(true)
                    setShowTimerPicker(false)
                    setStepIndex(idx)
                  }}
                  className={`h-2.5 flex-1 rounded-full transition-colors ${
                    idx === stepIndex && !showCelebration
                      ? "bg-amber-500"
                      : completedSteps.includes(idx)
                        ? "bg-emerald-500"
                        : "bg-[#E2D4C0]"
                  }`}
                />
              ))}
            </div>
          </div>

          {prepTimers.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {prepTimers.map((timer) => {
                const secs = getRemainingSeconds(timer, nowMs)
                const isRinging = timer.status === "ringing"
                const isActiveStep =
                  timer.stepIndex === stepIndex && !showCelebration
                return (
                  <button
                    key={timer.alarmId}
                    type="button"
                    onClick={() => {
                      setInspectingStepsWhenDone(true)
                      setShowTimerPicker(false)
                      setStepIndex(timer.stepIndex)
                    }}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition ${
                      isRinging
                        ? "animate-pulse bg-amber-500 text-white"
                        : isActiveStep
                          ? "border border-amber-300 bg-amber-100 text-amber-900"
                          : "border border-[#EAE0D0] bg-white text-[#3B2F26]"
                    }`}
                  >
                    <AlarmClock aria-hidden="true" size={13} />
                    <span>
                      Step {timer.stepIndex + 1} ·{" "}
                      {isRinging ? "Time's up!" : formatTimer(secs)}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* Center Hero Step Card or Completion Celebration */}
        <div className="my-auto py-4">
          <AnimatePresence mode="wait">
            {showCelebration ? (
              <motion.div
                key="celebration"
                initial={
                  reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
                }
                animate={{ opacity: 1, scale: 1 }}
                exit={
                  reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
                }
                transition={
                  reducedMotion ? INSTANT_TRANSITION : IOS_TRANSITION
                }
                className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-card"
              >
                <Illustration name="caught-up-cupcake" size="md" />
                <p className="mt-3 text-xs font-bold uppercase tracking-section text-emerald-700">
                  All {steps.length} steps complete
                </p>
                <h3 className="mt-1 text-2xl font-bold text-[#3B2F26]">
                  Ready to finish up!
                </h3>
                <p className="mt-1.5 text-sm text-[#78685B]">
                  Tap Completed below to mark this item ready and return to your order.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={stepIndex}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                transition={reducedMotion ? INSTANT_TRANSITION : IOS_TRANSITION}
                className="space-y-4 rounded-3xl border border-[#EAE0D0] bg-white p-6 shadow-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                      Step {stepIndex + 1}
                    </span>
                    {isCurrentCustom ? (
                      <span className="inline-flex items-center rounded-full bg-[#EFE6D8] px-2.5 py-1 text-[11px] font-medium text-[#78685B]">
                        Optional note
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onEditStep ? (
                      <button
                        type="button"
                        aria-label={`Edit step ${stepIndex + 1}`}
                        onClick={() => openEditStepSheet(stepIndex)}
                        className="inline-flex size-9 items-center justify-center rounded-full bg-[#FAF5ED] text-[#78685B] hover:text-[#3B2F26]"
                      >
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                    ) : null}
                    {isCurrentCustom && onRemoveOptionalStep && steps.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove optional step ${stepIndex + 1}`}
                        onClick={() => onRemoveOptionalStep(stepIndex)}
                        className="inline-flex size-9 items-center justify-center rounded-full bg-[#FAF5ED] text-[#78685B] hover:text-rose-600"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <p className="text-2xl font-semibold leading-snug text-[#3B2F26]">
                  {currentText}
                </p>

                {/* Optional Per-Step Timer */}
                <div className="border-t border-[#EFE6D8] pt-4">
                  {currentTimer ? (
                    currentTimer.status === "ringing" ? (
                      <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-section text-amber-800">
                            Timer finished!
                          </span>
                          <span className="text-lg font-bold tabular-nums text-[#3B2F26]">
                            00:00
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void dismissRingingAlarm(currentTimer.alarmId)
                          }
                          className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 text-sm font-bold text-white active:scale-button"
                        >
                          <BellOff aria-hidden="true" size={18} />
                          Turn off alarm
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlarmClock
                              aria-hidden="true"
                              size={18}
                              className="text-amber-600"
                            />
                            <span className="text-2xl font-bold tabular-nums tracking-tight text-[#3B2F26]">
                              {formatTimer(currentRemaining)}
                            </span>
                            {currentTimer.status === "paused" ? (
                              <span className="rounded-full bg-[#EFE6D8] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#78685B]">
                                Paused
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void clearStepTimer(currentTimer.alarmId)
                            }
                            aria-label="Clear step timer"
                            className="inline-flex h-9 items-center gap-1 rounded-full bg-[#EFE6D8] px-3 text-xs font-semibold text-[#3B2F26]"
                          >
                            <RotateCcw aria-hidden="true" size={13} />
                            Clear
                          </button>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-[#EFE6D8]">
                          <div
                            className="h-full rounded-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${timerProgress}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void (currentTimer.status === "running"
                                ? pauseStepTimer(currentTimer.alarmId)
                                : resumeStepTimer(currentTimer.alarmId))
                            }
                            className="flex min-h-[3.25rem] items-center justify-center gap-1.5 rounded-2xl bg-[#3B2F26] px-3 text-sm font-bold text-[#FAF5ED] active:scale-button"
                          >
                            {currentTimer.status === "running" ? (
                              <>
                                <Pause aria-hidden="true" size={16} />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play aria-hidden="true" size={16} />
                                Resume
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void addTimeToStepTimer(currentTimer.alarmId, 60)
                            }
                            className="flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-[#E2D4C0] bg-[#EFE6D8] px-3 text-sm font-semibold text-[#3B2F26] active:scale-button"
                          >
                            +1m
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void addTimeToStepTimer(currentTimer.alarmId, 300)
                            }
                            className="flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-[#E2D4C0] bg-[#EFE6D8] px-3 text-sm font-semibold text-[#3B2F26] active:scale-button"
                          >
                            +5m
                          </button>
                        </div>
                      </div>
                    )
                  ) : showTimerPicker ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#78685B]">
                          Set timer for Step {stepIndex + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTimerPicker(false)}
                          className="text-xs font-semibold text-[#78685B] hover:text-[#3B2F26]"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {TIMER_PRESETS_MIN.map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => startCurrentStepTimer(mins)}
                            className="min-h-[3rem] rounded-2xl border border-[#E2D4C0] bg-[#EFE6D8] text-sm font-bold text-[#3B2F26] transition hover:bg-amber-100 active:scale-button"
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={480}
                          inputMode="numeric"
                          aria-label="Custom minutes"
                          value={customMinutes}
                          onChange={(e) => setCustomMinutes(e.target.value)}
                          className="h-12 w-24 rounded-2xl border border-[#E2D4C0] bg-[#FAF5ED] px-3 text-center text-base font-bold text-[#3B2F26] outline-none focus:border-amber-500"
                        />
                        <span className="text-xs font-medium text-[#78685B]">
                          min
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            startCurrentStepTimer(Number(customMinutes))
                          }
                          className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#D97706] px-4 text-sm font-bold text-white active:scale-button"
                        >
                          <Play aria-hidden="true" size={16} />
                          Start timer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTimerPicker(true)}
                      className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl border border-[#E2D4C0] bg-[#FAF5ED] px-4 text-sm font-semibold text-[#3B2F26] transition hover:bg-[#EFE6D8] active:scale-button"
                    >
                      <AlarmClock
                        aria-hidden="true"
                        size={17}
                        className="text-amber-600"
                      />
                      <span>Set step timer (optional)</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Thumb-Reachable Bottom Action Dock (Warm Light Palette) */}
        <div className="pb-safe-bottom space-y-3">
          {allDone ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onFinishAll?.()
              }}
              className="flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-5 text-lg font-bold text-white shadow-button transition active:scale-button"
            >
              <CheckCircle2 aria-hidden="true" size={22} />
              Completed
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onToggleStep(stepIndex)
                if (!isCurrentDone && stepIndex < steps.length - 1) {
                  setShowTimerPicker(false)
                  setStepIndex(stepIndex + 1)
                }
              }}
              className={`flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-2xl px-5 text-lg font-bold shadow-button transition active:scale-button ${
                isCurrentDone
                  ? "bg-emerald-600 text-white"
                  : "bg-[#3B2F26] text-[#FAF5ED]"
              }`}
            >
              <Check aria-hidden="true" size={22} />
              {isCurrentDone ? "Step done ✓" : "Mark step done"}
            </button>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={!showCelebration && stepIndex === 0}
              onClick={() => {
                if (showCelebration) {
                  setInspectingStepsWhenDone(true)
                  setStepIndex(Math.max(0, steps.length - 1))
                } else {
                  setShowTimerPicker(false)
                  setStepIndex((i) => Math.max(0, i - 1))
                }
              }}
              className="flex min-h-[3.25rem] items-center justify-center gap-1 rounded-2xl border border-[#E2D4C0] bg-[#EFE6D8] px-3 text-sm font-semibold text-[#3B2F26] transition disabled:opacity-40 active:scale-button"
            >
              <ChevronLeft aria-hidden="true" size={18} />
              <span>Prev</span>
            </button>

            <button
              type="button"
              disabled={!onAddOptionalStep}
              onClick={openAddStepSheet}
              className="flex min-h-[3.25rem] items-center justify-center gap-1.5 rounded-2xl border border-amber-300/70 bg-amber-50 px-3 text-sm font-semibold text-amber-900 transition disabled:opacity-40 active:scale-button"
            >
              <Plus aria-hidden="true" size={17} />
              <span>Add step</span>
            </button>

            <button
              type="button"
              disabled={
                showCelebration || (!allDone && stepIndex >= steps.length - 1)
              }
              onClick={() => {
                setShowTimerPicker(false)
                if (stepIndex >= steps.length - 1 && allDone) {
                  setInspectingStepsWhenDone(false)
                } else {
                  setStepIndex((i) => Math.min(steps.length - 1, i + 1))
                }
              }}
              className="flex min-h-[3.25rem] items-center justify-center gap-1 rounded-2xl border border-[#E2D4C0] bg-[#EFE6D8] px-3 text-sm font-semibold text-[#3B2F26] transition disabled:opacity-40 active:scale-button"
            >
              <span>Next</span>
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Pop-Up Ingredients Sheet with Live Unit Conversion */}
      <AnimatePresence>
        {showIngredients ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : INSTANT_TRANSITION
            }
            className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/35"
            onClick={() => setShowIngredients(false)}
          >
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_SHEET}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto max-h-[82dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t border-[#EAE0D0] bg-[#FAF5ED] p-5 pb-safe-bottom text-[#3B2F26]"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Ingredients &amp; items</h3>
                  <p className="text-xs text-[#78685B]">
                    Tap to tick · edit quantity or switch unit
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIngredients(false)}
                  aria-label="Close ingredients list"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-[#EFE6D8] text-[#3B2F26]"
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
              {ingredients.length > 0 ? (
                <div className="space-y-2.5">
                  {ingredients.map((item) => {
                    const ticked = checkedIngredientIds.includes(
                      item.inventoryId,
                    )
                    const unitOptions = compatibleUnits(item.baseUnit)
                    const selectedUnit =
                      ingredientUnits[item.inventoryId] ?? item.baseUnit
                    const convertedQty = fromBaseQuantity(
                      item.baseQuantity,
                      selectedUnit,
                      item.baseUnit,
                      {
                        gramsPerTsp: item.gramsPerTsp,
                        mlPerTsp: item.mlPerTsp,
                      },
                    )
                    const currentDraft =
                      ingredientDrafts[item.inventoryId] ??
                      formatEditableQuantity(
                        Number.isFinite(convertedQty)
                          ? convertedQty
                          : item.baseQuantity,
                        2,
                      )
                    const hasEdited =
                      Math.abs(item.baseQuantity - item.plannedBaseQuantity) >
                      0.01

                    const commitDraft = (raw: string, unitToUse: Unit) => {
                      const clean = sanitizeNumericDraft(raw, true)
                      setIngredientDrafts((prev) => ({
                        ...prev,
                        [item.inventoryId]: clean,
                      }))
                      if (clean === "") return
                      const parsed = Number(clean)
                      if (!Number.isFinite(parsed) || parsed < 0) return
                      const nextBase = toBaseQuantity(
                        parsed,
                        unitToUse,
                        item.baseUnit,
                        {
                          gramsPerTsp: item.gramsPerTsp,
                          mlPerTsp: item.mlPerTsp,
                        },
                      )
                      if (Number.isFinite(nextBase) && nextBase >= 0) {
                        onUpdateIngredientQuantity?.(
                          item.inventoryId,
                          Math.round(nextBase * 1000) / 1000,
                        )
                      }
                    }

                    return (
                      <div
                        key={item.inventoryId}
                        className={`flex items-center justify-between gap-2.5 rounded-2xl border p-3 transition ${
                          ticked
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-[#EAE0D0] bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setCheckedIngredientIds((prev) =>
                              prev.includes(item.inventoryId)
                                ? prev.filter((id) => id !== item.inventoryId)
                                : [...prev, item.inventoryId],
                            )
                          }
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <ItemThumbnail
                            image={item.image}
                            alt={item.name}
                            size="xs"
                          />
                          <div className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-sm font-semibold ${
                                ticked
                                  ? "text-emerald-800 line-through"
                                  : "text-[#3B2F26]"
                              }`}
                            >
                              {item.name}
                            </span>
                            {hasEdited ? (
                              <span className="mt-0.5 block text-[11px] text-[#78685B]">
                                Planned:{" "}
                                {formatQuantity(
                                  item.plannedBaseQuantity,
                                  item.baseUnit,
                                )}
                              </span>
                            ) : null}
                          </div>
                        </button>

                        <div className="inline-flex shrink-0 items-center overflow-hidden rounded-xl border border-[#E2D4C0] bg-[#FAF5ED] focus-within:border-amber-500">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Quantity used for ${item.name}`}
                            value={currentDraft}
                            onChange={(e) =>
                              commitDraft(e.target.value, selectedUnit)
                            }
                            onBlur={() => {
                              if (currentDraft.trim() === "") {
                                const fallback = formatEditableQuantity(
                                  item.baseQuantity,
                                  2,
                                )
                                setIngredientDrafts((prev) => ({
                                  ...prev,
                                  [item.inventoryId]: fallback,
                                }))
                              }
                            }}
                            className="w-16 bg-transparent px-2 py-1.5 text-right text-xs font-bold tabular-nums text-[#3B2F26] outline-none"
                          />
                          {unitOptions.length > 1 ? (
                            <select
                              aria-label={`Measurement unit for ${item.name}`}
                              value={selectedUnit}
                              onChange={(e) => {
                                const nextUnit = e.target.value as Unit
                                const convertedDraft =
                                  convertDraftOnUnitChange(
                                    currentDraft,
                                    selectedUnit,
                                    nextUnit,
                                    {
                                      name: item.name,
                                      unit: item.baseUnit,
                                      gramsPerTsp: item.gramsPerTsp,
                                      mlPerTsp: item.mlPerTsp,
                                    },
                                  )
                                setIngredientUnits((prev) => ({
                                  ...prev,
                                  [item.inventoryId]: nextUnit,
                                }))
                                setIngredientDrafts((prev) => ({
                                  ...prev,
                                  [item.inventoryId]: convertedDraft,
                                }))
                              }}
                              className="border-l border-[#E2D4C0] bg-[#EFE6D8] py-1.5 pl-2 pr-1.5 text-xs font-semibold text-[#3B2F26] outline-none"
                            >
                              {unitOptions.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="border-l border-[#E2D4C0] bg-[#EFE6D8] px-2 py-1.5 text-xs font-semibold text-[#78685B]">
                              {item.baseUnit}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[#78685B]">
                  No ingredients recorded for this item.
                </p>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* All Steps Drawer (with Edit & Up/Down Reordering) */}
      <AnimatePresence>
        {showAllSteps ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : INSTANT_TRANSITION
            }
            className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/35"
            onClick={() => setShowAllSteps(false)}
          >
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_SHEET}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto max-h-[82dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t border-[#EAE0D0] bg-[#FAF5ED] p-5 pb-safe-bottom text-[#3B2F26]"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">All preparation steps</h3>
                  {onMoveStep ? (
                    <p className="text-xs text-[#78685B]">
                      Tap a step, edit, or reorder with arrows
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllSteps(false)}
                  aria-label="Close steps list"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-[#EFE6D8] text-[#3B2F26]"
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {steps.map((text, idx) => {
                  const done = completedSteps.includes(idx)
                  const isCustom = customStepIndexes.includes(idx)
                  return (
                    <div
                      key={`${idx}-${text}`}
                      className={`flex items-center gap-2 rounded-2xl border p-3 transition ${
                        idx === stepIndex && !showCelebration
                          ? "border-amber-300 bg-amber-50"
                          : done
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-[#EAE0D0] bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setInspectingStepsWhenDone(true)
                          setShowTimerPicker(false)
                          setStepIndex(idx)
                          setShowAllSteps(false)
                        }}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <span
                          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            done
                              ? "bg-emerald-600 text-white"
                              : "bg-[#EFE6D8] text-[#3B2F26]"
                          }`}
                        >
                          {done ? <Check aria-hidden="true" size={14} /> : idx + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm leading-snug ${
                              done
                                ? "text-emerald-800 line-through"
                                : "text-[#3B2F26]"
                            }`}
                          >
                            {text}
                          </span>
                          {isCustom ? (
                            <span className="mt-1 inline-block text-[11px] text-[#78685B]">
                              Optional note
                            </span>
                          ) : null}
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        {onEditStep ? (
                          <button
                            type="button"
                            aria-label={`Edit step ${idx + 1}`}
                            onClick={() => {
                              setShowAllSteps(false)
                              openEditStepSheet(idx)
                            }}
                            className="inline-flex size-9 items-center justify-center rounded-xl bg-[#EFE6D8] text-[#3B2F26] active:scale-button"
                          >
                            <Pencil aria-hidden="true" size={14} />
                          </button>
                        ) : null}
                        {onMoveStep && steps.length > 1 ? (
                          <>
                            <button
                              type="button"
                              disabled={idx === 0}
                              aria-label={`Move step ${idx + 1} up`}
                              onClick={() => handleMove(idx, idx - 1)}
                              className="inline-flex size-9 items-center justify-center rounded-xl bg-[#EFE6D8] text-[#3B2F26] disabled:opacity-30 active:scale-button"
                            >
                              <ChevronUp aria-hidden="true" size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === steps.length - 1}
                              aria-label={`Move step ${idx + 1} down`}
                              onClick={() => handleMove(idx, idx + 1)}
                              className="inline-flex size-9 items-center justify-center rounded-xl bg-[#EFE6D8] text-[#3B2F26] disabled:opacity-30 active:scale-button"
                            >
                              <ChevronDown aria-hidden="true" size={16} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Add / Edit Step Sheet */}
      <AnimatePresence>
        {stepEditor ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reducedMotion ? REDUCED_MOTION_TRANSITION : INSTANT_TRANSITION
            }
            className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/35"
            onClick={() => setStepEditor(null)}
          >
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_SHEET}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-2xl rounded-t-3xl border-t border-[#EAE0D0] bg-[#FAF5ED] p-5 pb-safe-bottom text-[#3B2F26]"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Illustration name="kitchen-prep" size="sm" />
                  <div>
                    <h3 className="text-base font-bold">
                      {stepEditor.kind === "edit"
                        ? `Edit Step ${stepEditor.index + 1}`
                        : "Add optional step"}
                    </h3>
                    <p className="text-xs text-[#78685B]">
                      {stepEditor.kind === "edit"
                        ? "Update the instruction for this preparation"
                        : `Inserts after Step ${insertAfterIndex + 1} (as Step ${insertAtIndex + 1})`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStepEditor(null)}
                  aria-label="Close step editor"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-[#EFE6D8] text-[#3B2F26]"
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>

              <textarea
                rows={3}
                value={stepDraftText}
                onChange={(e) => setStepDraftText(e.target.value)}
                placeholder="e.g., Rest sponge 10 mins before crumb coat..."
                className="w-full rounded-2xl border border-[#E2D4C0] bg-white p-3.5 text-sm text-[#3B2F26] placeholder:text-[#A5988B] focus:border-amber-500 focus:outline-none"
              />

              {canSaveToRecipe ? (
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-xs text-[#78685B]">
                  <input
                    type="checkbox"
                    checked={saveToRecipe}
                    onChange={(e) => setSaveToRecipe(e.target.checked)}
                    className="size-4 rounded border-[#E2D4C0] accent-[#D97706]"
                  />
                  {stepEditor.kind === "edit"
                    ? "Also update saved recipe for future orders"
                    : "Also save to recipe for future orders"}
                </label>
              ) : null}

              <button
                type="button"
                disabled={!stepDraftText.trim()}
                onClick={handleSaveStepEditor}
                className="mt-4 flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-2xl bg-[#3B2F26] px-5 text-base font-bold text-[#FAF5ED] transition disabled:opacity-40 active:scale-button"
              >
                {stepEditor.kind === "edit" ? (
                  <>
                    <Check aria-hidden="true" size={18} />
                    Save changes
                  </>
                ) : (
                  <>
                    <Plus aria-hidden="true" size={18} />
                    Insert as Step {insertAtIndex + 1}
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
