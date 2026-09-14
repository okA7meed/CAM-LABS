# CAM LABS — Design Resources Knowledge Base

Research + audit phase (no implementation). Created 2026-09-13.

## Purpose

This directory preserves verified research findings about five external design
resources and maps them to concrete, evidence-based improvement opportunities
for the CAM LABS platform (React 18 + Vite + TypeScript + Express + Prisma).

**This is a research-only knowledge base. Nothing in this directory has been
implemented.** Every recommendation here is a candidate for a future task, and
only after explicit approval.

## Scope Rules (repeat of the audit mandate)

- The current website UI is approved and visual design is **unchanged**.
- No packages were installed, no `package.json`/lockfiles were modified.
- No backend APIs, database schema, pricing engine, or business logic changed.
- No files were deleted or renamed.

## Directory Map

| File | Resource | Type |
| --- | --- | --- |
| [21st-dev.md](./21st-dev.md) | 21st.dev | Component registry / marketplace + AI generation + CLI |
| [refero-design.md](./refero-design.md) | Refero | Design research / inspiration library + DESIGN.md style specs |
| [supahero.md](./supahero.md) | Supahero | Hero-section inspiration gallery + Framer templates |
| [motion-dev.md](./motion-dev.md) | Motion (motion.dev) | Open-source npm animation library (ex-Framer Motion) |
| [60fps-design.md](./60fps-design.md) | 60fps.design | UI animation showcase / storyboard reference gallery |
| [cam-labs-design-opportunities.md](./cam-labs-design-opportunities.md) | — | Categorized improvement opportunities (design / UX / animation / technical / manufacturing) |
| [compatibility-matrix.md](./compatibility-matrix.md) | — | Resource-to-project compatibility analysis + mapping table |

## One-Line Findings

- **21st.dev** — a shadcn/ui-registry marketplace + AI generator. Requires
  Tailwind + shadcn project setup, which CAM LABS does not currently have. Do
  not adopt as-is; harvest *patterns* only.
- **Refero** — a pure design-research library (screens + DESIGN.md token specs
  + MCP). Useful as the *design-direction* source for future CAM LABS
  iterations. Nothing to install.
- **Supahero** — hero-section screenshot inspiration (now part of
  screensdesign). Visual reference only; no reusable code.
- **Motion** — the only directly reusable engineering asset. MIT, React 18.2+,
  Vite out-of-the-box, TypeScript-native, tree-shakable (~4.6 kb with
  LazyMotion), first-class reduced-motion support. Fits the existing CSS +
  IntersectionObserver animation system without replacing it.
- **60fps.design** — motion showcase + storyboards + MCP. Provides a *motion
  design vocabulary* (Gestures/Patterns/Effects/Elements taxonomy) and smooth
  spring-pattern references. SwiftUI code only; web code is not provided.

## Current CAM LABS Visual System (for context, unchanged)

- Dark-first design tokens in `frontend/src/styles/design-system.css`.
- Plain CSS custom properties (no Tailwind, no CSS modules, no styled-components).
- Three scoped design systems: public `.cam-*`, admin `.cam-admin`, manufacturing
  workspace `.mw-workspace`, pricing engine `.pe-workspace`.
- Animation: pure CSS keyframes (`motion.css`) + IntersectionObserver
  (`useScrollReveal`) + `<Reveal>`; comprehensive `prefers-reduced-motion` handling.
- State-based navigation (no react-router), `i18next` AR/EN with RTL via `dir`.
- CAD viewer built on raw `three.js` + `dxf-parser`.

## Files Not Created

Per the audit instruction, no website code, design files, or configuration was
modified. Only the Markdown files in this directory were added.

## Verification Status

See the individual files for "Verified" vs "Unverified/Assumption" sections.
Resources researched against official sources between 2026-09-13 and report
finalization. Where a claim could not be verified from an official source, it is
explicitly labeled.