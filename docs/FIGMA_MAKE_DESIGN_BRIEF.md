# Figma Make Design Brief — Udeni's Specials

## 1. Objective

Design a polished, mobile-first interface for Udeni's Specials, a small home bakery management app.

The primary user is the bakery owner, who currently receives orders by phone, records information manually, shops for ingredients, prepares products and calculates selling prices.

The application must reduce paperwork, simplify calculations and make the owner's workload visible.

Design for Android phone screens first. Do not design a customer-facing storefront.

## 2. Design principles

- Simple enough to use while working in a kitchen.
- Warm and friendly without sacrificing readability.
- Fast data entry with minimal unnecessary typing.
- Clear distinction between planned values, estimates and actual results.
- Financial calculations must be transparent.
- Important actions must be easy to find.
- Destructive actions require clear confirmation.
- Empty states should guide the owner toward the next useful action.

## 3. Visual direction

Use a warm, understated home-bakery aesthetic.

Suggested palette:
- Warm cream backgrounds.
- White or lightly tinted surfaces.
- Muted terracotta or cocoa-brown accents.
- Dark, high-contrast text.
- Green for positive financial outcomes.
- Amber for upcoming tasks and warnings.
- Red for errors and destructive actions.

Use consistent spacing, rounded cards, restrained shadows and readable typography.

Avoid excessive decorative illustrations, gradients, oversized charts or crowded dashboards.

The design should be achievable with React Native Paper components and a shared theme. Do not rely on web-only visual effects.

## 4. Navigation

Propose a simple primary navigation structure:

- Home
- Orders
- Shopping
- Products
- More, for expenses, pricing settings and history if needed

The final navigation must be evaluated against the actual phone screen size. Avoid hiding essential tasks several levels deep.

## 5. Core screen designs

### Screen A — Dashboard

Show:
- Orders due today.
- Upcoming orders.
- Orders awaiting shopping or preparation.
- Outstanding payment balances.
- Expected revenue and estimated profit for relevant orders.
- Recent order activity.
- Quick actions to create an order and open the shopping list.

Use realistic sample data and clearly label financial summaries.

### Screen B — Create order

Capture:
- Customer name and contact number.
- Required date and optional time.
- Customer notes.
- One or more product lines.
- Quantity and agreed unit price.
- Product-specific notes.
- Optional initial payment.

Support adding and removing multiple product lines without losing entered information.

Make validation errors visible beside the relevant fields.

### Screen C — Order details

Display:
- Customer and order information.
- Product lines and quantities.
- Preparation status.
- Agreed selling price.
- Estimated and actual cost summaries where available.
- Payment received and outstanding balance.
- Order-specific expenses.
- Actions to edit, advance the workflow, record a payment or complete the order.

Do not imply that an order is profitable merely because payment has been received.

### Screen D — Shopping list

Display:
- Ingredients required for selected orders.
- Consolidated quantities for matching ingredients.
- Planned versus actual purchased quantities.
- Purchase prices and totals.
- Purchase completion status.
- Manually added shopping items.
- Shared shopping trip and transport expenses.

Provide a clear way to see which orders depend on the selected shopping items.

### Screen E — Pricing calculator

Display a transparent breakdown of:
- Ingredient consumption cost.
- Packaging.
- Other direct expenses.
- Labour.
- Allocated shared expenses.
- Total estimated cost.

Provide an explicit selector between:
- Target profit margin.
- Markup percentage.

Show:
- Entered percentage.
- Calculated selling price.
- Optional rounded suggestion.
- Expected profit in LKR.
- Resulting profit margin.
- Final agreed price.

Allow manual price overrides without silently replacing the agreed price when estimates change.

### Screen F — Products and recipes

Display saved products and reusable recipes.

Allow the owner to:
- Create and edit a product.
- Add recipe ingredient lines and quantities.
- Select compatible measurement units.
- Define recipe yield or batch size.
- Record packaging and other direct costs.
- Create a one-off product without a reusable recipe.

Make recipe cost information understandable without displaying unnecessary accounting terminology.

## 6. Required prototype interactions

The Figma prototype should demonstrate:

1. Dashboard to create order.
2. Adding multiple product lines.
3. Opening and reviewing order details.
4. Navigating from an order to its shopping requirements.
5. Reviewing consolidated shopping quantities.
6. Opening the pricing calculator.
7. Switching between margin and markup.
8. Recording a payment and viewing the remaining balance.
9. Reviewing order status and completion.

Use representative values in LKR, but do not treat Figma's displayed calculations as the source of financial correctness.

## 7. Design system

Define:
- Colour tokens.
- Typography hierarchy.
- Spacing scale.
- Corner radii.
- Button variants.
- Text input styles.
- Cards.
- Status indicators.
- Dialogs and confirmation prompts.
- Financial summary components.
- Empty, loading, error and success states.

Keep component names and interaction behaviour understandable for implementation in React Native Paper.

## 8. Deliverables

Produce:
- Low-fidelity wireframes for all six core screens.
- A high-fidelity visual direction for the main flows.
- Reusable components and design tokens.
- A clickable prototype of the primary workflow.
- Notes on interactions, validation and responsive behaviour.
- A list of unresolved product questions.

## 9. Design acceptance criteria

Approve the design only when:
- All six screens are represented.
- The main workflow is navigable.
- Multi-product order entry is understandable.
- Cost, profit and payment are visually distinct.
- Margin and markup are clearly differentiated.
- The interface remains readable on narrow phone screens.
- The proposed components are practical to reproduce with React Native Paper.
- No unapproved customer ordering or backend-dependent features have been introduced.