import { describe, expect, it, vi } from "vitest"
import {
  APP_BUILD_CODE,
  APP_VERSION,
  checkForAppUpdate,
  compareSemver,
} from "./appVersion"

describe("appVersion & update checker", () => {
  it("compares semantic versions accurately", () => {
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0)
    expect(compareSemver("1.0.0", "v1.0.1")).toBe(-1)
    expect(compareSemver("1.2.0", "1.1.9")).toBe(1)
    expect(compareSemver("1.0.0", "2.0.0")).toBe(-1)
  })

  it("returns unconfigured when no feed URL is provided", async () => {
    const result = await checkForAppUpdate("")
    expect(result.status).toBe("unconfigured")
  })

  it("detects newer releases by version or versionCode", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: "9.9.0",
        versionCode: APP_BUILD_CODE + 1,
        downloadUrl: "https://example.com/app-v9.9.0.apk",
        notes: "Fixes bakery timer and adds dark mode.",
      }),
    })) as unknown as typeof fetch

    const result = await checkForAppUpdate(
      "https://example.com/version.json",
      fetcher,
    )
    expect(result).toEqual({
      status: "update-available",
      currentVersion: APP_VERSION,
      latestVersion: "9.9.0",
      downloadUrl: "https://example.com/app-v9.9.0.apk",
      notes: "Fixes bakery timer and adds dark mode.",
    })
  })

  it("reports up-to-date when feed matches current release and handles offline errors", async () => {
    const sameFetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: APP_VERSION,
        versionCode: APP_BUILD_CODE,
        downloadUrl: "https://example.com/app.apk",
      }),
    })) as unknown as typeof fetch

    expect(
      await checkForAppUpdate("https://example.com/version.json", sameFetcher),
    ).toEqual({
      status: "up-to-date",
      currentVersion: APP_VERSION,
    })

    const failingFetcher = vi.fn(async () => {
      throw new Error("Network unreachable")
    }) as unknown as typeof fetch

    const offlineResult = await checkForAppUpdate(
      "https://example.com/version.json",
      failingFetcher,
    )
    expect(offlineResult.status).toBe("offline")
  })
})
