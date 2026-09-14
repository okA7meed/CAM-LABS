# CAM LABS — Manufacturing Workspace: Deep Root-Cause / Performance / State-Machine Audit

Date: 2026-09-15 · Scope: the Manufacturing Workspace entry choreography (`ManufacturingWorkspaceView`), its upload pipeline, the CAD viewer, and the panel/entry CSS.

This is an **audit only**. No production code was changed. Confidence labels used throughout:

- **Confirmed** — established by direct inspection of the code and/or reproduced/measured in a running browser session.
- **Probable** — strongly supported by code inspection and runtime data, but the triggering condition was not deterministically reproduced.
- **Hypothesis** — consistent with the code but not yet directly evidenced.

---

## 1. Executive Summary

The Workspace entry choreography mounts an unusual amount of heavyweight work in one short window. When the upload flow leaves `upload-focus`, the app **simultaneously**:

1. re-lays-out all three grid columns (flex mount of viewer / material / dock / right panels),
2. creates and starts a first frame of a WebGL renderer (`CadGeometryViewer`),
3. starts a **second, concurrent** WebGL thumbnail renderer,
4. fetches + re-parses the same geometry twice and POSTs a quotation, and
5. animates a 520 px block via **CSS layout animation (width)** while also animating it via JS transforms.

Measured in a running browser (headless Chrome, software GPU — conservative estimate): the main-thread produced **6 long tasks including a 2611 ms stall** and **5 frame gaps ≥ 100 ms** during the reveal-to-workspace window.

The **"Workspace disappears" blank-screen symptom was NOT reproduced** in three headless end-to-end runs (full flow, Preview modal, delete+confirm, re-add, reload+draft-restore all survived). But the app has **zero error boundaries** — grep for `ErrorBoundary|componentDidCatch|getDerivedStateFromError` returns nothing. With React 18, **any** uncaught error anywhere (render, effect, animation, WebGL, async handler) unmounts the entire app to a background-only page. That is the exact reported symptom, and the highest-risk moments are exactly the ones this choreography creates (start-of-mount effects in three WebGL consumers + async network work). The disappearance is most consistent with **an intermittently thrown runtime error (most plausibly WebGL context creation/first-render failure, or an effect throw during the reveal window) unmounting the whole tree** because nothing isolates it.

There is also a structural inefficiency: the choreography animation drives **layout** (CSS `width` transition on `.mw-entry-left-block`) in parallel with **transform** animation and runs **synchronous layout reads** (`calculateFocusDelta`) on every stage change. The fix strategy (Section 13) is intentionally non-functional: it keeps the same workspace, panels, upload/CAD/quotation logic, and business rules — it only (a) isolates crashes, (b) converts the animated geometry to pure transforms, and (c) removes the forced layout reads.

---

## 2. Workspace Disappearance

**Evidence gathered in this audit:**

- `frontend/src/main.tsx` wraps the app in `<React.StrictMode>`; no error boundary exists in the tree (grep across `frontend/src` → 0 matches).
- The single frontend runtime capture produced **0 uncaught exceptions, 0 unhandledrejections** across the whole exercised flow. The workspace was present (`document.getElementById('root').innerHTML.length > 0`, `.mw-workspace[data-entry]` populated) at every 1 s sample through reveal → settle → interactions.
- Three independent headless runs (fresh Chrome profiles, real backend/Postgres, a real uploaded 20 mm STL cube, real processing + quote) all completed the reveal→workspace sequence without a blank. Also survived: opening the Preview modal (a second `CadGeometryViewer`), closing it, deleting the uploaded file (+confirm), adding a second file, reloading the page and re-entering via draft restore.
- The only logged errors were two `401 Unauthorized` resource loads from `/auth/me` in the unauthenticated headless session — handled by `ApiService.request` (non-required) and irrelevant to the disappearance.

**Conclusion on the disappearance (ranked):**

- **Confirmed — structural**: the app has no error boundary. Any uncaught error in a render/effect/lifecycle/WebGL/animation path unmounts the entire application, producing exactly the reported "Workspace vanishes to a substantially empty/background-only page".
- **Probable — trigger location**: the reveal→workspace transition. At that moment five heavyweight subsystems mount concurrently (Section 9), each with start-of-mount side effects and network awaits. A throw in any of: the `CadGeometryViewer` WebGL mount effect (renderer creation at `CadGeometryViewer.tsx:211`, first frame at `:238` — both **un-wrapped** in try/catch and therefore tree-killing if the GPU/driver fails), the thumbnail renderer (`cadThumbnailRenderer.ts:34` also un-wrapped), or the quote engine, would blank the page.
- **Probable — specific trigger(s)**: WebGL context failure — creation failure, `WebGL context lost`, or unknown-context accumulation (e.g., `canvas.setImageSmoothing`-style edge cases) from repeated mounts/dismounts plus StrictMode double-mounting in dev. WebGLRenderer construction or the first PMREM/ACES shader compile is the least-defended synchronous code in the whole flow.
- **Hypothesis — secondary triggers**: (a) memory pressure from 2–3 concurrent GPU contexts + a high-res display; (b) an interaction immediately after settle (e.g., fullscreen portal moving the panel while a flex re-layout is in flight); (c) dev-only StrictMode effect re-runs.

**Honest limitation:** the disappearance was not reproduced deterministically. The evidence pins the *mechanism* (whole-tree unmount from any error) but not the *exact keypress/timestamp*. Section 15 includes a targeted validation plan to confirm the trigger on the reporter's machine with console instrumentation.

---

## 3. State Machine Analysis

The stage machine lives in `ManufacturingWorkspaceView.tsx` (`entryStage`): `tech-focus → process-focus → upload-focus → reveal → workspace`.

**Valid transitions (code-supported):**
- tech-focus → process-focus: `advanceFromTechFocus` (deps include `request.technology`).
- process-focus → upload-focus: Next button (`onMouseDown`/click path).
- upload-focus → reveal: `ManufacturingWorkspaceView.tsx:314-321` — fires as soon as `uploadItems.some(item => isUploadItemReady(item) || ['processing','scanning','uploading'].includes(item.status))`. **Note: this fires when an upload merely *starts* (uploading/scanning/processing), not when it completes.**
- reveal → workspace: `settleToWorkspace` (`:302-312`) — fixed **850 ms** after reveal, then dispatches a synthesized `window.resize` to force the WebGL renderer to re-fit.

**Races / anomalies found (Confirmed by inspection):**

1. **Reveal fires too early.** Because "any activity" triggers reveal (`:318`), a long scan/process cycle runs *during* the reveal animation while the heavy panels are already mounting — exactly when main-thread contention peaks. The reveal is not gated on readiness; if processing fails, the app is already "revealed" around a failed file.
2. **Duplicate resize dispatch.** `settleToWorkspace` dispatches a resize event (`:305`) in addition to React re-rendering `workspace`. The resize listener in `CadGeometryViewer` and the `calculateFocusDelta` resize listener both react — a redundant re-fit right at settle.
3. **Two competing stage effects.** The reveal effect (`:314`) and the "revisit" steering effect (`:325-329`) both write `entryStage` with overlapping conditions, and the reveal depends on `uploadItems`, which arrives asynchronously. Intermediate state flapping (`upload-focus`⇄`reveal`) is possible if an item is deleted then re-added during the window.
4. **StrictMode re-runs.** In dev only, all effects fire twice; the 850 ms timer is cleaned up correctly (`clearTimeout` in the effect return), but the *second* mount re-executes `calculateFocusDelta`, the WebGL mount, and the thumbnails effect — doubling transient work during the choreography.
5. **`onRestore` stage override** (`:255-260`): a restored draft jumps to `workspace` directly, but the initial render already ran the *tech-focus* effects, so `advanceFromTechFocus` and the reveal/steering effects race the restore write. Harmless today, but it is the same class of race that would bite once reveal gains real gating.

**Overall:** the state machine is simple and has no illegal terminal states, but its **timing is coherent only by accident** — reveal is decoupled from readiness, and settle is wall-clock.

---

## 4. Upload Lifecycle

- File selection: `onFiles` → per-file `setUploadItem` (uploading) → `ApiService.uploadCadFile` (FormData) → on success `pollProcessing` (`:385`), which **polls `getCadFiles()` every 500 ms up to 40× (20 s)**, flipping status `scanning`/`processing`, and resolves only on COMPLETE; throws on QUARANTINED/FAILED/timeout.
- The poll loop **issues a full list `GET /api/v1/cad-files` every 500 ms** per file during the entire processing window — network churn that grows linearly with in-flight files, re-rendering the view each time it updates `uploadItems` state.
- The 20 s hard timeout leaves files stuck in `processing` from the user's perspective on slow geometry jobs; such files still trigger `reveal` (Section 3.1) and block `areAllUploadsReady` → no quote → workspace looks "finished" but shows no price.
- `reveal` is reached before readiness; if a file later FAILS, the workspace is already revealed around a failed item with no back-out path — the reveal state and the failure state can coexist.

---

## 5. Performance Analysis

**Measurement method:** headless Chrome (new) driving the real app on the running dev server + real backend/Postgres, CDP-injected `requestAnimationFrame` sampler + `PerformanceObserver('longtask')` + unhandledrejection/exception capture. Environment note: **software WebGL (SwiftShader), dpr 1** — production MacBook GPU numbers will be better for compositing/WebGL, but the reported **main-thread JS long tasks are on the same CPU** and remain valid evidence of render-work bursts.

**Results (single 20 mm STL, ~17.4 s window covering reveal→settle→viewer mount):**

| Metric | Value |
|---|---|
| Total rAF samples | 617 |
| Avg fps (software GPU) | ~35 |
| Frame gaps > 24 ms | 32 |
| Frame gaps ≥ 100 ms | 5 |
| Long tasks | **6 — 2611 ms, 853 ms, 777 ms, 84 ms, 65 ms, 51 ms** |
| Uncaught exceptions / unhandledrejections | 0 |
| JS heap | 25 MB |

**Interpretation:** the reveal→settle window carries multi-hundred-ms and one **2.6 s** main-thread stall even for a trivial model on a software GPU. The 2.6 s stall is consistent with shader compilation + first WebGL frame + thumbnail render + quote POST all colliding.

**Contributor ranking (Confirmed where measured, Probable for real device):**
1. **Concurrent WebGL startup** (main viewer renderer + shared thumbnail renderer) plus `parseCadBuffer` executed **twice in parallel for the same file** (viewer load at `CadGeometryViewer.tsx:135` and thumbnail `loadModel` at `cadThumbnailRenderer.ts:57`).
2. **Layout-concurrency at reveal**: full grid re-layout when the middle/right columns mount, plus a CSS `width` animation (Section 7).
3. **Forced synchronous layout reads** in `calculateFocusDelta` (`:176-180`) on every stage change + resize + rAF — synchronous offset/width reads that flush pending layout work during the animation window.
4. **Polling set-state churn** (Section 4): back-to-back `setUploadItems` every 500 ms.

---

## 6. React Rendering Problems

- **No error boundary (Confirmed)** — a single throw unmounts the app (Section 2). This is the #1 React-level risk.
- **StrictMode** (`main.tsx`) doubles effect execution in dev — the choreography is exactly the case where double-mount wastes the most work (WebGL, focusDelta, thumbnail queue).
- **`entryPoses` recompute**: `pose` object identity is derived fresh each render from `focusDelta` + `entryStage`; every `setUploadItems` poll tick (every 500 ms during processing) re-renders the entire view including the motion wrappers, forcing motion to diff animate targets during the animation window.
- **`useScaleContext`-style churn not applicable**; the render cost is bounded but the reveals/settles land in the same frame sequence as the state-machine writes (Section 3).
- **`onGeometry` callback (`CadGeometryViewer.tsx:126`)** is called during the load effect on every `getCadGeometry` response; combined with quote invalidation it can re-enter request-state updates mid-reveal.

---

## 7. Layout / FLIP / Geometry Problems

- **`calculateFocusDelta` (Confirmed, `ManufacturingWorkspaceView.tsx:169-207`)** performs synchronous geometry reads via `clientWidth`, `offsetLeft`, `offsetWidth`, `offsetTop`, `clientHeight` — forcing layout at effect time. It runs on: mount, **every `entryStage` change**, every `window.resize`, and once more via rAF.
- **Stale measurement (Confirmed by inspection):** the delta is measured at the *start* of the 580 ms width animation (block width is still mid-transition), and never re-measured during it — the focus target is therefore slightly wrong when the width transition is still running. Self-corrects only when the stage changes again.
- **Layout animation (Confirmed, CSS):** `.mw-entry-left-block` CSS-transitions `width`/`max-width` to `min(520px, calc(100vw - 48px))` over 0.58 s — an actual **geometry/layout animation** (text reflow inside Technology/Process panels every frame) running simultaneously with the JS-driven `x`/`y`/`scale` transform of the same element. Layout + transform are animated together; the layout half cannot be composited.
- **Instant layout jump at `upload-focus`**: `.mw-workspace[data-entry='upload-focus'] .mw-col-center { justify-content: center }` + upload `width: 100%` change with **no transition** — a visible geometry snap at the exact moment the left block is mid-animation.
- **Full grid re-layout at reveal**: middle/right columns mount as flex items, so the entire grid track sizing recalculates while the transformed blocks are flying.

---

## 8. CSS Rendering Problems

- **`backdrop-filter: blur(12px)` on `.mw-panel`-class surfaces (Confirmed):** panels are the very things being translated/scaled during the choreography; backdrop-filter inside a moving/transformed element forces per-frame backdrop sampling that cannot be cached on the compositor.
- **Panel states animate too**: `is-active` scanning sweep (`motion.css:429-441`, 2.2 s gradient translate) and `is-completed` state-pop run during reveal — several independently-animated layers on top of the choreography.
- **`.mw-canvas` layered background** (`manufacturing-workspace.css:102-124`): three radial gradients + a masked dot-grid `::before`. Large static surface re-rasterized during the layout animation and when panels move over it (compounded by the backdrop-filter above).
- **Reduced-motion**: handled via `MotionConfig reducedMotion="user"` + `prefers-reduced-motion` in a few JS spots, but the CSS `width` transition and the grid re-layout are **not** reduced-motion aware — a `prefers-reduced-motion` user still gets the 0.58 s layout animation and reflow.

---

## 9. CAD / Three.js Interaction

- **Two renderers, one file:** the main `CadGeometryViewer` (interactive, DOM-mounted) and the one-`THREE.WebGLRenderer` thumbnail pipeline (`cadThumbnailRenderer.ts`) each `getCadGeometry` → `getCadViewerAsset` → **`parseCadBuffer`** for the same file, in parallel (+ a third parse if the user opens Preview). For large STEP/IGES GLB outputs this triples CPU parse work around the reveal.
- **Unprotected WebGL effect (Confirmed):** `CadGeometryViewer.tsx:203-242` — the `new THREE.WebGLRenderer` and the first `renderer.render` are **not wrapped in try/catch**. Any WebGL context failure throws inside an effect → React unmounts the tree → **blank app** (Section 2).
- **PMREM + ACES on every mount:** `PMREMGenerator` from `RoomEnvironment` (`:216-217`) compiles cube/RoomEnvironment shaders on each mount — a big first-frame cost (the 2.6 s long task) and a frequent source of GPU-time spikes. Shared resources (environment texture, materials, geometries) are **not** cached across mounts.
- **`forceContextLoss` + double-mounting:** cleanup calls `renderer.forceContextLoss()` — in dev StrictMode the component mounts twice in quick succession, and repeated actual mounts (Preview open/close, delete/re-add) create/destroy contexts aggressively; a lost-context mid-render on the main thread surfaces as a bare exception (again: blank).
- **`setPixelRatio(min(dpr,2))`** at dpr 2 = 4× fragment load; the dev-only real-Mac experience (Retina) pays this while headless (dpr 1) does not.

---

## 10. Memory / Cleanup

- Disposal is generally thorough in `CadGeometryViewer` (geometry + materials + renderer + controls disposed; context force-lost) and in the thumbnail renderer (`disposeCadModel`, `material.dispose`). No confirmed leak in the exercised flows.
- But: **two independent WebGL contexts persist** (main viewer auto-rotating forever while stationary; shared thumbnail renderer owned module-level in `cadThumbnailRenderer.ts:28`), each with fixed GPU memory; the PMREM environment texture and shared materials are re-created per mount (Section 9).
- `URL.createObjectURL` for SVG/PDF is revoked on unmount and format change — correct.
- Nothing rotates fan-out: the long `getCadFiles` polls are bounded at 40; the quote is debounced 300 ms — but each poll setState loop adds to render pressure rather than memory.

---

## 11. Navigation / Mounting

- The Workspace mounts under the authenticated route; on `activeView` change it unmounts (removing everything including the main WebGL context at once). With no error boundary the boundary failure mode (Section 2) is deliberately emphasised here: an error on *any* earlier/parallel path (e.g., thumbnail in the background) can blank unrelated routes.
- Fullscreen Preview **reparenting**: `useLayoutEffect` moves the `.geometry-canvas-panel` DOM node into `#root` (`CadGeometryViewer.tsx:261-273`). Moving a node that hosts a live WebGL canvas to a different stacking context — while the entry columns are still flex/re-layouting — is a risky point not exercised by the passing tests (only manual flows touch fullscreen).
- Draft-restore re-entry mounts the app directly into `workspace`, skipping the choreography; observed working end-to-end, but it exercises the same unguarded WebGL mount immediately on load.

---

## 12. Root Cause Ranking

| # | Problem | Evidence | Confidence | Impact |
|---|---------|----------|------------|--------|
| P0 | **No error boundary anywhere** → any runtime error blanks the entire app | grep 0 matches across `frontend/src`; React 18 unmount-on-error semantics | **Confirmed** (mechanism) | Blank screen; the fully matching symptom is structural |
| P1 | **Un-wrapped WebGL renderer creation/first-frame effect** (`CadGeometryViewer.tsx:211,238`; `cadThumbnailRenderer.ts:34`) — context failure OOM/driver/StrictMode double-mount throws inside effect | code inspection | **Confirmed** (code path), **Probable** (trigger) | Blank screen at reveal / preview / fullscreen |
| P2 | Reveal fires on *any* upload activity, not readiness (`:318`); settle is a fixed 850 ms wall-clock (`:302`) decoupled from readiness | code inspection | **Confirmed** | Jank + wrong empty/“processing” states revealed |
| P3 | Main-thread long tasks at reveal: **2611/853/777 ms**; 5 frame gaps ≥100 ms; ~35 fps (software GPU) | runtime measurement (`instruments3.json`) | **Confirmed** (measured), Probable (magnitude on real GPU) | Visible stutter/freeze |
| P4 | Layout animation (`.mw-entry-left-block` CSS `width`) racing transform animation; grid re-layout at reveal | CSS + runtime | **Confirmed** | Continuous reflow, can’t composite |
| P5 | Forced layout reads (`calculateFocusDelta`) on every stage change + resize + rAF; stale mid-transition measurement | code inspection | **Confirmed** | Extra layout passes + off-target focus |
| P6 | 2–3 concurrent WebGL contexts + double `parseCadBuffer` of the same file | code inspection | **Confirmed** | CPU/GPU contention at reveal |
| P7 | Polling `getCadFiles` every 500 ms + setState churn | code inspection | **Confirmed** | Re-render churn during processing |
| P8 | Panel `backdrop-filter`, scan-sweep + state-pop animations concurrently during choreography | CSS | **Confirmed** | Non-cached per-frame paint |
| P9 | Stale/duplicate stage writes: reveal ↔ steering effect overlap; duplicated resize dispatch at settle | code inspection | **Probable** | Rare stage flapping |

---

## 13. Recommended Fix Strategy (NOT implemented — for approval)

Keeps the same workspace, same panels, same upload/CAD/quotation/pricing logic and same business rules. Each item states What / Where / Why / Benefit / Risk.

1. **Add error boundaries (P0).** Wrap the app (`main.tsx`) with a small `ErrorBoundary` and a *granular* boundary around `ManufacturingWorkspaceView` and around `CadGeometryViewer`. Why: converts any crash into an isolated recoverable panel, never a blank page. Risk: low (pure containment, no logic change).
2. **Harden the WebGL mount effect (P1).** Wrap `CadGeometryViewer.tsx:211-241` in try/catch; on failure set `state='error'` with retry path (there is already a retry UI). Also guard the thumbnail renderer factory (`cadThumbnailRenderer.ts:30-40`). Risk: low.
3. **Gate reveal on readiness (P2).** Change `:318` to trigger reveal only when `areAllUploadsReady(uploadItems)` (i.e., isUploadItemReady), and keep the busy/failed states visible before reveal. Settle can stay a short fixed timer once reveal is readiness-gated, or derive `workspace` from readiness+settle. Risk: medium (may change perceived timing of the animation; acceptable and testable).
4. **Convert the focus choreography to transforms only (P4, P5).** Stop CSS-animating `width`/`max-width` on `.mw-entry-left-block`; instead animate `x`/`scale` only, or use a clip-path/scale variant of the whole block; remove the instant `justify-content:center`/`width:100%` snap at `upload-focus` (use the transform-based focus instead). Replace `calculateFocusDelta` geometry reads with layout-neutral values (percent-based target, or measure only once on mount via `ResizeObserver`), and drop the always-on resize/rAF re-measure while animating.
5. **De-duplicate same-file work (P6).** Share one geometry load/parse per file between the viewer and thumbnails (cache parsed model by `file.id`), and cache the PMREM environment texture and preview materials across mounts.
6. **Respect reduced motion for the layout half (P8/P4).** Gate the CSS `width`/grid changes via a no-preference media query; keep opacity/transform fades for reduced-motion users.
7. **Remove the redundant synthesized resize at settle (P3/P9)** — rely on the `ResizeObserver` that already re-fits the renderer; avoid double re-fit.
8. **Throttle poll churn (P7):** reuse the existing cad-files list response instead of a fresh full GET per tick, or at least skip setState when the item’s status didn't change.
9. **Leave Stage as-is otherwise; re-verify with the audit harness (Section 15).**

---

## 14. What Should NOT Be Changed

- The workspace layout and panel structure/identifiers/accessibility (`mw-sec-tech`, process chips, upload list, panel badges, keyboard handling, `aria` on state marks).
- The upload → backend → poll → COMPLETE pipeline and its failure semantics (including the 20 s timeout and statuses).
- The quotation engine (`useQuoteEngine`, multi-file POST), pricing engine, ordering, and all business rules.
- The CAM LABS viewing convention and the fit/orientation logic in `CadGeometryViewer` (Z-up, no destructive orientation guessing).
- `parseCadBuffer`/loaders/camera conventions shared with thumbnails (identical output between thumbnails and viewer is deliberate).
- Reduced-motion is a design promise: any choreography change must preserve the collapse-to-fade behaviour.
- The audit-viewing DX conventions (visible data, honest empty/loading/error states). No hidden/hardcoded mock states.

---

## 15. Validation Plan After Fix

1. **Automated (repeatable in CI, no browser recorded flow needed):**
   - Keep/extend the component tests (126 pass today) and re-run `tsc --noEmit` and `npm run build`.
   - Add an error-boundary test: throw inside a child during reveal → expect boundary UI, not blank.
   - Add a WebGL-failure test for `CadGeometryViewer` (mock `THREE.WebGLRenderer` to throw) → expect `state='error'` + retry.
2. **Browser harness (used for this audit — `drive_flow*.mjs`, CDP):**
   - Re-run the full flow and assert: entry `upload-focus→reveal→workspace`, roots stays mounted, `< 2` long tasks > 200 ms during reveal, avg fps ≥ 45 (software GPU baseline), thumbnails + quote appear.
   - Re-run scenario matrix: full flow, Preview open/close, delete+confirm, re-add, reload+draft restore — assert never blank.
3. **On the reporter’s machine (where the disappearance occurred):**
   - Capture `window.addEventListener('error'/'unhandledrejection')` + `Runtime.exceptionThrown` during the exact recorded sequence to obtain the precise throwing module (expected: a WebGL/render effect in `CadGeometryViewer` or a reveal-window async effect). Devtools “Pause on exceptions” while watching a profile with **Memory → GPU** and Timeline.
   - Increase confidence about large-file behavior: repeat with a STEP file > 50 MB and a high-dpr Retina viewport, watching the reveal window.
4. **Regression gate:** after any fix, `git diff` should show changes only within the modules named in Section 13; business logic, API contracts, and panel DOM must remain byte-identical except the choreography targets.

---

**Raw evidence artifacts (generated by this audit, kept outside the repo):**
- `/var/folders/r3/ftfw9yl963xgm5n5qbylskvh0000gn/T/opencode/cdpaudit/`
  - `audit-cube.stl` (generated 20 mm test model)
  - `drive_flow.mjs`, `drive_flow2.mjs`, `drive_flow3.mjs` (CDP harness)
  - `instruments3.json` (frames + long tasks + heap)
  - `errors2/3.txt` (console/exception capture)
  - `*.png` screenshots of each stage