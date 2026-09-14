# 21st.dev — Knowledge File

> Research date: 2026-09-13. Verified against 21st.dev, help.21st.dev, npm,
> and the serafimcloud/21st GitHub README. Anything not verified is labeled.

## Resource Overview

21st.dev ("21st", owned by 21st Labs, Inc.) is a **community registry /
marketplace of React UI components and templates**, built around the shadcn/ui
registry format. It also offers an AI-based prompt-to-component generation
service and installable CLI tooling.

Self-described positioning: "the *living* library of interfaces" with
"12,000+ crafted React components, templates, and shadcn themes."

Crucially, 21st distinguishes itself from a traditional component library:
"A component library is one package with one aesthetic, installed as a
dependency. 21st is a registry: many authors, many styles, and the code is
copied into your repo rather than imported. You own it and can change it."
(Source: 21st.dev FAQ)

## Official URL

- https://21st.dev
- https://help.21st.dev (docs)
- https://www.npmjs.com/package/@21st-dev/cli (CLI, v1.17.0 at time of research)
- https://github.com/serafimcloud/21st (community GitHub README)

## Resource Type

**Hybrid:**
1. UI component / template **marketplace & registry** (shadcn registry format)
2. **AI generation** service ("21st AI", prompt → component)
3. Installable **CLI tools** (`@21st-dev/cli`, binary `21st`)

It is **NOT a component library you install as a runtime dependency.**

## Technologies Used (verified)

- React (components)
- TypeScript ("TypeScript First") (verified on GitHub README)
- **Tailwind CSS**
- **Radix UI** (verified on GitHub README)
- **shadcn/ui conventions and registry format** (verified on homepage + docs)
- Standard shadcn utilities (`cn` = clsx + tailwind-merge) in code samples

## Installation & Integration (verified)

Two documented integration paths (both require **no direct npm dependency on
the component**, code is copied into your repo):

1. **shadcn CLI (classic):**
   `npx shadcn@latest add "https://21st.dev/r/author/component-name"`
   Requires an initialized shadcn/ui project (`components.json`) with `@/`
   path aliases.

2. **AI prompt workflow (primary):** copy a component prompt and paste into
   Cursor / Claude Code / v0 / Lovable; the agent rebuilds it for your stack.

3. **21st CLI:** `21st add <user>/<slug>` — requires a 21st API key
   (`API_KEY_21ST`) and shells out to `npx shadcn@latest add` against the
   21st registry (verified on help.21st.dev).

4. **MCP server:** search/install via agent MCP.

## Component Categories (verified)

- **UI Components:** buttons, inputs, cards, modals, tables, forms
- **Marketing Blocks:** heroes, features, testimonials, pricing, footers, CTAs
- Homepage subcategories include: animated heroes, hero sections, shaders,
  gradients, backgrounds, footers, buttons, AI chats, cards & grids, galleries
  & 3D, navigation, sign-ins, sections

## Licensing & Pricing (verified)

- **npm packages** `@21st-dev/cli` / `@21st-dev/registry` are MIT-licensed
  (verified on npm).
- The **marketplace components** are labeled "open-source" by 21st; individual
  component licenses and template licenses were **not independently verified**
  (per-component metadata).
- Freemium: free tier = 2 component retrievals/installs per day; paid Builder
  membership ~$6/mo (yearly), Builder+AI $15/mo, Team $7.50/seat/mo; premium
  templates sold per-template by authors; AI generation on credits (+100 for $5).

## Production Readiness

- 21st claims "production-ready React/Tailwind components" and "real code,
  ready to ship." This is a **self-claim**; quality varies per author and was
  not independently verified. Approach each component with code review.

## CAM LABS Use Cases (candidate, NOT implemented)

Given CAM LABS currently has **no Tailwind and no shadcn setup**, direct
integration would require a large architecture change. Harvest the *patterns*
more than the code:

- **Data tables** for admin (Orders, Customers, CAD Files, Payments).
- **Dashboard card/grid compositions** for the admin dashboard.
- **Navigation patterns** (dense sidebar + header combos for `.cam-admin`).
- **Loading / skeleton / empty-state patterns** matching the existing visual
  language.
- **Form layouts** for the manufacturing configurator.

## Compatibility Notes

| Concern | Assessment |
| --- | --- |
| React 18 | Compatible (components are React). |
| TypeScript | Compatible (TS-first). |
| Vite | Compatible **only via the shadcn path**; no Next.js requirement (verified docs), but CAM LABS lacks shadcn/Tailwind scaffolding. |
| Existing CSS architecture | **Conflict risk.** CAM LABS uses plain CSS custom-property tokens; 21st components are Tailwind/shadcn (utility classes + Radix). Mixing pulls in Tailwind and Radix as new foundations. |
| RTL/LTR | Not documented on 21st; Radix provides some RTL primitives, but unverified per-component. |
| Dark/Light mode | Tailwind `dark:` classes are the norm; CAM LABS uses `[data-theme]` attribute tokens — needs adaptation work. |
| Maintenance | Code copied into repo → you own it; no runtime upgrade pressure. Review per-component quality/security on copy. |
| Security | Components are third-party code; must be reviewed on copy (never assume trust). |

## Performance Considerations

- No runtime library cost (code copied in), but component bloat varies; review
  each component's dependency list on import.
- Marketing-block components (hero shaders, 3D) can be asset-heavy; audit
  bundle impact before reuse.

## Accessibility Considerations

- Depends on author. Radix primitives (when used) have good a11y baselines;
  hand-rolled components need review. CAM LABS has strict focus-visible and
  reduced-motion requirements that must be preserved.

## RTL/LTR Considerations

- Not verified on 21st docs. CAM LABS is fully AR/RTL aware; any adopted
  component must be adapted to the `[dir='rtl']` system already in place.

## Limitations

- No industrial/dashboard-density focus; catalog skews marketing/AI/web.
- Free tier is rate-limited (2/day).
- No independent quality verification per component.
- Requires Tailwind + shadcn to be adopted to truly "drop in."

## Verified Findings Summary

1. 21st.dev is a shadcn-registry marketplace + AI tool, not a runtime package.
2. Install paths require shadcn/Tailwind scaffolding or an AI agent.
3. `@21st-dev/cli` and `@21st-dev/registry` are MIT.
4. Component categories relevant to admin tables, cards, nav, forms exist.
5. Code is copied into the repo (no version-upgrade liability).

## Unverified / Assumptions

- The "12,000+ components" / "3.6M users" figures (self-reported).
- Production quality of any individual component.
- Per-component licensing.
- RTL behavior of individual components.