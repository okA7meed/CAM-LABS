# Phase 05 CAD Format Validation Report

Date: 2026-08-16

## 1. Executive Summary

This audit traced the existing Phase 03 CAD path from authenticated multipart upload through private filesystem storage, PostgreSQL versioning, scanning, asynchronous processing, metadata extraction, protected asset delivery, Three.js rendering, and the Phase 04.3 manufacturing-request preview/review flow.

Real end-to-end browser support was proven for:

- ASCII STL
- Binary STL
- OBJ

STEP/STP, IGES/IGS, and DXF remain secure-upload-only formats. They have no geometry parser, triangulation, conversion, metadata extraction, or browser preview implementation. 3MF, PLY, GLB/GLTF, and DWG are rejected at preflight and upload boundaries.

Fixes made during validation include stricter STL/OBJ geometry validation, honest support-level metadata, MIME/extension compatibility checks, private viewer cache hardening, responsive WebGL sizing, mobile toolbar hit testing, accurate empty-file errors, truthful bilingual support copy, and loaded-page React SVG warning cleanup.

**Phase 05 readiness: NOT READY** for the broad native-CAD objective. Real mesh visualization works for STL and OBJ, but accepted native engineering formats cannot complete the required geometry pipeline and manufacturing submission is not persisted by the current wizard.

## 2. Existing CAD Architecture

The existing architecture was retained; no parallel upload, storage, processing, translation, or theme system was added.

- Frontend upload: `ManufacturingRequestView`, `CadVaultPanel`, and the legacy configurator call `ApiService.uploadCadFile`.
- Preflight: `POST /api/v1/cad-files/validate` checks extension and size.
- Upload: `POST /api/v1/cad-files` uses authenticated multipart upload.
- Authentication: `requireAuth` resolves the server session; client user IDs are not accepted.
- Ownership: list, detail, geometry, report, viewer, download, and retry queries include authenticated `userId`.
- Storage: `FilesystemObjectStorage` stores objects below `CAD_STORAGE_ROOT` using owner-prefixed random keys and traversal-safe path resolution.
- Integrity: SHA-256 checksum is persisted per immutable `CadFileVersion`.
- Scanning: local development scanner detects the EICAR signature. Production configuration rejects local scanner mode.
- Processing: `CadProcessingJob` is claimed atomically and updates scan/processing state, metadata, and `DfmReport`.
- Persistence: `CadFile` is the logical owned record; `CadFileVersion` stores immutable version, MIME, checksum, object key, status, and metadata.
- Viewer API: protected geometry JSON and original STL/OBJ bytes are loaded by `CadGeometryViewer`.
- Viewer: Three.js `STLLoader`, `OBJLoader`, `OrbitControls`, WebGL renderer, fit/reset/zoom/grid/axes controls, and disposal on unmount.
- Manufacturing request: the same in-memory `CadFile` and geometry response flow through Preview and Review. The final submit step currently creates only a client-side random reference; no manufacturing request record is posted.

Relevant environment controls:

- `CAD_STORAGE_ROOT` default: `.data/cad-files`
- `CAD_MAX_FILE_SIZE_BYTES` default: 150 MiB
- `CAD_SCANNER_MODE` default: `local`
- Multipart parser limit: 160 MiB
- `DATABASE_URL`, `CORS_ORIGIN`, and session configuration remain unchanged.

## 3. Supported Formats

### Fully supported

- STL, ASCII and binary variants
- OBJ text meshes with vertices and polygon faces that can be triangulated

“Fully supported” here means the tested file completed upload, scan, parsing, real metadata extraction, protected viewer asset delivery, browser rendering, manufacturing preview, and review.

### Upload only

- STEP / STP
- IGES / IGS
- DXF

These formats are stored, scanned, versioned, and ownership-protected, but geometry is unavailable. No conversion currently exists.

### Unsupported

- 3MF
- PLY
- GLB / GLTF
- DWG

## 4. Investigated Formats

All required formats were investigated through repository inspection and runtime preflight. STL and OBJ were additionally processed and rendered with real files. STEP/STP, IGES/IGS, and DXF were not falsely treated as 3D-capable; no native parser or trusted converter exists. DXF has only a `SECTION` marker check and is not a 2D geometry parser.

## 5. Compatibility Matrix

| Format | Upload | Processing | Geometry Parsing | Metadata | 3D Viewer | Conversion | Browser Tested | Result |
|---|---|---|---|---|---|---|---|---|
| STL ASCII | Yes | Yes | Real triangles | Dimensions, bounds, area, volume, counts | Yes | None | Yes, full wizard | `FULLY_SUPPORTED` |
| STL Binary | Yes | Yes | Real binary triangle records | Dimensions, bounds, area, volume, counts | Yes | None | Yes, full wizard | `FULLY_SUPPORTED` |
| OBJ | Yes | Yes | Real vertices/faces, polygon triangulation | Dimensions, bounds, area, volume, counts | Yes | None | Yes, full wizard | `FULLY_SUPPORTED` |
| STEP / STP | Yes | Scan/store only | No | Byte size/support status only | No | Required, absent | Preflight only | `UPLOAD_ONLY` |
| IGES / IGS | Yes | Scan/store only | No | Byte size/support status only | No | Required, absent | Preflight only | `UPLOAD_ONLY` |
| DXF | Yes | Scan/store and marker check | No 2D entity parser | Byte size/support status only | No | Required for 3D; absent | Preflight only | `UPLOAD_ONLY` |
| 3MF | No | No | No | No | No | Not implemented | Preflight rejection | `UNSUPPORTED` |
| PLY | No | No | No | No | No | Not implemented | Preflight rejection | `UNSUPPORTED` |
| GLB / GLTF | No | No | No | No | No | Not implemented | Preflight rejection | `UNSUPPORTED` |
| DWG | No | No | No | No | No | Proprietary conversion required | Preflight rejection | `UNSUPPORTED` |
| Malformed STL/OBJ | Stored if non-empty and MIME-compatible | Safe failure | Rejected | All geometry unavailable | No, HTTP 409 | N/A | Yes | `FAILED_VALIDATION` |

## 6. Test Fixtures

| Fixture | Format/variant | Generation/source | Geometry | Units | Purpose |
|---|---|---|---|---|---|
| `test-fixtures/tetrahedron.stl` | ASCII STL | Existing repository fixture | Closed 1x1x1 tetrahedron, 4 faces | Unknown/unitless | ASCII parser and upload |
| `test-fixtures/tetrahedron-final.stl` | ASCII STL | Existing repository fixture | Closed 3x3x3 tetrahedron, 4 faces | Unknown/unitless | Full preview/review identity test |
| `test-fixtures/tetrahedron-responsive.stl` | ASCII STL | Existing repository fixture | Closed 2x2x2 tetrahedron, 4 faces | Unknown/unitless | 24-case responsive/localization/theme matrix |
| `test-fixtures/tetrahedron-binary.stl` | Binary STL, 284 bytes | Deterministically generated by `generate-binary-stl.mjs` | Closed 1x1x1 tetrahedron, 4 records | Unknown/unitless | Binary parser and browser loader |
| `test-fixtures/tetrahedron.obj` | Text OBJ, 109 bytes | Created from explicit vertices/faces | Closed 1x1x1 tetrahedron, 4 source vertices/faces | Unknown/unitless | OBJ parser and browser loader |
| `test-fixtures/malformed.stl` | Malformed ASCII STL | Deliberately incomplete facet | Invalid | Unknown | Negative geometry/browser test |
| `test-fixtures/truncated.obj` | Truncated OBJ | Deliberately incomplete face | Invalid | Unknown | Negative geometry test |
| `test-fixtures/empty.stl` | Empty STL | Zero-byte fixture | None | Unknown | Upload rejection |
| Existing 23,456,084-byte binary STL | Binary STL | Existing account asset; source provenance not available | 469,120 triangles | Unknown/unitless | Large-file transfer/render observation only |

Binary STL SHA-256: `aada7ab7543201263f24fe2aaceb6ff76972684fe91584f4a0283ebddfe22f72`

OBJ SHA-256: `e4e4ec60b097f5448b30673184d9d2a929c9b2d9ec5f432c3c6df3d2545ec5f6`

No fake renamed files were used as successful fixtures. Native STEP/IGES/DXF files were not fabricated, so those formats are not marked browser-tested.

## 7. Geometry Processing Results

STL:

- ASCII parsing now requires `solid`/`endsolid`, complete facet blocks, exactly three finite vertices, and non-zero triangle area.
- Binary parsing requires exact byte length, finite coordinates, and non-zero triangle area.
- Variant is persisted as `ASCII` or `BINARY`.

OBJ:

- Parses finite `v` records.
- Parses positive and negative face indices.
- Triangulates polygon fans.
- Rejects files without complete nondegenerate faces.

Computed values are based on triangle geometry. No millimeter assumption is made. Units remain `unitless` with `CONFIRMATION_REQUIRED`.

STEP/STP, IGES/IGS, and DXF return `geometryStatus: UNAVAILABLE`, `supportLevel: UPLOAD_ONLY`, and a finding that conversion is required. Invalid STL/OBJ return `supportLevel: FAILED_VALIDATION`.

Viewer assets are not separately converted files. For proven STL/OBJ, the private original version bytes are the viewer asset and are parsed by the matching browser loader.

## 8. Viewer Results

Real uploaded STL and OBJ models appeared, were centered, fitted, and scaled from their actual bounds.

Controls tested:

- Rotate: exercised by left drag; rendered canvas changed.
- Zoom: wheel plus toolbar zoom-in/zoom-out exercised.
- Pan: right-drag gesture exercised; automated screenshot diff was inconclusive because the continuously rendered canvas did not become Playwright-stable.
- Reset: clicked successfully.
- Fit: clicked successfully.
- Grid: toggled and active state changed.
- Axes: toggled and active state changed.
- Orientation cube/views: not implemented.

Cleanup was observed across repeated wizard mounts: one active canvas remained, and renderer/control/material disposal exists in the effect cleanup. No WebGL errors or memory warnings were observed.

## 9. Geometry Metadata Results

Reliably extracted for tested STL/OBJ:

- Dimensions and bounding box
- Surface area
- Signed-triangle volume magnitude
- Triangle/face count
- Vertex count (emitted triangle vertices for STL; source vertices for OBJ)
- Format and representation variant
- Byte size

Units are not encoded reliably by STL/OBJ and are displayed as requiring confirmation. Values are never labeled millimeters.

Known fixture comparisons:

- Unit tetrahedron: 1x1x1, volume approximately 0.166667, area approximately 2.366025, 4 faces.
- 2-unit tetrahedron: 2x2x2, volume approximately 1.333333, area approximately 9.464102, 4 faces.
- 3-unit tetrahedron: 3x3x3, volume 4.5, area approximately 21.294229, 4 faces.

## 10. Manufacturing Request Integration

ASCII STL, binary STL, and OBJ were each uploaded through the existing wizard, processed, and displayed by the protected viewer. A controlled identity test confirmed the same `CadFile.id`, filename, version, geometry endpoint, viewer asset endpoint, Preview, and Review values for `tetrahedron-final.stl`.

The STL Review screen preserved filename, format, 3x3x3 dimensions, four triangles, selected process/material, and configuration.

Limitation: final submission creates a random reference in React state only. It does not post the CAD file/version or request configuration to a manufacturing endpoint. Therefore server-side request ownership and durable file-version linkage cannot be proven after submission.

## 11. Security Validation

Test asset: owner’s binary STL `f5d43ab9-760a-4bd2-a01e-e8929987a1bc`.

Runtime results:

| Endpoint | No credentials | Different authenticated owner | Correct owner |
|---|---:|---:|---:|
| CAD detail | 401 | 404 | Allowed |
| Geometry metadata/status | 401 | 404 | Allowed |
| Viewer asset | 401 | 404 | 200, 284 exact bytes |
| Private download | 401 | 404 | Allowed |
| DFM report | 401 | 404 | Allowed |
| Retry processing | 401 | 404 | Allowed |

A critical browser-cache issue was found and fixed. Previously, `private, max-age=300` allowed the browser to reuse an authenticated viewer response after credentials changed. Viewer assets now return:

- `Cache-Control: private, no-store`
- `Vary: Cookie, Authorization`

Fresh unauthorized and wrong-owner requests then returned 401/404; the owner received exact bytes.

No API response exposed filesystem paths, bucket internals, object keys, stack traces, or server paths during tested flows.

## 12. Localization Validation

The valid STL viewer was tested in:

- English / LTR
- Arabic / RTL

Upload support copy now states honestly in both languages that STL/OBJ have geometry preview while STEP/STP/DXF/IGES/IGS are secure upload only. Filename, metadata, controls, and panels remained readable in both directions.

## 13. Theme Validation

The valid STL viewer was tested with:

- Light
- Dark
- System (resolved dark in the test environment)

All themes retained a nonzero WebGL canvas, visible model, toolbar, metadata, and no overflow.

## 14. Responsive Validation

A real uploaded 2-unit ASCII STL was tested in all 24 combinations of 2 locales, 3 theme preferences, and these widths:

- 390 px: canvas 290x310
- 768 px: canvas 646x390
- 1024 px: canvas 884x390
- 1440 px: canvas approximately 727x688-693

All 24 checks passed:

- No page overflow
- No viewer-panel overflow
- Nonzero canvas dimensions
- Toolbar fully inside canvas panel
- Correct LTR/RTL direction
- Correct resolved theme

## 15. Problems Encountered

### Problem: Malformed STL promoted to viewer-ready
Root Cause: ASCII parsing accepted any three `vertex` lines; binary parsing accepted zero-area records.
Affected Format: STL
Affected Component: Backend metadata extractor
Impact: Invalid data could receive geometry metadata and viewer availability.

### Problem: Native CAD support inflation
Root Cause: Accepted extension list was treated as geometry support despite no parser/converter.
Affected Format: STEP/STP, IGES/IGS, DXF
Affected Component: Backend metadata and frontend upload copy
Impact: Users could infer unsupported preview/metadata capability.

### Problem: Authenticated viewer bytes reusable after auth change
Root Cause: Private URL response used five-minute browser caching without varying auth identity.
Affected Format: All viewer-ready formats
Affected Component: Viewer asset HTTP response
Impact: Previously loaded private bytes could be reused from browser cache under a changed session.

### Problem: Mobile WebGL canvas retained desktop width
Root Cause: Grid min-content sizing and renderer inline canvas width prevented shrink.
Affected Format: All viewer-ready formats
Affected Component: Manufacturing viewer CSS
Impact: 390px panel internally overflowed to 727px.

### Problem: Mobile toolbar lost hit testing
Root Cause: No explicit layer above the WebGL canvas.
Affected Format: All viewer-ready formats
Affected Component: Viewer toolbar CSS
Impact: Canvas/header/content could intercept control clicks.

### Problem: Empty upload returned oversized-file code
Root Cause: Empty and oversized checks shared `CAD_FILE_TOO_LARGE`.
Affected Format: All
Affected Component: Upload service
Impact: Misleading client error semantics.

### Problem: Loaded React SVG warnings
Root Cause: HTML `stroke-width` attributes in JSX.
Affected Format: None
Affected Component: Workflow/capability sections
Impact: Noisy console baseline during browser validation.

## 16. Problems Fixed

### Fix: Strict mesh validation
Root Cause: Structural/degeneracy checks were absent.
Solution: Validate STL envelope/facets, finite coordinates, exact binary length, and nonzero triangle area; reject incomplete OBJ faces.
Files Changed: `backend/src/cad/file-processing.ts`, focused tests.
Validation Performed: 10/10 focused processing tests plus malformed browser preview.
Final Result: Invalid geometry is `FAILED_VALIDATION`, metadata unavailable, viewer HTTP 409.

### Fix: Honest support status
Root Cause: Upload acceptance and geometry capability were conflated.
Solution: Persist `FULLY_SUPPORTED`, `UPLOAD_ONLY`, or `FAILED_VALIDATION`; update English/Arabic upload copy.
Files Changed: extractor and i18n resources.
Validation Performed: runtime preflight matrix and bilingual browser checks.
Final Result: No silent support expansion.

### Fix: MIME compatibility
Root Cause: Client MIME was persisted without extension compatibility checking.
Solution: Allow known CAD MIME values and generic octet-stream; reject contradictory values.
Files Changed: extractor utilities, upload service, tests.
Validation Performed: focused tests; live HTML-as-STL returned 400 `CAD_MIME_TYPE_MISMATCH`.
Final Result: Mismatched declarations are rejected before storage.

### Fix: Private viewer caching
Root Cause: authenticated response was cacheable for five minutes.
Solution: `private, no-store` and auth-aware `Vary`.
Files Changed: CAD route.
Validation Performed: no-credential 401, wrong-owner 404, owner 200 with exact bytes.
Final Result: Browser cache no longer bypasses the ownership boundary.

### Fix: Responsive viewer controls
Root Cause: canvas min-content width and toolbar stacking.
Solution: shrinkable canvas boundaries, max-width canvas, toolbar z-index.
Files Changed: manufacturing request CSS.
Validation Performed: real pointer controls at 390px and 24-case matrix.
Final Result: No overflow; toolbar remains clickable.

### Fix: Accurate empty-file error
Root Cause: shared condition/code.
Solution: `CAD_FILE_EMPTY` for zero bytes; retain `CAD_FILE_TOO_LARGE` for oversize.
Files Changed: CAD service.
Validation Performed: live multipart retest returned expected 400/code/message.
Final Result: Accurate failure response.

## 17. Problems Not Fixed

### Problem: No native STEP/IGES parser or converter
Why It Remains: No geometry kernel/conversion service exists in the architecture.
Technical Limitation: Three.js cannot directly render B-rep STEP/IGES data.
Recommended Future Solution: Add an isolated, authenticated worker using a proven Open Cascade-based converter, persist a derived version asset with provenance/checksum, and test real fixtures.
Impact: STEP/STP and IGES/IGS are upload only.

### Problem: DXF has no 2D parser
Why It Remains: Current code only checks for `SECTION`.
Technical Limitation: No entity/layer/unit parser or 2D viewer exists.
Recommended Future Solution: Add a proven DXF parser and explicitly 2D viewer; never extrude by default.
Impact: DXF is upload only.

### Problem: Manufacturing submit is client-only
Why It Remains: Existing wizard has no request persistence API call.
Technical Limitation: Random request reference and state disappear on reload.
Recommended Future Solution: Submit owned `cadFileId` plus immutable version ID and configuration to the existing manufacturing boundary in a transaction.
Impact: Durable request ownership/file-version linkage is unproven.

### Problem: MIME is not byte-sniffed
Why It Remains: Compatibility checking validates declaration against extension, while real parser validation is format-specific.
Technical Limitation: Native upload-only formats have no parser/signature validator.
Recommended Future Solution: Add trusted signatures/parsers per format; keep generic octet-stream browser compatibility.
Impact: Native upload-only payload authenticity is not fully established.

### Problem: Local scanner is development-only
Why It Remains: No production malware provider is configured.
Technical Limitation: Local scanner checks EICAR only.
Recommended Future Solution: Configure asynchronous production scanner and quarantine storage policy.
Impact: Production readiness requires environment integration.

### Problem: Some failure injections were not performed
Why It Remains: Corrupting private stored objects or stopping the shared backend would alter the user environment beyond a safe audit.
Technical Limitation: No injectable storage/conversion failure adapter exists.
Recommended Future Solution: Add isolated integration doubles for missing/corrupt object, storage read failure, network timeout, and worker failure.
Impact: Missing asset 404 and parser failures were tested; corrupted stored asset/backend outage were not.

### Problem: Header/dashboard CTA opens legacy configurator
Why It Remains: Existing navigation intentionally separates the legacy modal and Phase 04.3 wizard.
Technical Limitation: Wizard is reached from home CTAs only.
Recommended Future Solution: Consolidate CTA routing after product decision.
Impact: Manufacturing entry is inconsistent but tested wizard remains functional.

## 18. Browser Test Results

Browser: integrated Chromium at `http://127.0.0.1:3000/`.

Passed:

- Real ASCII STL upload/process/render/preview/review
- Real binary STL upload/process/render/preview
- Real OBJ upload/process/render/preview
- Protected geometry and viewer network requests
- Rotate, zoom, reset, fit, grid, and axes controls
- Right-drag pan gesture exercised
- Malformed STL unavailable state and 409 viewer response
- Exact metadata comparisons for controlled fixtures
- English/Arabic, LTR/RTL
- Light/Dark/System
- 390/768/1024/1440
- Clean fresh page console after JSX fixes
- Repeated viewer mount/unmount with one active canvas

Large-model observation:

- Existing binary STL: 23,456,084 bytes, 469,120 triangles
- Protected local transfer: approximately 706 ms
- It rendered in the viewer during investigation without WebGL/memory errors.
- Source provenance was unavailable, so it is not promoted to a controlled reusable fixture.

Expected negative HTTP errors appeared in the console only while deliberately testing 400/401/404/409 responses.

## 19. Automated Test Results

| Check | Result |
|---|---|
| Focused CAD processing tests | PASS, 10/10 |
| Auth route/in-memory tests | PASS as part of non-database run |
| Phase 02 isolated PostgreSQL auth tests | PASS, 6/6 |
| Phase 03 isolated PostgreSQL CAD tests | PASS, 3/3 |
| Initial unrestricted backend command | Configuration guard stopped it because development DB was selected; 19 passed, 3 skipped before guard result |
| Frontend/backend lint (`tsc --noEmit`) | PASS |
| Production build | PASS |
| Vite bundle advisory | Non-failing warning: main JS chunk exceeds 500 kB |
| Editor diagnostics on touched CAD files | PASS, none |

The database integration suites were then rerun correctly against `cam_labs_phase02_test` and `cam_labs_phase03_test`; no destructive test targeted the development database.

## 20. Final Format Status

| Format | Final Status | Basis |
|---|---|---|
| STL ASCII | `FULLY_SUPPORTED` | Real file, parser, metadata, protected asset, browser, wizard/review |
| STL Binary | `FULLY_SUPPORTED` | Generated valid binary file, parser variant, metadata, protected asset, browser |
| OBJ | `FULLY_SUPPORTED` | Real text fixture, parser, metadata, protected asset, browser |
| STEP / STP | `UPLOAD_ONLY` | Runtime preflight plus code inspection; no parser/converter/viewer |
| IGES / IGS | `UPLOAD_ONLY` | Runtime preflight plus code inspection; no parser/converter/viewer |
| DXF | `UPLOAD_ONLY` | Runtime preflight; marker check is not geometry parsing |
| 3MF | `UNSUPPORTED` | Runtime preflight rejection; no implementation |
| PLY | `UNSUPPORTED` | Runtime preflight rejection; no implementation |
| GLB / GLTF | `UNSUPPORTED` | Runtime preflight rejection; no implementation |
| DWG | `UNSUPPORTED` | Runtime preflight rejection; no implementation |

No format currently qualifies as `SUPPORTED_WITH_CONVERSION` because no conversion service exists.

## 21. Remaining Limitations

- Native B-rep CAD cannot be visualized or measured.
- DXF cannot be presented as trusted 2D geometry.
- Units must be confirmed manually for STL/OBJ.
- Volume assumes meaningful oriented closed triangle geometry; manifold/watertight validation is not implemented.
- OBJ material/texture dependencies are not loaded; geometry only is supported.
- Large uploads are buffered in memory by the custom multipart path.
- Manufacturing submission is not durable.
- Production malware scanning is not configured.
- No orientation cube or named orthographic views are implemented.
- No frontend unit/E2E test framework is configured; browser validation was executed interactively with Playwright tooling.

## 22. Phase 05 Readiness

**NOT READY**

The STL/OBJ mesh pipeline is real and validated. The broader Phase 05 objective is not ready because accepted STEP/STP, IGES/IGS, and DXF files cannot complete geometry parsing, trusted metadata extraction, viewer asset generation, or browser visualization, and the manufacturing request submit step does not durably reference the CAD version.
