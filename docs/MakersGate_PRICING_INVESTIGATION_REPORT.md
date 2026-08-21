# MakersGate Pricing Investigation and CAM LABS Validation Report

Date: 2026-08-20
Status: Reference experiment blocked before quote calculation

## Executive Finding

The live MakersGate configurator was opened and used through its real browser flow. The FDM path was reachable and required an STL upload. The upload analysis request did not complete, so no live MakersGate price was produced. Consequently, there is no defensible MakersGate baseline, experimental matrix, or observed pricing formula in this report.

No MakersGate pricing formula was invented or copied from CAM LABS's existing implementation.

## MakersGate Findings

### Flow reached

Observed through the live UI:

- URL: `https://makersgate.co/get-quote/config`
- Technology: `3D Printing (Additive Manufacturing)`
- Process: `FDM (Fused Deposition Modeling)`
- Supported format for this process: `STL`
- Configurator steps shown: Technology, Upload, File Setup, Material, Config, Review

### Upload evidence

Primary candidate:

| Field | Observed value |
| --- | --- |
| File | `Caballo+ajedrez+tematico+Imperio+Maya+STl.stl` |
| Type | STL; local `file` inspection reported generic binary data |
| Size | 23,456,084 bytes (22.37 MiB) |
| Geometry dimensions | Not available because analysis did not complete |
| Volume / surface area / facet count | Not available because analysis did not complete |

The primary upload remained at `1 uploading` after waiting 12 seconds. No quote or configuration state was reached.

A focused retry with the existing `Drawing273.stl` candidate produced stronger network evidence:

- File size shown by MakersGate: 1.64 MB
- Request: `POST https://api.makersgate.co/api/files/analyze/?save=true`
- UI state after 8 seconds: `1 analyzing`, `95%`
- Browser event: `requestFailed`, `net::ERR_ABORTED`
- Result: no analyzed geometry and no price

### Baseline and controlled experiments

Not performed because the reference configurator never reached a quote. Therefore the following are intentionally unavailable, not inferred:

- MakersGate Baseline A
- Technology/material/quality/layer-height/infill/wall/support/finish/quantity/color price deltas
- Quantity tests for 1, 2, 5, 10, and 20
- Price breakdown, material usage, print time, or production data
- MakersGate formula or confidence estimates

## CAM LABS Findings

The local CAM LABS engine was not changed to imitate an unobserved MakersGate formula.

The existing local implementation is configured as:

```text
material cost = slicer material volume * configured material density * configured EGP/gram rate
machine cost = slicer print time in hours * configured EGP/hour machine rate
labor cost = configured production/post-processing minutes * configured EGP/hour labor rate
setup cost = configured setup minutes * labor rate + setup consumables
manufacturing cost = material + machine + labor + setup + finish cost
final price = manufacturing cost + minimum-order adjustment
```

This is **Configured**, not **Observed from MakersGate**. The engine remains backend-authoritative, EGP-based, configuration-driven, slicer-backed, deterministic, and fail-closed for unsupported or incomplete geometry.

### Local slicer validation

Focused test: `backend/tests/cam-labs.pricing-engine.test.ts`

- 5 tests passed
- EGP currency verified
- Actual material usage and machine time sources verified
- Layer count changes when manufacturing parameters change
- Support-volume behavior verified
- Material density and EGP material rate differences verified
- Missing geometry, unsupported technology, invalid layer height, missing slicer input, and malformed model failures verified

These tests use the repository tetrahedron fixture and are not a MakersGate comparison. The requested shared-model comparison could not be reached because MakersGate analysis failed.

## UI Changes

Added a shared localized estimated-price notice to customer-visible price surfaces in the active React application:

- Manufacturing request sidebar and quote summary
- Dashboard order totals
- Dashboard quote unit and total prices
- Home marketplace cards
- Marketplace product price and request summary

The notice uses the existing localization system:

- English: `Estimated price - final price will be confirmed by CAM LABS.`
- Arabic: `السعر تقديري - سيتم تأكيد السعر النهائي من CAM LABS.`

When a quote request starts, the previous quote is already cleared by the request state. The quote surface now also shows a subtle animated calculating indicator while the latest request is pending. Existing abort-controller and request-version guards continue to cancel superseded requests and ignore stale responses.

## Browser Validation

Validated against the local browser application:

| Language | Viewports | Result |
| --- | --- | --- |
| English | 1440, 834, 390 | No horizontal overflow; four visible home marketplace notices |
| Arabic | 390 | `dir="rtl"`; Arabic notice visible; no horizontal overflow |

The manufacturing quote animation could not be observed with a real quote because the reference upload/analysis prerequisite was unavailable in the local unauthenticated session. The component state and build were validated.

## Model Corpus Limitations

The requested corpus of 20 legitimate real-world models was not assembled. The reference upload blocker prevented the required upload/analyze/calculate/verify sequence, and no fabricated prices or duplicate fixtures were counted as corpus results.

## Remaining Limitations

1. MakersGate did not produce a quote in the available live session because its analysis request aborted.
2. No MakersGate setting can be classified as price-affecting or price-neutral from evidence collected here.
3. No economic equivalence claim can be made between MakersGate and CAM LABS.
4. No CAM LABS pricing formula was changed based on MakersGate because there was no verified reference formula.
5. A complete investigation requires a successful MakersGate upload/analysis response, the same STL accepted by both systems, and repeated one-variable-at-a-time quote captures.

## Final Validation Rerun

- `npm run build --workspace=frontend`: passed. Vite emitted only the existing large-chunk warning.
- `npm run build --workspace=backend`: passed as part of the workspace build.
- Focused `cam-labs.pricing-engine.test.ts`: 5 tests passed.
- Full backend suite: 6 suites passed, 1 skipped, and 2 suites failed. The failures were the existing isolated-database guard in `auth.database.test.ts` (`DATABASE_URL` was not pointed at `cam_labs_phase02_test`) and two auth route tests returning HTTP 400 instead of their expected 201/409 responses. These failures do not exercise the pricing engine.
- Final live MakersGate browser check: still redirected to `/get-quote/technology` and displayed `Loading quotes...`; no quote controls, price, or pricing response became available.
- Focused local browser check: local app loaded without horizontal overflow at the active manufacturing route. The existing report's English/Arabic responsive checks remain the only completed UI matrix because an unauthenticated session cannot reach a real local quote without a processed upload.