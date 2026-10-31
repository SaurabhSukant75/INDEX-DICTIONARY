# Static MVP implementation decisions

**Confirmed:** 2026-10-27  
**Scope:** Initial implementation of Index Dictionary

## Approved baseline

- Frontend is plain HTML, CSS, and browser JavaScript modules.
- No UI framework, TypeScript, package manager, runtime dependency, server API, or database is part of this MVP.
- Public shared catalog data is versioned in `data/catalog.json`.
- Shared book content remains as independent static HTML files in `book/`.
- Private imports, collections, bookmarks, history, and progress belong in browser IndexedDB only.
- Serve the project over HTTP(S) during development/hosting. ES modules, `fetch()`, and IndexedDB are not supported as a reliable `file://` application.

## Verification baseline

Environment checked on 2026-10-27:

- Node.js `v18.19.1` is available for syntax checks and dependency-free validation scripts.
- Python `3.12.3` is available for local preview with `python3 -m http.server`.
- npm `9.2.0` is installed but is not required; no `package.json` or dependencies are introduced.
- The five standalone samples exist in `book/book-01.html` through `book/book-05.html`.

Use `python3 -m http.server 8000` from the project root, then open `http://localhost:8000/`. Stop the server with Ctrl+C when finished.

## Deliberately deferred

- Authenticated in-app editor, catalog API, and relational database.
- CI-mediated publication verification and a server-side publish/unpublish action.
- Guaranteed prevention of direct access to or revocation of already cached static book URLs.
- Reader accounts and synchronization.

## Follow-up scope update (2026-10-31)

The reader-account deferral above is superseded by the Supabase integration documented in [`README.md`](README.md). The static frontend remains plain browser JavaScript on GitHub Pages; Supabase now provides email/password authentication, per-user cloud copies of public-book and learning-path progress, and an opt-in aggregate leaderboard. IndexedDB remains the local source for imports and private library data. Imported HTML, bookmarks, saved books, and collections are not uploaded.

The leaderboard exposes only an opted-in username and a count of completed books. Completion records are client-submitted and self-reported, so this is not a tamper-resistant competitive score. The SQL schema and RLS policies are in [`supabase/schema.sql`](supabase/schema.sql).

For this MVP, shared catalog updates are repository changes to the JSON manifest and manually committed `book/` files, followed by static redeployment. Repository/hosting permissions protect changes; they are not represented as in-app editor authentication. Removing a book from the manifest removes it from discovery but cannot guarantee immediate revocation of a direct or cached static URL. Do not add client-side passwords or pretend a static UI can enforce editor authorization.

The original architecture document retains future API/database design detail. Its top-level static-only amendment identifies which recommendations are not active for this implementation.
