# Quote → Order Lifecycle Repair Plan

**Date:** 2026-09-21
**Status:** PROPOSAL — DRY-RUN ONLY. Read-only audit. **No DML was executed.**
**Scope:** Historical `quotes` / `orders` records audited against the fixed lifecycle invariants:

1. A quote must be **Approved** before an order can exist for it.
2. Conversion creates **exactly one** order, whose `reference` equals the quote's `reference`.
3. The customer must **not** be able to convert; only the canonical admin path (`POST /api/v1/admin/orders/from-quote/:quoteId`) may.
4. Orders created from quotes are linked via `orders.quoteId = quotes.id` and `quotes.convertedOrderId = orders.id`.

Audit baseline: DB has **45 orders** and **44 quotes**. All QA records created during verification were removed (**45 / 44 restored**, 0 `qa-%@cam-labs.test` users). One pre-existing `qa-cube.stl` cad file (2026-09-20, `userId` NULL) is left untouched.

---

## 1. Classification Legend

| Class | Meaning |
|---|---|
| **A** | VALID CONVERSION — quote Approved, 1 order, matching reference, correct links. |
| **B** | PREMATURE ORDER — order exists for a quote still "Ready for Approval". |
| **C** | DUPLICATE ORDER — two orders exist for one quote. |
| **D** | LEGACY ORDER — order with no `quoteId` (pre-lifecycle / dev data). Untouched. |
| **E** | STATUS / RELATIONSHIP INCONSISTENCY — overlaps with B (31) and C (2 reference mismatches). |

Totals check: orders 45 = 3 legacy (D) + 7 valid (A) + 31 premature single (B) + 4 from 2 duplicate quotes (C: 2 valid + 2 premature extras). Quotes 44 = 4 unconverted (correct) + 7 valid + 31 premature + 2 duplicate.

---

## 2. Record Inventory

### A — VALID CONVERSIONS (7) — no action

| Quote | Quote ref | Order | Order ref |
|---|---|---|---|
| RFQ-2026-706896 | CAM-2026-372885 | CAM-2026-372885 | CAM-2026-372885 |
| RFQ-2026-368000 | CAM-2026-461116 | CAM-2026-790414 | CAM-2026-461116 |
| RFQ-2026-717136 | CAM-2026-177132 | CAM-2026-968403 | CAM-2026-177132 |
| RFQ-2026-205941 | CAM-2026-650569 | CAM-2026-210818 | CAM-2026-650569 |
| RFQ-2026-693284 | CAM-2026-500204 | CAM-2026-256635 | CAM-2026-500204 |
| RFQ-2026-348400 | CAM-2026-195873 | CAM-2026-313374 | CAM-2026-195873 |
| RFQ-2026-691237 | CAM-2026-278622 | CAM-2026-752850 | CAM-2026-278622 |

All quotes `Approved`, single order each, `orders.reference = quotes.reference`.

### B — PREMATURE SINGLE-QUOTE ORDERS (31 + 2 duplicate extras)

All 31 quotes below are still **"Ready for Approval"** but each has **one order** already (status `In Review`).

| Quote | Quote ref / Order ref | Order created |
|---|---|---|
| RFQ-2026-829225 | CAM-2026-541538 | 2026-08-30 |
| RFQ-2026-106189 | CAM-2026-894787 | 2026-08-30 |
| RFQ-2026-413731 | CAM-2026-496330 | 2026-09-06 |
| RFQ-2026-914232 | CAM-2026-655427 | 2026-09-06 |
| RFQ-2026-989555 | CAM-2026-251273 | 2026-09-10 |
| RFQ-2026-859185 | CAM-2026-828800 | 2026-09-14 |
| RFQ-2026-113480 | CAM-2026-244599 | 2026-09-14 |
| RFQ-2026-578302 | CAM-2026-250104 | 2026-09-14 |
| RFQ-2026-487723 | CAM-2026-332133 | 2026-09-15 |
| RFQ-2026-825770 | CAM-2026-414198 | 2026-09-15 |
| RFQ-2026-201239 | CAM-2026-580503 | 2026-09-15 |
| RFQ-2026-857986 | CAM-2026-213897 | 2026-09-15 |
| RFQ-2026-955843 | CAM-2026-377854 | 2026-09-15 |
| RFQ-2026-391240 | CAM-2026-405088 | 2026-09-15 |
| RFQ-2026-544550 | CAM-2026-624425 | 2026-09-15 |
| RFQ-2026-395632 | CAM-2026-883564 | 2026-09-18 |
| RFQ-2026-261152 | CAM-2026-742299 | 2026-09-18 |
| RFQ-2026-339498 | CAM-2026-304068 | 2026-09-18 |
| RFQ-2026-735578 | CAM-2026-555281 | 2026-09-18 |
| RFQ-2026-179803 | CAM-2026-304760 | 2026-09-18 |
| RFQ-2026-655919 | CAM-2026-444493 | 2026-09-18 |
| RFQ-2026-746209 | CAM-2026-475752 | 2026-09-18 |
| RFQ-2026-167085 | CAM-2026-179345 | 2026-09-18 |
| RFQ-2026-600900 | CAM-2026-337182 | 2026-09-18 |
| RFQ-2026-964191 | CAM-2026-151611 | 2026-09-18 |
| RFQ-2026-862971 | CAM-2026-504242 | 2026-09-18 |
| RFQ-2026-272675 | CAM-2026-844917 | 2026-09-18 |
| RFQ-2026-736562 | CAM-2026-499004 | 2026-09-18 |
| RFQ-2026-417340 | CAM-2026-261485 | 2026-09-18 |
| RFQ-2026-748025 | CAM-2026-751036 | 2026-09-18 |
| RFQ-2026-552132 | CAM-2026-409541 | 2026-09-18 |

### C — DUPLICATE ORDERS (2 quotes, 4 orders) — 2 premature extras

| Quote | Quote ref (canonical) | Valid order | Premature extra (branch) |
|---|---|---|---|
| RFQ-2026-261639 | CAM-2026-566096 | CAM-2026-566096 | **CAM-2026-306669** (ref = own id, mismatch) |
| RFQ-2026-360569 | CAM-2026-706287 | CAM-2026-706287 | **CAM-2026-648957** (ref = own id, mismatch) |

The two **premature extras** are the only orders whose `reference` does not equal the quote's canonical reference (E). Their child records: `order_events` 4, `order_cad_files` 3, `manufacturing_requests` 2; 0 notifications / audit logs.

### D — LEGACY ORDERS (3) — no `quoteId`, untouched

| Order | Status | Created |
|---|---|---|
| CAM-2026-2072 | In Review | 2026-08-17 |
| CAM-2026-4341 | In Review | 2026-08-17 |
| CAM-2026-8894 | In Production | 2026-08-27 |

### UNCONVERTED QUOTES (4) — correct state, no action

RFQ-2026-654821, RFQ-2026-530419, RFQ-2026-573354, RFQ-2026-315034 — "Ready for Approval", `convertedOrderId` NULL, no orders. **Status is now enforced at the code level.** Any of these can still be converted via the canonical admin endpoint.

---

## 3. Repair Buckets

### 3.1 SAFE-AUTO (deterministic, reversible with backup; requires explicit approval)

**R1 — Remove duplicate premature branch orders (C).**
`CAM-2026-306669` and `CAM-2026-648957` are demonstrably premature duplicates (each quote already has its canonical order). Back up, then delete child rows and the orders. Quotes keep `convertedOrderId` = canonical order; reference mismatch disappears with the branch.

Dry-run preview (must NOT run as-is):

```sql
-- PREVIEW (read-only)
SELECT 'orders' t, count(*) FROM orders WHERE id IN ('CAM-2026-306669','CAM-2026-648957');
-- expect 2; quotes after: convertedOrderId points to CAM-2026-566096 / CAM-2026-706287
```

**R2 — Align quote status for premature orders IF business keeps the order (B, conditional).**
If management decides the 31 existing premature orders are to be retained, set those quotes to `Approved` (mirrors the state the canonical conversion would have produced). This is the *only* deterministic status repair.

Dry-run preview:

```sql
-- PREVIEW (read-only): list 31 quotes in state 'Ready for Approval' with convertedOrderId != NULL
SELECT id, reference FROM quotes
WHERE status = 'Ready for Approval' AND convertedOrderId IS NOT NULL
  AND id NOT IN ('RFQ-2026-261639','RFQ-2026-360569');
-- expect 31 rows (the B table above)
```

### 3.2 AMBIGUOUS / MANUAL (per-record business decision required)

- **The 31 premature orders themselves (B):** keep, cancel, or delete? They have real child records (`order_cad_files`, `order_events`, `manufacturing_requests` for at least the 09-14 batch). Deleting would remove production/manufacturing traces; cancelling is reversible. **Decision needed per order** before any DML.
- **Reference policy:** for any *retained* premature order, decide whether its `reference` field should be canonicalized (currently it equals its own order id — harmless post-fix since prefixes are the same) or left as-is for traceability.
- **Notifications/audit:** the two duplicate quotes produced no notifications/audit rows; if a re-run of canonical conversion is desired for clarity, that is an option, not a repair.

### 3.3 LEGACY-UNTOUCHED

`CAM-2026-2072`, `CAM-2026-4341`, `CAM-2026-8894` (parent user `persona-1` / `f15a2047-f7d3-44d8-b2e8-6e2040f5c1bb`) — pre-lifecycle/dev data with no `quoteId`. No FK on `orders.quoteId`, so they do not violate any invariant. **No action.**

---

## 4. Guardrails for any future execution

- Run in a transaction; take a logical backup (`pg_dump --table=quotes --table=orders --table=order_cad_files --table=order_events --table=manufacturing_requests`) first.
- Re-verify after each bucket: total orders 45→43 (R1 only), quotes 44 (unchanged), no dangling `convertedOrderId`.
- Never touch the QA/`persona-` users or the `qa-cube.stl` cad file.
- Re-run idempotency guard: `double-conversion` (409) and `customer convert` (403) are covered by automated tests in `tests/quote-order-separation.test.ts`, `phase04.order-routes.integration.test.ts`, `phase04.order-boundary.test.ts`.

---

## 5. Verification Evidence (already executed in this session)

- Backend suite: 28 files passed / 1 skipped, 323 tests passed / 13 skipped; `tsc --noEmit` clean.
- Frontend suite: 24 files / 293 tests passed; `tsc --noEmit` clean; production build OK.
- Live E2E on the fixed server (port 5001, rebuilt dist): customer register + CAD upload → quote `RFQ-2026-288639` (Ready) → customer convert 403 → admin convert 201 (`CAM-2026-905796`, ref matches) → repeat convert 409 → second quote `RFQ-2026-602001` rejected → convert 403. Browser-rendered dashboard (CDP, real session cookie) confirmed dashboard separation (orders=1 in Recent Orders; quotes=2 in Recent Quotes).
- All session QA records deleted; DB returned to 45 orders / 44 quotes.