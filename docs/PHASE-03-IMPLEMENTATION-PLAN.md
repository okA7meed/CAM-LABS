# CAM LABS Phase 03 Implementation Plan

Date: 2026-08-16  
Branch: `phase-03-cad-upload`  
Baseline: `docs/PHASE-01-AUDIT.md` and `docs/PHASE-02-AUTH-REPORT.md`

## Status

**Phase 03 implementation complete under the approved scope.**

## Implementation Checklist

- [x] Add additive Prisma models, indexes, and Phase 03 migration.
- [x] Add storage, scanning, metadata extraction, and durable job domain contracts.
- [x] Implement local filesystem storage and fail-closed scanner behavior.
- [x] Implement upload/version/job/DFM services with idempotent processing.
- [x] Replace the CAD route's in-memory persistence with authenticated durable APIs.
- [x] Add backend tests for security, ownership, versions, jobs, reports, and downloads.
- [x] Add frontend CAD upload, processing status, versions, and report states.
- [x] Update verified environment/configuration documentation.
- [x] Run the complete Phase 03 validation gate and review the Phase 04+ scope boundary.

## Verified Completion Notes

* Phase 02 regression suite: `19 passed, 2 skipped` against `cam_labs_phase02_test`.
* Phase 03 CAD suite: `6 passed` against `cam_labs_phase03_test`.
* Workspace lint/build, Prisma validation/generation, migration status, diagnostics, and whitespace checks passed.
* The Phase 02 database test is intentionally guarded to run only against `cam_labs_phase02_test`; it is run separately from the Phase 03 database suite to preserve its isolation contract.

## 1. Verified Starting Point

* The current branch is `phase-03-cad-upload` and the working tree was clean before this plan document was added.
* Phase 02 authentication code and migrations are present: bcrypt passwords, opaque server-side sessions, authenticated request identity, RBAC, and ownership middleware.
* The Phase 02 report records 15/15 tests passing, build/lint passing, Prisma validation/generation passing, and an isolated PostgreSQL migration verification.
* A fresh `npm test` run passed the auth route suite (9 tests) but stopped at the database suite because the current `DATABASE_URL` is not pointed at the required isolated `cam_labs_phase02_test` database. This is an environment prerequisite, not a Phase 03 code failure.
* The Prisma schema has a `CadFile` model with display metadata only. It has no durable storage key, content checksum, scan state, processing job, DFM report, or version relation.
* `backend/src/routes/cad.routes.ts` currently stores registrations in an in-memory array. The existing list route is authenticated and filters by `req.auth.id`; the validation route remains public.
* `backend/src/services/cadValidation.service.ts` checks extension and a 150 MB boundary, then returns simulated dimensions, volume, and surface area. It does not parse CAD bytes or perform DFM analysis.
* `frontend/src/components/configurator/ConfiguratorModal.tsx` and `frontend/src/hooks/useCadViewer.ts` provide the current CAD UI boundary. The viewer renders generated demo meshes; it does not load uploaded files.
* Existing repository scope searches found no object-storage adapter, antivirus scanner, metadata parser, queue/worker, durable CAD job, DFM report, or CAD version implementation.
* The project roadmap in `PHASE-01-AUDIT.md` defines Phase 03 as CAD and file processing. Phase 02 explicitly confirms that no Phase 03+ functionality was introduced.

## 2. Phase 03 Scope

### Included

1. Authenticated CAD upload and durable file records owned by the requesting user.
2. Object-storage boundary with a development/test implementation and a production-configurable implementation.
3. Upload security: size and extension checks, MIME/content consistency checks, generated storage keys, checksum verification, safe filenames, and request/body limits appropriate for CAD files.
4. File scanning through a scanner port with explicit pending/clean/quarantined/failed states and fail-closed behavior before processing.
5. Supported-format metadata extraction for the formats already named by the repository (`STEP`, `STP`, `STL`, `OBJ`, `DXF`, `IGES`, and `IGS`), with parser capability and unsupported-parser outcomes represented honestly.
6. Durable asynchronous processing jobs for metadata extraction and DFM analysis, including retry/error state and idempotent processing of a file version.
7. Persisted DFM report summaries and findings for the Phase 03 checks that can be implemented without a native manufacturing engine.
8. Immutable CAD file versions, current-version selection, and ownership-preserving access rules.
9. Typed backend API contracts and frontend upload/status/file-list/report states.
10. Focused unit, route, storage/scanner, and PostgreSQL integration tests plus verified documentation.

### Explicitly excluded

Native manufacturing, pricing redesign, marketplace, payments, shipping, maker/admin business workflows, notifications, analytics, localization, production scheduling, and any Phase 04+ feature remain out of scope.

## 3. Proposed Technical Design

### Database

Extend `CadFile` to represent a logical file and its current version without changing Phase 02 identity/session behavior. Add a related version model (proposed `CadFileVersion`) with:

* immutable version number and parent logical file relation;
* original filename, normalized extension, MIME type, byte size, SHA-256 checksum, and private storage key;
* upload, scan, and processing states with timestamps and failure reason fields;
* extracted metadata JSON plus normalized dimensions/volume/triangle fields where available;
* authenticated ownership through the existing user relation and indexes for `(userId, updatedAt)` and job/status lookup.

Add durable `CadProcessingJob` and `DfmReport` records. Jobs reference one version, use a uniqueness/idempotency constraint for the processing operation, and record attempts, status, lease/completion timestamps, and error details. Reports reference the processed version and record an overall result plus structured findings. Use Prisma enums only where existing string data will not make the migration unsafe; preserve existing `CadFile` rows through a baseline-compatible migration/backfill.

The migration must be additive and tested against an isolated PostgreSQL database. Existing Phase 02 `User`, `Session`, roles, and ownership relations must remain unchanged.

### Storage and scanning

Introduce narrow ports under the backend CAD boundary:

* `ObjectStorage`: put, read/stream, delete, and existence/checksum operations using private generated keys.
* `FileScanner`: scan a stream/object and return a typed verdict.
* `CadMetadataExtractor`: identify the supported format and return parser metadata or a typed unsupported/invalid result.
* `CadProcessingQueue`: enqueue and claim durable jobs.

Use a local filesystem storage adapter for development/tests, rooted outside the public frontend directory. Add a production-configurable object-storage adapter behind environment configuration; credentials and bucket names must come from environment variables and never from source. The scanner must be fail-closed when scanning is required but unavailable. Tests will use deterministic fakes and will not claim that a fake is antivirus protection. The production adapter choice and exact service (for example, ClamAV-compatible scanning and S3-compatible storage) will be isolated behind the ports.

### Processing model

Keep the first implementation as a modular-monolith worker boundary, not a new service. Upload creates a version and a pending scan/job record transactionally after the object is stored. A worker/application service claims jobs, verifies the object checksum, scans it, extracts metadata, runs the Phase 03 DFM checks, persists the report, and transitions the version to a terminal state. Claiming must be safe against duplicate requests and retries. No quote, order, pricing, or manufacturing provider flow will be changed.

The initial DFM report will be limited to deterministic file/metadata checks available from the selected parser boundary, such as unsupported/invalid geometry, missing or invalid dimensions, empty meshes, and configured file-size/format constraints. It will not be presented as a full manufacturing simulation or native CAM engine.

### API

Preserve the existing `/api/v1/cad-files` route and its authentication boundary. Replace only its in-memory implementation with the durable service. Proposed endpoints:

* `POST /api/v1/cad-files` — multipart upload; authenticated ownership; returns accepted version and processing status.
* `GET /api/v1/cad-files` — current user’s logical files, with optional status filtering.
* `GET /api/v1/cad-files/:id` — owned file/version summary.
* `GET /api/v1/cad-files/:id/versions` — owned version history.
* `GET /api/v1/cad-files/:id/versions/:version` — owned version metadata/status/report summary.
* `GET /api/v1/cad-files/:id/download` — authenticated private stream; never expose a raw storage path.
* `GET /api/v1/cad-files/:id/dfm-report` — owned persisted report when available.
* `POST /api/v1/cad-files/validate` — retain the existing public pre-flight contract, remove simulated geometry claims, and keep it independent from ownership.

Use runtime validation for params/query/body metadata, consistent existing response/error helpers, bounded multipart handling, and ownership checks based only on `req.auth.id`. Do not add a client-supplied `userId` path. Admin elevation should use the existing authorization policy only where the product already has a legitimate administrative read need; no new admin business workflow is introduced.

### Frontend

Add a focused CAD vault/upload surface within the existing authenticated dashboard/configurator composition:

* file picker with supported-format and 150 MB feedback;
* upload progress and accepted/pending/scanning/processing/ready/quarantined/failed states;
* durable file list and version history loaded from the API;
* metadata and DFM report summary once processing completes;
* retry/status refresh affordance for failed processing;
* clear empty, loading, unauthorized, and error states.

Keep the generated viewer as an explicit demo fallback until a real parser/rendering boundary exists. Do not claim that the viewer displays uploaded geometry unless that behavior is implemented and tested.

## 4. Implementation Sequence After Approval

1. Add typed domain contracts and storage/scanner/extractor/queue ports without changing existing auth code.
2. Add Prisma models/migration and a focused migration/invariant test.
3. Implement local storage, deterministic scanner/extractor adapters, upload service, and durable job service.
4. Replace only the CAD route internals, preserving Phase 02 middleware and ownership behavior.
5. Add route/unit/integration tests, including traversal, oversized/mismatched files, checksum mismatch, quarantine, retries, duplicate processing, version ownership, and private download behavior.
6. Add the frontend CAD upload/status/report components and typed API methods.
7. Update environment examples and this document with only verified configuration and behavior.
8. Run the complete validation gate in an isolated PostgreSQL test environment.

## 5. Validation Gate

Before reporting completion, verify all of the following:

* Prisma validation and generation pass.
* The Phase 03 migration applies cleanly after baseline and Phase 02 migrations.
* `npm test` passes with the database suite pointed at isolated `cam_labs_phase02_test` or a separately isolated Phase 03 test database.
* Existing Phase 02 authentication, RBAC, session, and ownership tests remain passing.
* Backend and frontend builds pass.
* Both workspace lint/type checks pass.
* Upload, scan, processing, DFM, version, ownership, and private-download tests pass.
* No secrets are present in source, fixtures, generated artifacts, or environment templates.
* A final scope review finds no Phase 04+ functionality.

## 6. Approval Decisions Needed

Please approve the plan as written, or specify changes to these two implementation choices before coding begins:

1. **Storage:** local filesystem adapter for development/tests plus a production-configurable object-storage adapter behind an interface, with private authenticated downloads.
2. **Processing:** durable database-backed jobs executed through a modular-monolith worker/application service, with deterministic test adapters and no new queue service in Phase 03.

Once approved, implementation will begin at step 1 and remain limited to this document’s Phase 03 scope.