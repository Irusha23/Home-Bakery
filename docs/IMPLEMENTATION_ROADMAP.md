# Udeni's Specials — Implementation Roadmap

**Status:** Implemented in Web Prototype (`feature/remaining-workflows`)  
**Stack:** React 19 + Vite 8 + TypeScript 5.7 + Tailwind CSS v4 + Vitest  
**Target:** Mobile-first, offline-capable home bakery application

## Phase 0 — Planning approval (Completed)

Deliverables:
- [x] Architecture & requirements design (`docs/ARCHITECTURE_DECISIONS.md`).
- [x] Domain business rules and financial terminology agreed.
- [x] Minimalistic 4-tab mobile UX direction established.

## Phase 1 — Project foundation & tooling (Completed)

Completed:
- [x] Vite 8 + React 19 + TypeScript 5.7 + Tailwind CSS v4 scaffold (`package.json`, `vite.config.ts`).
- [x] Git repository, feature branching (`feature/remaining-workflows`), and remote tracking.
- [x] Type checking (`npx tsc --noEmit`), Vitest suite (`pnpm test --run`), and production build (`pnpm build`).

## Phase 2 — Design system and 4-tab navigation (Completed)

Completed:
- [x] Shared warm bakery design tokens (`src/index.css`) and reusable UI primitives (`Button`, `Card`, `Dialog`, `Field`, `SelectField`, `Sheet`, `GroupedList`, `StatusBadge`, `SegmentedControl`, `CountdownBadge`, `Toast`).
- [x] 4-tab bottom navigation (`Home`, `Orders`, `Kitchen`, `Money`) with stack transitions (`useNavigationStack.ts`) and sub-screens (`CustomersScreen`, `SettingsScreen`).
- [x] Narrow mobile viewport layout, empty states, and confirmation dialogs.

## Phase 3 — Domain models and financial rules (Completed)

Completed:
- [x] Typed domain models (`src/types.ts`) for products, variants, recipes, orders, order lines, preparation records, payments, refunds, expenses, shared allocations, and budgets.
- [x] Pure domain calculators and validators (`src/lib/pricing.ts`, `src/lib/financials.ts`, `src/lib/expenses.ts`, `src/lib/budget.ts`, `src/lib/countdown.ts`).
- [x] Automated unit tests covering margin/markup pricing, payment balances, refunds, expenses, and `dd:hh:mm:ss` countdowns.

## Phase 4 — Orders, products, recipes, and baking workflow (Completed)

Completed:
- [x] Multi-line order creation and editing (`CreateOrderFlow.tsx`) with saved recipes or `+ Customise` one-off recipes.
- [x] Product & variant catalogue (`ProductEditorSheet.tsx`) with optional **"Copy recipe from existing"** starter cloning, plus Recipe Library (`RecipeEditorSheet.tsx`, `RecipesScreen.tsx`) with inline `Rs./kg | L | unit` pricing, batch scaling, and version history.
- [x] Direct order-linked baking workflow (`PreparationProductScreen`): pantry checklist gate (`Have` / `Buy`) → `Start bake` transitions into minimalistic **Baking State** (scaled recipe + steps + `Cook mode` + live `dd:hh:mm:ss` recipe timer) → `Mark ready` (step-gated) redirects to the order's `Ready for pickup` page.
- [x] Live `dd:hh:mm:ss` pickup countdowns on `OrderCard` and `OrderDetailScreen`, plus `REPEAT_ORDER` drafts.

## Phase 5 — Shopping, purchases, and expenses (Completed)

Completed:
- [x] Manual pantry checklist-driven **Shopping** (`To buy`) list (`ShoppingScreen.tsx`) consolidating minimal total quantities across orders with calculated per-item and total `Rs.` estimates.
- [x] Purchase recording (`ShoppingTripSheet.tsx`, `PurchaseForm.tsx`) updating inventory quantities and unit costs.
- [x] Direct and shared expense recording and allocation (`MoneyScreen.tsx` → `Expenses`, `FinancesScreen.tsx`).

## Phase 6 — Pricing, payments, and due-balance tracking (Completed)

Completed:
- [x] Integrated `PricingCalculatorSheet` supporting margin/markup modes and manual agreed prices.
- [x] Step-by-step partial payments, refunds, and `Collected` auto-prompt to record remaining balance when due.
- [x] Standardized payment method dropdown (`Cash`, `Online transaction`, `Other` with optional specification).
- [x] Unpaid & part-paid visibility across the app: `Orders → Due` filter + `Due Rs. X` card cues, `Home` contextual **Payments due** banner, and tappable **Unpaid customer orders** sheet in `Money`.

## Phase 7 — Local persistence and migrations (Completed for Web)

Completed:
- [x] Versioned `localStorage` persistence (`src/state/persistence.ts`) with schema migration support and `PersistenceRecoveryScreen.tsx`.
- [x] Centralized validated reducer (`src/state/AppState.tsx`) with `dispatchIfAccepted` safety guards.
- [x] Persistence and reducer lifecycle test suites (`AppState.test.ts`, `ExtraStockLifecycle.test.ts`, `persistence.test.ts`).

## Phase 8 — Dashboard, reporting, and budgeting (Completed)

Completed:
- [x] `HomeScreen` driven by live selectors (`todaySelectors.ts`): `Up next`, workload counts, `Upcoming pickups`, `Due` payment alerts, and `Notifications`.
- [x] Minimalistic `MoneyScreen` with period filters, `Sales earned`, `Cash received`, `Money spent`, `Monthly goal`, category spend limits (`Budget`), and CSV exports (`orders`, `expenses`, `purchases`).

## Phase 9 — Backup, restore, and data recovery (Completed)

Completed:
- [x] Versioned JSON export and validated import (`BackupRestorePanel.tsx` in `SettingsScreen.tsx`).
- [x] Weekly backup reminders with dismiss/snooze controls.
- [x] Safe rejection of invalid backup files without corrupting live state.

## Phase 10 — Release readiness & mobile packaging (Next)

Remaining tasks:
- [ ] Physical Android device / mobile browser end-to-end QA pass (touch targets, keyboard, scrolling, offline reload).
- [ ] Optional native wrapper / React Native + `expo-sqlite` port if distributing as a Play Store APK.
- [ ] User onboarding notes and initial bakery catalog setup before live business use.

## Development rules

- Work on one milestone at a time.
- Use small Git commits at stable checkpoints.
- Require human review of AI-generated changes.
- Run relevant tests before marking a task complete.
- Do not skip earlier acceptance criteria to add later features.
- Do not introduce a backend without an approved architectural change.
- Maintain a record of incomplete work and known limitations.

## Definition of project completion

The initial release is complete when the owner can manage real orders, calculate prices accurately, record expenses and payments, retrieve saved records offline, and recover her business data through a tested backup and restore workflow.

## Living Web Prototype Spec Status (Phases 0–10 Complete)

This Figma Make / Vite React web prototype now serves as the complete interactive specification prior to the Expo React Native + SQLite port:

- **Navigation:** 5-tab structure (`Today`, `Orders`, `Recipes`, `Stock`, `Money`) with stack history support (`src/navigation/useNavigationStack.ts`).
- **Pure Domain Logic (`src/lib/*`):** Framework-free whole-LKR modules ready for direct copy into the Expo TypeScript codebase (`pricing.ts`, `orders.ts`, `inventory.ts`, `financials.ts`, `financialReports.ts`, `expenses.ts`, `budget.ts`, `csv.ts`, `preparation.ts`, `orderLifecycle.ts`, and `selectors/todaySelectors.ts`).
- **UI & Motion Primitive Mapping for Expo Port:**
  - `Sheet` (`src/components/ui/Sheet.tsx`) -> `@gorhom/bottom-sheet`
  - `motion/react` springs & transitions (`src/lib/motion.ts`) -> `react-native-reanimated` v3
  - `ToastProvider` (`src/components/ui/Toast.tsx`) -> native toast/banner manager
  - `localStorage` persistence (`src/state/persistence.ts`, schema v7) -> `expo-sqlite` transactional repositories with JSON backup export/import preserved
