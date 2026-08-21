# Live Pricing Experiment Report

Date: 2026-08-20

Primary reference: https://makersgate.co/get-quote/config

Secondary benchmark: https://craftcloud3d.com/en/upload

## MakersGate Findings

### Model and readiness

| Field | Observed value |
| --- | --- |
| Model | `Caballo+ajedrez+tematico+Imperio+Maya+STl.stl` |
| Format | STL |
| File size | 22.37 MB |
| Dimensions | 37 x 37 x 75.16 mm |
| Volume | 29,041.48 mm3 |
| Surface area | 7,744.10 mm2 |
| Triangle count | 469,120 |
| Upload state | `1 uploading` -> `1 analyzing` at 51%/95% -> `1/1 ready` |
| Technology | 3D Printing (Additive Manufacturing) |
| Process | FDM (Fused Deposition Modeling) |

The file was selected with `setInputFiles`, then monitored until the site reported `1/1 ready`. The upload took approximately 4 seconds and geometry analysis completed approximately 6 seconds later. The file-setup page displayed the dimensions, volume, surface area, triangle count, and a 3D model viewer before the quote workflow continued.

### Baseline A

| Setting | Baseline |
| --- | --- |
| Material | PLA |
| Profile/quality | Standard |
| Layer height | N/A; not exposed by the live configurator |
| Infill | 15% (Standard) |
| Walls | Standard (3 walls) |
| Supports | N/A; not exposed |
| Surface finish | N/A; not exposed |
| Color | Any |
| Quantity | 1 |
| Machine/printer/nozzle | N/A; not exposed |
| Displayed configuration price | **EGP 60.20** |
| Currency | EGP |
| Review item subtotal | 60.20 EGP |
| Review estimated total | 500.00 EGP because of the order minimum |

The live configuration card displayed `EGP 60.20`. The review step independently displayed a 60.20 EGP item subtotal and a 500.00 EGP estimated total, including a 500.00 EGP order minimum. These are recorded as separate values.

### One-variable experiments

All changes were made from the restored Standard baseline. Each changed value was allowed to settle before recording, and the baseline was restored after each series.

#### Print profile

| Variable | Old | New | New price | Difference |
| --- | --- | --- | ---: | ---: |
| Profile | Standard | Lightweight | 48.55 EGP | -11.65 EGP (-19.35%) |
| Profile | Standard | Strong | 85.24 EGP | +25.04 EGP (+41.59%) |
| Profile | Standard | Solid | 140.74 EGP | +80.54 EGP (+133.79%) |
| Profile | Standard | Standard | 60.20 EGP | 0.00 EGP (0.00%) |

The profiles exposed 10%/2 walls, 15%/3 walls, 30%/5 walls, and 100%/5 walls respectively. A separate advanced-control trial showed that the profile price is not identical to the directly selected infill price at every combination.

#### Infill

| Variable | Old | New | New price | Difference |
| --- | --- | --- | ---: | ---: |
| Infill | 15% | 0% (Hollow) | 46.09 EGP | -14.11 EGP (-23.44%) |
| Infill | 15% | 10% (Sparse) | 55.50 EGP | -4.70 EGP (-7.81%) |
| Infill | 15% | 15% (Standard) | 60.20 EGP | 0.00 EGP (0.00%) |
| Infill | 15% | 30% (Moderate) | 74.30 EGP | +14.10 EGP (+23.42%) |
| Infill | 15% | 50% (Dense) | 93.11 EGP | +32.91 EGP (+54.67%) |
| Infill | 15% | 75% (Very Dense) | 116.62 EGP | +56.42 EGP (+93.72%) |
| Infill | 15% | 100% (Solid) | 140.13 EGP | +79.93 EGP (+132.77%) |

#### Walls

| Variable | Old | New | New price | Difference |
| --- | --- | --- | ---: | ---: |
| Walls | 3 | 1 (Single) | 47.05 EGP | -13.15 EGP (-21.84%) |
| Walls | 3 | 2 (Light) | 53.62 EGP | -6.58 EGP (-10.93%) |
| Walls | 3 | 3 (Standard) | 60.20 EGP | 0.00 EGP (0.00%) |
| Walls | 3 | 4 (Strong) | 66.77 EGP | +6.57 EGP (+10.91%) |
| Walls | 3 | 5 (Heavy Duty) | 73.35 EGP | +13.15 EGP (+21.84%) |

#### Material

| Variable | Old | New | New price | Difference |
| --- | --- | --- | ---: | ---: |
| Material | PLA | PLA | 60.20 EGP | 0.00 EGP (0.00%) |
| Material | PLA | ABS | 63.11 EGP | +2.91 EGP (+4.83%) |
| Material | PLA | PETG | 77.07 EGP | +16.87 EGP (+28.02%) |
| Material | PLA | TPU | 146.85 EGP | +86.65 EGP (+143.94%) |

#### Color

Any, Black, White, Red, Blue, Green, Yellow, Orange, Purple, and Gray were each selected individually from PLA/Standard/15%/3 walls. Every observed configuration price was 60.20 EGP. Color was therefore price-neutral in this trial.

#### Quantity

Quantity was changed in the review step and allowed to settle to a non-calculating state after each change. The item subtotal was linear in this range; the order minimum masked totals for quantities 1, 2, and 5.

| Quantity | Item subtotal | Estimated total |
| ---: | ---: | ---: |
| 1 | 60.20 EGP | 500.00 EGP |
| 2 | 120.40 EGP | 500.00 EGP |
| 5 | 301.00 EGP | 500.00 EGP |
| 10 | 602.00 EGP | 602.00 EGP |
| 20 | 1,204.00 EGP | 1,204.00 EGP |

Observed quantity behavior is linear item pricing plus a minimum-order adjustment, not a tested quantity discount.

#### Geometry and other controls

The live file-setup page exposed unit buttons (`mm`, `cm`, `in`, `m`) and X/Y/Z dimension inputs. A controlled X-dimension probe was restored from 40 to 37 before continuing. The displayed analyzed volume remained 29,041.48 mm3 and the restored configuration returned at 60.21 EGP rather than the earlier 60.20 EGP. Because the dimension change did not produce a confirmed geometry/quote transition in the live UI, its price effect is recorded as **N/A/inconclusive**, not inferred.

Technology had only one available process (FDM). Machine, printer, nozzle, supports, layer height, surface finish, orientation, tolerance, and delivery/manufacturing add-ons were not exposed as selectable controls in this live flow and are therefore N/A.

## Craftcloud3D Findings

Craftcloud was used as a secondary marketplace benchmark for the same horse STL. It required a location/unit confirmation; Egypt and millimeters were retained. The upload progressed from visible progress (`70%`, `83%`, `97%`) to `Analyzing`, then the model card stabilized with `Ready` and `See Materials & Prices`. Craftcloud then displayed the same geometry: 37 x 37 x 75.16 mm and 29,041.48 mm3.

Craftcloud is an aggregator, not a single manufacturer. Prices below are provider offers and include the visible shipping/lead-time context. Currency was USD because that was the live default in the settings modal; no EGP conversion is applied.

### Craftcloud baseline offer set

| Setting | Observed value |
| --- | --- |
| Model | Same `Caballo+ajedrez+tematico+Imperio+Maya+STl.stl` |
| Technology | 3D Printing / FDM |
| Material | PLA |
| Finish | Standard |
| Color | White for provider-offer inspection; White/Black/Gray/Blue/Green/Red all had the same stable total |
| Infill | 20% default exposed by Craftcloud |
| Quantity | 1 part |
| Currency | USD |
| Best visible offer | $44.51 + $14.90 shipping = **$59.41 total** |
| Provider | 3DSPRO Limited, Hong Kong |
| Delivery | Aug. 31 - Sep. 10; 7-15 business days |
| Additional terms | Minimum production cost applied; no import fees; Craftcloud remake guarantee |

Other visible offers for the same PLA/FDM/Standard/White/1-part configuration were $86.23 total from 3DBonum in Lithuania (Aug. 28 - Sep. 1) and $108.17 total from 3D Easyprint in Switzerland (Aug. 27 - 28). The all-offers list also showed $74.30 from IN3DTEC, $96.31 from INNOVATIVE PRO ENGINEERING LTD, and other provider-specific totals. These are not collapsed into one Craftcloud price.

### Craftcloud controlled observations

| Variable | Old | New | Observed Craftcloud result |
| --- | --- | --- | --- |
| Infill | 20% | 40% | +$17.13 on Standard finish card |
| Infill | 20% | 60% | +$17.87 |
| Infill | 20% | 80% | +$19.35 |
| Infill | 20% | 95% | +$20.85 |
| Infill | 20% | 100% | +$22.34 |
| Finish | Standard | Sanded | $85.47 total; +$26.06 displayed at 20% infill |
| Color | White | Black | $59.41 total; +$0.00 |
| Color | White | Gray | $59.41 total; +$0.00 |
| Color | White | Blue | $59.41 total; +$0.00 |
| Color | White | Green | $59.41 total; +$0.00 |
| Color | White | Red | $59.41 total; +$0.00 |
| Quantity | 1 | 2 | **N/A**: provider cards remained `Calculating prices` after extended waiting |

The quantity-2 request was not recorded as a price. It is a live availability limitation for this benchmark run, not evidence of failure or a quantity formula.

### Craftcloud classification

| Classification | Result |
| --- | --- |
| OBSERVED | Provider names, offer totals, shipping, delivery windows, material/finish/infill/color labels, and visible deltas above |
| DERIVED | $59.41 total equals $44.51 best offer plus $14.90 shipping; Sanded 20% total is $85.47 |
| INFERRED | Craftcloud behavior includes provider-specific production minimums and shipping/location components; color was neutral for stable tested colors |
| UNKNOWN | Platform-wide formula, provider normalization, quantity behavior, walls, supports, machine-time pricing, and EGP-equivalent pricing |

Craftcloud supports the broad observation that real marketplace pricing can include fixed/provider minimums, shipping, finish surcharges, and material/infill deltas. It does not establish a universal Craftcloud formula and does not by itself justify changing CAM LABS pricing.

### Craftcloud second-model validation

`Drawing273.stl` uploaded and analyzed successfully on Craftcloud. The platform reported 392.22 x 1,038 x 227 mm and 35,488,163.33 mm3. With the horse model deselected and Drawing273 isolated at quantity 1, Craftcloud returned a PLA/FDM best offer of **$8,023.92 + $639.13 shipping**, 3 offers available, delivery Aug. 26 - 28. The result included provider selection but the provider name was not captured in the isolated material-card view.

The same file also completed the MakersGate flow: `1/1 ready`, the same dimensions/volume/surface/triangle metadata, PLA/Standard configuration, and a review total of **33,605.02 EGP** with both the material minimum and 500 EGP order minimum met. CAM LABS rejected the same geometry as `Outside Printer Volume`. This is an eligibility/volume-policy difference, not a three-way price comparison; no CAM LABS price is fabricated for this model.

## CAM LABS Findings

The exact same file was uploaded to CAM LABS and completed through upload, processing, geometry viewing, quote calculation, and review. CAM LABS reported the same analyzed geometry as MakersGate: 29,041.48 mm3 volume, 7,744.1 mm2 surface area, and 469,120 triangles. The upload UI progressed to `1/1 ready`; the private viewer then changed from `Processing CAD geometry` to an interactive viewer before the quote workflow continued.

### CAM LABS Baseline A

| Setting | Observed value |
| --- | --- |
| Model | Same `Caballo+ajedrez+tematico+Imperio+Maya+STl.stl` |
| Technology/process | 3D Printing / FDM |
| Material | PLA |
| Quality/profile | Standard, 15% infill, 3 walls |
| Color | Any |
| Surface finish | Standard |
| Quantity | 1 |
| Quote | **435.68 EGP** |
| File manufacturing subtotal | 415.68 EGP |
| Shared setup cost | 20.00 EGP |
| Manufacturing price | 435.68 EGP |
| Final customer price | 435.68 EGP |

The CAM LABS review showed a 415.68 EGP file subtotal plus 20.00 EGP setup cost. No platform fee or hidden markup was shown in the review. CAM LABS displayed the same estimated-price notice in the customer workflow.

### CAM LABS one-variable experiments

| Variable | Old | New | CAM LABS price | Difference from CAM baseline |
| --- | --- | --- | ---: | ---: |
| Profile/quality | Standard | Lightweight / 10% / 2 walls | 435.68 EGP | 0.00 EGP |
| Profile/quality | Standard | Standard / 15% / 3 walls | 435.68 EGP | 0.00 EGP |
| Profile/quality | Standard | Strong / 30% / 5 walls | 721.33 EGP | +285.65 EGP |
| Profile/quality | Standard | Solid / 100% / 5 walls | 1,401.59 EGP | +965.91 EGP |
| Quality control | Standard | High | 721.33 EGP | +285.65 EGP |
| Quality control | Standard | Premium | 1,401.59 EGP | +965.91 EGP |
| Surface finish | Standard | Smooth | 435.68 EGP | 0.00 EGP |
| Material | PLA | ABS | 443.88 EGP | +8.20 EGP |
| Material | PLA | PETG | 483.18 EGP | +47.50 EGP |
| Material | PLA | TPU | 596.97 EGP | +161.29 EGP |

CAM LABS exposes quality controls rather than independent arbitrary infill and wall selectors. The quality values above are the supported equivalents and were each allowed to settle before recording. Color Any, Black, White, Red, Blue, Green, Yellow, Orange, Purple, and Gray were tested individually and all returned 435.68 EGP.

#### CAM LABS quantities

| Quantity | CAM LABS price | Difference from quantity 1 |
| ---: | ---: | ---: |
| 1 | 435.68 EGP | 0.00 EGP |
| 2 | 860.57 EGP | +424.89 EGP |
| 5 | 2,118.42 EGP | +1,682.74 EGP |
| 10 | 4,232.80 EGP | +3,797.12 EGP |
| 20 | 7,255.70 EGP | +6,820.02 EGP |

The first rapid quantity sweep produced aborted quote requests for superseded values. A slower second sweep was used for the recorded values; each value was held until the loading/calculating state cleared and the displayed price matched the current quantity. Quantity 20 is not 20 times quantity 1, indicating nonlinear quantity treatment in CAM LABS for this model/configuration.

### CAM LABS raw slicer and cost evidence

The exact-model backend engine was run with the analyzed geometry and the same Standard FDM parameters. PrusaSlicer returned actual material volume, print time, and layer count. The repeated exact request was deterministic across three runs: 11.39 cm3 material volume, 14.1236 g material, 76.7333 minutes machine time, and 375 layers.

| Quantity | Material volume | Material usage | Machine time | Layers | Material cost | Machine cost | Labor | Setup | Final price |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 11.39 cm3 | 14.1236 g | 76.7333 min | 375 | 169.48 EGP | 230.20 EGP | 16.00 EGP | 20.00 EGP | 435.68 EGP |
| 2 | 22.77 cm3 | 28.2348 g | 156.5833 min | 375 | 338.82 EGP | 469.75 EGP | 32.00 EGP | 20.00 EGP | 860.57 EGP |
| 5 | 56.88 cm3 | 70.5312 g | 390.6833 min | 375 | 846.37 EGP | 1,172.05 EGP | 80.00 EGP | 20.00 EGP | 2,118.42 EGP |
| 10 | 113.73 cm3 | 141.0252 g | 786.8333 min | 375 | 1,692.30 EGP | 2,360.50 EGP | 160.00 EGP | 20.00 EGP | 4,232.80 EGP |
| 20 | 193.30 cm3 | 239.6920 g | 1,346.4667 min | 375 | 2,876.30 EGP | 4,039.40 EGP | 320.00 EGP | 20.00 EGP | 7,255.70 EGP |

Observed: material and machine components come from PrusaSlicer output; layer count remains constant because the slicer duplicates the part. Configured: PLA rate is 12 EGP/g, machine rate is 180 EGP/hour, labor rate is 120 EGP/hour, production labor is 8 minutes per quantity, and setup is 10 minutes plus 0 EGP consumables. Calculated: final price is the sum of material, machine, labor, post-processing, and setup, with no minimum-order adjustment configured. Inferred: quantity nonlinearity is caused by duplicated slicer time/material plus per-unit labor, not by a quantity discount.

For quality/material/finish controls, the same engine path showed that material changes alter material rate/density and sometimes slicer output, quality changes alter configured slicer parameters, and Smooth has a configured 0 EGP post-processing rate. Raw G-code is deleted after parsing by the service and is not exposed in the customer UI.

### Direct comparison

| Experiment | MakersGate | Craftcloud3D | CAM LABS | Behavioral difference |
| --- | ---: | ---: | ---: | --- |
| Baseline PLA/Standard/Any/1 | 60.20 EGP | $59.41 best total, 3DSPRO Limited, plus $14.90 shipping | 435.68 EGP | Absolute currencies and aggregator fees differ; Craftcloud is provider-specific |
| Infill 20% -> higher values | Not exposed at 20% baseline; MakersGate tested 0-100% | +$17.13 to +$22.34 from 20% to 40-100% | CAM Standard baseline 435.68 EGP; quality equivalents tested | All show a material/configuration response, but scales are not comparable across currencies/providers |
| Finish Standard -> upgraded finish | Not exposed | Sanded: +$26.06 at 20% | Smooth: 0.00 EGP observed | Craftcloud has a visible finish surcharge; CAM Smooth is configured neutral |
| Colors | Tested colors neutral at 60.20 EGP | White/Black/Gray/Blue/Green/Red stable at $59.41 | Tested colors neutral at 435.68 EGP | Color-neutral behavior agrees across the stable tested values |
| Quantity 1 -> 2 | 60.20 -> 120.40 EGP item subtotal | N/A; quantity-2 provider cards remained calculating | 435.68 -> 860.57 EGP | MakersGate and CAM observed; Craftcloud quantity remains unknown |

| Experiment | MakersGate | CAM LABS | Behavioral difference |
| --- | ---: | ---: | --- |
| Baseline PLA/Standard/15%/3 walls/Any/1 | 60.20 EGP | 435.68 EGP | CAM LABS is 375.48 EGP higher; CAM includes visible 20 EGP setup cost and a larger file subtotal |
| Lightweight / 10% / 2 walls | 48.55 EGP | 435.68 EGP | MakersGate decreases price; CAM LABS is unchanged |
| Strong / 30% / 5 walls | 85.24 EGP | 721.33 EGP | Both increase, but CAM LABS increase is much larger |
| Solid / 100% / 5 walls | 140.74 EGP | 1,401.59 EGP | Both increase sharply; CAM LABS is about 10x MakersGate |
| PLA | 60.20 EGP | 435.68 EGP | Different baseline levels |
| ABS | 63.11 EGP | 443.88 EGP | Both increase; CAM material delta is larger in absolute EGP |
| PETG | 77.07 EGP | 483.18 EGP | Both increase; CAM material delta is larger in absolute EGP |
| TPU | 146.85 EGP | 596.97 EGP | Both increase; MakersGate percentage delta is larger |
| Smooth finish | N/A/not exposed | 435.68 EGP | CAM exposes it and observed it as neutral |
| Colors | All tested colors 60.20 EGP | All tested colors 435.68 EGP | Both color-neutral; different baseline |
| Quantity 1 | 60.20 EGP item / 500 EGP order total | 435.68 EGP | MakersGate order minimum masks the item price at review |
| Quantity 2 | 120.40 EGP item / 500 EGP order total | 860.57 EGP | MakersGate remains under order minimum; CAM is nonlinear relative to one unit |
| Quantity 5 | 301.00 EGP item / 500 EGP order total | 2,118.42 EGP | Same masking distinction; CAM higher and nonlinear |
| Quantity 10 | 602.00 EGP | 4,232.80 EGP | Both exceed the MakersGate order minimum; CAM much higher |
| Quantity 20 | 1,204.00 EGP | 7,255.70 EGP | Both grow with different quantity behavior; CAM is much higher |

These are observed behavioral differences, not a formula claim. MakersGate exposes a low configuration quote plus a separate review order minimum, while CAM LABS includes visible manufacturing/setup components and uses its own slicer-backed customer price.

Existing executable CAM LABS evidence was also run separately:

- `backend/tests/cam-labs.pricing-engine.test.ts`: 5 tests passed.
- The tests verify EGP output, actual material-usage and machine-time sources, layer-count variation, support-volume behavior, material density/rate selection, and rejection of unsupported or invalid slicer inputs.
- The engine contract requires actual model data and a slicer calculation; it does not justify substituting a MakersGate price.
- No CAM LABS pricing formula was modified because the comparison identifies behavioral differences but does not uniquely support a replacement formula.

## Pricing Formula Status

| Classification | Result |
| --- | --- |
| Observed | MakersGate prices and quantity/minimum-order behavior in the tables above |
| Calculated | Differences and percentages in the experiment tables |
| Inferred | Standard live configuration is sensitive to profile, infill, walls, and material; color was neutral in this model/configuration |
| Configured | CAM LABS remains configured around its existing manufacturing engine and EGP output |

No claim of formula equivalence is made.

## Pricing Model Sufficiency

The evidence is sufficient to explain the current CAM LABS implementation and to compare observed deltas, but it is not sufficient to identify a unique three-platform pricing formula. Numerically, many models remain consistent with the observations: for the horse STL, a fixed-cost-plus-slicer-cost CAM model fits all five CAM quantities, while a separate provider-plus-shipping Craftcloud model fits its one-part offers; the Craftcloud quantity-2 value is unavailable, and Craftcloud offers are in USD from different manufacturers. MakersGate has a separate 500 EGP order minimum and exposes no slicer components. The large Drawing273 model has MakersGate and Craftcloud prices but no CAM price because of the volume policy. These missing common observations leave multiple free parameters and no unique cross-platform solution.

Closest defensible model: retain CAM LABS' actual-slicer cost model, with configured material, machine, labor, setup, and finish components, and treat MakersGate/Craftcloud as external behavioral benchmarks rather than formula targets. This model is already implemented and tested. No pricing-engine adjustment is justified by the current black-box evidence.

## Slicer Evidence

| Evidence | Result |
| --- | --- |
| MakersGate material usage | N/A; not displayed for this model |
| MakersGate print time | N/A; not displayed |
| MakersGate layers | N/A; not displayed |
| MakersGate G-code | N/A; not exposed |
| CAM LABS material usage | Existing engine test source marked `actual`; raw usage not exposed in customer review |
| CAM LABS machine time | Existing engine test source marked `actual`; raw time not exposed in customer review |
| CAM LABS configuration passed to slicer | Same-model quote completed through the backend; raw slicer/G-code artifact was not exposed |

## 20-Model Validation

Two non-fixture STL files were uploaded to CAM LABS. The primary horse STL was validated end to end through quote review. `Drawing273.stl` uploaded and analyzed successfully, but its analyzed dimensions (392.218475 x 1038 x 227.000002 mm) exceed ordinary printer volume, so it was recorded as rejected and no price was fabricated. The remaining local files were not counted because they are tetrahedron/generated fixtures, malformed files, or non-STL engineering files. The repository does not contain 20 distinct legitimate printable models, and no fake or duplicate models were substituted.

| Count | Result |
| ---: | --- |
| 1 | `Caballo+ajedrez+tematico+Imperio+Maya+STl.stl` - Ready, analyzed, quote observed |
| 1 | `Drawing273.stl` - MakersGate Ready/PLA Standard: 33,605.02 EGP; Craftcloud Ready/PLA FDM: $8,023.92 + $639.13 shipping; CAM LABS **Rejected - Outside Printer Volume** |
| 18 required | Not executed; no additional eligible distinct local models available |

## UI Validation

The existing CAM LABS implementation contains `PriceTransition`, localized `PriceEstimateNotice`, an abort controller, request-version protection, and calculating/error states. The live page rendered Arabic with `dir="rtl"` and showed the Arabic estimated-price notice.

| Requirement | Result |
| --- | --- |
| Old price invalidation | Implemented by `PriceTransition`; CAM review quote returned only after recalculation settled |
| Calculating animation | Implemented; quote workflow exposed calculating/loading states during changes |
| Latest request wins | Abort controller and request version guard present; rapid quantity trial produced aborted superseded requests and the slower rerun produced the current values |
| Error state | Implemented in `PriceTransition` |
| Estimated-price notice | Observed in English and Arabic |
| English | Observed in the CAM review workflow |
| Arabic/RTL | Observed; `html[dir]` was `rtl`, `lang` was `ar` |
| Live old-price invalidation | Strong selection removed 435.68 EGP immediately and showed `Calculating your manufacturing quote...` |
| Live ready transition | Strong settled at 721.33 EGP; Standard restoration settled at 435.68 EGP |
| Live error recovery | Aborted quote request showed `Calculation failed - adjust your options and try again.`; restoring the request returned 435.68 EGP |
| 1440 px | `page.setViewportSize` reported 1440, but CSS client width remained 1792; not a valid 1440 layout verification |
| 834 px | `page.setViewportSize` reported 834, but CSS client width remained 1035; not a valid 834 layout verification |
| 390 px | `page.setViewportSize` reported 390, but CSS client width remained 480; not a valid 390 layout verification |

## Remaining Limitations

1. The MakersGate and same-model CAM LABS quotes were successfully observed and experimentally varied, but the full 20-model validation could not be completed without eligible distinct real-world STL files.
2. MakersGate did not expose material usage, print time, layers, G-code, supports, finish, nozzle, printer, tolerance, orientation, or delivery controls in this flow.
3. CAM LABS did not expose independent arbitrary infill and wall controls; its supported Standard/High/Premium quality controls were tested instead.
4. CAM LABS did not expose raw G-code or a downloadable slicer artifact in the customer flow.
5. The browser automation environment did not honor requested viewport sizes, so responsive dimensions require a separate browser session or device-emulation run.
6. The observed pricing differences do not uniquely identify a corrected formula. The CAM LABS pricing formula was left unchanged.
7. The complete backend suite reported 41 passed, 13 skipped, and 2 unrelated authentication failures in `auth.database.test.ts` and `auth.routes.test.ts`; the focused pricing/slicer/order suite passed 11/11.