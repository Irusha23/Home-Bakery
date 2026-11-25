export function getCollectionTargetMs(
  collectionDate: string,
  collectionTime?: string,
): number | null {
  if (!collectionDate || !/^\d{4}-\d{2}-\d{2}$/.test(collectionDate)) {
    return null
  }
  const timePart =
    collectionTime && /^\d{2}:\d{2}/.test(collectionTime)
      ? collectionTime.slice(0, 5)
      : "23:59"
  const ms = new Date(`${collectionDate}T${timePart}:00+05:30`).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function getBakeTargetMs(
  startedAt: string | null | undefined,
  preparationMinutes: number,
): number | null {
  if (!startedAt || !Number.isFinite(preparationMinutes) || preparationMinutes <= 0) {
    return null
  }
  const startMs = new Date(startedAt).getTime()
  if (!Number.isFinite(startMs)) return null
  return startMs + preparationMinutes * 60_000
}

export function formatCountdown(diffMs: number): {
  text: string
  overdue: boolean
} {
  const overdue = diffMs <= 0
  const totalSeconds = Math.floor(Math.abs(diffMs) / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  const pad = (value: number) => String(value).padStart(2, "0")
  return {
    text: `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    overdue,
  }
}
