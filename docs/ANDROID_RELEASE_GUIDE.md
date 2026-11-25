# Android Release Signing & In-Place Update Guide

This guide explains how to generate your permanent Android signing keystore, build signed `.apk` releases for **Udeni's Specials** (`lk.udenisspecials.bakery`), and ship future updates that upgrade Udeni's phone **in place** without losing any SQLite data or photos.

---

## 1. Critical Rule: Never Lose Your Release Keystore

Every `.apk` installed on Android is verified against its developer signing key:

- **Same `.jks` keystore + higher `versionCode`** → Android upgrades the app **in place**, preserving all SQLite orders, recipes, inventory, expenses, and reference photos.
- **Different or lost `.jks` keystore** → Android refuses to install the update (*"App not installed"*), forcing an uninstall + backup restore.
- **Never commit `.jks`, `.keystore`, or `android/keystore.properties` to Git.** They are already listed in `.gitignore`.

---

## 2. One-Time Keystore Setup (Windows PowerShell)

Run this once in your own terminal so your signing password stays completely private:

```powershell
# 1. Create a folder OUTSIDE the Git repository
$keystoreDir = "$env:USERPROFILE\.android-keystores"
New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null

# 2. Generate a 4096-bit RSA release keystore (valid ~27 years)
# You will be prompted to enter a keystore password and your details.
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v `
  -keystore "$keystoreDir\udenis-specials-release.jks" `
  -alias udenis-specials `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000
```

> [!TIP]
> If `$env:JAVA_HOME` is not set in your terminal, replace `& "$env:JAVA_HOME\bin\keytool.exe"` with the JDK 21 path (e.g. `& "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot\bin\keytool.exe"`).

### Back up the keystore immediately

1. Copy `%USERPROFILE%\.android-keystores\udenis-specials-release.jks` to at least **two** safe places (e.g., an encrypted cloud folder + a USB drive).
2. Save the **keystore password**, **key alias** (`udenis-specials`), and **key password** in your password manager.

### Connect Gradle to your keystore

1. Copy `android/keystore.properties.example` to `android/keystore.properties`.
2. Fill in your actual `storeFile` path (using forward slashes `/`), `storePassword`, `keyAlias`, and `keyPassword`:

```properties
storeFile=C:/Users/YOUR_USERNAME/.android-keystores/udenis-specials-release.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=udenis-specials
keyPassword=YOUR_KEY_PASSWORD
```

Verify Git ignores it:
```powershell
git status --short
# android/keystore.properties must NOT appear!
```

---

## 3. Building a Signed Release `.apk`

Run:

```powershell
pnpm android:apk:release
```

This single command:
1. Builds the production Vite bundle (`pnpm build`)
2. Syncs `dist/` into the Android project (`npx cap sync android`)
3. Runs `.\gradlew.bat assembleRelease` using `src/version.json` and `android/keystore.properties`
4. Verifies the `.apk` signature automatically using `apksigner verify --print-certs`

Output location:
```text
android/app/build/outputs/apk/release/udenis-specials-v<version>-b<versionCode>-release.apk
```

> [!NOTE]
> If `android/keystore.properties` is missing, Gradle intentionally **fails fast** on `assembleRelease` so an unsigned `.apk` is never produced by accident. Debug builds (`pnpm android:apk:debug`) do not require a release keystore.

---

## 4. Shipping an In-Place Update (Bug Fix or New Feature)

Whenever you release a new version for Udeni's phone:

1. **Bump the version & `versionCode`:**
   ```powershell
   pnpm version:bump patch   # 1.0.0 (build 1) -> 1.0.1 (build 2)
   # or: pnpm version:bump minor / major / 1.2.0
   ```
   This updates both `src/version.json` and `package.json` together, which automatically updates `Settings -> About & Updates` and `android/app/build.gradle`.
2. **Verify tests & build the signed `.apk`:**
   ```powershell
   pnpm typecheck
   pnpm test
   pnpm android:apk:release
   ```
3. **Optional — Generate `version.json` for GitHub Releases update checks:**
   ```powershell
   pnpm release:manifest -- --url "https://github.com/<owner>/<repo>/releases/download/v1.0.1/udenis-specials-v1.0.1-b2-release.apk" --notes "Bug fixes and improvements"
   ```
   This writes `release/version.json` matching `UpdateFeedPayload` in `src/lib/appVersion.ts`.
4. **Deliver the `.apk`:**
   - Upload `udenis-specials-v<version>-b<versionCode>-release.apk` (and `release/version.json` if using `VITE_UPDATE_FEED_URL`) to a GitHub Release, **or** share the `.apk` directly via WhatsApp / Google Drive.
5. **Upgrade test on Emulator before sending:**
   ```powershell
   adb install -r android/app/build/outputs/apk/release/udenis-specials-v<version>-b<versionCode>-release.apk
   ```
   Confirm existing orders/recipes remain intact and **Settings → About & Updates** displays the new version.
