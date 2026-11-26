import { useEffect, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import {
  clearAllNotifications,
  dismissNotification,
  markNotificationRead,
  type NotificationPreferences,
} from "./notificationState"
import type { AttentionItem } from "./selectors/todaySelectors"

export type SystemReminderEvent = {
  action: "read" | "clear" | "clear-all" | "open" | "open-alarm"
  id?: string
  ids?: string[]
  orderId?: string
  targetTab?: string
  starterAction?: string
}

interface SystemNotificationsNativePlugin {
  getNotificationPermissionStatus(): Promise<{ granted: boolean }>
  ensureNotificationPermission(): Promise<{ granted: boolean }>
  syncReminderNotifications(options: {
    reminders: {
      id: string
      title: string
      detail: string
      tone: "warning" | "sage"
      targetTab: string
      orderId?: string
      starterAction?: string
    }[]
  }): Promise<{ posted: number; permissionGranted: boolean }>
  clearAllSyncedReminders(): Promise<void>
  consumePendingReminderEvents(): Promise<{ events: SystemReminderEvent[] }>
  addListener(
    eventName: "reminderAction",
    listenerFunc: (data: SystemReminderEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const NativePlugin =
  registerPlugin<SystemNotificationsNativePlugin>("KitchenAlarm")

export const PHONE_NOTIFICATIONS_STORAGE_KEY =
  "udenis-bakery-phone-notifs-enabled-v1"

const toggleListeners = new Set<() => void>()

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
}

export function getPhoneNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true
  try {
    const raw = window.localStorage.getItem(PHONE_NOTIFICATIONS_STORAGE_KEY)
    if (raw === "false") return false
    return true
  } catch {
    return true
  }
}

export function setPhoneNotificationsEnabled(enabled: boolean): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        PHONE_NOTIFICATIONS_STORAGE_KEY,
        enabled ? "true" : "false",
      )
    } catch {
      // Ignore storage quota errors
    }
  }
  for (const listener of toggleListeners) {
    listener()
  }
}

export function usePhoneNotificationsEnabled(): [
  boolean,
  (next: boolean) => void,
] {
  const [enabled, setEnabled] = useState(() => getPhoneNotificationsEnabled())

  useEffect(() => {
    const sync = () => setEnabled(getPhoneNotificationsEnabled())
    toggleListeners.add(sync)
    return () => {
      toggleListeners.delete(sync)
    }
  }, [])

  return [enabled, setPhoneNotificationsEnabled]
}

export async function getSystemNotificationPermissionGranted(): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const res = await NativePlugin.getNotificationPermissionStatus()
      return Boolean(res.granted)
    } catch {
      return false
    }
  }
  if (typeof Notification !== "undefined") {
    return Notification.permission === "granted"
  }
  return false
}

export async function requestSystemNotificationPermission(): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const res = await NativePlugin.ensureNotificationPermission()
      return Boolean(res.granted)
    } catch {
      return false
    }
  }
  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") return true
    if (Notification.permission === "default") {
      try {
        const res = await Notification.requestPermission()
        return res === "granted"
      } catch {
        return false
      }
    }
  }
  return false
}

export async function syncRemindersToPhoneBar(
  unreadReminders: AttentionItem[],
  enabled: boolean,
): Promise<{ posted: number; permissionGranted: boolean }> {
  if (!isNativeAndroid()) {
    return { posted: 0, permissionGranted: false }
  }
  if (!enabled || unreadReminders.length === 0) {
    await NativePlugin.clearAllSyncedReminders().catch(() => undefined)
    return { posted: 0, permissionGranted: true }
  }
  try {
    return await NativePlugin.syncReminderNotifications({
      reminders: unreadReminders.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
        tone: item.tone,
        targetTab: item.targetTab,
        orderId: item.orderId,
        starterAction: item.starterAction,
      })),
    })
  } catch {
    return { posted: 0, permissionGranted: false }
  }
}

export async function consumeSystemReminderEvents(): Promise<
  SystemReminderEvent[]
> {
  if (!isNativeAndroid()) return []
  try {
    const res = await NativePlugin.consumePendingReminderEvents()
    return Array.isArray(res.events) ? res.events : []
  } catch {
    return []
  }
}

export function subscribeToSystemReminderEvents(
  handler: (event: SystemReminderEvent) => void,
): () => void {
  if (!isNativeAndroid()) return () => {}
  let removed = false
  let handle: { remove: () => Promise<void> } | null = null

  void NativePlugin.addListener("reminderAction", (evt) => {
    handler(evt)
  }).then((listener) => {
    if (removed) {
      void listener.remove()
    } else {
      handle = listener
    }
  })

  return () => {
    removed = true
    if (handle) {
      void handle.remove()
      handle = null
    }
  }
}

export function applySystemReminderEvent(
  prefs: NotificationPreferences,
  event: SystemReminderEvent,
): NotificationPreferences {
  if ((event.action === "read" || event.action === "open") && event.id) {
    return markNotificationRead(prefs, event.id)
  }
  if (event.action === "clear" && event.id) {
    return dismissNotification(prefs, event.id)
  }
  if (event.action === "clear-all" && Array.isArray(event.ids)) {
    return clearAllNotifications(prefs, event.ids)
  }
  return prefs
}
