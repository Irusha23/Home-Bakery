import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, "..")
const VERSION_FILE = path.join(ROOT_DIR, "src", "version.json")
const PACKAGE_FILE = path.join(ROOT_DIR, "package.json")

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export function bumpSemver(current, target) {
  const match = SEMVER_RE.exec(current.trim())
  if (!match) {
    throw new Error(`Invalid current semver "${current}"`)
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])

  if (target === "patch") return `${major}.${minor}.${patch + 1}`
  if (target === "minor") return `${major}.${minor + 1}.0`
  if (target === "major") return `${major + 1}.0.0`

  const explicit = SEMVER_RE.exec(String(target).trim())
  if (!explicit) {
    throw new Error(`Invalid version target "${target}". Use patch, minor, major, or x.y.z`)
  }
  return `${Number(explicit[1])}.${Number(explicit[2])}.${Number(explicit[3])}`
}

export function checkVersions() {
  const versionData = readJson(VERSION_FILE)
  const packageData = readJson(PACKAGE_FILE)

  if (!SEMVER_RE.test(String(versionData.version ?? ""))) {
    throw new Error(`src/version.json has invalid semver: ${versionData.version}`)
  }
  if (!Number.isInteger(versionData.versionCode) || versionData.versionCode < 1) {
    throw new Error(`src/version.json versionCode must be a positive integer, got: ${versionData.versionCode}`)
  }
  if (packageData.version !== versionData.version) {
    throw new Error(
      `Version mismatch: package.json (${packageData.version}) !== src/version.json (${versionData.version})`,
    )
  }
  return { version: versionData.version, versionCode: versionData.versionCode }
}

function runBump(target) {
  if (!target) {
    throw new Error("Usage: node scripts/release-tools.mjs bump <patch|minor|major|x.y.z>")
  }
  const versionData = readJson(VERSION_FILE)
  const packageData = readJson(PACKAGE_FILE)

  const nextVersion = bumpSemver(String(versionData.version), target)
  const nextCode = Number(versionData.versionCode) + 1

  writeJson(VERSION_FILE, {
    version: nextVersion,
    versionCode: nextCode,
  })
  packageData.version = nextVersion
  writeJson(PACKAGE_FILE, packageData)

  console.log(`Updated version: ${versionData.version} (build ${versionData.versionCode}) -> ${nextVersion} (build ${nextCode})`)
}

function runManifest(args) {
  let downloadUrl = ""
  let notes = ""
  let outPath = path.join(ROOT_DIR, "release", "version.json")

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--url" && args[i + 1]) {
      downloadUrl = args[i + 1].trim()
      i += 1
    } else if (arg === "--notes" && args[i + 1]) {
      notes = args[i + 1].trim()
      i += 1
    } else if (arg === "--out" && args[i + 1]) {
      outPath = path.resolve(ROOT_DIR, args[i + 1])
      i += 1
    }
  }

  if (!downloadUrl) {
    throw new Error("Usage: node scripts/release-tools.mjs manifest --url <apkDownloadUrl> [--notes \"...\"] [--out release/version.json]")
  }

  const { version, versionCode } = checkVersions()
  const payload = {
    version,
    versionCode,
    downloadUrl,
    ...(notes ? { notes } : {}),
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  writeJson(outPath, payload)
  console.log(`Generated update manifest at ${path.relative(ROOT_DIR, outPath)}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const [, , command, ...rest] = process.argv
  try {
    if (command === "check") {
      const info = checkVersions()
      console.log(`Version OK: ${info.version} (versionCode ${info.versionCode})`)
    } else if (command === "bump") {
      runBump(rest[0])
    } else if (command === "manifest") {
      runManifest(rest)
    } else {
      throw new Error("Unknown command. Use: check | bump | manifest")
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
