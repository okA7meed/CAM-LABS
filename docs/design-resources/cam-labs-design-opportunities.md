# CAM LABS — Design Improvement Opportunities

> Research + audit phase. **Nothing here is implemented.** Recommendations only,
> mapped to real findings from the codebase audit (2026-09-13).

## Context Reminder

Current visual system (verified, unchanged):
- Plain CSS custom-property design tokens (`design-system.css`), dark-first.
- Multiple scoped palettes: public `.cam-*`, admin `.cam-admin`, manufacturing
  workspace `.mw-workspace`, pricing engine `.pe-workspace`.
- Animation = CSS keyframes (`motion.css`) + IntersectionObserver
  (`useScrollReveal`), excellent reduced-motion coverage.
- State-based navigation (`StoreContext.activeView`), i18next AR/EN + RTL.

---

## A. Visual Design Opportunities

Priorities are relative to business value, effort, and risk. No changes made.

| # | Opportunity | Evidence in code | Priority | Type |
| --- | --- | --- | --- | --- |
| A1 | **Design-token audit & single source of truth.** Multiple palettes (`.cam-admin`, `.mw-workspace`, `.pe-workspace`) duplicate color/radius/spacing concepts rather than consuming the base tokens. | `admin.css`, `manufacturing-workspace.css`, `pricing-engine.css` open with their own `--admin-*`/`--admin-blue`/`#060A18` palettes | Medium | Frontend / Design system |
| A2 | **Unify control radii via the `--btn-radius-ratio` system** across admin/manufacturing buttons (admin `.btn` variants do not all consume `--btn-radius`). | `components.css` + `design-system.css:78-79` | Low | Design |
| A3 | **Consistent empty/error/loading state primitives** across public vs admin vs MW surfaces. `admin/ui/States.tsx` exists; public surfaces have separate skeleton/empty markup. | `States.tsx`, `.skeleton`, `loading-state` | Medium | Design |
| A4 | **Form/table density consistency** between the customer dashboard (`OrderCenter`) and admin tables (`OrdersTable` 10 columns). | `order-center.css`, `admin.css` | Optional | Design |
| A5 | Better **row hover / selection affordance** on admin tables (checkable rows exist via `selectedOrderIds` in StoreContext). | `StoreContext.tsx:128-136`, `OrdersTable` | Low | Design / UX |
| A6 | Keyboard `:focus-visible` audit across the wide modal/drawer set (AuthModal, PersonaModal, ComparisonModal, MobileNav, admin detail). | `App.tsx:197-202` overlays | Medium | Design / Accessibility |
| A7 | **Section rhythm** on marketing pages already uses `--space-*`; consider consistent section-header treatment (badge+title+subtitle) — already largely applied. | `design-system.css:294-332` | Optional | Design |

**Source resources informing A1–A7:** Refero Styles (token + DESIGN.md
norm), 21st.dev (table/form patterns), 60fps (empty/loading polish).

---

## B. Interaction & UX Opportunities

| # | Opportunity | Evidence in code | Priority | Type |
| --- | --- | --- | --- | --- |
| B1 | **Stepper-less workspace navigation feedback.** The Manufacturing Workspace uses panels, not a stepper (`panels ARE the workflow`). The `focusSection` flash + `Next: …` toast is functional but subtle. A persistent progress indicator could reduce dropout without changing visuals. | `ManufacturingWorkspaceView.tsx:229-256` | High | UX |
| B2 | **Upload feedback:** upload progress UI exists via XHR `onProgress`; consider a richer per-file phase indicator (scanning → processing → verified) matching backend statuses (`uploadState.ts`). | `uploadState.ts`, `api.ts:284` | Medium | UX |
| B3 | **CAD viewer controls:** viewer exists with fullscreen + controls; keyboard/gesture hints are minimal. | `CadGeometryViewer.tsx` | Low | UX |
| B4 | **Notification behavior:** toasts auto-remove after fixed 4.5s with no exit animation or pause-on-hover; admin NotificationCenter via SSE has retry backoff. | `StoreContext.tsx:158-166`, `NotificationsContext.tsx` | Medium | UX |
| B5 | **Modal focus trap & scroll-lock:** Escape handling exists at `App.tsx:125-137`; verify focus trapping in each modal remains consistent. | `App.tsx`, `index.html` | Medium | Accessibility / UX |
| B6 | **Mobile admin drawer / sidebar** pattern exists (`AdminLayout.tsx` compact viewport); consider persistence of collapsed state. | `AdminLayout.tsx:13-36` | Low | UX |
| B7 | **Draft restore feedback** ("Draft restored") is a single toast; could include a brief per-field restore highlight. | `ManufacturingWorkspaceView.tsx:258-279` | Optional | UX |

**Source resources informing B1–B7:** 60fps.design (toast/loading/progress
patterns), Motion (smooth step/panel transitions), 21st.dev (table selection).

---

## C. Animation Opportunities

For each: why useful, where, technique, performance, accessibility, optional?

| # | Opportunity | Why / Where | Technique | Perf | A11y | Optional? |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | **Panel expansion/collapse smoothing** in Manufacturing Workspace | Panels already derive `active/completed/inactive`; layout shifts when panels expand. Smoothing reduces cognitive load. | Motion `layout` on `.mw-panel` (or CSS grid `grid-template-rows` transition) | Low (transform/layout only on change) | `MotionConfig reducedMotion="user"` | Yes |
| C2 | **Modal/drawer enter-exit** (Auth, Persona, Comparison, MobileNav, admin detail) | Currently hard mount/unmount; enter-exit adds polish and perceived speed. | Motion `AnimatePresence` (or CSS keyframes on open/close classes) | Low | Respect existing focus/Escape logic | Yes |
| C3 | **Toast enter/exit + pause-on-hover** | Auto-removal at fixed 4.5s is abrupt. | Motion `AnimatePresence` with slide/fade; timer paused on hover | Negligible | Reduced-motion off | Yes |
| C4 | **Admin table row changes** (filtering, status updates) | Layout jumps on row add/move. | Motion `layout` on `<tr>` / list | Medium if many rows — keep to filtered subsets | Reduced-motion off | Yes |
| C5 | **Skeleton orchestration** (admin `.admin-skeleton-row`, `.skeleton`) | Existing shimmer is single-speed; staggered fade of blocks reads better. | CSS `animation-delay` or Motion variants | Very low | N/A | Yes |
| C6 | **Scroll-triggered reveals via Motion `whileInView`** | Alternative to `useScrollReveal`; identical result, different mechanism. | Motion `whileInView`, `once: true` | Pooled IntersectionObserver | Built-in reduced-motion | Yes (only if benefits justify churn) |
| C7 | **Stepper/status transitions** (order timeline, admin status chip) | Status changes are abrupt; a short check/green sweep adds confidence. | CSS keyframes (already partially via `.mw-panel-state-mark`) or Motion | Negligible | Reduced-motion off | Yes |
| C8 | **CAD viewer UI feedback** (loading → ready, fullscreen toggle) | Viewer loading state transitions are plain. | CSS/Motion fade + scale | Very low | Reduced-motion off | Yes |

**Do NOT animate:** the pricing transition (already a purpose-built state
machine), the hero typewriter (`AnimatedHeadline`), infinite decorative motion,
or scroll-jacking.

**Recommended posture:** adopt Motion via `LazyMotion` + `m` +
`<MotionConfig reducedMotion="user">` incrementally in one approved future
task; keep the CSS animation layer. ~4.6 kb initial, then +15/25 kb on demand.

---

## D. Technical Improvements

| # | Opportunity | Evidence | Priority | Type |
| --- | --- | --- | --- | --- |
| D1 | **Dependency hygiene (dxf-parser).** `CadGeometryViewer.tsx:10` imports `dxf-parser` from the workspace root hoist; it is a root dependency and a backend devDependency, not declared in `frontend/package.json`. Works only due to npm hoisting. | `frontend/package.json`, root `package.json`, `CadGeometryViewer.tsx:10` | **High** (correctness/declared deps) | Frontend / Maintenance |
| D2 | **Componentization of the 1,682-line `ManufacturingWorkspaceView.tsx`.** It boots the entire workflow; splitting panels/files/config into components isolates re-renders and boosts maintainability. | `ManufacturingWorkspaceView.tsx` (1,682 lines) | Medium | Frontend |
| D3 | **Shared UI atom consolidation.** Admin `Button`/`Card` duplicate public `.btn`/`.card` concepts with separate class names (`btn-*` reused though). Consider one token-driven kit. | `admin/ui/*`, `components.css` | Medium | Frontend |
| D4 | **State-based navigation** (`activeView`) works but means no deep links, no per-view title, history.replace patterns; consider react-router only if needed. High effort; not urgent. | `App.tsx:143-203`, `StoreContext.tsx` | Optional | Frontend |
| D5 | **API client** is a singleton `ApiService`; fine. Watch XHR-vs-fetch duplication for upload (XHR for progress, fetch elsewhere). | `api.ts:284-313` | Low | Frontend |
| D6 | **Validation coverage:** zod only used in `auth.routes.ts` + `admin.routes.ts`; order/quote/cad payloads validated by custom checks. Standardizing zod schemas would harden input handling. | backend `routes/`, `zod` dep | Medium | Backend |
| D7 | **Vite build**: `frontend lint = tsc --noEmit` only; consider ESLint for style/consistency. | `frontend/package.json:10` | Optional | Tooling |
| D8 | **Tests:** backend has 19 vitest+supertest suites; frontend has **no test runner configured**. Adding component tests for the pricing/upload state machines (they already export pure helpers) is low-cost, high-value. | `uploadState.ts`, `materialPreview.ts` | Medium | Testing |

---

## E. Manufacturing Experience Improvements

Evidence-first, mapped to the real workflow states.

| # | Opportunity | Evidence | Priority | Type |
| --- | --- | --- | --- | --- |
| E1 | **Progress affordance for the panel workflow** (see B1). Add an unobtrusive step summary without redesigning panels. | `ManufacturingWorkspaceView.tsx:229-256` | High | UX / Manufacturing Workflow |
| E2 | **Per-file configuration clarity when multiple files are in an order.** Existing order-material/fine-grained per-file config is powerful but dense (`FileConfiguration`). Better grouping visual could reduce misconfiguration. | `ManufacturingWorkspaceView.tsx`, `fileConfigurations` | Medium | UX |
| E3 | **CAD readiness gate already exists** (`areAllUploadsReady`/`isCadFileReady`) — keep; consider animated confirmation when the gate flips. | `uploadState.ts` | Low | UX |
| E4 | **Quote invalidation on config change** already implemented (`invalidateQuote` aborts in-flight calc + clears). Consider subtle "recalculating" cue beyond price transition. | `ManufacturingWorkspaceView.tsx:244` | Optional | UX |
| E5 | **Draft save** is localStorage-based (`cw-manufacturing-draft-v1`). Backend persistence of drafts would survive device change but is a separate scope. | `ManufacturingWorkspaceView.tsx:97,281-300` | Optional | Manufacturing Workflow / Backend |
| E6 | **Admin manufacturing-request pipeline** (PENDING→ACCEPTED→…) exists with detail views; ensure status transitions animate with clear feedback (see C7). | `ManufacturingRequest` model, `AdminManufacturingRequestsView` | Low | UX |
| E7 | **Mobile manufacturing flow:** workspace is `app-viewport` (100vh lock) with body overflow hidden — heavy for mobile; ensure panels scroll well and upload works from mobile browsers (input present, `accept` list complete). | `App.tsx:140-144`, upload inputs | Medium | Mobile / UX |

---

## Source Mapping Summary

| Resource | Where it informs CAM LABS most |
| --- | --- |
| 21st.dev | Admin data tables, card grids, form & dashboard composition patterns (not code). |
| Refero | Design-direction + DESIGN.md token specs for any future visual iteration. |
| Supahero | Hero/landing composition inspiration only. |
| Motion | The recommended engine for C1–C4, C8 enter/exit + layout animation. |
| 60fps.design | Motion-vocabulary + spring/timing references for all animation work. |

## Implementation Disqualifiers

These were considered and rejected (evidence-based):
- Direct 21st.dev component copy: requires Tailwind + shadcn adoption (CAM LABS
  is pure CSS-token based) — big architecture change with brand/risk cost.
- Custom scroll-linked parallax / scroll-jacking: unnecessary for a
  manufacturing platform; hurts perceived performance.
- Replacing the pricing transition, hero typewriter, or CSS reveal system:
  working, performant, reduced-motion-compliant already.
- 60fps/Supahero "code": does not exist (SwiftUI / none).