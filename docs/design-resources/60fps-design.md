# 60fps.design — Knowledge File

> Research date: 2026-09-13. Verified against 60fps.design, the shots/apps/
> appsites/motion/storyboards/glossary sections, and the /pro and /mcp pages.
> Anything not verified is labeled.

## Resource Overview

60fps.design is a **curated collection of UI/UX animation and interaction
design details** from best-in-class iOS and web apps (self-described: "a
curated collection of UI/UX animation and interaction design details from the
world's best iOS, and web apps"; "Endless collection of delightful details from
best-in-class apps.").

It is a **showcase / reference gallery** — not a course, not a code library,
not a design tool.

## Official URLs

- https://60fps.design
- https://60fps.design/shots (2,060 animation examples at research time)
- https://60fps.design/apps (481 curated iOS apps, A–Z)
- https://60fps.design/appsites (82 interactive website examples)
- https://60fps.design/motion (62 motion "bento" grids)
- https://60fps.design/storyboards (67 hand-crafted breakdowns)
- https://60fps.design/glossary (85 movement/interface terms)
- https://60fps.design/pro (PRO: $15/mo or $120/yr via Gumroad)
- https://60fps.design/mcp (MCP server, $29/mo)

## Resource Type

- **Curated inspiration showcase / reference gallery** with a taxonomy of
  interaction patterns.
- Optional **PRO** (deeper storyboards, motion tags, full filters) and an
  **MCP server** (AI-queryable: search_shots, list_filters, get_shot,
  get_motion_breakdown, get_motion_code, get_related_shots).
- **No web code is provided** free or PRO — only SwiftUI code is offered via
  the MCP `get_motion_code` tool ("Real SwiftUI for the motion,
  compile-checked").

## Categorization Taxonomy (verified — full 108-filter set)

- **Gestures:** Drag, Flick, Flip, Gyroscope, Hold, Long Press, Pan, Pinch,
  Pull, Scroll, Scrub, Slide, Swipe, Tap, Typing
- **Patterns:** Empty State, Loading, Onboarding, Progress, Success State,
  Gamification, Pricing, Shared Element, Stats, etc.
- **Effects:** Bounce, Fade, Morph, Pulse, Reveal, Sequence, Shimmer, Spring
  Physics, Stagger, etc.
- **Elements:** Button, Card, Graph, Input, Tooltip, Toast, Bottom Sheet, Tabs,
  Menu, Badge, Counter, Picker, Slider, etc.
- **App Store categories per app** (Business, Developer Tools, Finance,
  Productivity, Utilities, …)

Notably, there is **no dedicated Table/Dashboard/Form filter** in this
taxonomy (verified against the full filter list).

## Shots Content Format

Each shot includes a written narrative of the motion. Verified example:
*Blinkit Add Remove Cart Animation* — "quantity selector morphs back into 'Add
to cart'… text rolls… shrink and fade… springy settling effect" tagged
Badge/Button/Counter/Fade/Morph/Pulse/Shrink/Slide/Tap/Text/Wiggle.

## Reuse vs. Inspiration

- **Directly reusable in a React+Vite+TS web platform:** nothing code-level.
  The SwiftUI spring configs (`duration:`, `bounce:` values) are conceptually
  portable as *timing references* but not copy-paste.
- **Reusable as design language:** the Gestures/Patterns/Effects/Elements
  taxonomy works as a **motion-design vocabulary** for an internal CAM LABS
  motion system — standardize modal/table/form/notification animations by the
  same named patterns and spring timings.
- **Relevant filters to mine** (for admin/dashboards/forms/notifications):
  Progress, Graph, Stats, Counter, Loading, Empty State, Input, Picker,
  Slider, Search, Tabs, Menu, Button, Badge, Tooltip, Toast, Bottom Sheet,
  Show/Hide, Reveal, Shared Element, Success State, Sequence, Spring Physics,
  Stagger, Shimmer.

## CAM LABS Use Cases (candidate, NOT implemented)

- **Motion vocabulary for the design system:** adopt named patterns
  (e.g., fade+slight-rise entrances, springy "settle" on success chips,
  shared-element transitions on admin detail views) — implemented with the
  existing CSS animation system or Motion, per approved future tasks.
- **Toast/notification animations** (patterns: sequence, slide, success-state).
- **Loading & shimmer** (patterns: shimmer, progress, skeleton) in admin
  tables (`.admin-skeleton-row`) and CAD processing.
- **Empty/error/loading states** polish (patterns: empty state, success state).
- **Micro-interactions on buttons/cards/counters** consistent with the existing
  `cam-ease-out` curve.
- Beware: the library skews **consumer iOS + touch gestures** (Swipe, Pinch,
  Gyroscope, Long Press) — many are irrelevant to mouse-driven manufacturing
  admin UIs.

## Compatibility Notes

| Concern | Assessment |
| --- | --- |
| React / TS / Vite | N/A — no web code provided. |
| Existing CSS animation | Compatible as a *source of timing/pattern direction*. |
| RTL/LTR | N/A at code level. |
| Theme system | N/A. |
| Licensing | Screenshots/descriptions are reference; SwiftUI code is MCP/PRO-gated. |
| Cost | Free browse; PRO $15/mo or $120/yr; MCP $29/mo. |

## Performance Considerations

- No runtime adoption → zero runtime impact. If patterns are ported, CAM LABS
  should keep bounds (only transform/opacity, duration ceilings, `once`
  reveals, reduced-motion off).

## Accessibility Considerations

- The gallery's own content: N/A. When porting patterns, CAM LABS must keep
  its existing `prefers-reduced-motion` handling and non-motion fallbacks.

## RTL/LTR Considerations

- N/A at code level. When porting, use logical properties / inline-start
  animations for Arabic.

## Limitations

- iOS/consumer-touch skew; thin enterprise (tables/dashboards) coverage.
- No table/dashboard/form-specific filters.
- No web code; PRO+SwiftUI only.
- `/snippets` and `/learn/*` sections appear in third-party indexes as
  PRO-gated but could not be fetched directly (404 at research time) — their
  exact URLs and content are **unverified**.

## Verified Findings Summary

1. It is a showcase gallery with a highly granular interaction taxonomy.
2. 2,060 shots, 481 apps, 82 app sites, 62 motion grids, 67 storyboards,
   85-term glossary.
3. PRO unlocks storyboards/filters; MCP exposes search + SwiftUI motion code.
4. No web/React code is offered anywhere visible.
5. Most relevant CAM LABS value = motion-design vocabulary + spring/timing
   references.

## Unverified / Assumptions

- The site's own tech stack (not inspected).
- `/snippets` and `/learn/*` existence/content (search-index evidence only).
- Performance-education content (implied by the brand name but not found).
- Post-2022 continued accuracy of app entries.
- Whether the Manufacturing tag in the Motion section contains usable
  enterprise content beyond marketing motion.