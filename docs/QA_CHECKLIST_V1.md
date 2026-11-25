# v1.0.0 Release QA & Upgrade Sign-Off Checklist

**App:** `Udeni's Specials` (`lk.udenisspecials.bakery`)  
**Target Release:** `v1.0.0` (`versionCode: 1`)  
**Device Tested:** Android Studio Emulator (`emulator-5554`) + Physical Android Phone  

---

## Automated Pre-Release Gates

- [x] `pnpm version:check` passes (`1.0.0`, `versionCode 1`)
- [x] `pnpm typecheck` passes (`0` errors)
- [x] `pnpm test` passes (29 test files, 291 tests green)
- [x] `pnpm android:apk:release` builds signed `udenis-specials-v1.0.0-b1-release.apk`, passes `apksigner verify --print-certs`, and prints SHA-256
- [x] GitHub Actions CI (`web-verify` + `android-debug-check`) passes green

---

## Emulator & Device QA Matrix

| ID | Test Case | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | **Airplane Mode End-to-End Flow** | Enable Airplane Mode. Verify clean empty workspace on `v1.0.0` release install. Create customer, product, recipe, order with reference photo, shopping purchase, kitchen bake, partial/final payment, and expense. | All workflows operate 100% offline with accurate Rs. totals and no network errors. | **PASS** |
| **TC-02** | **Force-Close SQLite & Photo Persistence** | Force-stop app (`adb shell am force-stop lk.udenisspecials.bakery`), reopen app. | 100% orders, recipes, inventory, payments, expenses, and reference photos persist in SQLite + local filesystem. | **PASS** |
| **TC-03** | **Encrypted Backup, Wipe & Restore** | Export password-protected `.json` backup via Share Sheet/Files. Wipe app storage (`adb shell pm clear lk.udenisspecials.bakery`). Reopen clean app. Test wrong password rejection, then restore with correct password. | Wrong password rejected safely; correct password restores 100% data and reference photos. | **PASS** |
| **TC-04** | **In-Place `.apk` Upgrade Drill (`Build 1 -> Build 2`)** | With live data on `v1.0.0 (Build 1)`, build `v1.0.1 (Build 2)` signed with the **same `.jks` keystore**, install via `adb install -r` (**without** uninstalling). | App upgrades in place, **Settings -> About & Updates** shows `v1.0.1`, and zero SQLite/photo data is lost. | **PASS** |
| **TC-05** | **Native Android UX** | Test hardware/gesture Back button across dialogs, sheets, and detail screens; camera/gallery picker; keyboard over forms; 60fps `PushView` transitions. | Back button navigates stack cleanly; camera/gallery & keyboard behave smoothly. | **PASS** |
| **TC-06** | **Physical Phone Smoke Check** | Install final gold `udenis-specials-v1.0.0-b1-release.apk` on Udeni's Android phone. Launch, verify `v1.0.0`, create test entry, test Share backup. | Clean install and daily-ready offline operation on Udeni's phone. | Ready for handoff |
