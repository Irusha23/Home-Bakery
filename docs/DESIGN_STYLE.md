# Udeni’s Specials — Figma AI Master Design Brief

## 1. Project overview

Design a premium, polished, Android-first mobile application called **Udeni’s Specials** for a small home bakery.

The application will help the bakery owner manage daily operations from one Android phone, including customer orders, reusable recipes, ingredient shopping, inventory, preparation, sales, payments, and finances.

This is a functional business application, not a bakery e-commerce storefront, recipe discovery app, or enterprise management dashboard.

**Primary objective:** Make the everyday bakery workflow simple, visually clear, reliable, and enjoyable, with as little unnecessary phone interaction as possible while baking.

### Target user

A home bakery owner who needs to:
- Know which orders must be prepared and when.
- Calculate ingredients and packaging requirements.
- Shop efficiently without buying unnecessary quantities.
- Track physical stock and actual ingredient consumption.
- Estimate product costs, choose selling prices, and understand profit.
- Track deposits, partial payments, refunds, and outstanding balances.
- Prepare products for confirmed orders and additional stock for future sales.

The application should feel approachable to a small-business owner rather than designed for a large commercial bakery.

## 2. Design direction — approved

Use **Warm Minimalism with a premium, iOS-inspired visual finish and Android-first usability**.

The design should feel:
- Warm and welcoming.
- Elegant and quietly premium.
- Spacious, clean, and highly readable.
- Natural and artisanal.
- Professional without looking corporate.
- Calm and organised, even on information-heavy screens.

Take inspiration from the visual refinement, spacing, smooth transitions, and component consistency of excellent iOS applications. However, preserve Android-friendly touch behaviour, system insets, keyboard handling, back navigation, and familiar interaction patterns.

Do not imitate an existing application exactly.

## 3. Colour system

Use the following initial design tokens consistently.

| Token | Colour | Usage |
|---|---|---|
| Warm ivory | `#F7F5F0` | Main application background |
| White | `#FFFFFF` | Cards, sheets, and primary surfaces |
| Sage green | `#78917B` | Brand accent, selected navigation, primary actions |
| Cocoa brown | `#5C463C` | Main text and headings |
| Muted text | `#81786F` | Secondary labels and descriptions |
| Soft sage | `#E7EDE5` | Selected states and subtle accent surfaces |
| Warm border | `#E7E1D7` | Dividers, outlines, card borders |
| Success green | `#477653` | Successful actions and completed states |
| Warning amber | `#A96F21` | Stock shortages, upcoming deadlines, cautions |
| Error red | `#B54747` | Errors, destructive actions, serious discrepancies |

Maintain accessible text contrast. Never use pale sage text on ivory when it becomes difficult to read.

Use semantic colours sparingly. Status must also be communicated through text and icons, not colour alone.

The colour values are the initial source of truth. You may introduce supporting neutral shades when necessary, but do not introduce a competing primary colour palette.

## 4. Typography and components

### Typography

Use a highly readable sans-serif typeface, such as Inter or a suitable native system font.

Establish a clear hierarchy:
- Large, expressive but restrained screen headings.
- Medium-weight section headings.
- Clear, readable body text.
- Compact but legible secondary labels.
- Tabular numerals for monetary values and quantities wherever appropriate.

Use decorative or script typography only for a very small brand accent, if necessary. Never use it for operational information.

### Surfaces and layout

- Rounded cards with approximately 16–22 px corner radii.
- Larger rounded sheets for prominent forms and modal interactions.
- Generous, consistent spacing.
- Subtle borders and restrained shadows.
- Clear separation between primary actions and secondary actions.
- Consistent iconography, preferably a coherent rounded icon family.
- Large, comfortable touch targets, aiming for at least 44–48 dp where practical.
- Responsive layouts for different Android screen sizes.

Avoid excessive gradients, heavy shadows, glassmorphism, unnecessary floating cards, decorative blobs, and repetitive pill-shaped elements.

Use food photography selectively for product identity and the dashboard. Operational screens should prioritise useful information over decorative imagery.

## 5. App shell and navigation

Create a cohesive mobile app shell with a **custom floating, iOS-inspired bottom navigation bar**.

The navigation should:
- Float slightly above the bottom edge.
- Respect Android safe areas and gesture-navigation insets.
- Use a softly rounded container, subtle elevation, and restrained styling.
- Show a clear icon and readable label for each destination.
- Highlight the selected destination using sage green.
- Remain visually consistent across primary screens.
- Never obscure content, keyboard actions, or bottom-of-screen buttons.

Use these six primary destinations:

1. **Home** — daily overview and important actions.
2. **Orders** — customer orders and their lifecycle.
3. **Recipes** — reusable recipes and product variants.
4. **Shopping** — consolidated ingredient and packaging requirements.
5. **Inventory** — raw ingredients, packaging, and finished extra stock.
6. **Finances** — payments, expenses, pricing, and financial summaries.

Because six destinations can make a floating navigation bar crowded, design a compact, carefully balanced layout. If necessary, use a slightly wider floating bar or a visually distinct compact presentation. Do not shrink labels until they become illegible.

Customer records, reports, settings, extra-stock preparation, and backup/restore should be accessible through appropriate contextual screens or secondary navigation rather than adding more primary tabs.

## 6. Required screens

Design a connected, reusable component system and the following screens.

### A. Home dashboard

Include:
- Personal greeting and a subtle bakery brand identity.
- Today’s preparation workload.
- Orders awaiting preparation.
- Orders in progress and ready for collection.
- Upcoming collection dates and times.
- Low-stock warnings and ingredient shortages.
- Outstanding customer payments.
- A compact summary of sales and estimated profit, clearly distinguished.
- Quick actions: create order, record sale, plan shopping, and add expense.

Prioritise the next useful action rather than filling the screen with statistics.

Use a clear hierarchy: greeting, immediate priorities, order workload, stock alerts, and financial snapshot.

### B. Orders

Create an order list with:
- Search by customer, product, and relevant details.
- Filters for Draft, Confirmed, In Progress, Completed, and Cancelled.
- Collection date and time.
- Customer name or a clear indication of a quick order without customer details.
- Product summary, quantity, agreed price, and payment status.
- Clear visual status indicators.

Provide a detailed order screen with separate product lines, preparation progress, recipe references, collection information, agreed pricing, cost snapshot summary, payment history, and order history.

Order completion and payment settlement must be represented separately.

### C. Create order flow

Build a multi-step or well-structured single-screen flow:

1. Select an existing customer or create a customer record.
2. Add one or more products.
3. Select a product variant and quantity.
4. Choose a saved recipe or create a new recipe.
5. Enter collection date/time and relevant instructions.
6. Review ingredient and packaging requirements.
7. Review estimated cost and selling price.
8. Confirm the agreed selling price.
9. Review stock availability, reservations, and shortages.
10. Confirm the order with a clear summary of its consequences.

Allow a newly created recipe to be explicitly saved to the Recipe Library. Do not automatically turn every one-off recipe adjustment into a reusable recipe.

Draft orders must not reserve inventory. Confirmed orders must preserve their agreed selling price and initial cost snapshot. Insufficient stock must not prevent confirmation; instead, show shortages clearly and update shopping requirements.

### D. Recipe Library

Include:
- Searchable recipe cards or a clean list.
- Product and variant identification.
- Recipe yield and unit type.
- Ingredient quantities and compatible units.
- Packaging requirements.
- Preparation instructions.
- Estimated preparation time.
- Optional finished weight.
- Recipe creation and editing.
- Recipe scaling based on yield.
- A visible recipe version/history mechanism where appropriate.

Variants such as different cake sizes or cupcake box sizes may require different ingredient quantities, packaging, prices, and preparation times.

Changes to a reusable recipe must not silently change previously confirmed orders or planned preparation batches.

### E. Shopping planner

This is a core screen, not a basic checklist.

Create a shopping planner that combines requirements from:
- Confirmed customer orders.
- Additional products planned for future stock.

Show:
- Consolidated ingredient and packaging requirements.
- Available stock after reservations.
- Total required quantity.
- Quantity to purchase.
- The origin of demand, distinguishing customer orders from extra-stock plans.
- Editable purchase quantities for practical package sizes.
- Purchase status and actual purchased quantities.
- Actual purchase prices.
- A clear path to record purchases and update inventory.

Example: If combined flour requirements are 1,970 g and available stock is 500 g, the shortage is 1,470 g. The owner might choose to buy a 2 kg package.

Adding a recipe to the shopping planner must not reserve inventory, create a customer order, record a purchase, or deduct stock.

Purchases must be recorded independently of whether an item was originally on the shopping list. Preserve purchase history when the plan changes.

Use metric units only. Support compatible conversions such as kg/g and litres/ml. Never convert mass to volume without an explicitly defined ingredient-specific conversion.

### F. Inventory

Provide clear views for three inventory categories:

1. Raw ingredients.
2. Packaging materials.
3. Finished extra-stock products.

Show relevant information:
- Physical quantity.
- Reserved quantity.
- Available quantity.
- Planned requirement.
- Purchase and usage history.
- Cost information where applicable.
- Low-stock warnings.
- Stock adjustments, spoilage, damage, and corrections.

Available quantity means physical stock minus active reservations.

Purchases increase usable stock. Actual preparation consumption decreases raw ingredient and packaging stock. Sales and waste of finished products decrease finished-product stock without deducting the ingredients a second time.

Avoid silent negative stock. Make discrepancies visible and require explicit resolution.

### G. Preparation workflow

Design a calm, low-friction workflow suitable for use in a kitchen.

Include:
- Orders requiring preparation.
- Separate preparation progress for each product in a multi-product order.
- Recipe ingredients, quantities, and instructions.
- Clear, accessible preparation steps.
- Actual ingredient and packaging usage review.
- An adjustment interface for actual quantities.
- A final **Complete Preparation** action.
- A clear completion summary and ready-for-collection state.

Starting preparation does not deduct stock. Deduct actual quantities only when preparation is completed.

If actual usage differs from the recipe, record it against the specific preparation record. Never silently change the reusable recipe.

If the application is closed during preparation, progress must be preserved. Repeatedly completing the same preparation must not deduct stock twice.

### H. Extra-stock preparation and sales

Provide a secondary workflow for preparing products for future sales without a confirmed customer order.

Include planned quantity, actual quantity prepared, recipe version, preparation date, actual ingredient consumption, actual cost, remaining finished stock, and optional best-before date.

Finished stock must support sales and write-offs/discards.

Example: If 12 cupcakes are prepared, 8 are sold, and 4 are discarded, the system should track those movements separately. Do not deduct raw ingredients again when finished cupcakes are sold or discarded.

Support quick sales without requiring a customer profile, as well as customer-linked sales.

### I. Finances

Design a readable financial area with distinct sections for:
- Sales and recorded revenue.
- Estimated and actual product/order costs.
- Recorded expenses.
- Estimated and actual profit.
- Payments received.
- Refunds.
- Outstanding customer balances.
- Customer credit or overpayment.
- Inventory valuation.
- Extra-stock sales and waste.
- Unallocated shared expenses.

Allow multiple partial payments and separate refund records linked to original payments.

Completing an order must not require full payment. An order can be completed while a balance remains outstanding.

Clearly distinguish purchase cash outflow, ingredient consumption cost, revenue, and profit. Buying flour for future use is not the same as consuming that flour.

### J. Secondary screens

Include appropriate screens for:
- Customer details and order history.
- Manual expense recording.
- Product pricing and labour assumptions.
- Shared expense allocation.
- Reports and financial summaries.
- Settings.
- Manual backup and restore.

Keep secondary screens accessible without overcrowding the main navigation.

## 7. Interaction and motion

The prototype must feel connected and intentional.

Use:
- Smooth screen transitions.
- Subtle press feedback.
- Expandable sections where they reduce clutter.
- Bottom sheets or dialogs for short contextual tasks.
- Inline validation for forms.
- Confirmation dialogs for consequential or destructive actions.
- Clear loading, empty, error, success, and disabled states.
- Search, filters, segmented controls, and quantity steppers where appropriate.

Target subtle transitions around 150–220 ms when supported by the prototyping environment. Prefer natural easing over bouncy or theatrical effects.

Avoid unnecessary onboarding, excessive confirmation steps, and decorative animations.

Use realistic sample data and believable Sri Lankan rupee prices formatted as LKR or Rs. Keep monetary values and quantities consistent across connected screens.

## 8. Clickable prototype — essential journeys

Build connected prototype flows for these three journeys.

### Journey 1: Customer order to preparation

Home → Create Order → Select Customer → Add Product/Variant → Select or Create Recipe → Review Price → Confirm Order → Review Stock Shortage → Shopping Requirements → Orders → Start Preparation → Review Actual Usage → Complete Preparation → Ready for Collection → Record Collection/Handover → Record or Review Payment.

Ensure the prototype makes it clear that order completion and payment settlement are separate.

### Journey 2: Combined shopping and inventory

Home or Shopping → Add Recipe/Variant for an Existing Order → Add Extra-Stock Plan → Review Consolidated Requirements → Compare Available Stock → Edit Purchase Quantity → Record Actual Purchase → Update Inventory → Review Updated Availability.

Ensure the same ingredient can appear in combined demand while preserving the separate sources of that demand.

### Journey 3: Extra-stock preparation and sale

Plan Extra Stock → Select Product/Variant → Choose Recipe → Set Planned Quantity → Review Ingredients → Record Actual Preparation → Complete Preparation → Finished Stock Available → Record Sale → Update Finished Stock → Record Waste or Discard for Remaining Units.

The visual flow must distinguish raw material consumption during preparation from finished-product movement during sale or disposal.

### Prototype quality

Use realistic navigation destinations and functional hotspots. Every primary button in the demonstrated journeys should have a defined action.

Where actual database behaviour cannot be represented in Figma, simulate the intended state transitions consistently. Do not pretend that a prototype interaction proves the underlying business logic is implemented.

## 9. Figma file organisation

Organise the file into clearly named pages:

1. **00 — Cover & Overview**
2. **01 — Foundations & Design Tokens**
3. **02 — Components**
4. **03 — App Shell & Navigation**
5. **04 — Dashboard & Orders**
6. **05 — Recipes & Preparation**
7. **06 — Shopping & Inventory**
8. **07 — Finances & Customers**
9. **08 — Clickable Prototype**
10. **09 — Empty, Error & Edge States**

Create reusable components for navigation, buttons, cards, status labels, input fields, quantity controls, list rows, confirmation dialogs, bottom sheets, and financial summaries.

Use consistent naming, component variants, auto layout, and responsive constraints wherever supported. Keep spacing, typography, radii, and colour values centralised as design tokens.

## 10. Strict design guardrails

- Do not turn the app into an online bakery storefront.
- Do not create an enterprise ERP dashboard.
- Do not add cloud synchronisation or backend-dependent features to the first-release concept.
- Do not invent payment gateway integrations, supplier management, automatic expense recurrence, or other unrequested subsystems.
- Do not treat drafts as inventory reservations.
- Do not block order confirmation solely because stock is insufficient.
- Do not deduct ingredients when preparation starts.
- Do not deduct raw ingredients again when finished products are sold.
- Do not automatically mark an order as paid when it is completed.
- Do not silently change confirmed-order prices or cost snapshots after recipe or ingredient changes.
- Do not hide stock shortages, outstanding payments, or important discrepancies.
- Do not make every screen visually busy just to showcase more components.
- Do not compromise Android usability for the sake of imitating iOS.
- Do not replace clear labels with icons alone for important actions.
- Do not introduce dark mode as a requirement for the first design delivery.

Where an operational rule is not explicitly specified, use a clear and conservative interface, preserve the ability to review the action, and flag the behaviour for later product confirmation instead of inventing a new business rule.

## 11. Deliverables and acceptance criteria

Produce:
- A coherent, polished light-mode mobile design system.
- A complete app shell with the approved floating navigation.
- High-fidelity screens for the principal app areas.
- Reusable components and design tokens.
- Realistic sample data and consistent LKR formatting.
- A clickable prototype demonstrating the three essential journeys.
- Important empty, warning, validation, and confirmation states.
- Clear, consistent screen naming and prototype connections.

The design is successful when Udeni can quickly understand what needs attention, confidently manage orders and ingredient requirements, record actual preparation and purchases, and understand payments and financial outcomes without navigating a confusing or overly decorative interface.

**Final design principle:** Make the application feel like a thoughtfully crafted premium mobile product, while keeping every operational interaction practical, readable, and dependable for a real home bakery.