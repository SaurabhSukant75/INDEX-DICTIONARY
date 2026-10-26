# Static MVP verification

The implementation uses no package manager, framework, or third-party runtime dependency.

## Automated checks

- Validate `data/catalog.json` and every referenced `book/` path with `node scripts/validate-catalog.js`.
- Run focused catalog integrity tests with `node --test tests/catalog-validator.test.js`.
- Check browser JavaScript syntax with `node --input-type=module --check < src/js/app.js` and the same command for the modules under `src/`.

## Verified browser journeys

Use the app over HTTP(S), not `file://`. The implementation browser check covered:

- Full-width header, sidebar placement below it, mobile navigation, and no horizontal overflow at 320, 375, 600, 760, 1024, and 1280 CSS px.
- Intro-only Home, each primary route, topic selection, concept selection, learning-path steps, path completion, and search results/empty-state recovery.
- Opening a sample HTML book in the sandboxed reader and toggling its saved/completed state.
- Opening `#read/{bookId}/{pageId}` directly, refreshing to restore the requested page, rejecting unknown page fragments, and confirming the iframe has no same-origin permission.
- Verifying each sample book's ready/page-changed messages update the app route and local IndexedDB page position, while wrong-source, wrong-book, unknown-page, extra-field, and repeated-ready messages are ignored.
- Upgrading a version-1 IndexedDB database with existing saved books, imported HTML, and reading progress; verify records remain readable after migration and the current stores/indexes are created.
- Exercising local storage helpers in a browser: validated local-book reads/writes, transactional reading updates/deletion, collection and membership persistence, bookmark filtering, path completion, invalid-record rejection, and explicit unavailable/quota errors.
- Confirming book documents do not repeat the Index Dictionary header, that the app reader occupies the remaining viewport, and that the authoring template's contents, text zoom, Fit reset, and page navigation work at mobile and desktop sizes.
- Importing a supported local HTML document: invalid extensions, malformed markup, empty files, and documents over 2 MiB are rejected; a valid file previews in a sandbox before confirmation; cancellation leaves IndexedDB unchanged; confirming stores it locally.
- Editing an imported book's title/category, assigning it to a collection during import, reopening it after reload, and deleting it with its memberships, progress, and bookmarks.
- Verifying local import preview and reader frames have `sandbox="allow-scripts"` without same-origin access and a restrictive Content Security Policy blocks external resource requests.
- Creating, inline-renaming, and deleting collections; adding and removing book memberships; and switching among all, recent, in-progress, saved, imported, and bookmark filters.
- Adding/removing reader bookmarks and opening the bookmarked page; saving and completing a book; resuming saved progress, restarting at the first page, and confirming an explicit page URL takes precedence.
- Deleting a local import with its dependent records, confirming clear-all removes local reading data, and checking the library at 320–1280 CSS px without horizontal overflow.
- Sharing a public catalog book through the native share API or copy fallback; copying the validated current public page link; and confirming local imports render a device-only notice with no share/link controls.
- No browser page errors or unexpected console errors during route and responsive checks; CSP violation messages for deliberately blocked external resources are expected.

## Final cross-cutting validation

- Library filters and search filters are toggle-button groups, not ARIA tabs. Keyboard selection keeps focus on the newly rendered control. Topic and concept selection, descendant filtering, and learning-path completion also retain focus after updating their view.
- The mobile navigation opens with keyboard focus on its first control, closes with Escape, returns focus to the menu button, and is removed from the accessibility tree while closed.
- The browser accessibility tree exposes the page landmarks, named reader iframe, visible headings, labelled search and library controls, and status messages. A rendered-text contrast check across all primary views found no failures against WCAG AA thresholds after the muted-text adjustment.
- At viewport widths of 320, 375, 600, 760, 1024, and 1280 CSS px, Home, Search, Topics, Concept, Learning Path, My Learning, My Library, and the reader had no horizontal overflow. A 200% page-scale check at 375 CSS px also had no horizontal overflow.
- With reduced motion enabled, scrolling was `auto`; sidebar animation and transition durations were reduced to `0.01ms`. Keyboard focus was visible with a 3px outline.
- Release checks passed JavaScript syntax validation, the catalog/path validator, all six catalog-validator tests, and HTTP checks for the app, catalog, module assets, and all five sample books.
- The browser loaded all five sample books in sandboxed frames without `allow-same-origin`; observed requests stayed on the local app origin, and the browser reported no page errors or failed requests. Local IndexedDB-unavailable and quota-failure cases surfaced explicit errors without implying a successful save.
- Mobile LCP profile: integrated Chromium browser, 390×844 CSS px viewport, local Python static server, no network/CPU throttling, warm browser cache. The recorded LCP entry was approximately 440 ms. This local run is a smoke measurement, not a production or field-performance guarantee. Only the integrated Chromium build was exercised; other browser engines still require release-owner testing.

For static hosting, deploy the complete project root over HTTPS with the paths and MIME types described in the README. Hash routes need no server rewrite. Do not configure blanket frame denial; it prevents the sandboxed reader from loading its same-origin book files. Catalog removal cannot revoke direct or cached static book URLs.
