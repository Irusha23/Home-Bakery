import { describe, expect, it } from "vitest"
import packageJson from "../../package.json"
import versionJson from "../version.json"
import { APP_BUILD_CODE, APP_VERSION } from "./appVersion"

describe("version synchronization", () => {
  it("keeps package.json, src/version.json, and appVersion.ts aligned", () => {
    expect(APP_VERSION).toBe(versionJson.version)
    expect(APP_BUILD_CODE).toBe(versionJson.versionCode)
    expect(packageJson.version).toBe(versionJson.version)
  })

  it("uses a valid semver string and positive integer versionCode", () => {
    expect(/^\d+\.\d+\.\d+$/.test(versionJson.version)).toBe(true)
    expect(Number.isInteger(versionJson.versionCode)).toBe(true)
    expect(versionJson.versionCode).toBeGreaterThanOrEqual(1)
  })
})
