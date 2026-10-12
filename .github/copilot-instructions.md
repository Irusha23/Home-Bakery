# GitHub Copilot Instructions — Udeni's Specials

## Project mission

Build an Android-first, local-first home bakery management application.

The application digitises internal order management, recipes, shopping, expenses, pricing and payment tracking. Customer-facing online ordering is out of scope.

## Approved technology stack

- React Native
- Expo
- TypeScript with strict checking
- Expo Router
- React Native Paper
- Expo SQLite
- React Hook Form
- Zod
- Jest and React Native Testing Library
- Git and GitHub

Use compatible dependency versions. Prefer Expo's dependency installation and validation tools for native packages.

Do not introduce a backend, remote database, authentication service or cloud synchronisation without explicit approval.

## General working rules

1. Inspect the existing project before proposing or making changes.
2. Read the relevant architecture and requirements documents.
3. Describe the planned change and affected files before a substantial implementation.
4. Implement one bounded feature or milestone at a time.
5. Do not rewrite working modules unnecessarily.
6. Do not install new dependencies without explaining why they are needed.
7. Never claim a test passed unless it was actually run.
8. Report changed files, tests executed, known limitations and remaining work.
9. Do not discard user changes or reset Git history without explicit permission.
10. Ask for clarification when a requirement materially affects financial correctness or historical data.

## Architecture rules

- Keep presentation, application services, domain rules and persistence separate.
- Screens must not contain raw SQL.
- Keep financial formulas in dedicated, testable domain functions.
- Use typed repository interfaces for data access.
- Validate data at application boundaries and enforce appropriate database constraints.
- Use transactions for multi-record operations that must remain consistent.
- Do not duplicate business rules across screens.
- Avoid unnecessary abstractions and premature global state.

## Financial correctness

- Currency: LKR.
- Use a consistent money representation and explicit rounding rules.
- Never confuse markup with profit margin.
- Prevent invalid margin inputs of 100% or greater.
- Guard against division by zero and invalid quantities.
- Distinguish estimated cost from actual cost.
- Distinguish purchase cash outflow from ingredient consumption cost.
- Distinguish payment received from revenue and profit.
- Calculate outstanding balances from the agreed selling price and recorded payments.
- Never silently overwrite a manually agreed selling price.
- Never silently rewrite historical order costs when recipes or ingredient prices change.
- Ensure shared expense allocations never exceed the original expense.
- Preserve and clearly display unallocated shared expense amounts.

## Data integrity

- Use versioned SQL migrations.
- Use parameterised database queries.
- Define foreign keys and suitable constraints.
- Use transactions for related updates.
- Treat destructive actions carefully and require confirmation where appropriate.
- Do not reset or overwrite real user data when seeding sample data.
- Design export and restore with validation and recovery in mind.

## UI and accessibility

- Use React Native Paper as the primary component library.
- Apply the approved shared theme and design tokens.
- Follow the approved Figma screens and interaction flows.
- Optimise for Android phone screens and touch interaction.
- Use clear labels, readable typography, appropriate contrast and useful validation messages.
- Provide loading, error, empty and success states.
- Avoid horizontal scrolling on ordinary mobile screens.
- Do not introduce web-only HTML elements or browser CSS assumptions.

## Testing expectations

For every meaningful feature:

1. Run relevant unit tests.
2. Add tests for new business rules and edge cases.
3. Run TypeScript checks and available linting.
4. Run the application and verify the changed flow where possible.
5. Test database migrations and persistence for data-layer changes.
6. Report anything that could not be verified.

Financial calculations must have independent tests using known input and output values.

## Scope discipline

Do not implement features that have not been approved in the current milestone.

Do not add online ordering, a backend, remote APIs, multi-user permissions or automatic inventory management without approval.

Do not replace SQLite with another database or introduce an ORM solely because it is fashionable.

## Definition of done

A task is complete only when:

- The requested behaviour is implemented.
- Existing relevant behaviour still works.
- Appropriate tests pass.
- The changes respect the architecture.
- No unrelated modifications have been introduced.
- Known limitations are documented.
- The work is ready for human review.

Do not commit, push, publish or deploy unless explicitly requested.