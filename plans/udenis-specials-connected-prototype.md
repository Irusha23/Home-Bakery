# Udeni’s Specials — Full Connected Mobile Prototype Plan

## 1. Goal and agreed scope

Build a polished, Android-first React prototype for **Udeni’s Specials**, adapting the uploaded design brief into a working light-mode mobile application.

The first implementation will include:

- A responsive phone layout optimized around a 390 × 844 viewport and usable across common Android phone widths.
- The complete six-destination app shell: Home, Orders, Recipes, Shopping, Inventory, and Finances.
- High-fidelity principal screens plus contextual secondary screens needed by the demonstrated flows.
- All three essential journeys from the brief with meaningful simulated state transitions.
- Realistic Sri Lankan bakery sample data and consistent LKR/Rs. formatting.
- Local browser persistence so the prototype’s demo state survives refresh.
- No backend, authentication, cloud synchronization, payment gateway, supplier system, or dark mode.

This is an owner-facing bakery operations app, not a customer storefront and not a generic enterprise dashboard.

## 2. Design direction

Treat the uploaded brief as the project’s design system because the repository is currently a blank scaffold with no UI library.

### Visual language

- Warm minimalism with a premium, quiet finish and Android-first ergonomics.
- Warm ivory page background (`#F7F5F0`), white surfaces, sage brand/actions (`#78917B`), cocoa text (`#5C463C`), muted secondary text (`#81786F`), soft sage selections (`#E7EDE5`), and warm borders (`#E7E1D7`).
- Semantic success, warning, and error colors from the brief, always paired with labels/icons rather than color alone.
- Inter loaded through a public Google Fonts CSS import, with system sans-serif fallbacks and tabular numerals for prices and quantities.
- Spacious 16–22 px-radius surfaces, restrained borders/elevation, 44–48 px minimum interactive targets, and 150–220 ms transitions.
- No glassmorphism, loud gradients, decorative blobs, excessive pills, or dense desktop-dashboard composition.
- Use a coherent rounded icon family through `lucide-react`; labels remain visible for important actions.
- Use one intentionally selected Unsplash bakery/product image on the Home identity/priority area and small product thumbnails where they improve recognition. Operational views remain information-led. Store image attribution/source metadata in the sample-data module and provide useful alt text.

### Responsive behavior

- Full-width application on phone-sized previews; on wider canvases, center a mobile working column with a subtle neutral outer background rather than stretching operational content into a desktop dashboard.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- Add enough bottom content padding for the floating navigation and hide the primary navigation while the keyboard/form sheet pattern requires unobstructed actions.
- Keep touch targets comfortable, forms single-column, and horizontally scroll filter controls only when necessary.

## 3. Information architecture and navigation

Use lightweight internal screen state rather than adding a routing library. The app state will track the active primary tab, a detail-screen stack, and optional sheet/dialog state. Back actions pop the detail stack; switching a primary tab returns to that tab’s root.

### Primary tabs

1. **Home** — daily priorities, preparation workload, stock/payment alerts, quick actions, financial snapshot.
2. **Orders** — searchable/filterable order lifecycle and order detail.
3. **Recipes** — reusable recipes, variants, yields, versions, scaling, and edit/create views.
4. **Shopping** — consolidated order and extra-stock demand, editable purchase quantities, and purchase recording.
5. **Inventory** — segmented raw ingredients, packaging, and finished stock with movement history.
6. **Finances** — sales, payments, refunds, expenses, outstanding balances, and estimated versus actual profit.

Build a custom floating navigation bar with six balanced icon-and-label items, selected sage treatment, subtle elevation, and safe-area spacing. Secondary destinations such as customer detail, preparation, extra-stock plans, expenses, reports, settings, and backup/restore open contextually and do not become extra tabs.

## 4. Screen inventory

### Home

- Greeting (“Good morning, Udeni”) and subtle bakery identity.
- One dominant “Next up” preparation card with collection deadline and action.
- Compact workload summary for awaiting, in progress, and ready orders.
- Upcoming collections list.
- Low-stock/shortage warning and outstanding-payment callouts.
- Distinct sales and estimated-profit snapshot.
- Quick actions for Create order, Record sale, Plan shopping, and Add expense.
- Profile/menu access for reports, settings, and backup/restore.

### Orders

- Search input and scrollable status filters: All, Draft, Confirmed, In Progress, Completed, Cancelled.
- Cards/rows with customer or Quick order, product summary, quantity, collection date/time, agreed price, preparation status, and separate payment status.
- Order detail with product lines, recipe references, preparation progress, collection instructions, price/cost snapshot, payment history, and order history.
- Contextual actions for confirm, start/continue preparation, mark handed over, and record/review payment.

### Create order

Implement as a focused step flow with a compact progress header and persisted draft state:

1. Customer selection/create or Quick order.
2. Product, variant, quantity, and saved/new recipe.
3. Collection date/time and instructions.
4. Requirements, stock availability, estimated cost, suggested price, and editable agreed price.
5. Confirmation summary showing reservations and shortages.

Drafts do not reserve inventory. Confirmation freezes agreed price and recipe/cost snapshots, creates active reservations, and can succeed with shortages; shortages feed Shopping. A new recipe has an explicit “Save to Recipe Library” choice and is not saved automatically.

### Recipes

- Search and product/variant filter.
- Recipe cards with yield, unit, prep time, estimated cost, and version.
- Recipe detail with ingredient/packaging tables, instructions, scaling control, and version history.
- Create/edit form with compatible metric units and an explicit save action.
- Confirmed orders and preparation plans keep their recipe snapshot when the library recipe changes.

### Shopping

- Consolidated requirements grouped into Ingredients and Packaging.
- Each row shows required, available after reservations, shortage, editable buy quantity, and demand-source breakdown.
- Demand-source detail distinguishes customer orders and extra-stock plans.
- Add-recipe/variant flow for existing orders and extra-stock planning without creating purchases or extra reservations.
- Record Purchase sheet captures actual quantity, unit/package size, and purchase price; confirmation increases physical inventory and appends purchase history.
- Completed purchases remain in history even if planning demand later changes.

### Inventory

- Segments for Ingredients, Packaging, and Finished stock.
- Rows show physical, reserved, available, planned requirement, warning state, and cost where relevant.
- Detail screen shows movement timeline and adjustment actions.
- Adjustment sheet supports correction, spoilage, damage, and discard with reason.
- Discrepancies are surfaced; stock is not silently driven negative.

### Preparation workflow

- Queue of orders/products requiring preparation.
- Large kitchen-friendly recipe view with ingredients, quantities, packaging, instructions, progress checklist, and product-by-product status.
- Starting preparation changes status only and preserves progress; it does not deduct stock.
- Actual usage review allows adjustments against the preparation record without changing the reusable recipe.
- Complete Preparation deducts actual raw/packaging usage exactly once, appends movement history, and marks the product ready. A completion summary leads to handover and payment review.

### Extra-stock preparation and sales

- Plan extra stock from Home, Shopping, or Inventory.
- Select product/variant/recipe, planned quantity, and optional best-before date.
- Review requirements, record actual quantity/usage, then complete preparation.
- Completion deducts raw/packaging stock once and creates finished-stock units with actual cost.
- Record Sale supports quick sale or customer-linked sale and reduces finished stock only.
- Waste/discard is a separate finished-stock movement with reason; neither sale nor discard deducts raw ingredients again.

### Finances and secondary screens

- Financial overview cards for revenue, estimated/actual costs, estimated/actual profit, expenses, payments received, refunds, outstanding balances, inventory valuation, and extra-stock waste.
- Transaction list with filters and clear cash-flow versus consumption-cost language.
- Payment sheet supports deposits and multiple partial payments.
- Refunds remain separate records linked to a payment.
- Expense sheet supports amount, category, date, note, and shared/unallocated flag.
- Contextual customer detail includes balance and order/payment history.
- Reports, pricing/labour assumptions, shared-expense allocation, settings, and backup/restore are polished secondary summary screens/sheets; they are navigable but do not introduce backend behavior.

## 5. Demo domain model and state rules

Create strongly typed entities in a central model:

- `Customer`
- `Product` and `ProductVariant`
- `Recipe`, `RecipeVersion`, `RecipeIngredient`, and packaging requirement
- `Order` and `OrderLine`
- Frozen `OrderCostSnapshot` and recipe snapshot
- `PreparationRecord`
- `ExtraStockPlan`
- `InventoryItem` and `InventoryMovement`
- `ShoppingRequirement` and `PurchaseRecord`
- `Payment`, `Refund`, `Expense`, and `Sale`

Use a central `useReducer` provider with domain-oriented actions. Persist only serializable app/domain state to a versioned local-storage key; the current prototype uses `udenis-specials-demo-v5` and recognizes v4, v3, and v2 as migration sources. Local backups use the `udenis-specials-backup` JSON format at backup schema version 1 and are validated before restore; current storage is copied to a recovery key before a verified replacement. If saved data cannot be read or safely normalized, preserve its raw value and pause normal app access and persistence until the user retries, exports it, restores a validated backup, or explicitly starts fresh. Keep transient navigation, open sheets, search terms, and unsaved form fields in component state. Provide a Reset demo data action under Settings.

Seed internally consistent sample data, including products such as chocolate celebration cake, vanilla cupcakes, butter cake, and brownie boxes; customers with Sri Lankan names; metric quantities; and believable values formatted as `Rs. 12,500`. Use `Intl.NumberFormat("en-LK")` and explicit metric-unit helpers.

Enforce these reducer rules:

- Draft orders create no reservations.
- Confirming freezes agreed price, initial cost, and recipe versions; shortages do not block confirmation.
- Available stock = physical stock − active reservations.
- Starting preparation changes progress only.
- Completing preparation consumes actual raw/packaging quantities exactly once and releases relevant reservations.
- Completing/handover never implies full payment.
- Purchases increase physical stock and remain in history independently of the current shopping plan.
- Extra-stock preparation creates finished units; later sale or waste changes finished stock only.
- Repeated completion actions are idempotent and disabled once recorded.
- Compatible conversion is limited to kg↔g and L↔ml; no mass/volume conversion.

## 6. Component architecture and file changes

Keep `src/App.tsx` as the composition root and split the implementation by responsibility rather than creating one oversized file.

Planned structure:

- `src/App.tsx` — providers and root app shell.
- `src/index.css` — Tailwind import, Inter import, semantic CSS/Tailwind theme tokens, safe-area helpers, base typography, focus/motion rules.
- `src/types.ts` — domain and navigation types.
- `src/data/demoData.ts` — coherent seeded data and photo metadata.
- `src/lib/format.ts` — LKR, dates, quantities, and unit conversion helpers.
- `src/state/AppState.tsx` — reducer, persistence, selectors, and domain actions.
- `src/components/ui/*` — local design-system primitives: Button, IconButton, Card, Badge, Input, Select-like field, SegmentedControl, QuantityStepper, SearchField, Sheet, Dialog, EmptyState, SectionHeader, MoneyValue, and Progress.
- `src/components/AppShell.tsx` and `src/components/BottomNav.tsx` — safe-area shell and six-tab floating navigation.
- `src/components/domain/*` — OrderCard, InventoryRow, RequirementRow, FinancialCard, Timeline, ProductThumbnail, and similar reusable domain compositions.
- `src/screens/*` — primary and contextual screens grouped by Home, Orders, Recipes, Shopping, Inventory, Finances, Preparation, ExtraStock, and Secondary.

Add only the dependency needed for coherent icons (`lucide-react`). Do not add a component framework or routing/state-management library.

Local UI primitives will encapsulate semantic HTML, keyboard/focus behavior, variants, and design tokens. Screens should consume these components rather than duplicating raw control styling.

## 7. Key interaction details

- Sheets/dialogs trap focus where practical, close via explicit controls and Escape, and require confirmation for destructive/consequential actions.
- Inline validation identifies missing customer/product data, invalid quantity, invalid date/time, and non-positive financial values.
- Buttons show disabled/pressed states; save/completion actions show concise success feedback.
- Search and filters update visible lists immediately.
- Expandable demand, history, and cost sections reduce clutter without hiding urgent information.
- Status indicators include icon + text.
- Motion uses CSS transitions and respects `prefers-reduced-motion`.
- Empty states include a direct next action; warning/error states explain how to resolve the issue.

## 8. Required connected journeys

### Journey 1 — Customer order to preparation

Home → Create Order → choose/create customer → add product/variant → choose/create recipe → review cost and agreed price → confirm despite shown shortage → open Shopping requirements → return to Orders → start preparation → retain checklist progress → review actual usage → complete preparation → mark ready/handed over → record or review partial payment.

The UI must visibly preserve separate preparation/completion and payment states.

### Journey 2 — Combined shopping and inventory

Home/Shopping → add requirement for an existing order → add an extra-stock plan → view consolidated flour/packaging demand with separate sources → compare reserved/available stock → edit practical package quantity → record actual purchase and price → inspect updated inventory and purchase history.

### Journey 3 — Extra-stock preparation and sale

Plan extra stock → choose product/variant and recipe → set quantity → review ingredients → record actual prepared quantity/usage → complete preparation → inspect finished stock → record a quick sale → inspect reduced finished stock → discard remaining units separately.

The movement history must make clear that ingredients were consumed during preparation, not during sale/discard.

## 9. Accessibility and quality constraints

- Maintain AA-oriented contrast for operational text and never use pale sage as body text on ivory.
- Use visible focus rings, descriptive labels, `aria-current` for navigation, and accessible names for icon-only controls.
- Keep interactive targets at least 44 px where practical.
- Do not rely on color alone for statuses or warnings.
- Use real controls, logical tab order, and non-placeholder labels.
- Avoid content being hidden behind the floating navigation or system safe areas.
- Preserve strict TypeScript typing and default component exports where components are standalone modules.

## 10. Verification strategy

Because this is a broad application build:

1. Run `pnpm format` after implementation.
2. Run `pnpm build` and resolve all TypeScript/Vite failures.
3. Search changed UI files for accidental hard-coded competing colors, inaccessible icon-only actions, malformed JSX, and direct one-off control styling that should use a primitive.
4. Use the already-running Figma Make preview (do not start another server) to exercise the three journeys at a common Android phone width and one narrower width.
5. Refresh during an in-progress order/preparation and confirm local persistence restores domain progress.
6. Verify reducer invariants with focused interaction checks:
   - draft does not reserve;
   - shortage does not block confirmation;
   - preparation start does not deduct;
   - preparation completion deducts once;
   - order completion does not auto-pay;
   - purchase increases inventory;
   - finished-stock sale/discard does not consume ingredients.
7. Check bottom navigation, sheets, and sticky actions against top/bottom safe areas and ensure no content is obscured.
8. Check empty, validation, warning, confirmation, success, disabled, and destructive states on representative screens.

## 11. Acceptance criteria

The implementation is complete when:

- The visual style clearly matches the uploaded Warm Minimalism brief.
- All six primary destinations are present, polished, and connected.
- The three essential journeys can be completed through working controls and produce consistent visible state changes.
- Demo state persists across refresh and can be reset.
- Price, cost, payment, inventory, and preparation concepts remain correctly separated.
- Realistic data and LKR values remain consistent across screens.
- Android phone layouts are readable, touch-friendly, safe-area aware, and free of navigation overlap.
- The production build passes without errors.
