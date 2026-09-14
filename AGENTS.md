# AGENTS.md — CAM LABS Engineering Workflow

This file is the instruction set for every AI agent, engineer, and contributor working on the CAM LABS manufacturing platform. It codifies the official engineering and product improvement framework defined in [`docs/continuous-improvement-process.md`](docs/continuous-improvement-process.md).

CAM LABS is a real production platform, not a static demo or mockup. It spans a frontend (React + TypeScript + Vite), a backend (Node.js/Express + Prisma + PostgreSQL), a shared workspace, and a full manufacturing workflow (authentication, CAD upload/processing, quoting, pricing engine, ordering, admin). All changes must fit this existing architecture and preserve integration with it.

## Core workflow: Observe → Decide → Specify → Execute → Measure → Review

Every task — feature, bug fix, redesign, or UI adjustment — MUST run this workflow in full, in order. Do not skip the analysis phase. Do not implement based on assumptions when the repository can provide evidence.

```
Observe → Decide → Specify → Execute → Measure → Review
```

---

## 1. Observe

Inspect and understand the existing repository before making any change:

- Repository structure: monorepo workspaces (`frontend/`, `backend/`, `shared/`).
- Frontend framework, build tool, routing system, and package manager.
- Component architecture and design system (existing reusable components, styles, primitives).
- The relevant pages, views, and components for the task.
- State management and data flow (hooks, contexts, stores).
- API layer, backend integration, and database interaction where relevant.
- Existing tests and dependencies.
- The current implementation of the requested feature.
- The exact source of the problem, and whether it is frontend, backend, data, state-management, rendering, or integration related.

Do not assume the current implementation is incomplete without investigating it.

## 2. Decide

Before proposing a solution, determine:

- What exactly needs to change, and why.
- Which existing components are affected.
- Whether the change should be local or shared.
- What must remain unchanged.
- What risks the change introduces.
- Whether a simpler solution is possible.

Do not expand scope without a clear technical reason.

## 3. Specify

Before coding, produce a concise One-Page Improvement Spec (template in `docs/continuous-improvement-process.md`). It must contain:

- **Title** — short, outcome-oriented.
- **Problem** — what is currently wrong or missing.
- **Root Cause** — the technical reason, based on repository analysis.
- **Proposed Solution** — the exact implementation approach.
- **Affected Files** — the files to be modified.
- **Out of Scope** — what must not be changed.
- **Acceptance Criteria** — specific, testable conditions that define success.
- **Risks** — potential regressions or compatibility concerns.
- **Validation Plan** — how the change will be verified.

## 4. Execute

Implement the approved solution. Rules:

- Reuse existing components and design-system primitives.
- Preserve existing functionality, API contracts, business logic, responsiveness, and accessibility.
- Keep the implementation focused; avoid unnecessary refactoring and unnecessary dependencies.
- Follow existing project conventions.
- Handle loading, empty, error, and success states where relevant.
- Do not hardcode fake data to simulate a working feature.
- Do not create a static mockup instead of implementing actual functionality.

## 5. Measure and Review

After implementation:

1. Review the changed files.
2. Check for TypeScript errors.
3. Run available lint checks.
4. Run relevant tests.
5. Run the build if appropriate.
6. Review for regressions.
7. Confirm the acceptance criteria are satisfied.
8. Explain any validation that could not be performed.

## 6. Report

After the work, clearly report:

- What changed, and which files were affected.
- Why the changes solve the problem.
- What tests and checks were run.
- Any remaining limitations.

Never claim a task is complete if it has not been verified. Do not provide vague statements such as "done" without technical evidence.

---

## Universal rules

- **Inspect first.** Understand the existing architecture, framework, routing, components, design system, APIs, backend, database, authentication, pricing logic, and manufacturing workflow when relevant — before touching anything.
- **Identify the real problem and root cause** from the repository, not from assumptions.
- **Do not create duplicate functionality.** Reuse existing components, services, hooks, and design patterns whenever possible.
- **Do not replace existing architecture** without strong technical justification.
- **No vibe coding.** Every change follows the Observe → Decide → Specify → Execute → Measure → Review workflow and is verified.
- **Screenshots are not the sole source of truth.** Written requirements and the repository implementation define functionality.
- **Preserve existing functionality, responsiveness, accessibility, and business logic.**
- **Verify implementation** with appropriate tests, type checks, linting, build checks, and regression checks. If a check cannot be run, state why.
- **Ask for explicit approval before executing high-risk, broad, or architectural changes.**

## Bug fixes

For every bug:

1. Reproduce or trace the issue using the available code and data.
2. Identify the root cause and explain why the current implementation produces the issue.
3. Implement the smallest reliable fix.
4. Verify the fix does not break related functionality.
5. Add or update tests when appropriate.

Do not hide bugs with visual workarounds. Do not claim a bug is fixed without checking the relevant behavior.

## UI/UX and design changes

- Treat the application as a real production product; analyze the existing layout before modifying it.
- Reuse existing colors, typography, spacing, borders, radii, and components when appropriate.
- Preserve the existing visual language unless the task explicitly requests a redesign.
- Do not modify unrelated sections, and do not change functionality merely to match a visual reference.
- Ensure the UI works with real data, stays responsive, and keeps interactive controls functional.
- Verify loading, empty, and error states.

## Definition of Done

A task is complete only when:

- The requested behavior is implemented.
- The implementation uses the existing project architecture.
- The affected files have been reviewed.
- No unnecessary duplicate functionality was introduced.
- Existing business logic remains correct.
- Relevant tests or validation checks have been performed.
- No obvious TypeScript, lint, or build errors were introduced.
- Responsive behavior and accessibility have been considered.
- The final implementation is explained clearly.

## Notes on tooling and modes

- `.cluster/expert-playbook.md` applies only when operating in the experimental research-cluster mode; the workflow in this file is the default engineering workflow for all CAM LABS work.
- `AGENTS.md` is written to be self-contained so it communicates the workflow regardless of whether the agent runtime auto-loads it.

---

Always work through the full workflow. Observe before deciding, specify before implementing, and measure before reporting done.