import { emptyState, escapeHtml } from "../ui/markup.js";

function getBook(catalog, importedBooks, bookId) {
  return catalog.books.find(book => book.id === bookId) ||
    importedBooks.find(book => book.id === bookId) ||
    null;
}

function bookTitle(book) {
  return book?.title || "Unavailable book";
}

function bookRow(book, options = {}) {
  const { progress, saved, imported, collections, selectedCollectionId } = options;
  const currentProgress = progress.get(book.id);
  const pageId = currentProgress?.currentPageId || currentProgress?.lastPageId || "";
  const status = currentProgress?.completed
    ? "Completed"
    : pageId ? "In progress" : saved ? "Saved" : imported ? "Imported book" : "Not started";
  const collectionOptions = collections.map(collection =>
    `<option value="${escapeHtml(collection.collectionId)}"${collection.collectionId === selectedCollectionId ? " selected" : ""}>${escapeHtml(collection.name)}</option>`
  ).join("");
  return `<article class="library-book" data-book-id="${escapeHtml(book.id)}">
    <div class="library-book-main">
      <button class="library-book-open" type="button" data-open-book="${escapeHtml(book.id)}">
        <strong>${escapeHtml(bookTitle(book))}</strong>
        <small>${escapeHtml(status)}${imported && book.category ? ` · ${escapeHtml(book.category)}` : ""}${pageId ? ` · Last page: ${escapeHtml(pageId)}` : ""}</small>
      </button>
      <div class="library-book-actions">
        ${pageId && !currentProgress?.completed ? `<button class="text-button" type="button" data-resume-book="${escapeHtml(book.id)}">Resume</button>` : ""}
        ${currentProgress ? `<button class="text-button" type="button" data-restart-book="${escapeHtml(book.id)}">Restart</button>` : ""}
        ${currentProgress ? `<button class="text-button" type="button" data-toggle-complete="${escapeHtml(book.id)}" aria-pressed="${currentProgress.completed === true}">${currentProgress.completed ? "Mark in progress" : "Mark complete"}</button>` : ""}
        ${imported ? `<button class="text-button" type="button" data-edit-import="${escapeHtml(book.id)}">Edit details</button>` : ""}
        ${saved ? `<button class="text-button" type="button" data-remove-saved="${escapeHtml(book.id)}">Remove saved</button>` : ""}
        ${imported ? `<button class="text-button danger-text" type="button" data-delete-import="${escapeHtml(book.id)}">Delete import</button>` : ""}
      </div>
    </div>
    ${collections.length ? `<div class="collection-add">
      <label class="sr-only" for="collection-for-${escapeHtml(book.id)}">Collection for ${escapeHtml(bookTitle(book))}</label>
      <select id="collection-for-${escapeHtml(book.id)}" data-collection-select>${collectionOptions}</select>
      <button class="text-button" type="button" data-add-to-collection="${escapeHtml(book.id)}">Add</button>
    </div>` : ""}
  </article>`;
}

function collectionPanel(collections, collectionBooks, selectedCollectionId, renamingCollectionId, catalog, importedBooks) {
  const selected = collections.find(collection => collection.collectionId === selectedCollectionId);
  const members = selectedCollectionId ? collectionBooks.get(selectedCollectionId) || [] : [];
  const memberRows = members.map(({ bookRef }) => {
    const bookId = bookRef.slice(bookRef.indexOf(":") + 1);
    const book = getBook(catalog, importedBooks, bookId);
    if (!book) return "";
    return `<article class="library-book">
      <div class="library-book-main">
        <button class="library-book-open" type="button" data-open-book="${escapeHtml(bookId)}">
          <strong>${escapeHtml(bookTitle(book))}</strong>
          <small>${escapeHtml(bookRef.startsWith("local:") ? "Private HTML import" : "Catalog book")}</small>
        </button>
        <button class="text-button" type="button" data-remove-from-collection="${escapeHtml(bookId)}" data-collection-id="${escapeHtml(selectedCollectionId)}">Remove</button>
      </div>
    </article>`;
  }).join("");
  const selectedContent = selected
    ? `${members.length
      ? `<div class="library-book-list">${memberRows}</div>`
      : emptyState("This collection is empty", "Add saved or imported books from your library below.")}`
    : `<p class="muted-copy">Create a collection to organize saved and imported books.</p>`;
  const collectionItems = collections.map(collection => `<li class="collection-item">
    <button class="collection-select${collection.collectionId === selectedCollectionId ? " selected" : ""}" type="button" data-select-collection="${escapeHtml(collection.collectionId)}" aria-pressed="${collection.collectionId === selectedCollectionId}">
      <span>${escapeHtml(collection.name)}</span><small>${(collectionBooks.get(collection.collectionId) || []).length}</small>
    </button>
    ${renamingCollectionId === collection.collectionId
      ? `<form class="collection-rename" data-rename-collection-form data-collection-id="${escapeHtml(collection.collectionId)}">
        <label class="sr-only" for="rename-collection-${escapeHtml(collection.collectionId)}">Rename ${escapeHtml(collection.name)}</label>
        <input id="rename-collection-${escapeHtml(collection.collectionId)}" name="name" maxlength="80" value="${escapeHtml(collection.name)}" required>
        <button class="text-button" type="submit">Save</button>
        <button class="text-button" type="button" data-cancel-rename>Cancel</button>
      </form>`
      : `<button class="text-button" type="button" data-rename-collection="${escapeHtml(collection.collectionId)}" aria-label="Rename ${escapeHtml(collection.name)}">Rename</button>`}
    <button class="text-button danger-text" type="button" data-delete-collection="${escapeHtml(collection.collectionId)}" aria-label="Delete ${escapeHtml(collection.name)}">Delete</button>
  </li>`).join("");
  return `<section class="library-panel" aria-labelledby="collections-title">
    <div class="panel-heading"><div><p class="eyebrow">Make it yours</p><h2 id="collections-title">Collections</h2></div></div>
    <form class="collection-create" data-create-collection>
      <label class="sr-only" for="new-collection-name">New collection name</label>
      <input id="new-collection-name" name="name" maxlength="80" placeholder="e.g. Read next" required>
      <button class="button small" type="submit">Create</button>
    </form>
    ${collections.length ? `<ul class="collection-list">${collectionItems}</ul>` : ""}
    ${selectedContent}
    ${selected ? `<p class="muted-copy">Selected collection: ${escapeHtml(selected.name)}</p>` : ""}
  </section>`;
}

function bookmarkPanel(bookmarks, catalog, importedBooks) {
  if (!bookmarks.length) return emptyState("No bookmarks yet", "Bookmark a page while reading and it will appear here.");
  return `<div class="library-book-list">${bookmarks.map(bookmark => {
    const bookId = bookmark.bookRef.slice(bookmark.bookRef.indexOf(":") + 1);
    const book = getBook(catalog, importedBooks, bookId);
    return `<article class="library-book">
      <button class="library-book-open" type="button" data-open-book-page="${escapeHtml(bookId)}" data-page-id="${escapeHtml(bookmark.pageId)}">
        <strong>${escapeHtml(bookmark.label || bookmark.pageId)}</strong>
        <small>${escapeHtml(bookTitle(book))} · ${escapeHtml(bookmark.pageId)}</small>
      </button>
      <button class="text-button danger-text" type="button" data-delete-bookmark="${escapeHtml(bookmark.bookmarkId)}">Remove</button>
    </article>`;
  }).join("")}</div>`;
}

function importEditor(draft, collections) {
  if (!draft) return "";
  const isNew = draft.mode === "new";
  const collectionOptions = [`<option value="">No collection</option>`, ...collections.map(collection =>
    `<option value="${escapeHtml(collection.collectionId)}"${collection.collectionId === draft.collectionId ? " selected" : ""}>${escapeHtml(collection.name)}</option>`
  )].join("");
  return `<section class="import-editor library-panel" aria-labelledby="import-editor-title">
    <div class="panel-heading">
      <div><p class="eyebrow">${isNew ? "Private HTML import · Preview first" : "Private HTML import · Edit"}</p><h2 id="import-editor-title">${isNew ? "Review this book" : "Edit book details"}</h2></div>
    </div>
    <p class="import-safety-note">Preview runs in a sandbox separate from Index Dictionary. External resources are blocked. Only the HTML file is stored on this device; it is never uploaded.</p>
    <div class="import-editor-grid">
      <form class="import-details-form" data-import-details>
        <label for="import-title">Book title</label>
        <input id="import-title" name="title" maxlength="180" required value="${escapeHtml(draft.title)}">
        <label for="import-category">Category <span>(optional)</span></label>
        <input id="import-category" name="category" maxlength="80" value="${escapeHtml(draft.category || "")}" placeholder="e.g. Psychology">
        ${isNew ? `<label for="import-collection">Add to collection <span>(optional)</span></label><select id="import-collection" name="collectionId">${collectionOptions}</select>` : ""}
        <p class="muted-copy">File: ${escapeHtml(draft.filename)} · Maximum size: 2 MiB</p>
        <div class="import-editor-actions">
          <button class="button small" type="submit">${isNew ? "Save to My Library" : "Save details"}</button>
          <button class="text-button" type="button" data-cancel-import>Cancel</button>
        </div>
      </form>
      <div class="import-preview">
        <h3>Sandboxed preview</h3>
        <iframe title="Imported book preview" sandbox="allow-scripts" referrerpolicy="no-referrer" data-import-preview></iframe>
      </div>
    </div>
  </section>`;
}

export function renderLibrary(catalog, state) {
  const {
    savedBookIds,
    importedBooks,
    progress,
    selectedTab = "all",
    collections = [],
    collectionBooks = new Map(),
    bookmarks = [],
    selectedCollectionId = "",
    renamingCollectionId = "",
    importDraft = null
  } = state;
  const publicBooks = catalog.books;
  const imports = importedBooks.map(book => ({ ...book, readingMinutes: 0 }));
  const allBooks = [...publicBooks, ...imports];
  const inProgress = allBooks
    .filter(book => progress.has(book.id) && !progress.get(book.id).completed)
    .sort((a, b) => (progress.get(b.id)?.lastOpenedAt || 0) - (progress.get(a.id)?.lastOpenedAt || 0));
  const saved = allBooks.filter(book => savedBookIds.has(book.id));
  const recent = allBooks
    .filter(book => progress.has(book.id))
    .sort((a, b) => (progress.get(b.id)?.lastOpenedAt || 0) - (progress.get(a.id)?.lastOpenedAt || 0));
  const tabBooks = selectedTab === "recent" ? recent
    : selectedTab === "in-progress" ? inProgress
      : selectedTab === "saved" ? saved
        : selectedTab === "imported" ? imports
          : [...recent, ...saved.filter(book => !recent.some(item => item.id === book.id)), ...imports.filter(book => !recent.some(item => item.id === book.id))];
  const tabs = [
    ["all", "All books"],
    ["recent", "Recent"],
    ["in-progress", "In progress"],
    ["saved", "Saved"],
    ["imported", "Imported"],
    ["bookmarks", "Bookmarks"]
  ].map(([value, label]) => `<button class="library-tab${selectedTab === value ? " active" : ""}" type="button" data-library-tab="${value}" aria-pressed="${selectedTab === value}">${label}</button>`).join("");
  const chosenCollection = collections.find(collection => collection.collectionId === selectedCollectionId);
  const currentTabTitle = {
    all: "Your books",
    recent: "Recently read",
    "in-progress": "Continue reading",
    saved: "Saved books",
    imported: "Your imports",
    bookmarks: "Bookmarked pages"
  }[selectedTab] || "Your books";
  const listContent = selectedTab === "bookmarks"
    ? bookmarkPanel(bookmarks, catalog, importedBooks)
    : tabBooks.length
      ? `<div class="library-book-list">${tabBooks.map(book => bookRow(book, {
        progress,
        saved: savedBookIds.has(book.id),
        imported: imports.some(item => item.id === book.id),
        collections,
        selectedCollectionId
      })).join("")}</div>`
      : emptyState(selectedTab === "imported" ? "No imported books yet" : "Nothing here yet", selectedTab === "imported" ? "Import an HTML book to keep a personal copy on this device." : "Save a book or start reading to see it here.");
  const collectionPanelHtml = collectionPanel(collections, collectionBooks, selectedCollectionId, renamingCollectionId, catalog, importedBooks);
  return `<section class="page-wrap" aria-labelledby="library-title">
    <p class="eyebrow">Your space · Stored on this device</p>
    <h1 class="page-title" id="library-title">My Library.</h1>
    <p class="lede">Pick up where you left off, save books, or organize them into collections.</p>
    <div class="library-stats">
      <div class="stat"><strong>${saved.length}</strong><span>Saved books</span></div>
      <div class="stat"><strong>${inProgress.length}</strong><span>In progress</span></div>
      <div class="stat"><strong>${imports.length}</strong><span>Imported books</span></div>
      <div class="stat"><strong>${bookmarks.length}</strong><span>Bookmarks</span></div>
    </div>
    <div class="library-toolbar">
      <div class="library-tabs" role="group" aria-label="Filter library">${tabs}</div>
      <div class="library-toolbar-actions">
        <button class="button small light" type="button" data-import-book>＋ Import HTML</button>
        <button class="text-button danger-text" type="button" data-clear-library>Clear local library</button>
      </div>
    </div>
    ${importEditor(importDraft, collections)}
    <div class="library-columns">
      ${collectionPanelHtml}
      <section class="library-panel" aria-labelledby="library-list-title">
        <div class="panel-heading"><div><p class="eyebrow">${chosenCollection ? `Collection · ${escapeHtml(chosenCollection.name)}` : "Your reading"}</p><h2 id="library-list-title">${escapeHtml(currentTabTitle)}</h2></div></div>
        ${listContent}
      </section>
    </div>
    <p class="privacy-note">Your private imports and reading activity are stored in this browser; they are not uploaded.</p>
  </section>`;
}
