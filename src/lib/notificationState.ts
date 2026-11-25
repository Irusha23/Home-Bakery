export const NOTIFICATION_STORAGE_KEY = "udenis-bakery-notifications-v1"

export type NotificationPreferences = {
  readIds: string[]
  dismissedIds: string[]
}

const EMPTY_PREFS: NotificationPreferences = {
  readIds: [],
  dismissedIds: [],
}

export function loadNotificationPreferences(
  storage?: Pick<Storage, "getItem"> | null,
): NotificationPreferences {
  const target =
    storage ?? (typeof window !== "undefined" ? window.localStorage : null)
  if (!target) return EMPTY_PREFS
  try {
    const raw = target.getItem(NOTIFICATION_STORAGE_KEY)
    if (!raw) return EMPTY_PREFS
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>
    return {
      readIds: Array.isArray(parsed.readIds)
        ? parsed.readIds.filter((id): id is string => typeof id === "string")
        : [],
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [],
    }
  } catch {
    return EMPTY_PREFS
  }
}

export function saveNotificationPreferences(
  prefs: NotificationPreferences,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  const target =
    storage ?? (typeof window !== "undefined" ? window.localStorage : null)
  if (!target) return
  try {
    target.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage quota / private-mode errors
  }
}

export function markNotificationRead(
  prefs: NotificationPreferences,
  id: string,
): NotificationPreferences {
  if (prefs.readIds.includes(id)) return prefs
  return {
    ...prefs,
    readIds: [...prefs.readIds, id],
  }
}

export function markAllNotificationsRead(
  prefs: NotificationPreferences,
  ids: string[],
): NotificationPreferences {
  const next = new Set(prefs.readIds)
  for (const id of ids) next.add(id)
  if (next.size === prefs.readIds.length) return prefs
  return {
    ...prefs,
    readIds: [...next],
  }
}

export function dismissNotification(
  prefs: NotificationPreferences,
  id: string,
): NotificationPreferences {
  const hasRead = prefs.readIds.includes(id)
  const hasDismissed = prefs.dismissedIds.includes(id)
  if (hasRead && hasDismissed) return prefs
  return {
    readIds: hasRead ? prefs.readIds : [...prefs.readIds, id],
    dismissedIds: hasDismissed
      ? prefs.dismissedIds
      : [...prefs.dismissedIds, id],
  }
}

export function restoreNotification(
  prefs: NotificationPreferences,
  id: string,
): NotificationPreferences {
  if (!prefs.dismissedIds.includes(id)) return prefs
  return {
    ...prefs,
    dismissedIds: prefs.dismissedIds.filter((item) => item !== id),
  }
}

export function clearAllNotifications(
  prefs: NotificationPreferences,
  ids: string[],
): NotificationPreferences {
  const nextDismissed = new Set(prefs.dismissedIds)
  const nextRead = new Set(prefs.readIds)
  for (const id of ids) {
    nextDismissed.add(id)
    nextRead.add(id)
  }
  return {
    readIds: [...nextRead],
    dismissedIds: [...nextDismissed],
  }
}

export function pruneNotificationPreferences(
  prefs: NotificationPreferences,
  activeIds: string[],
): NotificationPreferences {
  const activeSet = new Set(activeIds)
  const nextRead = prefs.readIds.filter((id) => activeSet.has(id))
  const nextDismissed = prefs.dismissedIds.filter((id) => activeSet.has(id))
  if (
    nextRead.length === prefs.readIds.length &&
    nextDismissed.length === prefs.dismissedIds.length
  ) {
    return prefs
  }
  return {
    readIds: nextRead,
    dismissedIds: nextDismissed,
  }
}
