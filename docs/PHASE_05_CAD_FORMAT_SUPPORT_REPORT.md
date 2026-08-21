# Phase 05 CAD Format Support Report

Date: 2026-08-16

## Implemented Architecture

CAM LABS uses its existing authenticated CAD pipeline:

```text
Multipart upload -> format/MIME validation -> private filesystem storage
-> checksum/version decision -> antivirus scan -> metadata extraction
-> private viewer-asset endpoint -> format-specific browser viewer
```

Original uploads are stored under a private per-user storage key. Download, metadata, viewer-asset, retry, and delete routes require authentication and filter by the owning user ID. Exact checksum duplicates return the existing version; a changed file with the same name creates the next version.

## Supported Formats

| Format | Upload | Processing | Viewer | Metadata | Result |
| --- | --- | --- | --- | --- | --- |
| STL | Yes | Server mesh validation | Three.js 3D | Bounds, area, volume, triangles, vertices, faces | Tested in browser |
| OBJ | Yes | Server mesh validation | Three.js 3D | Bounds, area, volume, triangles, vertices, faces | Tested in browser |
| PLY | Yes | Server ASCII/binary mesh validation | Three.js 3D | Bounds, area, volume, triangles, vertices, faces | Tested in browser |
| DXF | Yes | Server planar-entity parsing | Three.js 2D line viewer | Bounds, declared units, entity/object counts | Tested in browser |
| SVG | Yes | Standalone, non-executable SVG validation | Private 2D image preview | `viewBox` bounds when declared | Unit-tested |
| PDF | Yes | PDF signature validation | Private browser document preview | Byte/signature status only | Unit-tested |
| STEP / STP | Yes | Scan and private versioning only | Not supported | Not available | Upload-only |
| IGES / IGS | Yes | Scan and private versioning only | Not supported | Not available | Upload-only |
| 3MF | No | No | No | No | Not supported |
| GLB / GLTF | No | No | No | No | Not supported |
| OFF / AMF | No | No | No | No | Not supported |
| Parasolid X_T / X_B | No | No | No | No | Not supported |
| SAT / ACIS | No | No | No | No | Not supported |
| BREP | No | No | No | No | Not supported |
| DWG | No | No | No | No | Not supported |

## Format Pipelines

- Mesh: STL, OBJ, and PLY are validated and measured server-side, then loaded by Three.js `STLLoader`, `OBJLoader`, or `PLYLoader` from the authenticated private viewer-asset endpoint.
- 2D CAD: DXF is parsed server-side for planar metadata and drawn as a Three.js line model. SVG is validated server-side and rendered in an inert browser image surface, not a 3D canvas.
- Documents: PDF is validated as a PDF document and displayed in an authenticated browser document surface. It is not represented as CAD geometry.
- Solid CAD: STEP/STP and IGES/IGS are retained as private upload-only formats. No claim of geometry extraction, conversion, or preview is made without an OCCT conversion worker.

## Libraries Used

| Library | Version | Location | Purpose |
| --- | --- | --- | --- |
| three | 0.185.1 | Frontend/root | 3D and DXF line rendering; format loaders |
| @types/three | 0.185.4 | Frontend/root | Three.js TypeScript types |
| dxf-parser | 1.1.2 | Backend/root | DXF entity and unit parsing |
| i18next | 26.3.6 | Frontend/root | English/Arabic localized CAD states and actions |
| react-i18next | 17.0.11 | Frontend/root | React translation integration |
| opencascade.js | 2.0.0-beta.b5ff984 | Root | Present but not wired into production conversion; no solid-CAD support is claimed |

## Test Results

| Test | Result | Evidence |
| --- | --- | --- |
| STL upload, processing, preview, metadata | Pass | Browser: `tetrahedron.stl` reached Ready; 3D preview reported 1 x 1 x 1 bounds, 0.167 volume, 2.366 area, 4 triangles |
| OBJ upload and processing | Pass | Browser: `tetrahedron.obj` reached Ready |
| PLY upload and processing | Pass | Browser: `tetrahedron.ply` reached Ready |
| DXF upload and processing | Pass | Browser: `rectangle-mm.dxf` reached Ready and was selected for request |
| Multiple-file upload | Pass | Browser uploaded STL, OBJ, PLY, and DXF in one chooser operation; all four independently reached Ready |
| SVG validation and preview metadata | Pass | Backend unit test validates safe SVG and rejects executable SVG |
| PDF validation and preview metadata | Pass | Backend unit test validates `%PDF-` and rejects invalid payloads |
| Exact duplicate behavior | Pass | Existing database integration test verifies original version is returned with no extra storage, version, or job record |
| Ownership enforcement | Pass | Existing database integration test denies a different user geometry, viewer asset, download, and delete access |
| Delete behavior | Pass | Existing database integration test deletes all versions and denies subsequent access |
| Backend CAD unit suite | Pass | `vitest run tests/cad.processing.test.ts`: 13 tests passed |

## Browser Validation

- Desktop, English, system dark: completed with a newly registered authenticated customer account.
- Authentication: private endpoints correctly returned 401 before sign-in; authenticated upload succeeded after registration.
- Console: an existing React `stroke-width` property warning in the auth modal was observed. It is unrelated to CAD processing.
- Browser test coverage was not completed for tablet, mobile, light theme, Arabic, SVG, PDF, STEP, IGES, or duplicate UI due to the available session time. These must not be read as browser-validated.

## Problems Encountered and Fixes

| Problem | Fix |
| --- | --- |
| Vault actions routed to the decorative home sample viewer | Connected cards to the existing authenticated `CadGeometryViewer` modal |
| Vault omitted download/delete controls and polling | Added localized preview, download, delete, confirmation, and real processing-state polling |
| SVG/PDF were absent despite valid browser-specific viewing paths | Added private upload validation, metadata, and appropriate 2D/document viewer selection |
| Full backend test suite cannot run against the active database | Test intentionally requires isolated `cam_labs_phase02_test`; configure `DATABASE_URL` to that database before rerunning |

## Remaining Limitations

- No server-side CAD kernel or worker is configured, so STEP, IGES, BREP, Parasolid, and ACIS cannot be tessellated, measured, or previewed.
- 3MF, GLB/GLTF, OFF, AMF, DWG, and other unsupported formats are rejected rather than falsely advertised.
- SVG metadata is limited to a declared `viewBox`; PDF metadata is intentionally limited.
- Viewer assets currently stream the private original for supported direct-view formats. A future conversion worker should produce segregated GLB assets for solid CAD.
- The browser build reports a pre-existing large JavaScript chunk warning; code splitting is a future performance task.

## Validation Commands

- `npm run lint`: passed for frontend and backend.
- `npm run build`: passed for shared, backend, and frontend.
- `npm run test -- --run tests/cad.processing.test.ts`: passed, 13 tests.
- `npm run test`: 22 passed, 5 skipped, with one database-suite setup failure caused by the required isolated database configuration.
