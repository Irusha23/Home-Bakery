import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, "..")
const ANDROID_DIR = path.join(ROOT_DIR, "android")

const mode = process.argv[2] === "release" ? "release" : process.argv[2] === "debug" ? "debug" : null
if (!mode) {
  console.error("Usage: node scripts/build-apk.mjs <debug|release>")
  process.exit(1)
}

function run(command, args, cwd = ROOT_DIR) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function findApksigner() {
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : "")
  if (!sdkRoot) return null

  const buildToolsDir = path.join(sdkRoot, "build-tools")
  if (!fs.existsSync(buildToolsDir)) return null

  const versions = fs
    .readdirSync(buildToolsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()

  const binaryName = process.platform === "win32" ? "apksigner.bat" : "apksigner"
  for (const version of versions) {
    const candidate = path.join(buildToolsDir, version, binaryName)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

const versionInfo = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "src", "version.json"), "utf8"))
const gradleTask = mode === "release" ? "assembleRelease" : "assembleDebug"
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew"

console.log(`1/3 Building web bundle for v${versionInfo.version} (build ${versionInfo.versionCode})...`)
run("pnpm", ["build"])

console.log("2/3 Syncing Capacitor Android project...")
run("pnpm", ["exec", "cap", "sync", "android"])

console.log(`3/3 Running Gradle ${gradleTask}...`)
run(gradlew, [gradleTask], ANDROID_DIR)

const apkName = `udenis-specials-v${versionInfo.version}-b${versionInfo.versionCode}-${mode}.apk`
const apkPath = path.join(ANDROID_DIR, "app", "build", "outputs", "apk", mode, apkName)

if (!fs.existsSync(apkPath)) {
  console.error(`Expected APK was not found at: ${apkPath}`)
  process.exit(1)
}

const sizeMb = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2)
console.log(`\nAPK built successfully: ${apkPath} (${sizeMb} MB)`)

if (mode === "release") {
  const apksigner = findApksigner()
  if (apksigner) {
    console.log("Verifying APK signature with apksigner...")
    run(apksigner, ["verify", "--print-certs", apkPath])
  } else {
    console.warn("apksigner not found in ANDROID_HOME/LOCALAPPDATA; skipping signature verification.")
  }
}
