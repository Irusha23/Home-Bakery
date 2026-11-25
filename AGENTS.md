# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
- Use `createId(prefix)` from `src/lib/id.ts` instead of `crypto.randomUUID()` directly so ID generation works in non-HTTPS LAN contexts on mobile devices.

## Motion & Physics Rules

All UI motion must preserve physics-based continuity and immediate acknowledgment across existing and new features:

- **Single source of truth:** Import mass-scaled springs (`SPRING_MICRO`, `SPRING_CONTROL`, `SPRING_PANEL`, `SPRING_SHEET`, `SPRING_PAGE`, `SPRING_ELASTIC`, `SPRING_NUDGE`), stagger helpers (`staggerDelay`), and `REDUCED_MOTION_TRANSITION` from `src/lib/motion.ts`. Never use linear motion or abrupt 0ms state snaps.
- **Perceptual color continuity:** Use the `oklch(...)` tokens in `src/index.css` and `transition-colors` so colors interpolate smoothly without muddy RGB midpoints.
- **Universal interaction acknowledgment:** Build interactive controls on top of `<Button>`, `<IconButton>`, `<Stepper>`, `<QuantityControl>`, `<CheckboxField>`, `<ListRow>`, `<Sheet>`, `<Dialog>`, and `<SwipeableRow>` (or use `useTouchRipple()` + `<TouchRippleLayer />`). Even disabled or boundary controls must respond visibly (`aria-disabled` spring nudge + `disabledReason` tooltip).
- **Origin, destination & choreography:** Wrap tab/segmented view switches in `<TabView>`, drill-down flows in `<PushView>`, collapsible cards in `<Disclosure>`, and dynamic lists/sections in `<AnimatedList>` / `<AnimatedItem index={...}>` or `<StaggerSection index={...}>` (30–80 ms stagger).
- **Illustrations & loading:** Use `<Illustration name="..." />` (`src/components/ui/Illustration.tsx`), `<EmptyState illustration="..." />` (`src/components/ui/EmptyState.tsx`), and `<AppLoader />` (`src/components/ui/AppLoader.tsx`) for empty states, reminders, and loading states so artwork stays cohesive.
- **Performance & accessibility:** Animate only GPU-composited properties (`transform`, `opacity`, and `height` inside `<Disclosure>`). Under `prefers-reduced-motion: reduce`, replace spatial movement with gentle ~160 ms cross-fades (`REDUCED_MOTION_TRANSITION`) — never instant pops.
- **Rule 10 self-check:** Before finishing UI work, verify: (a) no instant property jumps, (b) clear origin & destination, (c) zero-velocity spring start/settle, (d) interruptibility, (e) smooth OKLCH color transitions, and (f) visible feedback on every interactive/disabled element.

## Git & Remote Sync

- Regularly commit verified milestones with clear conventional commit messages and push to the active remote branch (`origin`).
