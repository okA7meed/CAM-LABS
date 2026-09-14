# CAM LABS — Resource Compatibility Matrix

> Research + audit phase, 2026-09-13. Compatibility analysis of the five
> researched resources against the verified CAM LABS stack. Nothing installed.

## CAM LABS Verified Stack (summary)

- React 18.2, Vite 5, TypeScript 5.3 (monorepo workspace `frontend/`)
- Plain CSS custom-property design system (no Tailwind / no CSS modules)
- Three.js + dxf-parser CAD viewer (raw three, no @react-three in frontend src)
- i18next AR/EN, RTL via `dir` attribute, `[data-theme]` dark/light/system
- Express + Prisma 5 + PostgreSQL backend
- State-based navigation (`StoreContext.activeView`), no react-router

## Per-Resource Compatibility

### 21st.dev

| Concern | Assessment |
| --- | --- |
| Type | Component registry/marketplace + AI gen + CLI (not a runtime lib) |
| React/TS/Vite | Compatible only via shadcn/Tailwind scaffolding — CAM LABS has neither |
| CSS architecture | **Conflicts** (Tailwind utility classes vs CAM LABS custom property tokens) |
| Theme system | Requires dark-mode adaptation to `[data-theme]` |
| RTL/LTR | Unverified per-component |
| Bundle impact | No runtime cost (code copied) but component bloat varies |
| Maintenance | No upgrade liability (copied code); per-component quality review needed |
| Licensing | `@21st-dev/*` CLI MIT; per-component "open source" self-labeled, individual terms unverified |
| **Verdict** | **Do not adopt now.** Use as pattern reference. Requires Tailwind+shadcn re-architecture to be "drop-in." |

### Refero

| Concern | Assessment |
| --- | --- |
| Type | Design research/inspiration library + DESIGN.md specs + MCP |
| React/TS/Vite | N/A (no code) |
| CSS architecture | High translation compatibility (tokens → CSS custom properties) |
| Theme system | Dark-mode references map directly |
| RTL/LTR | Arabic/RTL product screens indexed |
| Bundle impact | None |
| Maintenance | Research subscription; no runtime |
| Licensing | Screenshots/briefs for reference; verify redistribution usage |
| **Verdict** | **Adopt as design-direction source** in future visual tasks. Nothing installs. |

### Supahero

| Concern | Assessment |
| --- | --- |
| Type | Hero-section screenshot gallery + Framer template listings |
| React/TS/Vite | N/A (no code) |
| CSS architecture | N/A |
| Theme system | N/A |
| RTL/LTR | N/A |
| Bundle impact | None |
| Maintenance | N/A |
| Licensing | No published asset licensing; screenshot copyrights remain with brands |
| **Verdict** | **Low value / inspiration only** for a manufacturing platform. Skip unless landing-page composition work starts. |

### Motion (motion.dev)

| Concern | Assessment |
| --- | --- |
| Type | **Open-source npm library** (ex-Framer Motion) |
| React 18.2 | Compatible (requires 18.2+) |
| TS / Vite | TS-native; "works out of the box with Vite" (official) |
| CSS architecture | Coexists with CSS keyframes (animates style/transforms via WAAPI/JS) |
| Theme system | Theme-agnostic |
| RTL/LTR | Reorder RTL added 13.1.0; general RTL needs project testing |
| Bundle impact | `LazyMotion`+`m` ≈ 4.6 kb initial, +15/25 kb on demand; full `motion` ≈ 34 kb |
| Reduced motion | First-class (`MotionConfig reducedMotion="user"`) |
| Maintenance | Active OSS fork of Framer Motion (MIT) |
| Licensing | MIT — free |
| **Verdict** | **Recommended** for incremental enter/exit + layout animation in an approved future task. Fits without redesign. |

### 60fps.design

| Concern | Assessment |
| --- | --- |
| Type | UI animation showcase + storyboards + MCP ($29/mo) |
| React/TS/Vite | N/A — no web code (SwiftUI only behind PRO/MCP) |
| CSS architecture | N/A |
| Theme system | N/A |
| RTL/LTR | N/A |
| Bundle impact | None |
| Maintenance | Reference subscription |
| Licensing | PRO/MCP gated content; screenshots are reference |
| **Verdict** | **Motion vocabulary + timing references only.** Do not vendor; use its taxonomy/timings when building the CAM LABS motion system. |

---

## Resource-to-Project Mapping (evidence-based)

| Resource | CAM LABS Area | Potential Improvement | Technical Approach | Priority | Risk |
| --- | --- | --- | --- | --- | --- |
| 21st.dev | Admin data tables | Row-selection, dense toolbar + filter patterns (pattern only) | Port the *patterns* into existing `.cam-admin` CSS; do NOT adopt Tailwind/shadcn | Low | Low (idea) / High if code copied verbatim |
| 21st.dev | Admin dashboard cards/grids | Dashboard composition ideas | Build with existing `.admin-card`/`.cam-admin` tokens | Optional | Low |
| 21st.dev | Forms (workspace configurator) | Field-grouping & validation visual patterns | Reimplement in `.mw-workspace` styles | Optional | Low |
| Refero | Design system tokens | DESIGN.md-style token audit for `.cam-admin`/`.mw-workspace`/`.pe-workspace` consolidation | Translate specs to CSS custom properties later | Medium | Low |
| Refero | Dark-mode industrial UI | Dark-mode palette & density references | Use as redesign brief only | Optional | Low |
| Refero | Dashboard / charts | Chart + stats composition references (hand-rolled SVG charts exist) | Use as layout direction | Optional | Low |
| Supahero | Hero/landing | Hero composition inspiration (headline+stage+CTA+trust) | Reimplement in existing style only, if ever | Optional | Low |
| Motion | Manufacturing workspace | Panel layout + enter/exit transitions (C1/C2) | `LazyMotion`+`m`+`AnimatePresence`+`MotionConfig reducedMotion="user"` | High | Low |
| Motion | Modals/drawers + toasts | Enter/exit + auto-dismiss polish (C3) | `AnimatePresence`, spring timing | Medium | Low |
| Motion | Admin tables | Row layout smoothing on filter/sort | `motion.tr` + `layout` on subsets | Medium | Medium (perf on large lists — scope carefully) |
| Motion | CAD viewer UI | Loading→ready + fullscreen transitions (C8) | CSS or Motion fade/scale | Low | Low |
| Motion | Scroll reveals | `whileInView` alternative to `useScrollReveal` | Motion, `once: true` | Optional | Low |
| 60fps | Motion design system | Named pattern vocabulary + spring/timing references | CSS/Motion port of durations & curves | Medium | Low |
| 60fps | Toasts / loading / empty states | Sequence, shimmer, success-state polish (C5) | CSS keyframe polish | Medium | Low |
| 60fps | Buttons/counters | Micro-interaction references (consistent with `cam-ease-out`) | CSS transforms | Low | Low |

---

## Summary Verdict Table

| Resource | Install? | Compatible? | Recommend? | Notes |
| --- | --- | --- | --- | --- |
| 21st.dev | CLI only (shadcn path) | No (Tailwind/shadcn gap) | Patterns only | Do not copy code wholesale |
| Refero | No | Yes (as research) | Yes (research) | DESIGN.md specs translate to tokens |
| Supahero | No | N/A | Marginal | Consumer/SaaS skew |
| Motion | **`npm install motion`** | **Yes** | **Yes (approved task)** | MIT, small with LazyMotion, a11y-ready |
| 60fps.design | No (MCP is a server, not an app lib) | N/A | As vocabulary | SwiftUI only; inspiration |

## Risk Register

1. **Tailwind/shadcn adoption (via 21st.dev)** — architectural change,
   color/token rework, RTL risk, large diff. Not recommended now.
2. **Motion on huge admin tables** — layout animation on hundreds of rows can
   jank. Limit to filtered subsets or skip table layout animation.
3. **Motion RTL** — limited support beyond Reorder. Test mirrored animations in
   Arabic before release.
4. **Per-component quality (21st)** — third-party code must be reviewed for
   security/quality before any copy.
5. **dxf-parser declaration gap** — unrelated to these resources but flagged as
   High maintenance risk: declare it in `frontend/package.json` in a future
   approved task.

## Final Recommendation

Adopt **Motion** (MIT, `npm install motion`, `motion/react`) as the incremental
animation engine in one approved future task — scoped, LazyMotion-based, with
`reducedMotion="user"` — and use **Refero + 60fps.design** as the design
direction/vocabulary. Treat **21st.dev** and **Supahero** as pattern references
only. No adoption happens before explicit approval.