# Index Dictionary Book Template

This guide defines how standalone HTML books fit into the Index Dictionary reader. The app shell owns the persistent Index Dictionary brand, global navigation, book title, save/complete actions, and library return action. A book owns only its editorial content and book-specific reading controls.

The runnable example is [`book/AttentionEconomyTemplate.book`](book/AttentionEconomyTemplate.book). It is valid HTML stored with a `.book` authoring extension. Rename a finished copy to `.html` before adding its path to `data/catalog.json`; the static host and catalog validator expect HTML filenames.

## Reader boundary and layout

- **Do not add another Index Dictionary logo, brand header, or global navigation inside a book.** The app already displays its full-width header and reader bar outside the sandboxed book frame.
- Start the book with its cover or content, not an app-like dashboard. A small book-specific contents/reading toolbar is allowed, but it must not repeat the app identity.
- The reader frame fills the space below the app header and reader bar. Size book content relative to the frame viewport (`100dvh`/`100vh`, flexible grid or flex sizing); do not assume the browser's full viewport belongs to the book.
- Use a centered, responsive reading canvas with a comfortable maximum width. Fit the canvas to the available screen by default, while allowing long pages to scroll inside the current page.
- Provide a **Fit**/reset text-size control and optional text-size adjustments. Fit means return to the responsive default, not shrinking a long chapter to illegible text. Never use browser zoom or a fixed-width canvas as the only fit strategy.
- Use responsive typography, spacing, diagrams, and controls. Avoid horizontal overflow at narrow mobile widths, and account for short landscape viewports and safe area insets where needed.

## Required book structure

1. HTML5 document with `lang`, UTF-8, viewport metadata, and a descriptive document title.
2. One book-specific cover containing the book title and a concise premise.
3. A table of contents with one link per reading page/chapter.
4. Ordered content pages with meaningful headings, readable paragraphs, and useful diagrams or examples as appropriate.
5. Reader controls for previous/next, current position/progress, and contents access.
6. A closing page with a short recap or a meaningful next step.

Keep content self-contained for the static MVP: inline CSS and small book-specific JavaScript are fine; avoid remote dependencies, tracking scripts, external fonts, and network-loaded assets.

## Page IDs and navigation

- Give every navigable page a unique, stable ID matching `^[A-Za-z][A-Za-z0-9_-]{0,99}$`, such as `cover`, `contents`, `chapter-1`, and `takeaways`.
- Reuse the same page IDs across revisions when the page meaning remains the same. Deep links use `#read/{bookId}/{pageId}` in the app.
- Make contents links work as ordinary fragment links and support direct fragment loading and refresh.
- Provide buttons as an alternative to touch gestures. Keyboard left/right and PageUp/PageDown may turn pages when focus is not in a form control or link. Escape should close book-owned overlays.
- Do not put app navigation destinations such as the Index Dictionary Home or Library inside the book frame. The app's own header/back control owns those routes.

## Fit, accessibility, and interaction

- The initial layout should fit the reader frame without an inner brand header or unnecessary top padding.
- Keep text at a comfortable default size, with user-controlled zoom/text scaling that remains usable on mobile.
- Preserve visible keyboard focus; use real buttons and links with descriptive accessible names.
- Give informative illustrations concise alternative text. Mark purely decorative graphics as decorative.
- Ensure controls have comfortable touch targets, strong contrast, and a non-gesture alternative.
- Respect `prefers-reduced-motion`; page-turn animation must never be required to understand state.
- Use semantic landmarks and a logical heading order. Announce the current page/progress politely without moving focus on every turn.

## Sandbox and data ownership

- Books run in an iframe with `sandbox="allow-scripts"` and **without** `allow-same-origin`. Never request broader iframe privileges to make a book feature work.
- Treat imported or authored HTML as untrusted. Do not place secrets in it or assume it can read the app's DOM, IndexedDB, or catalog.
- Do not use book-owned local storage for app progress, bookmarks, or library state. The app owns private state in IndexedDB.
- Do not directly navigate the parent window or send arbitrary commands to it. For app-owned navigation and progress, send only the versioned `index-dictionary.book` messages shown below. The parent verifies the iframe's `contentWindow`, opaque sandbox origin, exact schema, catalog book ID, message type, and known page ID.
- Avoid inline event attributes and unsafe HTML construction from user-controlled text. Keep the document's book IDs, metadata, and static file paths aligned with `data/catalog.json`.

The app allows exactly these messages:

```js
const bookId = "replace-with-the-exact-catalog-book-id";
let hasSentReady = false;

function notifyParentPage(pageId) {
  parent.postMessage({
    protocol: "index-dictionary.book",
    version: 1,
    type: hasSentReady ? "page-changed" : "book-ready",
    bookId,
    pageId
  }, "*");
  hasSentReady = true;
}
```

Call `notifyParentPage(activePageId)` once after the first page is selected, then after each page change. Use only a stable, known page ID. The wildcard target origin is required because the sandboxed frame has an opaque origin; the parent compensates by accepting messages only from the active frame's `contentWindow` with `event.origin === "null"`. Never add commands to this protocol; the app validates data and owns navigation and persistence.

## Catalog and publishing checklist

Before publication:

- Place the finished HTML file under `book/` and use a lowercase kebab-case filename, for example `attention-economy.html`.
- Add a unique catalog ID and metadata entry whose `contentPath` points to that `.html` file.
- Confirm each page fragment exists once and that the document renders at mobile and desktop widths.
- Run `node scripts/validate-catalog.js` and `node --test tests/catalog-validator.test.js`.
- Open the book from the app and verify reading controls, direct page fragments, browser refresh, and sandbox behavior.
- Keep the `.book` source/template separate from the published `.html` catalog path unless the validator and hosting rules are deliberately changed.
