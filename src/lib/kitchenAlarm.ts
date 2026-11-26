import { useEffect, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"

export type StepTimerStatus = "running" | "paused" | "ringing"

export type StepTimerRecord = {
  alarmId: string
  preparationId: string
  stepIndex: number
  title: string
  stepLabel: string
  totalSeconds: number
  remainingSeconds: number
  targetEndAtMs: number | null
  status: StepTimerStatus
}

interface KitchenAlarmNativePlugin {
  scheduleAlarm(options: {
    alarmId: string
    triggerAtMs: number
    title: string
    body: string
  }): Promise<void>
  cancelAlarm(options: { alarmId: string }): Promise<void>
  stopAlarm(options: { alarmId?: string }): Promise<void>
  getRingingState(): Promise<{
    ringing: boolean
    alarmId?: string
    title?: string
    body?: string
  }>
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>
  ensureNotificationPermission(): Promise<{ granted: boolean }>
  addListener(
    eventName: "alarmRinging" | "alarmStopped" | "alarmSnoozed",
    listenerFunc: (data: {
      alarmId?: string
      title?: string
      body?: string
      triggerAtMs?: number
    }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const KitchenAlarmNative =
  registerPlugin<KitchenAlarmNativePlugin>("KitchenAlarm")

const STORAGE_KEY = "udenis_kitchen_step_timers_v1"

type Listener = () => void
const listeners = new Set<Listener>()
let timerMap: Record<string, StepTimerRecord> = loadTimersFromStorage()
let webMonitorId: number | null = null
let webAudioTimerId: number | null = null
let audioCtx: AudioContext | null = null
let nativeListenersRegistered = false

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
}

function loadTimersFromStorage(): Record<string, StepTimerRecord> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Record<string, StepTimerRecord>
  } catch {
    return {}
  }
}

function saveTimersToStorage(next: Record<string, StepTimerRecord>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage quota errors cleanly
  }
}

function emitChange() {
  saveTimersToStorage(timerMap)
  syncWebMonitor()
  for (const listener of listeners) {
    listener()
  }
}

function playWebAlarmChime() {
  if (typeof window === "undefined") return
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) {
      audioCtx = new Ctx()
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => undefined)
    }

    const now = audioCtx.currentTime
    const freqs = [880, 1174.66, 880]
    freqs.forEach((freq, idx) => {
      if (!audioCtx) return
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, now + idx * 0.18)
      gain.gain.setValueAtTime(0.001, now + idx * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.18 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.16)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start(now + idx * 0.18)
      osc.stop(now + idx * 0.18 + 0.17)
    })
  } catch {
    // Audio playback blocked or unavailable
  }
}

function startWebRingingLoop() {
  if (isNativeAndroid() || typeof window === "undefined") return
  if (webAudioTimerId !== null) return
  playWebAlarmChime()
  webAudioTimerId = window.setInterval(() => {
    const hasRinging = Object.values(timerMap).some(
      (item) => item.status === "ringing",
    )
    if (!hasRinging) {
      stopWebRingingLoop()
      return
    }
    playWebAlarmChime()
  }, 2000)
}

function stopWebRingingLoop() {
  if (webAudioTimerId !== null && typeof window !== "undefined") {
    window.clearInterval(webAudioTimerId)
    webAudioTimerId = null
  }
}

function syncWebMonitor() {
  if (typeof window === "undefined") return
  const hasRunning = Object.values(timerMap).some(
    (t) => t.status === "running",
  )
  const hasRinging = Object.values(timerMap).some(
    (t) => t.status === "ringing",
  )

  if (hasRinging && !isNativeAndroid()) {
    startWebRingingLoop()
  } else if (!hasRinging) {
    stopWebRingingLoop()
  }

  if (!hasRunning && webMonitorId !== null) {
    window.clearInterval(webMonitorId)
    webMonitorId = null
    return
  }

  if (hasRunning && webMonitorId === null) {
    webMonitorId = window.setInterval(() => {
      const nowMs = Date.now()
      let changed = false
      const next = { ...timerMap }
      for (const [id, timer] of Object.entries(next)) {
        if (
          timer.status === "running" &&
          timer.targetEndAtMs !== null &&
          timer.targetEndAtMs <= nowMs
        ) {
          next[id] = {
            ...timer,
            status: "ringing",
            remainingSeconds: 0,
            targetEndAtMs: null,
          }
          changed = true
          if (
            !isNativeAndroid() &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification(timer.title, {
                body: `${timer.stepLabel} timer finished!`,
              })
            } catch {
              // Ignore browser notification failure
            }
          }
        }
      }
      if (changed) {
        timerMap = next
        emitChange()
      }
    }, 500)
  }
}

function ensureNativeBridgeSynced() {
  if (!isNativeAndroid() || nativeListenersRegistered) return
  nativeListenersRegistered = true

  void KitchenAlarmNative.getRingingState()
    .then((res) => {
      if (res.ringing && res.alarmId) {
        const existing = timerMap[res.alarmId]
        const parsed = parseStepAlarmId(res.alarmId)
        timerMap = {
          ...timerMap,
          [res.alarmId]: existing
            ? { ...existing, status: "ringing", remainingSeconds: 0, targetEndAtMs: null }
            : {
                alarmId: res.alarmId,
                preparationId: parsed?.preparationId ?? "",
                stepIndex: parsed?.stepIndex ?? 0,
                title: res.title ?? "Kitchen Timer",
                stepLabel: res.body ?? "Step timer is up!",
                totalSeconds: 0,
                remainingSeconds: 0,
                targetEndAtMs: null,
                status: "ringing",
              },
        }
        emitChange()
      }
    })
    .catch(() => undefined)

  void KitchenAlarmNative.addListener("alarmRinging", (data) => {
    if (!data.alarmId) return
    const existing = timerMap[data.alarmId]
    const parsed = parseStepAlarmId(data.alarmId)
    timerMap = {
      ...timerMap,
      [data.alarmId]: existing
        ? { ...existing, status: "ringing", remainingSeconds: 0, targetEndAtMs: null }
        : {
            alarmId: data.alarmId,
            preparationId: parsed?.preparationId ?? "",
            stepIndex: parsed?.stepIndex ?? 0,
            title: data.title ?? "Kitchen Timer",
            stepLabel: data.body ?? "Step timer is up!",
            totalSeconds: 0,
            remainingSeconds: 0,
            targetEndAtMs: null,
            status: "ringing",
          },
    }
    emitChange()
  })

  void KitchenAlarmNative.addListener("alarmStopped", (data) => {
    if (!data.alarmId) return
    const next = { ...timerMap }
    delete next[data.alarmId]
    timerMap = next
    emitChange()
  })

  void KitchenAlarmNative.addListener("alarmSnoozed", (data) => {
    if (!data.alarmId || !data.triggerAtMs) return
    const existing = timerMap[data.alarmId]
    if (!existing) return
    timerMap = {
      ...timerMap,
      [data.alarmId]: {
        ...existing,
        status: "running",
        totalSeconds: 120,
        remainingSeconds: 120,
        targetEndAtMs: data.triggerAtMs,
      },
    }
    emitChange()
  })
}

export function makeStepAlarmId(preparationId: string, stepIndex: number): string {
  return `${preparationId}::${stepIndex}`
}

export function parseStepAlarmId(
  alarmId: string,
): { preparationId: string; stepIndex: number } | null {
  const splitIdx = alarmId.lastIndexOf("::")
  if (splitIdx <= 0) return null
  const preparationId = alarmId.slice(0, splitIdx)
  const stepIndex = Number(alarmId.slice(splitIdx + 2))
  if (!preparationId || !Number.isInteger(stepIndex) || stepIndex < 0) {
    return null
  }
  return { preparationId, stepIndex }
}

export function getStepTimers(): Record<string, StepTimerRecord> {
  return timerMap
}

export function getRemainingSeconds(
  timer: StepTimerRecord,
  nowMs = Date.now(),
): number {
  if (timer.status === "ringing") return 0
  if (timer.status === "paused" || timer.targetEndAtMs === null) {
    return Math.max(0, Math.ceil(timer.remainingSeconds))
  }
  return Math.max(0, Math.ceil((timer.targetEndAtMs - nowMs) / 1000))
}

export async function startStepTimer(params: {
  preparationId: string
  stepIndex: number
  durationSeconds: number
  title: string
  stepLabel: string
}): Promise<void> {
  const duration = Math.max(1, Math.round(params.durationSeconds))
  const alarmId = makeStepAlarmId(params.preparationId, params.stepIndex)
  const triggerAtMs = Date.now() + duration * 1000

  timerMap = {
    ...timerMap,
    [alarmId]: {
      alarmId,
      preparationId: params.preparationId,
      stepIndex: params.stepIndex,
      title: params.title,
      stepLabel: params.stepLabel,
      totalSeconds: duration,
      remainingSeconds: duration,
      targetEndAtMs: triggerAtMs,
      status: "running",
    },
  }
  emitChange()

  if (isNativeAndroid()) {
    await KitchenAlarmNative.ensureNotificationPermission().catch(() => undefined)
    await KitchenAlarmNative.scheduleAlarm({
      alarmId,
      triggerAtMs,
      title: params.title,
      body: `${params.stepLabel} timer is up!`,
    }).catch(() => undefined)
  } else if (
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  ) {
    void Notification.requestPermission().catch(() => undefined)
  }
}

export async function addTimeToStepTimer(
  alarmId: string,
  extraSeconds: number,
): Promise<void> {
  const existing = timerMap[alarmId]
  if (!existing) return

  const currentRemaining = getRemainingSeconds(existing)
  const nextRemaining = Math.max(1, currentRemaining + Math.round(extraSeconds))
  const nextTotal = Math.max(existing.totalSeconds, nextRemaining)

  if (existing.status === "paused") {
    timerMap = {
      ...timerMap,
      [alarmId]: {
        ...existing,
        totalSeconds: nextTotal,
        remainingSeconds: nextRemaining,
      },
    }
    emitChange()
    return
  }

  const triggerAtMs = Date.now() + nextRemaining * 1000
  timerMap = {
    ...timerMap,
    [alarmId]: {
      ...existing,
      status: "running",
      totalSeconds: nextTotal,
      remainingSeconds: nextRemaining,
      targetEndAtMs: triggerAtMs,
    },
  }
  emitChange()

  if (isNativeAndroid()) {
    await KitchenAlarmNative.scheduleAlarm({
      alarmId,
      triggerAtMs,
      title: existing.title,
      body: `${existing.stepLabel} timer is up!`,
    }).catch(() => undefined)
  }
}

export async function pauseStepTimer(alarmId: string): Promise<void> {
  const existing = timerMap[alarmId]
  if (!existing || existing.status !== "running") return
  const remaining = getRemainingSeconds(existing)
  timerMap = {
    ...timerMap,
    [alarmId]: {
      ...existing,
      status: "paused",
      remainingSeconds: remaining,
      targetEndAtMs: null,
    },
  }
  emitChange()

  if (isNativeAndroid()) {
    await KitchenAlarmNative.cancelAlarm({ alarmId }).catch(() => undefined)
  }
}

export async function resumeStepTimer(alarmId: string): Promise<void> {
  const existing = timerMap[alarmId]
  if (!existing || existing.status !== "paused") return
  const remaining = Math.max(1, existing.remainingSeconds)
  const triggerAtMs = Date.now() + remaining * 1000
  timerMap = {
    ...timerMap,
    [alarmId]: {
      ...existing,
      status: "running",
      targetEndAtMs: triggerAtMs,
    },
  }
  emitChange()

  if (isNativeAndroid()) {
    await KitchenAlarmNative.scheduleAlarm({
      alarmId,
      triggerAtMs,
      title: existing.title,
      body: `${existing.stepLabel} timer is up!`,
    }).catch(() => undefined)
  }
}

export async function clearStepTimer(alarmId: string): Promise<void> {
  const next = { ...timerMap }
  delete next[alarmId]
  timerMap = next
  emitChange()

  if (isNativeAndroid()) {
    await KitchenAlarmNative.cancelAlarm({ alarmId }).catch(() => undefined)
  }
}

export async function dismissRingingAlarm(alarmId: string): Promise<void> {
  const next = { ...timerMap }
  delete next[alarmId]
  timerMap = next
  emitChange()

  if (isNativeAndroid()) {
    await KitchenAlarmNative.stopAlarm({ alarmId }).catch(() => undefined)
  }
}

export async function snoozeRingingAlarm(
  alarmId: string,
  snoozeSeconds = 120,
): Promise<void> {
  const existing = timerMap[alarmId]
  if (!existing) return
  if (isNativeAndroid()) {
    await KitchenAlarmNative.stopAlarm({ alarmId }).catch(() => undefined)
  }
  await startStepTimer({
    preparationId: existing.preparationId || "kitchen",
    stepIndex: existing.stepIndex,
    durationSeconds: snoozeSeconds,
    title: existing.title,
    stepLabel: existing.stepLabel,
  })
}

export async function setKeepScreenOn(enabled: boolean): Promise<void> {
  if (!isNativeAndroid()) return
  await KitchenAlarmNative.setKeepScreenOn({ enabled }).catch(() => undefined)
}

function remapPrepTimerIndices(
  preparationId: string,
  remap: (stepIndex: number) => number,
) {
  const next: Record<string, StepTimerRecord> = {}
  let changed = false
  for (const [id, timer] of Object.entries(timerMap)) {
    if (timer.preparationId !== preparationId) {
      next[id] = timer
      continue
    }
    const nextIdx = remap(timer.stepIndex)
    if (nextIdx !== timer.stepIndex) {
      changed = true
    }
    const nextId = makeStepAlarmId(preparationId, nextIdx)
    next[nextId] = {
      ...timer,
      alarmId: nextId,
      stepIndex: nextIdx,
    }
  }
  if (changed) {
    timerMap = next
    emitChange()
  }
}

export function shiftStepTimersOnInsert(
  preparationId: string,
  insertAtIndex: number,
): void {
  remapPrepTimerIndices(preparationId, (idx) =>
    idx >= insertAtIndex ? idx + 1 : idx,
  )
}

export function moveStepTimers(
  preparationId: string,
  fromIndex: number,
  toIndex: number,
): void {
  if (fromIndex === toIndex) return
  remapPrepTimerIndices(preparationId, (idx) => {
    if (idx === fromIndex) return toIndex
    if (fromIndex < toIndex && idx > fromIndex && idx <= toIndex) {
      return idx - 1
    }
    if (fromIndex > toIndex && idx >= toIndex && idx < fromIndex) {
      return idx + 1
    }
    return idx
  })
}

export function resetKitchenAlarmsForTests(): void {
  timerMap = {}
  stopWebRingingLoop()
  if (webMonitorId !== null && typeof window !== "undefined") {
    window.clearInterval(webMonitorId)
    webMonitorId = null
  }
}

export function useKitchenAlarms(): {
  timers: StepTimerRecord[]
  ringingAlarm: StepTimerRecord | null
  nowMs: number
} {
  const [, setTick] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    ensureNativeBridgeSynced()
    syncWebMonitor()

    const handleChange = () => {
      setNowMs(Date.now())
      setTick((v) => v + 1)
    }
    listeners.add(handleChange)

    const clockId = window.setInterval(() => {
      const hasRunning = Object.values(timerMap).some(
        (t) => t.status === "running",
      )
      if (hasRunning) {
        setNowMs(Date.now())
      }
    }, 500)

    return () => {
      listeners.delete(handleChange)
      window.clearInterval(clockId)
    }
  }, [])

  const timers = Object.values(timerMap)
  const ringingAlarm =
    timers.find((timer) => timer.status === "ringing") ?? null

  return { timers, ringingAlarm, nowMs }
}
