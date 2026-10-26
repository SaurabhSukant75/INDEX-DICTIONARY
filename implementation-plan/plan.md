# Implementation Plan: Index Dictionary Static MVP

**Date**: 2026-10-27 | **Spec**: [`../index-dictionary-prd-v1.2.html`](../index-dictionary-prd-v1.2.html), [`../index-dictionary-ui-ux-v1.md`](../index-dictionary-ui-ux-v1.md), [`../index-dictionary-architecture-mvp-v1.0.md`](../index-dictionary-architecture-mvp-v1.0.md)

## Summary

Implement the approved static-only MVP as a dependency-free web application using plain HTML, CSS, and browser JavaScript. Keep book content as standalone files in `book/`, shared catalog/navigation metadata in versioned JSON, and private reader imports and reading state in IndexedDB. The UI will implement discovery, topic taxonomy, concept graph, ordered learning paths, a sandboxed reading shell, and a private local library/import flow.

This owner-confirmed static scope supersedes the architecture document's proposed runtime catalog API and relational database for this implementation. It cannot provide a secure editor service or enforce revocation of already-public static book files. FR-040 through FR-042 remain product direction but are deferred; manual catalog/file changes and repository-host access controls are the interim publication workflow. The limitation must remain explicit until a backend/editor phase is approved.

**Execution checkpoint (2026-10-27):** T001–T015 completed (15/15 tasks). The app now implements the responsive shell, catalog discovery, taxonomy, concept graph, learning paths, a validated sandboxed reader, a private library with collections/bookmarks/reading continuity, preview-first local HTML imports, and safe public book/page sharing. Final keyboard, assistive-technology semantics, responsive, reduced-motion, privacy, integrity, storage-failure, and static-hosting checks are recorded in the release verification docs.

## Technical Context

**Language/Version**: HTML5, CSS, browser JavaScript modules (ES2020+); no TypeScript or frontend framework. Existing host Node.js 18.19.1 and Python 3.12.3 are available for local validation/preview only.  
**Primary Dependencies**: None at runtime or build time.  
**Storage**: `data/catalog.json` for public catalog metadata; browser IndexedDB for local books, collections, bookmarks, progress, history, and path completion. No server-side DB in this phase.  
**Testing**: Dependency-free Node.js validation for JSON/catalog integrity and JavaScript syntax; browser validation for UI, iframe isolation, responsive behavior, and core flows.  
**Target Platform**: Static web hosting over HTTP(S); current stable Chrome, Edge, Firefox, Safari, plus mobile Chrome/Safari. Opening the app through `file://` is not the supported run mode because ES modules and `fetch()` require an HTTP origin.  
**Performance Goals**: Respect PRD NFR-04: target LCP ≤ 2.5 seconds under a documented mobile profile; avoid unnecessary dependencies and defer nonessential work.  
**Constraints**: Do not add a package manager manifest or third-party library without an explicit need/approval. Never store book HTML in catalog JSON. Imported HTML is untrusted and must be rendered in an isolated frame. Static publication is public; removing catalog JSON does not guarantee revocation of direct or cached static file URLs.

## Constitution Check

No project `constitution.md` is present. The plan uses the approved product/architecture constraints as its baseline:

| Principle | Result | Evidence |
|---|---|---|
| Keep book content outside catalog data | PASS | HTML remains in `book/`; JSON contains metadata and relative content paths only. |
| Keep reader data local and private | PASS | IndexedDB is the only planned persistence for local imports, collections, bookmarks, and progress; no network API is introduced. |
| Isolate active HTML from app privileges | PASS | Reading/import preview uses sandboxed frames with the minimum required script permission and no same-origin permission. |
| Keep taxonomy, graph, and sequence distinct | PASS | Separate JSON structures and separate browsing views. |
| Avoid false success on storage/validation errors | PASS | User-facing recoverable error states are planned for import, local storage, and missing content. |
| Provide authenticated editor publishing | DEFERRED BY OWNER SCOPE | A static-only app has no trusted server boundary; no client-side password or hidden editor route will be treated as authorization. |

## Applied Guidelines

No matching framework migration guideline applies. The implementation intentionally uses native browser APIs and static files. Content isolation and validation follow the repository's architecture/PRD constraints.

## Implementation Steps

### Phase 1: Setup

#### Step 1: [Cross-cutting] Establish the static project scaffold and verify the stack
- **Requirements**: FR-040, FR-041, FR-042 (scope boundary), NFR-05, NFR-07
- **Design inputs**: UI/UX brief; architecture folder layout and book boundary; owner decision for plain HTML/CSS/JavaScript and static-only delivery.
- **Description**: Create the static app entrypoint and source/data/test folder layout without adding a framework, build step, or package dependencies. Document local HTTP preview, toolchain verification, static deployment expectations, and the fact that editor authentication/database publishing is deferred. Update the PRD and architecture status/addendum so they no longer describe the API/database as the active MVP baseline. This is the first task to execute.

**Tasks**
- [ ] T001 [Plan:1.1] Create the no-dependency HTML/CSS/JavaScript project scaffold, document local preview and deployment, and record the owner-approved static-only boundary in the PRD and architecture.

### Phase 2: Foundational catalog and shell

#### Step 2: [Cross-cutting] Define and validate the static catalog
- **Requirements**: FR-001, FR-010, FR-060, FR-063, FR-065, NFR-08
- **Design inputs**: PRD catalog model; architecture schemas; five prototype book files in `book/`.
- **Description**: Define the versioned JSON shape and seed entries for all five sample files, with stable book IDs, metadata, topic assignments, concept links, typed graph edges, and ordered learning-path items. Add a dependency-free validator for unique IDs, safe relative `book/` paths, existing files, valid references, taxonomy consistency, and contiguous path positions. Keep title/content hashes as optional validation metadata, not identifiers or security controls.

**Tasks**
- [x] T002 [Plan:2.1] Define `data/catalog.json` for five sample books; add `scripts/validate-catalog.js` and `tests/catalog-validator.test.js` to validate IDs, references, safe `book/` paths, taxonomy, concepts, and contiguous learning-path positions.

#### Step 3: [Cross-cutting] Build the responsive library shell and navigation
- **Requirements**: FR-001, FR-004, FR-010, NFR-01, NFR-02, NFR-07
- **Design inputs**: UI/UX page inventory and prototype; stable-route architecture.
- **Description**: Implement semantic app layout, Home, navigation, responsive mobile menu, loading/error boundaries, and stable view/URL navigation using native browser APIs. Separate reusable catalog rendering from route handling.

**Tasks**
- [x] T003 [Plan:2.2] Implement the semantic app shell, responsive navigation, accessible status/error regions, and stable client-side views in `index.html`, `src/navigation/router.js`, `src/views/`, and `src/css/`.

### Phase 3: US-01/US-02 catalog discovery and search

#### Step 4: [US1] Implement catalog cards, search, filters, and empty/error states
- **Requirements**: FR-001, FR-002, FR-003, FR-004, FR-010
- **Design inputs**: PRD US-01/US-02; UI/UX Search and Home.
- **Description**: Render the static catalog, search title/description/topic/tag/concept text, combine search and clearable filters, and retain the query in the no-results state with clear-search and browse-all recovery actions.

**Tasks**
- [x] T004 [US1] [Plan:3.1] Implement catalog cards, metadata search, combinable topic filters, query-preserving no-results recovery, and catalog loading/error states in `src/services/catalog-service.js`, `src/services/search-service.js`, and `src/views/search.js`.

### Phase 4: US-10 hierarchical taxonomy

#### Step 5: [US10] Implement taxonomy browsing and breadcrumbs
- **Requirements**: FR-060, FR-061, FR-062
- **Design inputs**: PRD taxonomy schema; UI/UX Topics page.
- **Description**: Render parent/child topics in declared display order, show breadcrumbs, list direct assignments, and support an explicit include-descendants option. Preserve a primary topic for cards/default navigation.

**Tasks**
- [x] T005 [US10] [Plan:4.1] Implement ordered parent/child taxonomy browsing, breadcrumbs, primary topic display, direct assignments, and include-descendants filtering in `src/views/topics.js`.

### Phase 5: US-11 knowledge graph

#### Step 6: [US11] Implement bounded concept graph exploration
- **Requirements**: FR-063, FR-064
- **Design inputs**: PRD concept/edge model; UI/UX graph exploration view.
- **Description**: Render a bounded view of stable concept IDs and typed/directed labeled edges with linked books and roles. Make clear that graph relationships are not a curriculum; keyboard navigation and a textual relationship list must remain available.

**Tasks**
- [x] T006 [US11] [Plan:5.1] Implement a bounded, labeled concept graph and keyboard-accessible textual relationship view in `src/views/concepts.js`.

### Phase 6: US-12 learning sequences

#### Step 7: [US12] Implement ordered learning paths and local completion display
- **Requirements**: FR-065, FR-066
- **Design inputs**: PRD ordered path model; UI/UX Learning Paths page.
- **Description**: Display contiguous positions beginning at 1, required/optional labels, previous/next links, and local completion state. Do not infer order from JSON object order, taxonomy, or graph edges.

**Tasks**
- [x] T007 [US12] [Plan:6.1] Render explicit learning-path positions, required/optional status, step navigation, and local completion in `src/views/learning-paths.js`.

### Phase 7: US-03 independent book reading

#### Step 8: [US3] Implement stable reader routes and isolated HTML rendering
- **Requirements**: FR-011, FR-012, FR-013, FR-004, NFR-02, NFR-06
- **Design inputs**: Architecture reader isolation policy; UI/UX reader-shell boundary; existing independent sample HTML files.
- **Description**: Load the selected standalone HTML by catalog content path into a sandboxed iframe. Keep shell navigation outside the book gesture surface. Support book contents and visible/keyboard book controls, validated book/page fragments, refresh restoration, and explicit missing/invalid-content states.

**Tasks**
- [x] T008 [US3] [Plan:7.1] Implement stable book/page routing, a sandboxed iframe with no same-origin permission, return-to-library control, keyboard navigation, and missing/invalid content states in `src/views/reader.js` and `src/services/book-service.js`.

#### Step 9: [US3/US6] Connect book navigation events to app-owned progress safely
- **Requirements**: FR-013, FR-032, FR-033
- **Design inputs**: Architecture allowlisted `postMessage` protocol and IndexedDB progress model.
- **Description**: Add a narrowly scoped book-ready/page-changed message to the sample books and validate `event.source`, message type, book identity, and known page IDs in the shell. Do not allow child commands to navigate the parent or access catalog/app state.

**Tasks**
- [x] T009 [US3] [Plan:7.2] Add the allowlisted page-change protocol to the five `book/book-*.html` samples and validate message source/schema/book/page IDs in `src/services/book-service.js`.

### Phase 8: US-04/US-06 private library and continuity

#### Step 10: [US4/US6] Create versioned IndexedDB storage services
- **Requirements**: FR-030, FR-031, FR-032, FR-033, FR-034, FR-066, NFR-03, NFR-05
- **Design inputs**: Architecture IndexedDB schema and delete semantics; PRD local privacy boundary.
- **Description**: Implement versioned object stores and typed-by-validation service functions for local books, collections, collection membership, saves, bookmarks, reading progress, and path completion. Use transactions for related writes/deletes and surface quota/unavailable errors.

**Tasks**
- [x] T010 [US4] [Plan:8.1] Create versioned IndexedDB stores and transaction-safe persistence helpers with explicit unavailable/quota errors in `src/services/reader-library-service.js`.

#### Step 11: [US4/US6] Implement My Library, collections, bookmarks, and resume
- **Requirements**: FR-030, FR-031, FR-032, FR-033, FR-034
- **Design inputs**: UI/UX My Library; PRD state precedence and local-data controls.
- **Description**: Add saved/recent/in-progress/imported views, create/rename/delete collections, add/remove books, bookmark actions, resume/restart behavior, completion, and confirmed clear/delete actions. URL page references take precedence over saved progress.

**Tasks**
- [x] T011 [US4] [Plan:8.1] Implement saved/recent/in-progress library views, collection CRUD, bookmarks, resume/restart, completion, and confirmed data deletion across `src/views/library.js`, `src/js/app.js`, `src/navigation/router.js`, and `src/views/reader.js`.

### Phase 9: US-05 private HTML imports

#### Step 12: [US5] Implement validated local import, preview, and lifecycle
- **Requirements**: FR-020, FR-021, FR-022, FR-023, NFR-03, NFR-05, NFR-06
- **Design inputs**: PRD import journey, proposed 2 MiB limit and security policy; architecture local-book schema.
- **Description**: Accept one `.html`/`.htm` file, enforce size/content checks and actionable errors, derive editable title metadata, preview only in a sandbox, require user confirmation before IndexedDB persistence, and support rename/category/collection/delete. Never upload or add imported HTML to the shared catalog.

**Tasks**
- [x] T012 [US5] [Plan:9.1] Implement HTML file checks, editable title/category, restrictive sandbox preview, confirmed IndexedDB import, collection assignment, and local-book update/delete in `src/views/library.js`, `src/js/app.js`, `src/services/book-service.js`, and `src/services/reader-library-service.js`.

### Phase 10: US-08 sharing

#### Step 13: [US8] Add public book/page sharing and safe local-only handling
- **Requirements**: FR-050
- **Design inputs**: PRD stable public URL rules; UI/UX reader controls.
- **Description**: Add copy/share-link actions for published static catalog books and validated page fragments. Do not expose local-book contents in a share URL; explain that local-only books are available only on this device.

**Tasks**
- [x] T013 [US8] [Plan:10.1] Implement native public-book sharing, validated page-link copy with fallback behavior, and device-only messaging for local imports in `src/views/reader.js` and `src/js/app.js`.

### Phase 11: US-09 and cross-cutting quality

#### Step 14: [US9] Complete keyboard, assistive technology, responsive, and reduced-motion behavior
- **Requirements**: FR-012, FR-051, NFR-01, NFR-02, NFR-07
- **Design inputs**: PRD WCAG 2.2 AA target; UI/UX accessibility and responsive principles.
- **Description**: Verify all primary flows with keyboard and assistive-technology semantics, visible focus, status announcements, text zoom, reduced motion, and no horizontal overflow down to 320 CSS px.

**Tasks**
- [x] T014 [US9] [Plan:11.1] Complete semantic labels, focus behavior, status announcements, reduced-motion styling, text scaling, and 320px responsive behavior across `index.html` and `src/css/`.

#### Step 15: [Cross-cutting] Verify privacy, integrity, browser compatibility, and static deployment
- **Requirements**: FR-004, FR-023, FR-042 (static-only limitation), NFR-03, NFR-04, NFR-05, NFR-06, NFR-07, NFR-08
- **Design inputs**: PRD quality/release criteria; static-only scope; catalog validator and sandbox policy.
- **Description**: Run catalog/path validation and browser journeys for discovery, reading, local persistence, import, and graph/path browsing. Verify no local content/state is sent over the network, handle missing files and storage failures, check supported browsers and mobile breakpoints, document LCP test profile, and publish static deployment instructions. Record that static file publication cannot offer authenticated in-app editing or guaranteed immediate revocation.

**Tasks**
- [x] T015 [Plan:11.2] Add/run static catalog and book-integrity checks, execute the browser/privacy/accessibility matrix, and document hosting and static-revocation limitations in `scripts/`, `tests/README.md`, and `README.md`.

## Project Structure

```text
index-dictionary/
├── index.html                     # Static app entrypoint
├── src/
│   ├── css/
│   │   ├── tokens.css
│   │   ├── app.css
│   │   └── reader.css
│   ├── navigation/
│   │   └── router.js
│   ├── services/
│   │   ├── catalog-service.js
│   │   ├── search-service.js
│   │   ├── book-service.js
│   │   └── reader-library-service.js # IndexedDB; no account/user service in static MVP
│   └── views/
│       ├── home.js
│       ├── search.js
│       ├── topics.js
│       ├── concepts.js
│       ├── learning-paths.js
│       ├── library.js
│       └── reader.js
├── data/
│   └── catalog.json               # Public metadata only; no HTML content
├── book/                          # Existing independent static HTML book documents
├── scripts/
│   └── validate-catalog.js        # Dependency-free structural/path validation
├── tests/
│   └── README.md                  # Browser/manual validation matrix and fixtures
├── static-mvp-decisions.md       # Scope boundary and deferred server-side work
└── README.md                      # Run, verify, and deploy static app
```

## Testing Strategy

- **appType**: Static client-side web application with isolated HTML reader frames.
- **Critical user journeys**:
  1. Search and filter catalog entries, recover from zero matches, and open the intended book.
  2. Browse taxonomy, concept relationships, and explicitly ordered learning paths.
  3. Open a public book at a stable page link, navigate by keyboard/contents, and return to the library.
  4. Import a supported book locally, preview it safely, organize it, and resume it.
  5. Save/organize a catalog book, track progress, clear data, and verify no private state is transmitted.
- **primaryValidationStack**: Node.js built-ins for JSON/script/path checks; integrated browser for runtime and responsive journeys; no package installs.
- **fallbackMatrix**:
  - `infra-tier`: No service/container required → serve static files using Python 3's built-in HTTP server or the editor's equivalent static preview.
  - `browser-tier`: Integrated browser and supported-browser matrix → Node.js syntax/JSON/path checks if a browser is unavailable (does not validate runtime DOM, accessibility, or iframe behavior).
- **Environment requirements**: HTTP(S) origin for ES modules, `fetch()`, IndexedDB, and iframe behavior; Node.js 18+ for validators; Python 3 optional for local static preview.
- **knownGaps**: In the absence of multiple installed browsers, compatibility claims remain unverified outside the integrated browser. Static-only mode cannot verify backend authorization, database behavior, or immediate unpublishing.
- **Test data strategy**: Five existing numbered sample copies with distinct stable catalog IDs and independent IndexedDB keys; tests use a dedicated browser profile/database name and clear it after verification.
- **Acceptance criteria**: Catalog validator passes; each sample path resolves; no-result state retains the query; all three catalog models are separate; reader frame has no same-origin permission; import validation rejects invalid/oversized inputs before persistence; local storage failures show errors; public page URL overrides saved position; no private import/progress network requests occur.
- **Validation review expectations**: Confirm FR-040–042 are explicitly deferred rather than simulated client-side; confirm every static data reference resolves; verify accessibility and responsive criteria manually in a real browser.

## Complexity Tracking

No constitution violations require justification. Delayed secure editor publishing is a confirmed scope limitation, not a technical workaround.

## Requirement Mapping

| FR ID | Description | Plan Items | Implementation Evidence |
|---|---|---|---|
| FR-001 | Show catalog books and open action | 2.1, 2.2, 3.1 | `data/catalog.json`, `src/services/catalog-service.js`, Home/catalog rendering |
| FR-002 | Search title, description, category, tags; combine filters | 3.1 | Search module and filter controls |
| FR-003 | Useful no-results state with query, clear, browse | 3.1 | Search empty-state rendering and recovery actions |
| FR-004 | Loading, empty, and recoverable errors | 2.2, 3.1, 7.1, 11.2 | Catalog/reader state UI |
| FR-010 | Stable book identity and metadata | 2.1, 2.2 | Catalog schema, validator, stable routes |
| FR-011 | Readable book with contents and return path | 7.1 | Sandboxed reader route and sample-book navigation |
| FR-012 | Visible and keyboard navigation; gestures optional | 7.1, 11.1 | Reader controls and accessibility checks |
| FR-013 | Stable book/page URLs and validated restoration | 7.1, 7.2, 8.2 | Router, fragment validation, book protocol |
| FR-020 | Import, preview, edit title/metadata | 9.1 | Import view and IndexedDB `localBooks` |
| FR-021 | Private local imports distinct from shared books | 9.1, 8.2 | Local-only metadata and no-network verification |
| FR-022 | Rename, categorize, organize, delete local books | 9.1, 8.2 | Local-book CRUD and collection memberships |
| FR-023 | Reject unsupported/malformed/oversized files clearly | 9.1, 11.2 | Import validation and actionable errors |
| FR-030 | Save books and manage collections | 8.1 | IndexedDB collection/saved-book services and UI |
| FR-031 | My Library shows saved/imported/recent/unfinished | 8.1 | My Library selectors and views |
| FR-032 | Persist progress, bookmarks, completion locally | 7.2, 8.1 | Validated book events and IndexedDB progress |
| FR-033 | URL page wins; otherwise resume/restart | 7.1, 8.1 | Route precedence and resume prompt |
| FR-034 | Clear data and clean dependent records on deletion | 8.1, 9.1 | Transactional delete/clear controls |
| FR-040 | Authenticated editor publishing | 1.1 | Explicitly deferred in static-only MVP; future editor service requires server-side authentication |
| FR-041 | Metadata/file verification and explicit publish | 1.1, 11.2 | Documented manual repo/deploy workflow only; no editor UI or automated CI enforcement in this phase |
| FR-042 | Public access and unpublish/revocation behavior | 1.1, 11.2 | Public static catalog is supported; guaranteed revocation is deferred and documented as a static-hosting limitation |
| FR-050 | Public sharing; do not expose local books | 10.1 | Share/copy URL actions and local-only guard |
| FR-051 | Reduced-motion optional enhancements | 11.1 | CSS media query and interaction verification |
| FR-060 | Stable hierarchical taxonomy and breadcrumbs | 4.1 | Taxonomy JSON and tree/breadcrumb view |
| FR-061 | Multiple taxonomy assignments and primary topic | 2.1, 4.1 | Catalog topic references and primary-topic selection |
| FR-062 | Direct/descendant topic browsing | 4.1 | Explicit descendant filter behavior |
| FR-063 | Stable concepts and typed directed edges | 2.1, 5.1 | Concept/edge JSON and graph rendering |
| FR-064 | Bounded labeled graph, no implied sequence | 5.1 | Graph limits, relationship labels, textual access |
| FR-065 | Contiguous editor-curated order starting at 1 | 2.1, 6.1 | Path schema and catalog validator; editing/publishing is repository-maintained |
| FR-066 | Path steps and local completion | 6.1, 8.1 | Ordered path view and IndexedDB path progress |

## Requirement Mapping: Quality

| NFR ID | Plan Items | Validation Evidence |
|---|---|---|
| NFR-01 | 2.2, 3.1, 4.1, 5.1, 7.1, 11.1 | Semantic/keyboard/screen-reader checks |
| NFR-02 | 2.2, 7.1, 11.1 | 320px, tablet, desktop layout checks |
| NFR-03 | 8.1, 9.1, 11.2 | IndexedDB unavailable/quota failure cases |
| NFR-04 | 11.2 | Documented mobile LCP profile and measured result |
| NFR-05 | 1.1, 8.1, 9.1, 11.2 | Network inspection; no user files/progress sent |
| NFR-06 | 7.1, 9.1, 11.2 | Sandbox permissions, unsafe import and frame-isolation checks |
| NFR-07 | 1.1, 11.1, 11.2 | Supported browser matrix; feature-detection cases |
| NFR-08 | 2.1, 11.2 | Catalog integrity validator and missing-file/reference fixtures |
