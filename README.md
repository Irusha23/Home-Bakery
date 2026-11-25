# Udeni's Specials — Home Bakery Manager

A **100% local-first, offline-capable Android mobile application** (`.apk`) built for managing a home bakery business in Sri Lankan Rupees (**Rs. / LKR**).

## Key Capabilities

- **Orders & Customers:** Multi-line orders, custom or saved recipes, automatic stock reservation & shortage detection, customer reference photos, pickup countdowns (`dd:hh:mm:ss`), and repeat orders.
- **Kitchen & Baking:** Pantry checklist gate (`Have` / `Buy`), scaled recipe view, Cook mode, live countdown timer, and step-gated completion.
- **Inventory, Shopping & Extra Stock:** Consolidated `To buy` shopping list, purchase recording with weighted-average unit cost updates, and standalone extra-stock batches.
- **Finances & Budgets:** Partial/final payments (`Cash`, `Online transaction`, `Other`), refunds, direct & shared expenses, monthly sales goals, category budgets, and CSV exports.
- **Offline-First & Private:** Backed by on-device **SQLite** (`@capacitor-community/sqlite`), local filesystem photo storage (`@capacitor/filesystem`), and password-protected **AES-256-GCM** backups shared via the Android Share Sheet (Google Drive / WhatsApp / Files). Zero cloud server or hosting cost.

## Architecture & Docs

- [Architecture Decisions (v2.0)](docs/ARCHITECTURE_DECISIONS.md)
- [SQLite Database Schema](docs/DATABASE_SCHEMA.md)
- [Android Release & Signing Guide](docs/ANDROID_RELEASE_GUIDE.md)
- [v1.0.0 QA Sign-Off Checklist](docs/QA_CHECKLIST_V1.md)
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)

## Quick Commands

| Command | Purpose |
| :--- | :--- |
| `pnpm dev` | Run Vite dev server for browser preview |
| `pnpm typecheck` | Run TypeScript type check (`tsc --noEmit`) |
| `pnpm test` | Run Vitest unit & integration suite |
| `pnpm build` | Build production web bundle (`dist/`) |
| `pnpm android:apk:debug` | Build web bundle, `cap sync android`, and debug `.apk` |
| `pnpm android:apk:release` | Build `empty`-starter release bundle, `cap sync`, signed `.apk`, verify signature & SHA-256 |
| `pnpm version:bump <patch\|minor\|major>` | Bump semver & `versionCode` across `src/version.json` and `package.json` |
