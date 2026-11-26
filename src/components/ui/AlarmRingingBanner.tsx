import { BellOff, ChevronRight, Plus } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  dismissRingingAlarm,
  snoozeRingingAlarm,
  useKitchenAlarms,
  type StepTimerRecord,
} from "../../lib/kitchenAlarm"
import {
  REDUCED_MOTION_TRANSITION,
  SPRING_SHEET,
} from "../../lib/motion"
import Button from "./Button"
import Illustration from "./Illustration"

type AlarmRingingBannerProps = {
  onOpenAlarm?: (alarm: StepTimerRecord) => void
}

/**
 * High-contrast phone-style alarm banner shown anywhere in the app when a
 * Cook Mode step timer finishes. Tapping the banner jumps straight to that
 * order's Cook Mode step, with "+2m" and "Turn off alarm" actions below.
 */
export default function AlarmRingingBanner({
  onOpenAlarm,
}: AlarmRingingBannerProps) {
  const { ringingAlarm } = useKitchenAlarms()
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {ringingAlarm ? (
        <motion.div
          key={ringingAlarm.alarmId}
          role="alertdialog"
          aria-modal="true"
          aria-label="Step timer finished"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -32 }}
          transition={reducedMotion ? REDUCED_MOTION_TRANSITION : SPRING_SHEET}
          className="fixed inset-x-0 top-0 z-[70] mx-auto w-full max-w-xl px-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:px-6"
        >
          <div className="rounded-3xl border border-amber-300 bg-[#FFFDF9] p-4 text-[#3B2F26] shadow-dialog">
            <button
              type="button"
              onClick={() => onOpenAlarm?.(ringingAlarm)}
              className="flex w-full items-center gap-3 rounded-2xl p-1 text-left transition hover:bg-[#FAF5ED] active:scale-[0.99]"
            >
              <div className="shrink-0">
                <Illustration name="timer-bell" size="sm" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-section text-amber-700">
                  Time&apos;s up · Tap to open step
                </p>
                <p className="truncate text-base font-bold text-[#3B2F26]">
                  {ringingAlarm.title}
                </p>
                <p className="truncate text-xs text-[#78685B]">
                  {ringingAlarm.stepLabel}
                </p>
              </div>
              <ChevronRight
                aria-hidden="true"
                size={18}
                className="shrink-0 text-amber-700"
              />
            </button>

            <div className="mt-3.5 grid grid-cols-3 gap-2">
              <Button
                variant="secondary"
                className="min-h-[3.25rem] border-[#E7DAC8] bg-[#F5ECE0] text-[#3B2F26] hover:bg-[#EFE2D0]"
                leadingIcon={<Plus aria-hidden="true" size={16} />}
                onClick={() => void snoozeRingingAlarm(ringingAlarm.alarmId, 120)}
              >
                +2m
              </Button>
              <Button
                className="col-span-2 min-h-[3.25rem] bg-[#D97706] text-white hover:bg-[#B45309]"
                leadingIcon={<BellOff aria-hidden="true" size={18} />}
                onClick={() => void dismissRingingAlarm(ringingAlarm.alarmId)}
              >
                Turn off alarm
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
