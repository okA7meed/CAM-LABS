# CAM LABS Phase 01 Audit

Audit date: 2026-08-16  
Scope: the complete workspace, including the active React application, Express API, Prisma schema, shared types, duplicated static surfaces, legacy implementation, styles, assets, configuration, and provider integrations.

## Executive Summary

CAM LABS is a compilable early MVP, not a production platform. The active product is a React 18/Vite SPA backed by an Express REST API and a Prisma/PostgreSQL schema. The frontend is visually developed, but authentication, persistence, CAD processing, and manufacturing execution are not production implementations. The backend's quote and order orchestration is coupled to a SeekMake adapter and uses a simulated Native CAM LABS adapter as its only independent alternative.

The repository has no git metadata in the supplied workspace, no automated test runner, no route-based frontend router, no localization system, and no database migration history. The application builds successfully, but its runtime foundation is unsafe for production: login is unconditional, protected resources have no authentication middleware, environment configuration contains credential-like defaults, and database connection failure is only logged while request code continues toward Prisma calls.

Phase 01 therefore documents the current state, establishes explicit boundaries, and removes secret-shaped defaults from the checked-in environment template. It intentionally does not implement authentication, a native manufacturing engine, a new database model, or the full platform.

## 1. Project Inventory

| Path | Purpose and current use | Classification | Disposition |
|---|---|---|---|
| `package.json` | npm workspace orchestration and build/lint scripts | Real / incomplete | Preserve; add test and schema-validation scripts in the foundation work |
| `frontend/` | Active React/Vite application | Partially functional | Preserve; evolve toward route-based domain areas |
| `frontend/src/App.tsx` | View switcher for landing, dashboard, and profile | UI only / incomplete | Preserve visual composition; replace view switching with routing incrementally |
| `frontend/src/components/` | Auth, configurator, dashboard, explorer, home, layout, and profile UI | Mostly UI only | Preserve reusable presentation; connect to authenticated API contracts |
| `frontend/src/context/` | Local auth and store state | Mock/demo | Refactor after real auth and server state contracts exist |
| `frontend/src/services/api.ts` | Browser API client | Partially functional | Preserve; add typed error/loading/auth handling |
| `frontend/src/hooks/useCadViewer.ts` | CAD viewer hook | UI/demo surface | Preserve as an adapter boundary; add real file lifecycle later |
| `frontend/src/data/` | Demo personas/material/order data | Mock/demo | Keep only as explicit demo fixtures; never use as production source of truth |
| `frontend/src/styles/` | Active React CSS source | Real presentation layer | Preserve; consolidate duplicate copies only after deployment target is documented |
| `frontend/public/assets/` | Vite-served frontend assets | Real/static | Preserve and inventory licensing/source metadata |
| `backend/src/app.ts` | Express middleware and route registration | Real / incomplete | Preserve; add auth middleware, request validation, and production CSP policy |
| `backend/src/server.ts` | API process entry point | Real / incomplete | Preserve; make startup/config/database health explicit |
| `backend/src/routes/` | REST route handlers | Partially functional | Preserve boundaries; add schemas, authorization, and consistent status codes |
| `backend/src/services/` | Quote, order, pricing, and CAD orchestration | Partially functional | Preserve domain boundaries; remove provider coupling from domain contracts |
| `backend/src/config/env.ts` | dotenv loading and environment values | Unsafe foundation | Refactored in this phase to remove credential-shaped defaults |
| `backend/src/config/database.ts` | Lazy Prisma client and connection attempt | Incomplete / risky | Fix fail-fast production behavior in foundation/auth phase |
| `backend/src/providers/manufacturing/` | Manufacturing provider interface and implementations | Partially functional / mock | Preserve interface; retire SeekMake implementation and replace Native placeholder later |
| `backend/src/database/prisma/schema.prisma` | PostgreSQL data model | Partially functional | Preserve; add migrations and domain constraints incrementally |
| `backend/src/database/prisma/seed.ts` | Demo seed data | Mock/demo | Preserve for local demo only; never use as production bootstrap |
| `backend/src/utils/` | Errors, response formatting, and logging | Real / incomplete | Preserve; standardize structured context and redaction |
| `shared/` | Shared TypeScript domain/API types | Real / incomplete | Preserve; add runtime DTO schemas and provider-neutral enums |
| `assets/`, root `css/`, root `js/` | Static/previous application surfaces | Unclear / duplicated | Archive after deployment ownership is confirmed; do not delete in Phase 01 |
| `legacy/` | Complete vanilla JS predecessor | Unused / legacy | Preserve as reference for now; document and archive before removal |
| root `index.html` | Static duplicate of the application shell | Unclear / duplicated | Keep until hosting/deployment target is decided; designate one canonical entry point |

## 2. Current Architecture

### Frontend

| Concern | Observed implementation | Assessment |
|---|---|---|
| Framework/build | React 18, TypeScript, Vite 5 | Appropriate foundation |
| State | `AuthContext`, `StoreContext`, component state, `localStorage` | Suitable for UI state; not a server-state/auth solution |
| Routing | `activeView` conditional rendering in `App.tsx` | Does not scale to customer/maker/admin areas |
| API | `/api/v1` client with Vite proxy | Useful boundary, but auth and error contracts are incomplete |
| Styling | Hand-authored CSS in `frontend/src/styles` | Existing CAM LABS visual direction is preserved |
| UI library | No component/icon library identified | Low dependency risk; accessibility is hand-maintained |
| Localization | No i18next, translation resources, language detection, or RTL handling | Missing |

### Backend

| Concern | Observed implementation | Assessment |
|---|---|---|
| Runtime/framework | Node.js, Express 4, TypeScript, CommonJS output | Appropriate MVP foundation |
| Routes | Health, auth, materials, CAD, quotes, orders, manufacturing | Clear initial boundaries; handlers lack validation/auth |
| Services | Quote/order orchestration and pricing service | Useful separation; provider assumptions leak into domain text/types |
| Validation | Manual required-field checks only | Insufficient; add runtime schemas before expanding API |
| Authentication | No token verification or authorization middleware | Broken for any protected use case |
| Errors/logging | Shared response helper, custom errors, logger | Good starting point; health and errors overstate readiness |
| Infrastructure | No queues, object storage, email, payments, shipping, monitoring, or deployment config | Not implemented |

### Database

PostgreSQL is declared through Prisma 5.22.0. The schema contains `User`, `Material`, `Order`, `Quote`, and `CadFile`, with user relations and `onDelete: SetNull` for optional ownership. Most business values are strings, including roles, technologies, statuses, money, dates, and provider names. Orders and quotes have timestamps, but several domain dates are stored as strings. There is no migration directory visible in the workspace, no schema validation npm script, and no indexes beyond primary/unique keys.

The model is adequate for an MVP read/write shape but not yet for the target platform. The next schema iterations should add explicit money/date types, provider-neutral status enums, ownership constraints, quote/order lifecycle invariants, and indexes only when a real access pattern exists. Do not add all future marketplace, payment, production, and messaging models now.

## 3. Feature Matrix

| Feature | Classification | Evidence | Main gap |
|---|---|---|---|
| Authentication | **E. PLACEHOLDER / F. BROKEN** | `auth.routes.ts` returns tokens without checking credentials; `AuthContext` starts authenticated with a demo persona | Password hashing, persistence, token verification, expiry, logout, verification, reset, RBAC |
| User profile | **C. UI ONLY / D. MOCK** | Profile state is local and update endpoint echoes request body | Authenticated user ownership and persisted profile updates |
| Dashboard | **C. UI ONLY** | Dashboard renders local/store data and API-shaped views | Server-owned queries, authorization, loading/error/empty states |
| CAD upload | **B. PARTIALLY FUNCTIONAL** | Routes register metadata and validate format; no object storage or parser pipeline | Actual upload, virus scanning, metadata extraction, durable file/version lifecycle |
| CAD viewer | **D. MOCK / DEMO** | Hook/component surface exists, but no verified file-processing backend | Secure preview generation and supported-format processing |
| CAD analysis/DFM | **B. PARTIALLY FUNCTIONAL** | `cadValidation.service.ts` provides pre-flight checks | Real geometry/DFM engine, persisted reports, reproducibility |
| Materials explorer | **C. UI ONLY / D. MOCK** | Frontend and route data are static/demo catalog records | Database-backed catalog, lifecycle/versioning, localized content |
| Configurator | **B. PARTIALLY FUNCTIONAL** | UI calls quote API and can fall back to local estimation | Single authoritative pricing path and durable quote context |
| Pricing | **B. PARTIALLY FUNCTIONAL** | Backend fee normalization exists; frontend also estimates | Native rules engine, money arithmetic, versioned pricing inputs |
| Quotes | **B. PARTIALLY FUNCTIONAL** | Prisma create/read and provider quote call exist | Auth ownership, state transitions, idempotency, auditability |
| Orders | **B. PARTIALLY FUNCTIONAL** | Prisma create/read and provider dispatch call exist | Auth ownership, transactions, payment, production lifecycle, idempotency |
| Manufacturing provider | **D. MOCK / DEMO** | SeekMake adapter is primary; Native adapter returns simulated values | Native CAM LABS manufacturing engine |
| Database persistence | **B. PARTIALLY FUNCTIONAL** | Prisma schema/client exist; seed exists | Migrations, required DB health, no silent fallback, integration tests |
| API endpoints | **B. PARTIALLY FUNCTIONAL** | Routes compile and are registered | Runtime validation, auth, consistent contract/error semantics |
| Localization | **E. PLACEHOLDER** | English hardcoded UI; no i18n/RTL system | English/Arabic resources, locale persistence, direction handling |

## 4. SeekMake Dependency Report

SeekMake is not an acceptable final dependency. It is currently embedded in the provider factory, provider interface unions, quote/order services, route messages, Prisma defaults/comments, environment configuration, and frontend configurator terminology. The current abstraction is reusable, but the implementation and provider-specific vocabulary are not.

| Area | Current state | Phase 01 decision |
|---|---|---|
| Provider interface | Generic shape, but unions and comments name SeekMake | Preserve boundary; rename to provider-neutral contracts in the manufacturing-engine phase |
| Factory | Defaults to `SeekMake` for unknown values | Do not add new SeekMake usage; make provider selection explicit and fail on unsupported values |
| SeekMake adapter | External API calls and simulated mode | Mark for removal/replacement; no new features or credentials |
| Native adapter | Placeholder with simulated quote/order values | Preserve only as a temporary development boundary; it is not production functionality |
| Quote/order services | Orchestration logs and user messages mention SeekMake | Replace wording with provider-neutral/native domain language before production |
| Prisma | `provider` defaults and refs are SeekMake-shaped | Migrate to native/provider-neutral fields during a planned schema migration |
| Frontend | Configurator describes provider-backed calculation | Keep user-facing flow; remove provider identity from customer UI |
| Environment | SeekMake endpoint/key were in `.env.example` | Removed from the safe template in this phase |

Target dependency direction:

```text
CAM LABS API
  -> Manufacturing application service
    -> Native manufacturing engine
    -> Native pricing engine
    -> Native quotation engine
    -> Native production engine
```

The provider port may remain as an internal boundary for testing and future factory nodes, but the final product must not require SeekMake at runtime or in its data model.

## 5. Security Audit

| Finding | Severity | Path | Why it matters | Action |
|---|---|---|---|---|
| Login/register accept arbitrary input and issue mock tokens | Critical | `backend/src/routes/auth.routes.ts`, `frontend/src/context/AuthContext.tsx` | Any client can impersonate a user | Fix in Phase 02 |
| No auth middleware protects quotes, orders, CAD, or profile | Critical | `backend/src/app.ts`, `backend/src/routes/` | Users can read/write without identity or ownership checks | Fix in Phase 02 |
| Credential-shaped JWT/provider defaults existed in source/config | High | `backend/src/config/env.ts`, `.env.example` | Defaults can be mistaken for deployable credentials | Remove defaults; require explicit production configuration |
| Database failure does not fail startup or health | High | `backend/src/config/database.ts`, `health.routes.ts` | Production can advertise operational status while persistence is unavailable | Fix in foundation hardening |
| Shipping address is hardcoded in order creation | High | `backend/src/services/orders.service.ts` | Customer data and order destination are incorrect/insecure | Fix with authenticated order/shipping model in later phase |
| CSP is disabled unconditionally | Medium | `backend/src/app.ts` | Reduces browser defense against injected content | Enable a tested production policy |
| Demo persona and profile data are stored in localStorage | Medium | `frontend/src/context/AuthContext.tsx` | Browser state is not identity, authorization, or durable data | Replace after auth implementation |
| No rate-limit tiers or audit trail | Normal | `backend/src/app.ts`, `backend/src/utils/` | Sensitive operations lack abuse/compliance context | Add with auth/business platform |

No real secrets were intentionally added. Environment templates contain placeholders only; production secrets must be supplied by deployment configuration or a secret manager.

## 6. Legacy Audit

`legacy/` is a complete vanilla HTML/JS/CSS predecessor, while root `index.html`, root `css/`, and root `js/` are additional static surfaces outside the active Vite entry point. They are useful for recovering product behavior and visual intent, but they duplicate the current React implementation and are not part of the configured workspace build. They should be archived or removed only after the deployment target and historical retention policy are recorded. No legacy code was merged or deleted in Phase 01.

## 7. Localization Audit

There is no i18next, translation catalog, language detector, locale persistence, or RTL direction handling. UI strings are hardcoded in React/HTML/JS and database fields contain display content directly.

Recommended boundary:

* UI localization: frontend message catalogs for `en` and `ar`, persisted locale preference, and `dir="ltr"`/`dir="rtl"` at the document root.
* Database content localization: localized domain records or translation tables only where business content truly needs multiple authored languages. Do not put UI keys in the database.

Localization should be introduced before route/domain expansion so new screens do not deepen the hardcoded-string inventory.

## 8. Build and Test Results

| Check | Result | Notes |
|---|---|---|
| `npm run build` | PASS | Shared, backend, and frontend compile; Vite production bundle generated |
| `npm run lint` | PASS | Both workspace lint scripts are TypeScript no-emit checks |
| `npm --workspace=backend run prisma:generate` | PASS | Prisma Client generated |
| `npm --workspace=backend run prisma:validate` | PASS with explicit URL | The script was added in Phase 01; validation succeeds when `DATABASE_URL` is supplied |
| `npx prisma validate --schema=...` | BLOCKED without env, PASS with explicit URL | Prisma correctly requires `DATABASE_URL`; no database connection is needed for schema validation |
| Automated tests | NOT CONFIGURED | No test script or `*.test`/`*.spec` files found |
| Frontend runtime probe | PASS | `http://localhost:3000/` returned HTTP 200 |
| Backend runtime/health probe | BLOCKED | Port `5000` is occupied by macOS AirTunes and returned HTTP 403; the CAM LABS API was not running |
| API/database integration | NOT VERIFIED | Requires a free API port and running PostgreSQL; current code does not make DB health authoritative |

## 9. Environment Report

| Variable | Purpose | Required | Current policy |
|---|---|---:|---|
| `NODE_ENV` | Runtime mode | Yes | `development`, `test`, or `production` |
| `PORT` | API listen port | No | Defaults to `5000` |
| `DATABASE_URL` | Prisma PostgreSQL connection | Yes outside local demo | Must be supplied for test/production |
| `JWT_SECRET` | Future token signing secret | Yes for auth-enabled environments | No source fallback; configure before Phase 02 |
| `CORS_ORIGIN` | Browser origin allow-list | Yes in deployment | Explicitly configure per environment |
| `ACTIVE_MANUFACTURING_PROVIDER` | Temporary development adapter selection | Yes for demo | Safe template selects explicit `NativeCAMLabs` placeholder |
| `CAM_LABS_SERVICE_FEE_RATE` | Pricing rule | No | Existing default is 9%; must become versioned business config later |

SeekMake endpoint/key variables are intentionally absent from the safe template. Existing local environments containing them should be rotated/removed and must not be copied into production.

## 10. Completion Estimate

These are architecture-readiness estimates, not product claims.

| Subsystem | Estimate | Reason |
|---|---:|---|
| Visual frontend shell | 65% | Broad screens and styling exist |
| Frontend platform architecture | 25% | No real routing, server-state model, localization, or auth |
| Backend API structure | 45% | Routes/services/error utilities exist, but contracts/security are incomplete |
| Authentication/security | 5% | UI and mock endpoints only |
| Database foundation | 30% | Initial schema/client exist; migrations and lifecycle constraints are absent |
| CAD processing | 15% | Metadata/validation surfaces only |
| Native manufacturing | 5% | Placeholder adapter only |
| Pricing/quotations | 25% | Simulated/provider-dependent MVP flow |
| Orders/production | 15% | Basic records/provider dispatch; no native production lifecycle |
| Localization | 0% | Not implemented |
| Testing/operations | 5% | Build checks only; no tests or deployment/observability foundation |

## 11. Gap Analysis

| Priority | Gaps |
|---|---|
| Critical | Real authentication and authorization; mandatory database health; removal of SeekMake runtime/data dependency; actual file storage/processing; tests for quote/order/auth invariants |
| Important | Route-based frontend architecture; runtime request validation; migrations; native pricing/quotation contracts; money/date normalization; audit logging; production CSP; server-owned state |
| Normal | English/Arabic localization and RTL; materials administration; maker and production workflows; object-storage lifecycle; notifications; better loading/error/empty states |
| Future | Marketplace, engineering services, payments, shipping, returns, reviews, messaging, affiliates, analytics, multi-node scheduling, advanced DFM/CAD engines |

## 12. Target Architecture

Use a modular monolith first, with ports around high-change or infrastructure-heavy domains:

```text
React/Vite web app
  -> route areas: customer, maker, admin, marketplace, services, orders, quotes, profile, settings
  -> typed API client and query/cache layer
  -> locale/message layer (en/ar + RTL)

Express application
  -> authentication/RBAC middleware
  -> domain modules: identity, CAD, materials, manufacturing, pricing, quotes,
     orders, production, maker, services, marketplace, payments, shipping,
     notifications, messaging, admin, analytics
  -> application services and provider ports
  -> Prisma repositories + PostgreSQL

Infrastructure ports
  -> object storage for CAD/files
  -> CAD/DFM workers
  -> native manufacturing/pricing/quotation/production engines
  -> payment/shipping/email providers
  -> queue/job runner, cache, metrics, logs, audit sink
```

Keep asynchronous CAD processing, production scheduling, notifications, and analytics behind jobs/events. Keep customer-facing quote/order commands transactional and idempotent. Add separate services only when scale or operational ownership requires it; do not distribute the MVP prematurely.

## 13. Dependency Map and Roadmap

1. **Phase 01: Foundation, audit, and stabilization.** Establish environment policy, canonical entry points, schema validation, test harness, health semantics, provider-neutral contracts, and documentation.
2. **Phase 02: Authentication, users, and RBAC.** Persist users, hash passwords, issue/verify expiring tokens or sessions, add ownership checks, roles, permissions, verification, reset, and audit events.
3. **Phase 03: CAD and file processing.** Add object storage, secure upload, file scanning, format metadata extraction, CAD analysis jobs, DFM reports, and versioned file records.
4. **Phase 04: Native manufacturing engine.** Replace SeekMake with native process/material/machine capability models and production routing ports.
5. **Phase 05: Pricing and quotation engine.** Centralize money math and versioned pricing rules; persist quote inputs, revisions, validity, and approvals.
6. **Phase 06: Customer platform.** Convert the dashboard/profile into authenticated route areas with server-owned state and localization.
7. **Phase 07: Orders and production.** Add transactional quote conversion, order state machine, production jobs, quality gates, and customer tracking.
8. **Phase 08: Maker platform.** Add maker applications, machines, capacity, materials, work queues, and maker permissions.
9. **Phase 09: Engineering services.** Add service requests, briefs, deliverables, collaboration, and billing boundaries.
10. **Phase 10: Marketplace.** Add products, catalog, cart, wishlist, reviews, inventory, and seller workflows.
11. **Phase 11: Admin and business platform.** Add moderation, configuration, support, audit views, analytics dimensions, and business reporting.
12. **Phase 12: Payments, shipping, notifications, analytics, QA, and production.** Integrate external providers behind ports, harden operations, run security/load/accessibility testing, and deploy.

## 14. Phase 01 Change Boundary

### Changed

* Added this audit as the source of truth for the current foundation and roadmap.
* Updated the environment template to avoid credential-shaped SeekMake/JWT defaults and to make demo provider selection explicit.
* Updated environment parsing so security credentials are not silently invented by application code.

### Intentionally not changed

* No Phase 02 authentication implementation.
* No deletion of legacy/static files.
* No schema expansion for future domains.
* No new mock business functionality.
* No implementation of the native manufacturing, pricing, production, payment, marketplace, or localization systems.
* No database migration was generated because the environment does not establish a database or a confirmed migration policy.

### Exact next step

Implement Phase 02 identity foundations behind tests: choose session versus JWT architecture, add password hashing and persistent users, add authentication middleware and RBAC, then migrate frontend auth state away from the demo persona. Before that work, add a test runner and a database-backed test environment so auth behavior is verifiable.
