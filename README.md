# Index Dictionary

Index Dictionary is a static web library and reader for short visual HTML books.

## Current implementation baseline

The approved MVP uses plain HTML, CSS, and browser JavaScript only. There is no application framework, build step, package dependency, or server API. Shared catalog metadata is versioned in `data/catalog.json`; book documents are static files under `book/`; private saves, imports, reading progress, collections, bookmarks, and path completion are stored in versioned browser IndexedDB. Existing local imports are migrated when the IndexedDB schema is upgraded. Storage errors, including quota exhaustion and unavailable storage, are surfaced rather than treated as successful saves.

The app currently includes the responsive shell and navigation, introduction Home, catalog search, taxonomy browser, concept graph, learning paths, validated book/page reader routes in a sandboxed HTML iframe, and local library/import flows. My Library supports saved, recent, in-progress, imported, and bookmarked views; collections; page bookmarks; resume/restart; and confirmed local-data cleanup. Local HTML imports accept one `.html`/`.htm` document up to 2 MiB, show a sandboxed preview before saving, and let readers edit its title/category and optionally add it to a collection. The isolated preview and reader block external resource loads; imported HTML, metadata, and progress stay in browser storage and are not uploaded. Public catalog books provide native share with a copy fallback and a validated current-page link action. Private imports do not expose share URLs and are labelled device-only. Public links use `#read/{bookId}/{pageId}`; page fragments are checked against the loaded book before opening. The active book reports only its validated ready/page changes to the app; the app verifies the sandboxed iframe source, opaque origin, exact message schema, book ID, and page ID before updating the route and local progress. Further implementation tasks and limitations are tracked in [`implementation-plan/plan.md`](implementation-plan/plan.md).

New book content should follow [`BookTemplate.md`](BookTemplate.md). [`book/AttentionEconomyTemplate.book`](book/AttentionEconomyTemplate.book) is a standalone HTML example; rename a completed copy to `.html` before adding it to the catalog.

## Local preview

Run an HTTP server from the project root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>. The app should not be run using a `file://` URL because native JavaScript modules and catalog fetches require an HTTP(S) origin.

## Static deployment

There is no build step. Publish the project root as the site root (or as a complete subdirectory), preserving `index.html`, `src/`, `data/`, and `book/` with their existing names and paths. Serve the site over HTTPS and ensure the host serves JavaScript modules, JSON, CSS, and HTML with their normal MIME types. The app uses hash routes, so server-side SPA rewrites are not required.

Before each release, run the verification commands below and confirm that the deployed catalog and every referenced book file are present. Revalidate `index.html`, `src/`, `data/catalog.json`, and `book/` when publishing changes. If a host applies Content Security Policy or framing headers, verify the app modules, catalog fetch, and sandboxed same-origin reader continue to work; blanket frame denial breaks the reader.

Public book files are static URLs. Removing a book from the catalog stops discovery but cannot guarantee revocation of a direct link or a copy already cached by a browser or CDN. Use repository and hosting permissions to control publication. The static MVP has no authenticated editor, server-side authorization, or reader-data sync. Imported books and reading state remain in the browser and are not uploaded.

## Verification

Run the dependency-free catalog checks with:

```sh
node scripts/validate-catalog.js
node --test tests/catalog-validator.test.js
```

Check JavaScript module syntax with:

```sh
for file in src/js/*.js src/navigation/*.js src/services/*.js src/ui/*.js src/views/*.js; do
  node --input-type=module --check < "$file" || exit 1
done
```

Node.js 18.19.1 and Python 3.12.3 were available during implementation. npm is not needed and no packages are installed. Browser features, including IndexedDB, require the HTTP(S) preview above.

## Scope boundary

The static-only implementation and deferred publishing limitations are recorded in [`static-mvp-decisions.md`](static-mvp-decisions.md). In-app editor authentication, a catalog service/database, CI-backed publication state, and guaranteed static-file revocation are not part of this MVP.

The earlier clickable design exploration remains available at [`index-dictionary-ui-ux-prototype-v1.html`](index-dictionary-ui-ux-prototype-v1.html).
