# Motion (motion.dev) — Knowledge File

> Research date: 2026-09-13. Verified against motion.dev, motion.dev/docs, npm,
> and the motiondivision/motion GitHub repo. Anything not verified is labeled.

## Resource Overview

**Motion** is the production animation library formerly known as **Framer
Motion** ("Motion (prev Framer Motion)"). It is an open-source, MIT-licensed
animation library for **React, JavaScript, and Vue**, with the React bindings
imported from the `motion/react` subpath.

This is the **only one of the five researched resources that is a directly
installable engineering asset** suitable for the CAM LABS stack.

## Official URL

- https://motion.dev
- https://motion.dev/docs/react (React docs)
- https://motion.dev/docs/react-installation (install)
- https://github.com/motiondivision/motion
- npm: https://www.npmjs.com/package/motion

## Resource Type

- **Open-source npm animation library** (React / JS / Vue bindings)
- Formerly Framer Motion; the older `framer-motion` package still exists on
  npm (pulled in as a dependency of `motion`)
- MIT license (verified on homepage, npm, and GitHub)

## Verified Install Commands

```
npm install motion
# or
yarn add motion
pnpm add motion
```

Import pattern (verified across all official docs and the README):
```ts
import { motion } from "motion/react";
```

Slim builds:
```ts
import * as m from "motion/react-m";  // used with <LazyMotion>
```

The legacy import `framer-motion` is deprecated in favor of `motion/react`.

## Version (verified)

- Latest published on npm at research time: **13.2.0** (registry updated
  Sep 2, 2026); npm page showed 13.1.1 (Aug 20, 2026). Current series = **13.x**.
- 13.0.0 (Aug 5, 2026) removed the `@emotion/is-prop-valid` dependency in favor
  of an explicit `<MotionConfig isValidProp>` (changelog).

## React / TypeScript / Vite Compatibility (verified)

- **Requires React 18.2+** (CAM LABS runs React 18.2 — compatible).
- **Vite: "No special configuration is needed with Vite. Motion works out of
  the box!"** (official docs).
- "Production ready. Built on TypeScript, extensive test suite, fully
  tree-shakable." (official docs).

## Capabilities (verified from docs)

- **Layout animations** (`layout` prop, shared element / FLIP-style)
- **Spring physics** (`type: "spring"`, stiffness/damping/mass,
  `visualDuration`, `bounce`)
- **Scroll-linked** animations via native `ScrollTimeline`/`ViewTimeline` with
  JS fallback
- **Scroll-triggered** reveals via pooled `IntersectionObserver` (`whileInView`)
- **Gestures**: `hover`, `press`, `drag`, tap/pan
- **AnimatePresence** for enter/exit animations (sync/wait/popLayout modes)
- **Variants + stagger**
- `useMotionValue`, `useSpring`, `useTransform`, `useScroll`
- SVG and backgroundColor acceleration since 12.43.0

## Bundle Size (verified, Rollup figures from official docs)

- `useAnimate` mini (WAAPI-only): **2.3 kb**; hybrid: **17 kb**
- `motion` component pre-bundled: **~34 kb** (can't be tree-shaken smaller)
- `LazyMotion` + `m`: **~4.6 kb initial**, then `domAnimation` (+15 kb) or
  `domMax` (+25 kb) loaded on demand
- (Webpack is "slightly larger"; figure from docs, exact number unverified)

## Performance Model (verified)

- Hybrid engine: JavaScript + **WAAPI** hardware-accelerated transforms
  (x/y/rotate/scale, independent transforms, no wrapper DOM elements).
- Best practice: animate `transform`/`opacity` only for GPU-friendly motion.

## Reduced Motion & Accessibility (verified)

- Site-wide policy via `<MotionConfig reducedMotion="user" | "always" |
  "never">` (default `"never"`).
  - `"user"`: respect `prefers-reduced-motion` — transform/layout animations
    disabled, opacity/color remain.
- `useReducedMotion()` hook also available.
- Directly aligns with CAM LABS' existing strong `prefers-reduced-motion`
  CSS handling (motion.css, design-system.css).

## RTL Support

- RTL support verified for the **Reorder** component (added 13.1.0,
  Aug 10, 2026). No broader RTL/LTR documentation claims were verified.

## Licensing

- **MIT**, free to use (official homepage, npm metadata, GitHub).

## CAM LABS Use Cases (candidate, NOT implemented)

Where Motion fits CAM LABS *without* altering the approved visual design
(motion can be added in a way that preserves all current visuals):

1. **Step/panel transitions in the Manufacturing Workspace** — panels already
   have derived `active/completed/inactive` states (ManufacturingWorkspaceView);
   `AnimatePresence` + layout spring could smooth panel expansion/collapse.
2. **Modal / drawer transitions** (AuthModal, PersonaModal, ComparisonModal,
   ComparisonDrawer, MobileNav drawer, admin detail views) — replace raw
   mount/unmount with `AnimatePresence` enter/exit.
3. **Toast notifications** — exit/auto-dismiss animations for ToastContainer
   (currently timed removal in StoreContext.showToast, no exit animation).
4. **Admin tables & lists** — row mount/unmount + layout shift smoothing when
   filtering/sorting (layout animation on `<motion.tr>`).
5. **Scroll-triggered reveals** — could complement/replace the current
   `useScrollReveal` + CSS `cam-reveal` system (motion `whileInView`).
6. **Stepper / process status feedback** — order timeline, progress steps.
7. **CadGeometryViewer UI chrome** — viewer loading state, fullscreen toggle
   transitions, control panel fade.
8. **Skeleton loading states** — orchestrated skeleton shimmer variants.

### Where Motion is NOT appropriate

- The pricing transition is already a purpose-built CSS state machine
  (`price-transition`, `motion.css`) — do not replace.
- The hero headline typewriter (`AnimatedHeadline`) is lockstep choreographed
  CSS — replacing adds risk without benefit.
- Avoid scroll-jack/parallax on hero that could degrade perceived performance.

### Recommendation posture

- Motion is recommended as an **incremental enhancement** for a future,
  approved task. Keep CAM LABS CSS animation system; adopt Motion sparingly for
  mount/unmount + layout transitions via `LazyMotion` + `m` + 
  `<MotionConfig reducedMotion="user">` (~4.6 kb initial).

## Compatibility Notes

| Concern | Assessment |
| --- | --- |
| React 18.2 | Compatible (requires 18.2+). |
| TypeScript | Compatible (TS-native). |
| Vite | Zero config (official). |
| Existing CSS animation (motion.css) | Coexists; Motion animates style/transforms via WAAPI/JS, CSS keyframes remain for direction mapping. |
| Theme system | Theme-agnostic. |
| RTL | Basic RTL support for Reorder; layouts animate with logical properties. |
| Bundle size | ~4.6 kb initial with LazyMotion+m; ~34 kb full tree-shaken for the `motion` component. |
| Maintenance | Active OSS project (Motion team; ex-Framer team). |
| Reduced motion | First-class (`MotionConfig reducedMotion="user"`). |

## Performance Considerations

- Use transforms/opacity; avoid animating width/height directly except via
  `layout` with `layout="preserve-aspect-ratio"` when needed.
- Prefer `LazyMotion` + `m` + `domAnimation`/`domMax` for admin + public
  surfaces.
- Accepts `transformTemplate` and hardware acceleration automatically.

## Accessibility Considerations

- `MotionConfig reducedMotion="user"` should be set **once at app root**.
- Focus management remains the app's responsibility (existing Escape + focus
  handling in CAM LABS must be preserved).

## RTL/LTR Considerations

- Animate logical properties / use `translate` on inline axes carefully in RTL.
  Motion's RTL support is limited to Reorder; test mirrored animations for the
  Arabic experience.

## Limitations

- The `motion` component (~34 kb) itself is not tree-shaken below that figure —
  use the slim `m` + LazyMotion path for smaller budgets.
- RTL support is thin beyond Reorder.
- Webpack bundle figures are slightly higher than the (smaller) Rollup figures
  documented.

## Verified Findings Summary

1. `npm install motion`; import from `"motion/react"`.
2. MIT, React 18.2+, Vite zero-config, TS-native, tree-shakable.
3. LazyMotion + `m` ≈ 4.6 kb initial (then +15/+25 kb on demand).
4. First-class reduced-motion support; alignment with CAM LABS a11y posture.
5. Capabilities verified: layout, springs, scroll-linked/triggered, gestures,
   AnimatePresence, variants/stagger.

## Unverified / Assumptions

- "~90% smaller than GSAP" claim (from motion.dev; not independently benchmarked).
- Exact Webpack bundle figures.
- Deep browser support matrix beyond 18.2+ / Vite.
- Practical RTL behavior for non-Reorder animations (needs project testing).