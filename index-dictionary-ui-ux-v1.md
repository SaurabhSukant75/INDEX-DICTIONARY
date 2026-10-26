# Index Dictionary — UI/UX direction (MVP)

**Status:** Investigation brief paired with [`index-dictionary-ui-ux-prototype-v1.html`](./index-dictionary-ui-ux-prototype-v1.html).  
**Purpose:** Explore the discovery-to-reading experience before committing to production UI or a component framework.

## Product experience

Index Dictionary helps readers discover a visual book, understand how it relates to other ideas, read it in its own voice, and keep a private record of their learning. The interface has two distinct layers:

1. **Library shell:** discovery, catalog navigation, personal organization, and a small amount of reading context.
2. **Book document:** an independent HTML experience that owns its typography, layout, content, internal navigation, and gestures.

The shell must not restyle a book, intercept its pointer or touch gestures, or make its own page controls compete with the book's controls. It provides a clear way into and out of the book and can display app-level status outside the book's interaction area.

## Page inventory and behavior

| Page / route | Job | Main content and actions |
|---|---|---|
| Home `/` | Explain the product and welcome curious readers | A concise introduction to Index Dictionary as a visual, structured learning platform; a friendly monkey mascot and humorous speech bubble. No catalog cards, recommendations, path promotion, statistics, or implementation details. |
| Search `/?q=…` | Find a book by title, description, topic, or concept | Search field, optional topic filters, result count, book cards, useful empty state with clear-search and browse actions. |
| Topic `/topics/{topicId}` | Browse a broad-to-specific hierarchy | Parent/child topic tree, breadcrumbs, topic description, and assigned books. Taxonomy is for browsing, not a learning order. |
| Concept `/concepts/{conceptId}` | Follow a semantic relationship | Concept description, a small navigable graph, typed relationship labels, and linked books. Graph edges do not imply sequence. |
| Learning path `/paths/{pathId}` | Follow an editorially ordered sequence | Path purpose, numbered steps, book links, progress/completion state, and next/previous affordances. Sequence is explicit and curated. |
| My Learning `/my-learning` | Resume personal learning activity | Continue-reading action and a working link to the curated Learning Path view. |
| My Library `/my-library` | Organize private reading activity | Continue reading, saved books, local imports, collections, and local progress. State is device-local in the MVP. |
| Read `/read/{bookId}` | Read one standalone book | Thin outer shell with exit/back, catalog title, and optional shell-owned bookmark/status. The actual book is rendered as a sandboxed document. |

The clickable prototype presents these as view switches and a hash-based read route so it can run as a static file. A full-width branded header remains visible above the sidebar and content, including while reading. On desktop, the sidebar sits directly below the header; on mobile, a header menu button opens a sidebar below the header with a dismissible backdrop.

The sidebar has two independently collapsible groups: Discover contains only Concept and Learning Path; My Space contains My Library. My Learning is a separate working navigation item. Search remains available through the global search field, and Topics is a top-bar shortcut rather than a sidebar item.

## Reader shell and book boundary

```text
Library UI
└── Read shell
    ├── Back to library
    ├── Catalog title / optional save action
    └── Isolated book viewport (iframe)
        └── Independent book HTML
            ├── Book-owned design and typography
            ├── Book-owned chapters, index, and navigation
            └── Book-owned swipe / keyboard / touch gestures
```

- Keep shell controls outside the iframe viewport. Do not install gesture listeners on the iframe wrapper.
- Render published and imported HTML in an isolated iframe; the architecture's MVP policy is `sandbox="allow-scripts"` only, with a restrictive CSP. Do not grant same-origin access, forms, popups, or top-level navigation.
- Do not inject app credentials or private data into a book. Any future shell/book messaging must be a narrow, validated protocol; it is not implemented in this visual prototype.
- A book's local progress behavior is not authoritative for the app. Production progress belongs to the shell's local database; a reviewed event protocol is needed if it must know a book's current page.
- Show app-level unavailable/unsupported states outside the frame, without replacing or silently transforming book content.

## Catalog and library design

Keep the three catalog structures separate in the UI and data model:

1. **Hierarchical taxonomy** answers “what topic is this?” and supports parent/child browsing.
2. **Knowledge graph** answers “how are these concepts related?” and shows typed, editorial edges.
3. **Learning path** answers “what should I read in what order?” and has an explicit numbered sequence.

Book cards should show a readable title, short description, topic, estimated reading time where known, and a small number of editorial tags. Selecting any card opens that book's stable route. The five cards in this prototype are clearly numbered copies of the provided sample, not five distinct titles or subjects.

My Library is private to the current browser in the MVP. It should distinguish catalog books from reader-imported HTML, and make clear that imported books, saved items, collections, and progress are not shared or synced. A production import flow needs validation and an explicit local-storage confirmation; this prototype only presents a file chooser placeholder.

## Visual direction and interaction principles

- **Tone:** editorial, calm, curious, and approachable; the book is the visual centerpiece.
- **Library:** warm off-white canvas, quiet borders, large serif editorial headlines, compact sans-serif labels, and restrained accent colors.
- **Hierarchy:** one primary action per page; cards are large enough to identify at a glance; topic and relationship labels remain secondary. Home is a welcoming product introduction, not a catalog dashboard.
- **Responsive:** desktop sidebar collapses to a mobile menu; catalog cards reflow; reader shell retains a visible exit affordance while leaving the book's full interaction surface intact.
- **Accessible interactions:** semantic headings and buttons, keyboard-operable book cards and controls, visible focus states in production, clear no-results text, and reduced-motion support.
- **Progressive enhancement:** browsing and reading should remain understandable when local storage is unavailable; show a clear notice rather than implying persistence.

## Prototype scope and known limitations

Open [`index-dictionary-ui-ux-prototype-v1.html`](./index-dictionary-ui-ux-prototype-v1.html) from the project directory. It links to five standalone sample copies in `book/`, each opened in its own iframe. The copies retain the source book's content and behavior; distinct filenames and per-copy internal progress keys let us exercise separate routes. They are deliberately not presented as different books.

The prototype is static and illustrative:

- Catalog metadata, topic assignments, graph edges, learning path membership, and library counts are mock data.
- Search and view changes work client-side; no catalog API or database is connected.
- The import chooser demonstrates the entry point only; it does not persist an imported file.
- Bookmark status is a small browser-local demonstration, not the production IndexedDB data model.
- Sample book internal progress remains book-owned for this prototype. Production must move authoritative progress into the reader shell as described in the engineering architecture.
- There is no account, cloud sync, editor workflow, or production content security policy.

## Questions to resolve after prototype review

1. Should Home prioritize continuing a book, recommended books, or a selected learning path?
2. Which reader controls belong in the shell (save/bookmark, font/appearance, progress), and which should remain book-owned?
3. Should catalog search include concept descriptions and taxonomy labels in addition to book metadata?
4. How should local imports be visually distinguished from catalog books and appear in search?
5. What is the desired mobile behavior for the app shell around a full-screen book?
6. Which book metadata is mandatory on a card: author, reading time, level, topic, or format?
