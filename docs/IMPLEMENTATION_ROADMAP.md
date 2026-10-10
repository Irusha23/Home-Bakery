# Udeni's Specials — Implementation Roadmap

**Status:** Proposed  
**Development environment:** VS Code + GitHub Copilot  
**Target:** Android-first, offline-capable application

## Phase 0 — Planning approval

Deliverables:
- Approved architecture decision record.
- Approved Copilot project instructions.
- Approved Figma Make design brief.
- Agreed business rules and acceptance criteria.

Acceptance:
- No unresolved architectural issue blocks the initial project setup.
- Scope boundaries are explicit.
- Core financial terminology is agreed.

## Phase 1 — Development environment and project foundation

Tasks:
- Verify Node.js, Git, VS Code, Android Studio and Android SDK setup.
- Create the Expo React Native TypeScript project.
- Establish the initial Git repository and checkpoint.
- Configure Expo Router and React Native Paper.
- Configure the shared application theme.
- Establish TypeScript, linting and test commands.
- Verify the project starts on the Android emulator.

Acceptance:
- Application launches successfully on the emulator.
- Navigation shell renders correctly.
- Type checking, tests and production-oriented build checks are available.
- Dependencies are compatible and recorded in the lockfile.
- No business features have been added prematurely.

## Phase 2 — Design system and navigation

Tasks:
- Implement shared typography, colours, spacing and component conventions.
- Implement the approved navigation structure.
- Create the six core screen shells.
- Add reusable inputs, cards, status indicators and dialogs.
- Implement empty and error states.

Acceptance:
- The six main screen destinations are reachable.
- Screens follow the approved Figma design.
- Layouts remain usable on narrow Android screens.
- Common components behave consistently.

## Phase 3 — Domain models and financial rules

Tasks:
- Define typed models for products, recipes, orders, order lines, expenses, payments and shared allocations.
- Define money and quantity representations.
- Implement recipe costing and order cost calculations.
- Implement margin and markup pricing.
- Implement payment balance calculations.
- Implement shared expense allocation validation.
- Add tests for normal and invalid cases.

Acceptance:
- A Rs. 1,000 cost with a 30% margin produces Rs. 1,428.57 before rounding.
- The same cost with a 30% markup produces Rs. 1,300.
- Invalid margin inputs are rejected.
- Shared allocations cannot exceed the source expense.
- Tests verify payment balances and cost calculations.
- Historical snapshots have defined semantics.

## Phase 4 — Orders and products

Tasks:
- Create and edit orders.
- Add multiple product lines.
- Maintain reusable recipes and custom one-off products.
- Add order status and due-date handling.
- Capture the relevant recipe and costing snapshot.
- Implement order details and validation.

Acceptance:
- An order can contain multiple products.
- Both recipe-based and custom products are supported.
- Editing a reusable recipe does not silently rewrite existing order costs.
- Invalid or incomplete order data is handled safely.

## Phase 5 — Shopping and expenses

Tasks:
- Generate shopping requirements from selected orders.
- Consolidate compatible ingredient requirements.
- Record actual purchases.
- Record order-specific expenses.
- Record shared shopping and transport expenses.
- Allocate shared expenses and display unallocated balances.

Acceptance:
- Shopping requirements combine matching ingredients correctly.
- Purchase spending is distinguished from ingredient consumption cost.
- Shared expenses are recorded once and allocated consistently.
- Related database updates use transactions where required.

## Phase 6 — Pricing and payments

Tasks:
- Integrate the pricing calculator with order costing.
- Support margin and markup modes.
- Support price suggestions and manual agreed prices.
- Record payments and outstanding balances.
- Distinguish estimated profit from actual profit.

Acceptance:
- The calculator uses the agreed business rules.
- Changing an estimate does not silently overwrite an agreed price.
- Partial payments produce the correct outstanding balance.
- Missing cost information is clearly identified.
- Payment records and financial summaries remain consistent.

## Phase 7 — SQLite persistence

Tasks:
- Implement repository interfaces.
- Implement SQLite repositories and schema migrations.
- Configure database initialisation and error handling.
- Persist all required business records.
- Add transactions and database constraints.
- Verify data across app restarts.

Acceptance:
- Core workflows operate offline.
- Saved data survives application restarts.
- Related records remain consistent after failures.
- Migrations work against supported database versions.
- Invalid database operations fail safely.

## Phase 8 — Dashboard and history

Tasks:
- Populate the dashboard from saved records.
- Add upcoming-order and outstanding-payment summaries.
- Add completed-order history.
- Add basic date filtering and financial summaries.

Acceptance:
- Dashboard figures are derived from consistent underlying records.
- Estimated and actual results are clearly differentiated.
- Cancelled and completed orders are handled correctly.
- Empty states work when no orders exist.

## Phase 9 — Backup, restore and data recovery

Tasks:
- Design a versioned export format.
- Export required business records.
- Validate imported data before restoration.
- Define how duplicate or conflicting records are handled.
- Add recovery guidance and destructive-action confirmation.

Acceptance:
- A valid export can be restored successfully.
- Invalid files are rejected without corrupting existing records.
- Restore operations are transactional where practical.
- Backup and restore are tested on the Android application.

## Phase 10 — Release readiness

Tasks:
- Complete emulator-based functional testing.
- Test on the physical Android phone.
- Verify keyboard behaviour, touch targets and scrolling.
- Test offline use, restart behaviour and data recovery.
- Fix high-priority usability and data-integrity defects.
- Prepare installation and user guidance.

Acceptance:
- All critical end-to-end workflows pass.
- No known critical data-loss or financial-calculation defect remains.
- Physical-device testing is documented.
- Known limitations are disclosed before real business use.

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