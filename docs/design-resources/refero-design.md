# Refero — Knowledge File

> Research date: 2026-09-13. Verified against refero.design, styles.refero.design,
> doc.refero.design, and search-index corroboration. Anything not verified is labeled.

## Resource Overview

Refero is a **structured design research library**: curated, searchable
screenshots of real products (web + iOS), organized by page type, UX pattern,
UI element, company, and visual aesthetic. It markets itself as "a structured
design research library: curated visual styles, real product screens, and user
flows searchable by aesthetic direction, page type, UX pattern, company, or
plain language."

It is fundamentally an **inspiration/research source**, not a component source.

## Official URLs

- https://refero.design (main gallery)
- https://styles.refero.design (the "Styles" / DESIGN.md product, labeled Beta)
- https://refero.design/mcp (MCP server for AI agents)
- https://doc.refero.design (documentation)
- Figma plugin (separate integration)

## Resource Type

- Design inspiration gallery (screenshots by Page Type / UX Pattern / UI Element)
- AI-agent data/spec layer: **Refero Styles** produces DESIGN.md design-system
  briefs (colors, typography, spacing, components) formatted for AI agents
  (Cursor, Claude Code, Codex, v0, Lovable)
- **Refero MCP** server for programmatic search
- **Figma plugin**
- **Nothing code-based is installable** (no npm package, no component source)

## What refero.design/styles Contains (verified)

The Styles product ("Beta") exposes **2,000+ AI-readable design-system specs**
from leading product websites. Each style page documents:
- Named color tokens with hex values and roles
- Typography
- Spacing
- Buttons, cards, page models
- "Similar Brands"
- A `DESIGN.md` you can feed to an AI agent

Verified example: the style page for refero.design itself is annotated with
Tailwind v4 CSS-variable notation (`--color-*` tokens). **Note:** this is
Refero's own standardized output format; it does **not** verify the actual tech
stack of the referenced sites.

## Categorization Taxonomies (verified)

- **Page Types:** Dashboard, Product Page & Landing, Paywall & Subscription,
  Log In, Product Details, Profile & Account, 404, Catalog Page, Blog, About,
  Careers, Contacts, Developers/Integration Pages
- **UX Patterns:** Filter & Sorting, Reviews & Rating, Stats, Checklist &
  To-Do, Billing & Plans, Payment Method, Dark Mode, Money Transfer, Shopping,
  Trial & Freemium, Activity & Notification Feed, Article & Text, Audio Player
- **UI Elements:** Dialog & Modal, Cards & Tiles, Color Picker, Map, Table,
  Tabs, Skeleton, Illustration, Line & Bar Chart, Footer, Navigation Bar,
  Sidebar & Drawer, Toolbar, 3D Illustration, Animation
- Styles examples include: "industrial product gallery", "blueprint",
  "terminal war room", "frosted dashboard", "editorial"

Self-reported scale: over 74k web + 67k iOS screens; 12,000+ user flows;
2,000+ DESIGN.md examples (unverified counts).

## Manufacturing-Relevant Categories (verified)

- **Dashboard**, **Catalog Page**, **Product Details**, **Table**, **Stats**,
  **Line & Bar Chart**, **Filter & Sorting**, **Dark Mode**, **Map**
- Processes/status via **Stats** and **Activity/Notification Feed** patterns
- Styles gallery includes industrial/catalog-style references

## CAM LABS Use Cases (candidate, NOT implemented)

Use Refero as the **design-judgment / spec source** in future tasks:

- Dashboard composition, stat rows, charts for the Admin Panel.
- Catalog/product-detail layouts for materials & marketplace pages.
- Dark-mode industrial UI palettes that keep within the CAM LABS brand
  (blue-on-near-black precision aesthetic).
- Filter & sorting patterns for admin tables.
- Table density/readability patterns for orders/customers/payments.

Because the Styles output is a token + DESIGN.md brief (CSS-variable / Tailwind
notation), it can be converted into CAM LABS CSS custom properties without
adopting Tailwind.

## Compatibility Notes

| Concern | Assessment |
| --- | --- |
| React / TypeScript / Vite | N/A (no code). Output is design spec text. |
| Existing CSS architecture | High compatibility — tokens can be translated to CSS custom properties; the DESIGN.md format is normalization by Refero, not a framework requirement. |
| RTL/LTR | Refero shows Arabic/RTL product screens; applicability per reference. |
| Theme system | Dark-mode references map directly to CAM LABS dark-first tokens. |
| Maintenance | Zero runtime cost; a research subscription only. |
| Licensing | Verify individually for screenshots you redistributed; reference use in prompts is low-risk. Pricing for Styles/MCP not fully visible at research time. |

## Performance Considerations

- No runtime impact whatsoever (research only).

## Accessibility Considerations

- N/A at code level; screenshot references may or may not be representative of
  accessible implementations.

## RTL/LTR Considerations

- Refero indexes Arabic/RTl product screens; use as RTL references for the CAM
  LABS Arabic experience. Unverified depth of RTL-specific catalog entries.

## Limitations

- Screenshots can be out of date with the current live product.
- No component code, no assets, no installable anything.
- Does not verify the referenced products' real tech stacks.
- Scale figures are self-reported.

## Verified Findings Summary

1. Refero is a research/inspiration library with Web + iOS coverage.
2. Styles (styles.refero.design) outputs DESIGN.md design-system briefs with
   color/type/spacing tokens and Tailwind v4 CSS-variable notation.
3. Categorization covers the page/pattern/element types most relevant to a
   manufacturing admin platform.
4. Nothing is installable; there is no code to reuse.

## Unverified / Assumptions

- Exact pricing of Styles/MCP products (not visible on fetched pages).
- Catalog depth per industry (manufacturing-specific entries) is undisclosed.
- For a specific future redesign brief, actual behavior of members-only
  features was not exercised.