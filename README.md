# Index Dictionary

Index Dictionary is a static web library and reader for short visual HTML books.

## Current implementation baseline

The app uses plain HTML, CSS, and browser JavaScript with no application framework or build step. Shared catalog metadata is versioned in `data/catalog.json`; book documents are static files under `book/`; private saves, imports, collections, and bookmarks are stored in browser IndexedDB. Reading and learning-path progress is always saved locally and can also sync to Supabase when a reader signs in. Existing local imports are migrated when the IndexedDB schema is upgraded. Storage errors, including quota exhaustion and unavailable storage, are surfaced rather than treated as successful saves.

The app currently includes the responsive shell and navigation, introduction Home, catalog search, taxonomy browser, concept graph, learning paths, validated book/page reader routes in a sandboxed HTML iframe, and local library/import flows. My Library supports saved, recent, in-progress, imported, and bookmarked views; collections; page bookmarks; resume/restart; and confirmed local-data cleanup. Local HTML imports accept one `.html`/`.htm` document up to 2 MiB, show a sandboxed preview before saving, and let readers edit its title/category and optionally add it to a collection. Imported HTML, metadata, and progress remain on the device and are never uploaded. Public catalog books provide native share with a copy fallback and a validated current-page link action. Private imports do not expose share URLs and are labelled device-only. Public links use `#read/{bookId}/{pageId}`; page fragments are checked against the loaded book before opening. The active book reports only its validated ready/page changes to the app; the app verifies the sandboxed iframe source, opaque origin, exact message schema, book ID, and page ID before updating the route and local progress.

Email/password accounts and the opt-in leaderboard use Supabase. For signed-in users, only progress for public catalog books and learning paths is synced; on sign-in, local and cloud progress are merged by most recent update. Leaderboard entries show only an opted-in username and a self-reported count of completed books. No email, imported book, bookmark, saved book, or collection is shared. The existing progress bars continue to work without an account.

## Supabase setup

1. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates the profile/progress tables, per-user Row Level Security policies, sign-up profile trigger, and an aggregate-only leaderboard RPC.
2. In **Authentication → URL Configuration**, set the Site URL to `https://saurabhsukant75.github.io/INDEX-DICTIONARY/` and allow that URL as a redirect.
3. Keep the Supabase project URL and **publishable** key configured in [`src/services/supabase-service.js`](src/services/supabase-service.js). A publishable key is expected to be visible in a static site; never add a secret/service-role key.
4. Deploy the changed files to GitHub Pages, then test account creation, email confirmation (if enabled), sign-in, progress sync, sign-out, and leaderboard opt-in on the deployed HTTPS URL.

This site is not a Next.js app. Do not add `@supabase/ssr`, Next server components, `.env.local`, or Next middleware: GitHub Pages cannot read build-time environment variables or run server middleware. The browser SDK is loaded as an ES module from a CDN, so the deployed site needs network access to Supabase and that CDN.

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

Public book files are static URLs. Removing a book from the catalog stops discovery but cannot guarantee revocation of a direct link or a copy already cached by a browser or CDN. Use repository and hosting permissions to control publication. The static app has no authenticated editor or custom server-side publication workflow. Imported books and private library data remain in the browser and are not uploaded.

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

Node.js and Python are sufficient for the catalog checks and local preview. The app does not use a local npm install or build; the Supabase browser SDK is fetched from its CDN at runtime. Browser features, including IndexedDB, require the HTTP(S) preview above.

## Scope boundary

The static-only implementation and deferred publishing limitations are recorded in [`static-mvp-decisions.md`](static-mvp-decisions.md); the Supabase reader-account and progress-sync addition above supersedes its earlier reader-sync deferral. In-app editor authentication, a catalog service/database, CI-backed publication state, and guaranteed static-file revocation are not part of this MVP.

The earlier clickable design exploration remains available at [`index-dictionary-ui-ux-prototype-v1.html`](index-dictionary-ui-ux-prototype-v1.html).
