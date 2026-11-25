import versionInfo from "../version.json"

export const APP_VERSION = versionInfo.version
export const APP_BUILD_CODE = versionInfo.versionCode

export type UpdateFeedPayload = {
  version: string
  versionCode?: number
  downloadUrl: string
  notes?: string
}

export type UpdateCheckResult =
  | {
      status: "up-to-date"
      currentVersion: string
    }
  | {
      status: "update-available"
      currentVersion: string
      latestVersion: string
      downloadUrl: string
      notes?: string
    }
  | {
      status: "offline" | "unconfigured" | "error"
      message: string
    }

function parseSemverParts(raw: string): [number, number, number] | null {
  const cleaned = raw.trim().replace(/^v/i, "").split("-")[0]
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(cleaned)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareSemver(current: string, latest: string): -1 | 0 | 1 {
  const a = parseSemverParts(current)
  const b = parseSemverParts(latest)
  if (!a || !b) return 0
  for (let i = 0; i < 3; i += 1) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return 0
}

/**
 * Checks an optional static JSON update feed (e.g., hosted on GitHub Releases)
 * to notify Udeni when a newer signed `.apk` is available.
 */
export async function checkForAppUpdate(
  feedUrl = import.meta.env.VITE_UPDATE_FEED_URL,
  fetcher: typeof fetch = fetch,
): Promise<UpdateCheckResult> {
  const trimmedUrl = feedUrl?.trim()
  if (!trimmedUrl) {
    return {
      status: "unconfigured",
      message:
        "No update feed URL configured yet. Install new APK releases shared directly with you.",
    }
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      status: "offline",
      message: "You are offline. Connect to Wi-Fi or mobile data to check for updates.",
    }
  }

  try {
    const response = await fetcher(trimmedUrl, { cache: "no-store" })
    if (!response.ok) {
      return {
        status: "error",
        message: `Update server returned HTTP ${response.status}.`,
      }
    }
    const payload = (await response.json()) as Partial<UpdateFeedPayload>
    if (
      typeof payload.version !== "string" ||
      typeof payload.downloadUrl !== "string" ||
      !payload.downloadUrl.trim()
    ) {
      return {
        status: "error",
        message: "Update metadata is incomplete.",
      }
    }

    const newerBySemver = compareSemver(APP_VERSION, payload.version) < 0
    const newerByCode =
      typeof payload.versionCode === "number" &&
      payload.versionCode > APP_BUILD_CODE

    if (newerBySemver || newerByCode) {
      return {
        status: "update-available",
        currentVersion: APP_VERSION,
        latestVersion: payload.version.replace(/^v/i, ""),
        downloadUrl: payload.downloadUrl.trim(),
        ...(typeof payload.notes === "string" && payload.notes.trim()
          ? { notes: payload.notes.trim() }
          : {}),
      }
    }

    return {
      status: "up-to-date",
      currentVersion: APP_VERSION,
    }
  } catch {
    return {
      status: "offline",
      message: "Could not reach the update feed right now.",
    }
  }
}
