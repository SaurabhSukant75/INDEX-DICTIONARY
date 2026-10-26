# Index Dictionary — MVP Architecture and Technical Decisions

**Status:** Proposed future architecture; static-only MVP amendment approved 2026-10-27  
**Companion product document:** [Index Dictionary PRD v1.2](./index-dictionary-prd-v1.2.html)  
**Scope:** Public book discovery and reading, reader-local imports and progress, and editor-only publishing.

> **Implementation scope amendment (2026-10-27):** The owner selected a static-only initial implementation using plain HTML, CSS, and browser JavaScript. For that MVP, `data/catalog.json` replaces the proposed catalog API/database; `book/` remains static content; IndexedDB remains the private reader store. An in-app editor, authenticated metadata service, relational database, and guaranteed unpublishing/revocation are deferred. The detailed API/database sections below are future design reference, not requirements for the static MVP. Repository changes and static redeployment are the interim catalog publishing workflow; repository permissions are not an in-app editor authorization system.

## 1. Executive decision

For the owner-approved static MVP, build a dependency-free web application around a **Book content module**:

- `book/` contains the actual HTML book files. Book content is never stored in the relational database.
- `data/catalog.json` stores searchable metadata, stable book identifiers, organization, and relative book paths. It is version-controlled and manually edited.
- Catalog organization has three distinct, connected structures: a hierarchical taxonomy for browsing, a knowledge graph for semantic relationships, and explicitly ordered learning paths for progression.
- Stable book IDs identify entries; a title hash is not an ID, a security token, or a replacement for search. Database indexing is not part of the static MVP.
- Public readers fetch a published book from the deployed `book/` directory through the reader route. The reader displays it in a restrictive sandbox.
- Reader imports, collections, bookmarks, and progress remain in the browser's IndexedDB in the MVP. Reader accounts and cloud sync are not included.
- Catalog changes and book files are manually committed and deployed together. There is no authenticated editor service, metadata database, or server-side publication verification in the static MVP.
- Static catalog removal does not guarantee immediate revocation of direct or cached book URLs. Do not claim otherwise.

The relational catalog/API design below remains a possible future phase. It is not active until the owner approves a server-side stack and scope.

## 2. Architecture at a glance

```text
                         Public read path
┌───────────────┐  GET catalog / book metadata  ┌────────────────┐
│ Reader browser├──────────────────────────────►│ Catalog API    │
└───────┬───────┘                                └───────┬────────┘
        │ GET published HTML                             │ SQL metadata
        ▼                                                ▼
┌────────────────────┐                           ┌────────────────┐
│ Deployed book/ files│                           │ Catalog DB     │
│ book/{book-id}/... │                           │ metadata/hash  │
└─────────┬──────────┘                           └────────────────┘
          │
          ▼
┌──────────────────────────────┐
│ Reader shell + sandboxed frame│  Local reader state → IndexedDB
└──────────────────────────────┘

                    Editor catalog + manual deploy
┌─────────────────┐ metadata only  ┌──────────────────┐
│ Editor catalog  ├────────────────►│ Catalog service  │
│ form            │                 │ creates draft    │
└─────────────────┘                 └────────┬─────────┘
                                             │ catalog DB draft
┌─────────────────┐ manually add HTML ┌─────────────────┐
│ Maintainer      ├───────────────────►│ Repository book/│
│ / content author│                    │ + site deploy   │
└─────────────────┘                    └────────┬────────┘
                                                 │ CI validates path/hash
                                                 │ editor publishes metadata
                                        ┌────────▼────────┐
                                        │ Deployed book/  │
                                        │ + public entry  │
                                        └─────────────────┘
```

### Components and responsibilities

| Component | Responsibility | MVP boundary |
|---|---|---|
| Library UI | Search, taxonomy browse, concept graph, learning paths, book cards, no-results state, My Library | Static web frontend; no reader login |
| Reader shell | Load a book, display progress, process book/page navigation, show errors | Parent application owns app state and URL |
| Book module (`book/`) | Store manually added HTML documents and approved local assets | Version-controlled files deployed with the site; not database content |
| Catalog API | List/search public metadata and resolve a book identifier to its published file | Read-only public endpoints |
| Catalog editor service | Authenticate editors and create/update catalog metadata records | Metadata only; never receives or writes book HTML |
| Catalog database | Store catalog metadata, stable IDs, title hash, deployed content hash, revision and status | No HTML document bodies |
| Taxonomy | Organize books under a single-parent category tree | Database adjacency list; books may be tagged to multiple taxonomy nodes |
| Knowledge graph | Connect concepts with typed, directed relationships and associate books with concepts | Database concept and edge tables |
| Learning paths | Present a deliberate ordered sequence of books | Database path and ordered item tables; editors curate order explicitly |
| Reader IndexedDB | Store private imports, collections, saved books, bookmarks, progress and history | Per-browser/per-device only |
| Repository/deployment workflow | Validate draft catalog references against repository files, deploy Book files, then record verification before catalog publication | Protected repository access controls who can add files and merge publishing changes |

## 3. Key decisions

| ID | Decision | Rationale / consequence |
|---|---|---|
| ADR-01 | Keep HTML outside the database in a `book/` module. | HTML is content, versionable and served as a file. The DB remains small and queryable. |
| ADR-02 | Store catalog metadata and hashes in the DB. | The DB provides discovery, publication state, and file lookup without becoming a content blob store. |
| ADR-03 | Use a generated, immutable `book_id` as the canonical identifier. | Titles can change and can collide. URLs and relationships must not depend on a title hash. |
| ADR-04 | Store `title_hash = SHA-256(normalize(title))` as a non-unique lookup index. | Supports exact normalized-title lookup. It does not support substring/full-text search and is not a secret. |
| ADR-05 | Store `content_sha256` for each deployed revision. | Verify manually committed file integrity and detect deployment/catalog mismatch. |
| ADR-06 | Keep reader data in IndexedDB; do not create reader accounts for MVP. | HTML files exceed the intended use of localStorage; local state matches the PRD privacy boundary. |
| ADR-07 | Require editor authentication for catalog metadata and publication-state changes. | A hidden admin URL is not authorization. The catalog service must enforce roles. |
| ADR-08 | Render book HTML in a sandboxed iframe with a restrictive policy. | Book HTML is executable content and must not share the application’s origin privileges. |
| ADR-09 | Keep public book URLs stable by ID/slug, with page position in a URL fragment. | Human-readable navigation is independent of the stored title hash and file revision. |
| ADR-10 | MVP accepts one self-contained HTML file per book, added manually to the repository. | Matches the sample book and keeps the metadata service and deployment process simple. Multi-file bundles are a later decision. |
| ADR-11 | Add book files manually to versioned repository paths; update catalog pointers rather than overwriting a published revision. | Git history provides rollback; versioned URLs avoid serving stale cached HTML. |
| ADR-12 | Serve the repository's deployed `book/` directory as static content. | Site deployment publishes the file; no runtime file store or upload API is needed. |
| ADR-13 | Model taxonomy, knowledge graph, and learning paths as separate catalog structures. | They answer different questions: where to browse, what is related, and what to learn next. Do not overload categories or graph edges to represent progression. |
| ADR-14 | Use a single-parent taxonomy tree with many-to-many book assignments. | Predictable breadcrumb/child navigation, while allowing a book to appear under more than one relevant topic. |
| ADR-15 | Keep knowledge graph edges typed and directional. | Relationship meaning is explicit (`prerequisite_for`, `related_to`, etc.); graph order is not an implied learning curriculum. |
| ADR-16 | Make learning paths editor-curated ordered lists with stable positions. | A reader receives a clear 1 → 2 → 3 sequence; algorithmic sequencing is out of MVP. |
| ADR-17 | Shared book submission updates catalog metadata only; HTML is added manually to `book/` and deployed with the site. | Removes binary upload/storage behavior from the MVP service; publishing is a repository/deployment workflow. |
| ADR-18 | A metadata-only entry remains draft until deployment validation confirms its referenced HTML file exists and matches its recorded hash. | Prevents catalog entries that point to missing or stale book files. |

### Hash rules

The phrase “hash of book name” is implemented as two distinct hashes:

1. `title_hash`: SHA-256 of a normalized title, indexed but **not unique**. Normalization is Unicode NFKC, trim, collapse internal whitespace, and case-fold before UTF-8 encoding. Use it for exact title matching or duplicate-title warnings only.
2. `content_sha256`: SHA-256 of the exact deployed HTML bytes. CI computes it from the manually added file and the catalog service records it after deployment verification.

The canonical lookup is:

```text
book_id (UUID) → current published revision → content_path → deployed Book file
```

For a title lookup:

```text
normalized title → title_hash → candidate book rows → compare normalized titles
```

Always compare the normalized title after the hash lookup; a hash is an index, not proof of equality. A title hash cannot perform “contains” search. Search by title prefix/substring, description, category, or tags uses normal indexed text/search columns.

## 4. MVP request and publishing flows

### Discover and open a public book

1. The browser requests `GET /api/v1/books?q=attention&category=...`.
2. The Catalog API queries only `published` books and returns metadata and a stable URL; it never returns HTML bodies.
3. Search with zero results returns an empty list and the UI displays the dedicated no-results page/state, retaining the query and offering **Clear search** and **Browse all**.
4. The reader opens `/read/{book_id}/{slug}#page-04`.
5. The reader shell requests `GET /api/v1/books/{book_id}`. The API returns title, revision, deployed content URL, and verified content hash only for a published book.
6. The browser fetches the HTML file from the deployed static `book/` directory and checks response status and ETag/hash against catalog metadata.
7. The reader places the document in a sandboxed iframe. The parent shell maintains the public route and page fragment.
8. The book reports its current page through a narrow `postMessage` contract. The parent validates the message source, type, page ID, and length before updating the URL and local progress.

### Import a private reader book

1. The user selects a single `.html`/`.htm` file.
2. The browser validates file size and reads the file locally. The application may extract a suggested title, but does not trust it as an identifier.
3. The app creates a local UUID and content hash; it does not call the shared-catalog metadata service.
4. The original bytes and local metadata are stored in IndexedDB.
5. The local book is rendered through the same isolated reader surface, using a local Blob URL or sanitized wrapper.
6. The UI labels the book **On this device** and explains that it is not shared or synced.

### Publish a shared book (editor only)

1. The editor uses the authenticated catalog form to submit metadata only: title, summary, taxonomy assignments, tags, concept links, and attribution/source. There is no HTML file input or user-entered filesystem path.
2. The catalog service validates metadata, creates a stable book ID/title hash, and records a draft revision with the generated expected path. It does not receive, read, write, or host HTML bytes.
3. A maintainer manually creates `book/{book-id}/revisions/1.html` in the repository and adds the self-contained HTML document. The catalog references this explicit file path.
4. The maintainer opens a pull request/changeset. CI verifies every new/changed draft reference resolves to a file under `book/`, validates format/size/content policy, computes SHA-256 and byte size, and rejects path traversal or missing content.
5. After review and merge, deployment publishes `book/`. The deployed content URL is checked for availability and a matching hash.
6. The editor publishes the metadata record only after the file is deployed and verified. Public catalog queries then include the book. Updates add a new versioned file and point metadata to it; unpublishing changes catalog state and removes the book from discovery.

If the metadata service is unavailable, the same metadata record can be maintained through a reviewed catalog seed/migration. Source-controlled files and metadata still pass the deployment validation.

## 5. How books are rendered and opened

### Public route and page position

Canonical public route:

```text
/read/{book_id}/{slug}#page-04
```

- `book_id` is immutable and authoritative.
- `slug` is for readability only; a stale slug can redirect to the current slug for the same ID.
- `#page-04` is a book page identifier, not a database key. The reader validates it against the book’s allowed page IDs.
- The route does not contain a title hash, file path, storage credential, or raw HTML.
- A valid URL page fragment wins over stored progress. If there is no valid fragment, offer **Resume** or **Start from beginning**.
- Local-only books use an app-local route such as `/my-library/local/{local_id}`. That route is only meaningful in the same browser profile and must not be presented as a shareable public URL.

### Isolation contract

The HTML document must not run in the application document or a same-origin iframe. Use an iframe sandbox without `allow-same-origin`. For the initial supported book format:

- Permit only the script behavior required by the sample book, in the isolated iframe (`allow-scripts` only).
- Do not allow forms, popups, downloads, top-level navigation, or same-origin access.
- Apply a restrictive Content Security Policy to the framed document: block network connections, external scripts, external frames, and unapproved remote resources; allow only the inline/local resources required by the supported format.
- Do not inject reader credentials, app state, or private data into the frame.
- Use `postMessage` only for an explicit allowlisted protocol, such as `page-changed` and `book-ready`. Check `event.source === iframe.contentWindow`, schema-validate every field, and accept only known page IDs. Do not accept commands to navigate the parent, access APIs, or write arbitrary state.
- For local Blob URLs, revoke the object URL when the book is closed or replaced.

The sample book uses inline CSS/JavaScript and browser storage for its own progress. Its script must not own authoritative reader progress. The app shell owns progress; the sample integration should report page changes to the parent. Review any inline script against the CSP policy before adding an uploaded book to the supported format.

### Rendering errors

The shell must show explicit states for: book not found/unpublished, file unavailable, unsupported book format, invalid page fragment, integrity mismatch, and browser storage unavailable. Public reading should remain possible if IndexedDB is unavailable.

## 6. Repository and project folder layout

```text
index-dictionary/
├── apps/
│   ├── web/                         # Public library, My Library, reader shell
│   │   ├── index.html
│   │   ├── catalog/
│   │   │   ├── taxonomy/
│   │   │   ├── concepts/
│   │   │   └── learning-paths/
│   │   ├── reader/
│   │   ├── my-library/
│   │   ├── css/
│   │   └── js/
│   └── editor/                      # Editor-only metadata and catalog management UI
├── services/
│   └── catalog-api/                 # Catalog reads + protected metadata-only editor writes
│       ├── src/
│       │   ├── catalog/
│       │   ├── taxonomy/
│       │   ├── knowledge-graph/
│       │   ├── learning-paths/
│       │   ├── catalog-admin/
│       │   ├── auth/
│       └── migrations/
├── book/                            # Book content module; never DB blobs
│   ├── {book-id}/
│   │   └── revisions/
│   │       ├── 1.html
│   │       └── 2.html               # Add a new file for each content revision
│   └── README.md                    # Format, validation, local authoring guidance
├── packages/
│   ├── book-protocol/               # Shared page IDs and postMessage schema
│   └── catalog-contracts/            # API and metadata types/schema
├── tests/
│   ├── catalog/
│   ├── import-safety/
│   ├── reader-navigation/
│   └── book-file-validation/
├── static-mvp-decisions.md        # Owner-approved static-only implementation boundary
├── .env.example                     # Names only; no credentials
└── README.md
```

The metadata service creates the stable `book_id` and expected `book/`-relative path. A maintainer adds the HTML manually at that generated path in the repository. CI rejects absolute paths, `..`, encoded traversal, unexpected extensions, and references outside `book/`.

### Development vs deployed storage

- **Local MVP:** the working tree's `book/` directory is served by the development/static server. Add file and metadata changes to source control; no runtime service writes this directory.
- **Hosted deployment:** the deployment pipeline publishes repository `book/` files as static content. The committed HTML revision and catalog metadata must pass validation together.
- **Migration path:** repository paths are represented as content URLs/relative paths in catalog metadata. If storage later moves to object storage, change the file-serving adapter without changing book IDs or reader routes.

## 7. Catalog and user-data model

### Server-side catalog database

Recommended MVP relational schema (PostgreSQL syntax). `title_hash` is deliberately non-unique; titles may be identical. HTML bytes are not present in any table. The taxonomy tree, concept graph, and learning paths have separate tables and rules.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE taxonomy_nodes (
  id             UUID PRIMARY KEY,
  parent_id      UUID REFERENCES taxonomy_nodes(id),
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX taxonomy_parent_order_idx
  ON taxonomy_nodes(parent_id, is_active, sort_order, name);

CREATE TABLE concepts (
  id             UUID PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  label          TEXT NOT NULL,
  definition     TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL CHECK (status IN ('draft', 'published', 'unpublished')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE concept_relations (
  id                  UUID PRIMARY KEY,
  source_concept_id   UUID NOT NULL REFERENCES concepts(id),
  target_concept_id   UUID NOT NULL REFERENCES concepts(id),
  relation_type       TEXT NOT NULL CHECK (
    relation_type IN (
      'prerequisite_for',
      'part_of',
      'causes',
      'contrasts_with',
      'related_to',
      'example_of'
    )
  ),
  description         TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_concept_id <> target_concept_id),
  UNIQUE (source_concept_id, target_concept_id, relation_type)
);

CREATE TABLE editors (
  id             UUID PRIMARY KEY,
  oidc_issuer    TEXT NOT NULL,
  oidc_subject   TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('editor', 'admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oidc_issuer, oidc_subject)
);

CREATE TABLE books (
  id                  UUID PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  normalized_title    TEXT NOT NULL,
  title_hash          BYTEA NOT NULL CHECK (octet_length(title_hash) = 32),
  summary             TEXT NOT NULL,
  attribution         TEXT NOT NULL DEFAULT '',
  source_url          TEXT,
  status              TEXT NOT NULL CHECK (status IN ('draft', 'published', 'unpublished')),
  current_revision_id UUID,
  created_by          UUID NOT NULL REFERENCES editors(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at        TIMESTAMPTZ
);

CREATE INDEX books_title_hash_idx ON books(title_hash);
CREATE INDEX books_status_idx ON books(status);
CREATE INDEX books_title_search_idx ON books USING GIN(normalized_title gin_trgm_ops);

CREATE TABLE book_taxonomy (
  book_id       UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  taxonomy_id   UUID NOT NULL REFERENCES taxonomy_nodes(id),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (book_id, taxonomy_id)
);

CREATE UNIQUE INDEX book_one_primary_taxonomy_idx
  ON book_taxonomy(book_id) WHERE is_primary;

CREATE INDEX book_taxonomy_node_idx ON book_taxonomy(taxonomy_id, book_id);

CREATE TABLE book_tags (
  book_id       UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  normalized_tag TEXT NOT NULL,
  PRIMARY KEY (book_id, normalized_tag)
);

CREATE INDEX book_tags_lookup_idx ON book_tags(normalized_tag, book_id);

CREATE TABLE book_revisions (
  id             UUID PRIMARY KEY,
  book_id        UUID NOT NULL REFERENCES books(id),
  revision_no    INTEGER NOT NULL CHECK (revision_no > 0),
  content_path   TEXT NOT NULL UNIQUE CHECK (content_path LIKE 'book/%'),
  content_sha256 BYTEA CHECK (content_sha256 IS NULL OR octet_length(content_sha256) = 32),
  content_bytes  BIGINT CHECK (content_bytes IS NULL OR content_bytes > 0),
  mime_type      TEXT NOT NULL CHECK (mime_type = 'text/html'),
  created_by     UUID NOT NULL REFERENCES editors(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at    TIMESTAMPTZ,
  deployment_id  TEXT,
  UNIQUE (book_id, revision_no),
  UNIQUE (book_id, content_sha256)
);

ALTER TABLE books
  ADD CONSTRAINT books_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES book_revisions(id);

CREATE TABLE book_concepts (
  book_id       UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  concept_id    UUID NOT NULL REFERENCES concepts(id),
  role          TEXT NOT NULL CHECK (role IN ('introduces', 'explains', 'applies', 'example')),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (book_id, concept_id, role)
);

CREATE INDEX book_concepts_concept_idx ON book_concepts(concept_id, book_id);

CREATE TABLE learning_paths (
  id             UUID PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  summary        TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL CHECK (status IN ('draft', 'published', 'unpublished')),
  estimated_minutes INTEGER,
  created_by     UUID NOT NULL REFERENCES editors(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ,
  CHECK (estimated_minutes IS NULL OR estimated_minutes > 0)
);

CREATE TABLE learning_path_items (
  path_id          UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL CHECK (position > 0),
  book_id          UUID NOT NULL REFERENCES books(id),
  is_required      BOOLEAN NOT NULL DEFAULT TRUE,
  estimated_minutes INTEGER,
  PRIMARY KEY (path_id, position),
  UNIQUE (path_id, book_id),
  CHECK (estimated_minutes IS NULL OR estimated_minutes > 0)
);

CREATE INDEX learning_path_books_idx ON learning_path_items(book_id, path_id);

CREATE TABLE publishing_events (
  id          UUID PRIMARY KEY,
  book_id     UUID NOT NULL REFERENCES books(id),
  editor_id   UUID NOT NULL REFERENCES editors(id),
  action      TEXT NOT NULL CHECK (action IN ('create', 'publish', 'update', 'unpublish')),
  revision_id UUID REFERENCES book_revisions(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`gin_trgm_ops` requires PostgreSQL’s `pg_trgm` extension. Enable it in a migration. If the chosen MVP DB does not support trigram search, use its equivalent index/search feature or explicitly limit MVP search to exact/prefix matching. Do not use a hash to emulate full-text search.

#### What each catalog value does

| Field | Purpose |
|---|---|
| `books.id` | Permanent identity for URLs and relationships; never derived from title. |
| `books.slug` | Human-readable route segment; can change without changing book identity. |
| `books.title_hash` | Exact normalized-title lookup and duplicate-title warning; non-unique. |
| `books.normalized_title` | Search/sort value; supports case-insensitive title matching. |
| `books.status` | Controls public visibility; public queries include only `published`. |
| `books.current_revision_id` | Identifies the immutable current revision. |
| `book_revisions.content_path` | Repository-relative path to the manually committed file under `book/`. |
| `book_revisions.content_sha256` | Integrity/version identity for exact HTML bytes; populated from deployment validation. |
| `publishing_events` | Audit trail for editor changes. |

### The three catalog structures

These structures are related through stable IDs, but they are not interchangeable:

```text
Taxonomy tree:       Ideas → Technology → Attention Economy books
Knowledge graph:     Attention ──related_to──► Incentives ──part_of──► Platform design
Learning sequence:  [1. Foundations] → [2. Attention] → [3. Design choices]

All three may point to the same book IDs; none is inferred from another.
```

| Structure | Reader question | Model | Navigation behavior |
|---|---|---|---|
| Hierarchical taxonomy | “What area or topic should I browse?” | A single-parent tree of taxonomy nodes; a book may be assigned to multiple nodes, with one primary node. | Browse parent → child, show breadcrumbs, and include books assigned to the selected node or any descendant. |
| Knowledge graph | “What concepts connect to this book or topic?” | Published concepts are vertices; typed, directed concept relations are edges; books link to concepts with a role. | Open a concept to see adjacent concepts and books; relationship labels explain why nodes are connected. |
| Learning sequence | “What should I learn first, next, and after that?” | A published learning path owns an explicit ordered list of books with integer positions. | Show numbered steps, current/complete state, and previous/next; sequence order is editorial, not calculated from taxonomy or graph. |

#### Taxonomy rules

- A taxonomy node has zero or one parent. Root nodes have `parent_id IS NULL`; children are sorted by `sort_order`, then name.
- A book can belong to multiple taxonomy nodes to support discovery across topics; exactly one assignment should be primary for display. Draft books may temporarily have no primary assignment.
- Selecting a node includes books assigned directly to it and, when the UI option “include subtopics” is on, books assigned to all descendants.
- Store the parent relation as the source of truth. Resolve ancestors/descendants with recursive CTEs; do not store an independently mutable path string in the MVP.
- Prevent cycles on editor writes (a node cannot be moved below itself or one of its descendants). Validate category deactivation so published books do not become undiscoverable without an explicit editor action.

#### Knowledge graph rules

- A concept is a named, described idea with a stable ID and slug. A concept is not a book and is not a taxonomy category.
- An edge is a directed, typed assertion from a source concept to a target concept. `A prerequisite_for B` means A should be understood before B. For symmetric meanings such as `related_to` or `contrasts_with`, store reciprocal edges or define canonical rendering; never infer an inverse silently.
- `prerequisite_for` edges must remain acyclic; validate writes by checking whether the proposed edge creates a cycle. Other relation types may form cycles.
- Books connect to concepts through `book_concepts` roles such as `introduces`, `explains`, or `applies`. A concept may link to multiple books and a book may cover multiple concepts.
- Only published concepts, edges, and books appear in public graph responses. Graph traversal is bounded by a requested depth and result limit to prevent unbounded responses.
- Graph relationships are discoverability/context, not an automatically generated learning path. Editorial sequence is authored separately.

#### Learning path rules

- A learning path is a named, curated ordered series of published books. `position` starts at 1 and must be contiguous in the published path (1, 2, 3, …); draft paths may contain gaps while being edited.
- One book can appear in many learning paths, but not twice in the same path.
- Optional steps may be marked `is_required = false`; the UI still displays their ordinal position and optional label.
- Publishing a path requires a non-empty sequence, contiguous positions starting at 1, and every included book to be published and assigned a primary taxonomy node. Reordering changes positions transactionally.
- A path can reference taxonomy nodes or concepts for discovery metadata in a later version; MVP path ordering does not derive from graph edges.
- Completion is reader-local in IndexedDB, keyed by `(path_id, book_id)` or by `path_id` and current position. It is not stored in the public catalog DB.

### Reader-local database (IndexedDB)

The reader has no server-side user row in the MVP. Use IndexedDB object stores, all scoped to the current browser profile:

| Store | Key | Example fields |
|---|---|---|
| `localBooks` | `localId` (UUID) | `title`, `normalizedTitle`, `titleHash`, `htmlBlob`, `contentSha256`, `importedAt`, `updatedAt`, `sourceFileName`, `localOnly: true` |
| `collections` | `collectionId` (UUID) | `name`, `createdAt`, `updatedAt` |
| `collectionBooks` | `[collectionId, bookRef]` | `collectionId`, `bookRef` (`public:{bookId}` or `local:{localId}`), `sortOrder`, `addedAt` |
| `savedBooks` | `bookRef` | `bookRef`, `savedAt` |
| `readingProgress` | `bookRef` | `bookRef`, `pageId`, `percent`, `lastReadAt`, `completedAt` |
| `bookmarks` | `bookmarkId` (UUID) | `bookRef`, `pageId`, `label`, `createdAt` |
| `learningPathProgress` | `pathId` | `pathId`, `currentPosition`, `completedBookIds`, `lastReadAt` |

Use a versioned IndexedDB schema and upgrade transaction. Deleting a local book must transactionally delete its local content, saved reference, progress, bookmarks, and collection memberships after confirmation. If browser storage quota is exceeded, report the error and do not show a successful import.

#### Implemented static MVP schema (schema version 2)

The running static app uses database `index-dictionary-reader-library`, schema version 2. It retains the existing `savedBooks`, `readingProgress`, and `pathProgress` key formats for compatibility with the UI, and adds stable `bookRef` values (`public:{bookId}` or `local:{bookId}`) for associations. The former `importedBooks` store is migrated to `localBooks` in the version-change transaction; old saved/progress records receive their `bookRef` without losing their existing fields.

| Store | Key | Purpose |
|---|---|---|
| `localBooks` | `localId` | Imported HTML and local metadata |
| `collections` | `collectionId` | Reader-owned collection names and timestamps |
| `collectionBooks` | `[collectionId, bookRef]` | Collection membership for public or local books |
| `savedBooks` | `bookId` | Saved state with `bookRef` and `savedAt` indexes |
| `bookmarks` | `bookmarkId` | Page bookmarks indexed by book reference and creation time |
| `readingProgress` | `bookId` | Current page, completion, open times, and book reference |
| `pathProgress` | `pathId` | Local learning-path completion |

Service writes validate their inputs, related updates/deletes use read-write transactions, and quota/unavailable/blocked storage errors reject with an explicit `LibraryStorageError`. The stored HTML remains local to the browser profile. Collections and bookmark service operations are available for the subsequent library UI task; this schema change does not imply those controls are already exposed in the UI.

No synchronization or recovery across browsers is promised. A future account/sync feature must define ownership, export/import, deletion, and conflict behavior before adding server-side reader data.

## 8. API contract (MVP)

| Method and route | Access | Purpose |
|---|---|---|
| `GET /api/v1/books?q=&taxonomyId=&includeDescendants=&conceptId=&cursor=` | Public | Search published books with optional taxonomy or concept filters; paginated metadata only. |
| `GET /api/v1/books/{bookId}` | Public | Resolve a published ID to metadata and current revision. |
| `GET /book/{bookId}/revisions/{revisionNo}.html` | Public static file | Fetch the manually committed, deployed HTML file; includes content type and deployment hash/ETag. |
| `GET /api/v1/taxonomy?parentId=` | Public | Return root taxonomy nodes or children of one node, sorted for browsing. |
| `GET /api/v1/taxonomy/{taxonomyId}/books?includeDescendants=true` | Public | Return published books assigned to a taxonomy node and optionally its descendants. |
| `GET /api/v1/concepts/{conceptId}/graph?depth=1&limit=50` | Public | Return a bounded subgraph of published concepts, typed relations, and linked books. |
| `GET /api/v1/learning-paths` | Public | List published learning paths with step count and estimated duration. |
| `GET /api/v1/learning-paths/{pathId}` | Public | Return ordered published book steps with position and required/optional state. |
| `POST /api/v1/editor/books` | Editor | Create a draft from catalog metadata. Service generates book ID and content path; no HTML payload or caller path. |
| `PUT /api/v1/editor/books/{bookId}` | Editor | Update metadata or point the draft at a new manually added content revision. |
| `GET /api/v1/ci/catalog-manifest?status=draft` | CI identity | Read draft metadata/path references needed to validate a repository change. |
| `POST /api/v1/ci/deployments/{deploymentId}/books/{bookId}/verify` | CI identity | Record path, byte count, and CI-computed SHA-256 after verifying the deployed static file. |
| `POST /api/v1/editor/books/{bookId}/publish` | Editor | Publish only after the current revision has passed deployment verification. |
| `POST /api/v1/editor/books/{bookId}/unpublish` | Editor | Remove the book from public catalog and resolution. |
| `POST /api/v1/editor/taxonomy` and `PUT /api/v1/editor/taxonomy/{id}` | Editor | Create or update a taxonomy node; server rejects parent cycles. |
| `POST /api/v1/editor/concepts` and `POST /api/v1/editor/concept-relations` | Editor | Curate concepts, book-concept links, and typed directed relations. |
| `POST /api/v1/editor/learning-paths` and `PUT /api/v1/editor/learning-paths/{id}` | Editor | Create/reorder path steps and publish a validated ordered sequence. |

Public list response shape:

```json
{
  "items": [
    {
      "id": "8c3e0000-0000-4000-8000-000000000004",
      "slug": "attention-economy",
      "title": "The Attention Economy",
      "summary": "A short visual book about attention and design.",
      "primaryTaxonomy": {
        "id": "taxonomy-human-thinking",
        "name": "Human Nature & Thinking",
        "path": ["Ideas", "Human Nature & Thinking"]
      },
      "taxonomy": [
        { "id": "taxonomy-human-thinking", "name": "Human Nature & Thinking" },
        { "id": "taxonomy-technology", "name": "Technology" }
      ],
      "concepts": [
        { "id": "concept-attention", "label": "Attention", "role": "introduces" },
        { "id": "concept-attention-economy", "label": "Attention economy", "role": "explains" }
      ],
      "tags": ["attention", "technology"],
      "contentUrl": "/book/8c3e0000-0000-4000-8000-000000000004/revisions/1.html"
    }
  ],
  "nextCursor": null
}
```

Metadata-only draft response:

```json
{
  "id": "8c3e0000-0000-4000-8000-000000000004",
  "status": "draft",
  "expectedContentPath": "book/8c3e0000-0000-4000-8000-000000000004/revisions/1.html",
  "message": "Add the HTML file at this path in the repository. This draft is not public yet."
}
```

Learning path response shape:

```json
{
  "id": "path-thinking-foundations",
  "slug": "thinking-foundations",
  "title": "Thinking Foundations",
  "summary": "A curated introduction to key ideas about human thought.",
  "items": [
    {
      "position": 1,
      "required": true,
      "estimatedMinutes": 8,
      "book": { "id": "book-observation", "slug": "observation", "title": "Learning to Observe" }
    },
    {
      "position": 2,
      "required": true,
      "estimatedMinutes": 10,
      "book": { "id": "book-attention", "slug": "attention-economy", "title": "The Attention Economy" }
    }
  ]
}
```

List/search behavior:

- Search is case-insensitive and trims/collapses whitespace. It matches title, summary, taxonomy node names, concept labels, and tags.
- `taxonomyId` filters direct assignments and optionally descendants; `conceptId` filters books linked to that concept. When both are provided, filters are ANDed.
- Taxonomy children are returned in a stable order; graph traversal requires bounded `depth` and `limit`; learning path items are returned by ascending `position`.
- A learning path response includes a sequential `position` (1, 2, 3, …) and never relies on a database row's incidental ordering.
- Editor publish validation requires every public book to have exactly one primary taxonomy assignment and a verified deployed revision with a non-null content hash. Taxonomy reparent operations are rejected if they would create a cycle; `prerequisite_for` concept edges are rejected if they would create a directed cycle.
- Results are sorted deterministically (for example relevance, then title, then ID).
- Filtered results paginate with a cursor; do not return the entire catalog without a limit.
- Only `published` records are visible publicly.
- Empty results return HTTP `200` with `items: []`; the UI renders the dedicated no-results page/state.
- Missing or unpublished book resolution returns `404`, without disclosing draft metadata.
- Invalid input returns a clear `400`; authorization failure returns `401` or `403`; metadata or file-reference validation failures return `422`. The shared-catalog metadata service has no binary upload endpoint and does not accept HTML multipart bodies.

## 9. Metadata-only book submission and manual file deployment

### Catalog service input

The shared-catalog form is **Add book to catalog**, not an HTML file uploader. It accepts JSON metadata:

```json
{
  "title": "The Attention Economy",
  "summary": "A short visual book about attention and design.",
  "primaryTaxonomyId": "taxonomy-human-thinking",
  "taxonomyIds": ["taxonomy-human-thinking", "taxonomy-technology"],
  "tags": ["attention", "technology"],
  "conceptLinks": [
    { "conceptId": "concept-attention", "role": "introduces" },
    { "conceptId": "concept-attention-economy", "role": "explains" }
  ],
  "attribution": "Index Dictionary",
  "sourceUrl": null
}
```

The service returns a draft catalog row with a generated stable book ID and the exact expected path, such as `book/8c3e0000-0000-4000-8000-000000000004/revisions/1.html`. The path is generated by the service, not selected by the user. The service never accepts multipart HTML, reads a user file, writes `book/`, or claims that a draft is publicly available.

### Maintainer file and deploy workflow

1. Create the metadata-only draft. The service returns the generated book ID and the exact expected content path.
2. Manually add the single self-contained HTML file to that exact path in the repository. Do not put the HTML in the database or submit it to the catalog service.
3. Open a repository change for review. CI validates that every intended published/draft entry has a matching file under `book/`, that paths do not escape the folder, and that the file meets the agreed HTML policy and size limit (recommended initial cap: **2 MiB**, subject to device testing).
4. CI computes the content SHA-256 and byte count from the checked-in file and verifies that catalog metadata refers to the right revision. It does not trust a hash supplied by a browser form.
5. Merge and redeploy the static `book/` files. Verify the deployed file URL returns successfully and its bytes match the build artifact.
6. Record the verified deployment ID/hash against the revision, then explicitly change the catalog draft to `published`. The book is discoverable only after both file and metadata are ready.
7. To update, add `2.html` (or the next revision number) and update the draft/current content path. Never overwrite a published revision in place. Redeploy and verify before moving the published pointer.

### Serving and caching

- Serve files as `text/html; charset=utf-8` from the public static site, in the isolated reader context. Do not execute book HTML as the application’s own page.
- Include the revision number in the path so a content update gets a new URL. Static content may then use immutable caching; catalog metadata/current-revision responses use revalidation.
- Unpublishing removes the book from catalog queries and resolution. A previously deployed public file can still be fetched if its URL is known; remove/restrict it in a redeployment if file-level revocation is required. Previously cached copies cannot be instantly recalled.

## 10. Security, privacy, and failure requirements

- Do not store shared book HTML in a SQL text/blob column or send it to the metadata service.
- Do not execute imported content in the parent application context or an unsandboxed same-origin frame.
- Keep imported books in IndexedDB on the current device. Accept only one non-empty `.html`/`.htm` document up to 2 MiB, preview it before saving, and enforce a restrictive Content Security Policy in the sandbox to block external resources; the frame has scripts only and never receives same-origin access.
- Do not add a local import to the shared catalog or treat it as published content. Allow readers to update its local title/category, manage collection membership, and delete it with dependent progress/bookmark cleanup.
- Protect editor metadata and publication endpoints server-side with OIDC validation and role checks; hiding UI controls is insufficient.
- Generate IDs, slugs, and expected file paths server-side. Reject absolute paths, path traversal, and any path outside `book/`.
- Validate manually committed files in CI for size, HTML format, content policy, and hash. The metadata service has no file-upload rate limit because it accepts no binary file.
- Log metadata and publication changes without logging file bodies, credentials, or secrets.
- Do not send local imports, reading history, bookmarks, or collection membership to the Catalog API.
- Do not report a successful metadata submission as a published book; keep it in draft until the file is deployed and verified.
- Handle a missing deployed file or hash mismatch as a deployment failure; do not publish the catalog row and show the maintainer a recovery state.
- Back up the catalog DB and version-controlled Book files together. Test restoration, since metadata without files (or files without metadata) is incomplete.

## 11. Test strategy and release gates

### Automated checks

- Schema migrations create constraints and indexes; title hash is not unique; content bytes never appear in a catalog API response.
- Same normalized title can exist for different books; title-hash lookup returns candidates and compares normalized titles.
- Search covers title, summary, category, and tags; empty search results remain a successful empty response.
- Public endpoints never return drafts/unpublished books; metadata-write endpoints reject missing/invalid editor role claims.
- Metadata submission creates a draft and returns a generated path without accepting a file body or writing to `book/`.
- CI rejects missing/mismatched Book paths, computes SHA-256 from repository bytes, and prevents publication until deployment verification succeeds.
- Publishing metadata before file verification is rejected; a failed deployment leaves no discoverable partial book.
- Direct read by ID, unknown ID, stale slug, invalid page fragment, missing file, and hash mismatch have defined behavior.
- Reader stores restore progress; clear-data and local-book deletion remove dependent local records.
- Oversized, invalid-extension, malformed, and storage-quota-exceeded imports fail visibly without partial library records.
- Import preview does not persist content before confirmation; external resource loads are blocked in both preview and reader frames; title/category changes and collection assignment remain local.
- The framed sample book cannot access parent DOM, app storage, editor tokens, or navigate the top-level page; expected page-change messages are accepted and malformed messages ignored.

### Manual release gates

- Test the no-results page/state with no query matches and verify clear-search/browse-all behavior.
- Test public discovery and read on mobile and desktop, with keyboard and a screen reader.
- Test offline/slow file response, blocked IndexedDB, and reload on a valid public page fragment.
- Verify public book files have no unintended remote requests under the content policy.
- Verify an ordinary reader cannot edit catalog metadata or publish by calling an editor endpoint directly.
- Restore catalog DB and source-controlled Book files from backup in a non-production environment.

## 12. PRD gaps closed by this architecture

| PRD gap or ambiguity | Engineering resolution |
|---|---|
| “No database” conflicted with editor-managed catalog metadata and search. | No HTML content in DB; relational DB stores metadata and hashes, while HTML is served from static deployed files. |
| “Hash of book name” could be mistaken for identity or security. | Stable UUID is identity; normalized-title SHA-256 is a non-unique lookup aid; content SHA-256 identifies a revision. |
| `Book` module and storage paths were not defined. | Manually committed versioned `book/{book-id}/revisions/{revisionNo}.html`; catalog service generates the path; CI validates it and computes the content hash. |
| The exact browser opening/rendering mechanism was unspecified. | Reader route + shell + sandboxed iframe + validated `postMessage` page protocol. |
| The sample book’s inline script/storage conflicted with the import safety model. | Scripts remain isolated; parent owns progress; CSP and a narrow message contract are required. |
| Shared-catalog “upload” could imply the service receives the HTML file. | Shared catalog operation is metadata-only; maintainer adds the HTML to `book/` and deploys it. Reader imports remain local in IndexedDB. |
| A single HTML file may reference separate assets. | MVP is one self-contained HTML document; asset bundles are deferred. |
| Catalog search and title hashing were conflated. | Hash serves exact title lookup only; text/tag search uses searchable metadata and suitable indexes. |
| Catalog organization was treated as a flat category field. | Separate hierarchical taxonomy, typed concept knowledge graph, and curated ordered learning-path models with explicit browse/traversal rules. |
| No API or query contract existed for taxonomy descendants, concept graph navigation, or ordered paths. | Add public taxonomy, bounded concept graph, and learning-path endpoints; path responses are sorted by explicit contiguous position. |
| DB tables, user identity, revisions, and audit were missing. | Catalog schema, editor OIDC identity, immutable revisions, and publishing audit are specified. |
| URL/deep-link ownership and progress precedence were unclear. | Stable ID route; page fragment identifies the page; valid link wins over local progress. |
| Upload size, MIME, integrity, cache, and failure policy were missing. | 2 MiB recommended cap, server-side validation/hash, immutable revisions, errors, and lifecycle are specified. |
| A catalog record could be published before its manual file is deployed. | Keep the record draft until CI verifies the repository file, deployment URL, and hash; publish afterward. |

Product decisions still requiring owner confirmation are the CI/deployment provider, acceptable inline JavaScript policy, file size limit for manually committed books, and whether personal libraries will eventually sync across devices. The shared catalog service does not upload book files; the file limit is enforced during repository validation.
