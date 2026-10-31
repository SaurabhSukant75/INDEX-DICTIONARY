import { loadCatalog, findBook } from "../services/catalog-service.js";
import { navigate, subscribeToRoutes } from "../navigation/router.js";
import {
  createBookPageUrl,
  hasBookPage,
  createImportedBookUrl,
  isAllowedBookMessage,
  loadBookDocument
} from "../services/book-service.js";
import {
  addBookToCollection,
  clearReaderData,
  deleteBookmark,
  deleteCollection,
  deleteImportedBook,
  getBookmarks,
  getCollectionBooks,
  getCollections,
  getImportedBook,
  getImportedBooks,
  getPathProgress,
  getReadingProgress,
  getSavedBooks,
  removeBookFromCollection,
  saveBookmark,
  saveCollection,
  recordBookOpened,
  recordBookPage,
  saveImportedBook,
  setBookCompleted,
  setBookSaved,
  updateImportedBook,
  setPathCompleted
} from "../services/reader-library-service.js";
import {
  createSupabaseClient,
  saveBookProgressToCloud,
  savePathProgressToCloud,
  syncProgress
} from "../services/supabase-service.js";
import { escapeHtml } from "../ui/markup.js";
import { renderAccount } from "../views/account.js";
import { renderConcepts } from "../views/concepts.js";
import { renderHome } from "../views/home.js";
import { renderLearningPaths } from "../views/learning-paths.js";
import { renderLibrary } from "../views/library.js";
import { renderLeaderboard } from "../views/leaderboard.js";
import { renderMyLearning } from "../views/my-learning.js";
import { renderReader } from "../views/reader.js";
import { renderSearch } from "../views/search.js";
import { renderTopics } from "../views/topics.js";

const root = document.querySelector("#view-root");
const globalSearch = document.querySelector("#global-search");
const topbar = document.querySelector("#topbar");
const breadcrumb = document.querySelector("#breadcrumb");
const sidebar = document.querySelector("#sidebar");
const mobileMenu = document.querySelector("#mobile-menu");
const backdrop = document.querySelector("#sidebar-backdrop");
const importInput = document.querySelector("#import-file");
const toastElement = document.querySelector("#toast");

const state = {
  catalog: null,
  route: { name: "home" },
  query: "",
  filter: "all",
  selectedTopic: "ideas",
  includeDescendants: true,
  selectedConcept: "attention",
  selectedLibraryTab: "all",
  selectedCollectionId: "",
  renamingCollectionId: "",
  savedBookIds: new Set(),
  importedBooks: [],
  collections: [],
  collectionBooks: new Map(),
  bookmarks: [],
  progress: new Map(),
  pathProgress: new Map(),
  storageError: "",
  activeObjectUrl: null,
  importDraft: null,
  readerContext: null,
  readerRequestId: 0,
  toastTimer: null,
  supabase: null,
  authInitializing: true,
  authError: "",
  account: null,
  profile: null,
  accountRevision: 0,
  accountLoading: false,
  accountBusy: false,
  accountError: "",
  accountMessage: "",
  leaderboard: { status: "idle", entries: [], error: "" }
};

function announce(message, isError = false) {
  toastElement.textContent = message;
  toastElement.classList.add("visible");
  toastElement.setAttribute("role", isError ? "alert" : "status");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toastElement.classList.remove("visible"), 3600);
}

function focusControl(attribute, value) {
  [...root.querySelectorAll(`[${attribute}]`)]
    .find(control => control.getAttribute(attribute) === value)
    ?.focus();
}

function showStorageWarning() {
  return state.storageError
    ? `<p class="storage-warning" role="alert">${escapeHtml(state.storageError)} Your books still open, but library changes cannot be saved.</p>`
    : "";
}

function showRouteError(message) {
  root.innerHTML = `${showStorageWarning()}<section class="page-wrap"><div class="empty-state"><h1>We couldn’t open that book.</h1><p>${escapeHtml(message)}</p><a class="button" href="#search" data-route="search">Back to the library</a></div></section>`;
}

function titleForRoute(route) {
  const titles = {
    home: "Home",
    "my-learning": "My Learning",
    search: "Search",
    topics: "Topics",
    concepts: "Concept",
    paths: "Learning Path",
    library: "My Library",
    account: "Account",
    leaderboard: "Leaderboard",
    reader: "Reading"
  };
  return titles[route.name] || "Home";
}

function closeSidebar(returnFocus = false) {
  const wasOpen = sidebar.classList.contains("open");
  sidebar.classList.remove("open");
  backdrop.hidden = true;
  mobileMenu.setAttribute("aria-expanded", "false");
  mobileMenu.setAttribute("aria-label", "Open navigation");
  if (window.matchMedia("(max-width: 760px)").matches) {
    sidebar.setAttribute("aria-hidden", "true");
    sidebar.setAttribute("inert", "");
  } else {
    sidebar.removeAttribute("aria-hidden");
    sidebar.removeAttribute("inert");
  }
  if (returnFocus && wasOpen) mobileMenu.focus();
}

function toggleSidebar() {
  const open = !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", open);
  backdrop.hidden = !open;
  mobileMenu.setAttribute("aria-expanded", String(open));
  mobileMenu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  syncSidebarForViewport();
  if (open) sidebar.querySelector("a, button")?.focus();
  else mobileMenu.focus();
}

function syncSidebarForViewport() {
  if (!window.matchMedia("(max-width: 760px)").matches) {
    closeSidebar();
    sidebar.removeAttribute("aria-hidden");
    sidebar.removeAttribute("inert");
  } else if (!sidebar.classList.contains("open")) {
    sidebar.setAttribute("aria-hidden", "true");
    sidebar.setAttribute("inert", "");
  } else {
    sidebar.removeAttribute("aria-hidden");
    sidebar.removeAttribute("inert");
  }
}

function updateNavigation(route) {
  document.querySelectorAll("[data-route]").forEach(link => {
    const active = link.dataset.route === route.name;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  breadcrumb.textContent = `Index Dictionary / ${titleForRoute(route)}`;
  topbar.hidden = route.name === "reader";
  document.body.classList.toggle("reader-mode", route.name === "reader");
  document.title = route.name === "reader" && state.catalog
    ? `${findBook(state.catalog, route.id)?.title || "Reading"} · Index Dictionary`
    : `${titleForRoute(route)} · Index Dictionary`;
  closeSidebar();
  syncSidebarForViewport();
}

function renderReaderRoute(route) {
  state.readerContext = null;
  const requestId = ++state.readerRequestId;
  const isCurrentRequest = () =>
    requestId === state.readerRequestId &&
    state.route.name === "reader" &&
    state.route.id === route.id &&
    state.route.pageId === route.pageId;
  if (route.invalid) {
    showRouteError("The requested book link is malformed.");
    return;
  }

  const book = findBook(state.catalog, route.id);
  const imported = !book && route.id.startsWith("import-");
  if (!book && !imported) {
    showRouteError("The requested book is not in this catalog.");
    return;
  }

  root.innerHTML = `${showStorageWarning()}<section class="page-wrap"><div class="empty-state" role="status"><h1>Opening your book…</h1><p>The independent HTML reader is loading.</p></div></section>`;
  const load = imported ? getImportedBook(route.id) : Promise.resolve(book);
  load.then(async record => {
    if (!record) {
      if (isCurrentRequest()) showRouteError("This imported book is no longer available in this browser.");
      return;
    }
    if (!isCurrentRequest()) return;
    let bookUrl;
    let pageIds;
    if (imported) {
      const importedDocument = createImportedBookUrl(record.content);
      pageIds = importedDocument.pageIds;
      state.activeObjectUrl = importedDocument.url;
      bookUrl = new URL(importedDocument.url);
    } else {
      ({ url: bookUrl, pageIds } = await loadBookDocument(record));
    }
    if (!isCurrentRequest()) {
      if (imported && state.activeObjectUrl) {
        URL.revokeObjectURL(state.activeObjectUrl);
        state.activeObjectUrl = null;
      }
      return;
    }
    if (route.pageId && !hasBookPage(pageIds, route.pageId)) {
      if (imported && state.activeObjectUrl) {
        URL.revokeObjectURL(state.activeObjectUrl);
        state.activeObjectUrl = null;
      }
      showRouteError(`The book does not contain a page named “${route.pageId}”.`);
      return;
    }
    const savedPage = state.progress.get(record.id)?.currentPageId ||
      state.progress.get(record.id)?.lastPageId ||
      null;
    const requestedPageId = route.pageId || (route.restart ? pageIds[0] : savedPage);
    if (requestedPageId && !hasBookPage(pageIds, requestedPageId)) {
      showRouteError(`The book does not contain a page named “${requestedPageId}”.`);
      return;
    }
    const saved = state.savedBookIds.has(record.id);
    const completed = state.progress.get(record.id)?.completed === true;
    const bookmarks = state.bookmarks.filter(bookmark => bookmark.bookRef.endsWith(`:${record.id}`));
    root.innerHTML = `${showStorageWarning()}${renderReader(record, saved, completed, imported, requestedPageId, bookmarks)}`;
    const frame = root.querySelector("[data-reader-frame]");
    state.readerContext = {
      frame,
      bookId: record.id,
      imported,
      pageIds,
      ready: false
    };
    frame.src = createBookPageUrl(bookUrl, requestedPageId);
    try {
      const progress = await recordBookOpened(record.id);
      state.progress = await getReadingProgress();
      await syncBookProgress(progress);
    } catch (error) {
      if (isCurrentRequest()) announce(`Reading progress could not be saved: ${error.message}`, true);
    }
  }).catch(error => {
    if (isCurrentRequest()) {
      showRouteError(imported
        ? `Local book storage or content failed: ${error.message}`
        : error.message);
    }
  });
}

function renderRoute(route) {
  state.route = route;
  updateNavigation(route);
  if (route.name !== "library" && state.importDraft) discardImportDraft();
  if (route.name !== "reader") state.readerContext = null;
  if (!state.catalog) return;
  if (route.name === "invalid") {
    showRouteError("The requested link is malformed.");
    return;
  }
  if (state.activeObjectUrl) {
    URL.revokeObjectURL(state.activeObjectUrl);
    state.activeObjectUrl = null;
  }

  if (route.name === "reader") {
    renderReaderRoute(route);
    return;
  }
  const routeRenderers = {
    home: renderHome,
    "my-learning": () => renderMyLearning(state.catalog, state.progress, state.pathProgress),
    search: () => renderSearch(state.catalog, state.query, state.filter),
    topics: () => renderTopics(state.catalog, state.selectedTopic, state.includeDescendants),
    concepts: () => renderConcepts(state.catalog, state.selectedConcept),
    paths: () => renderLearningPaths(state.catalog, state.progress, state.pathProgress),
    library: () => renderLibrary(state.catalog, {
      savedBookIds: state.savedBookIds,
      importedBooks: state.importedBooks,
      progress: state.progress,
      selectedTab: state.selectedLibraryTab,
      collections: state.collections,
      collectionBooks: state.collectionBooks,
      bookmarks: state.bookmarks,
      selectedCollectionId: state.selectedCollectionId,
      renamingCollectionId: state.renamingCollectionId,
      importDraft: state.importDraft
    }),
    account: () => renderAccount({
      configured: Boolean(state.supabase),
      loading: state.authInitializing || state.accountLoading || state.accountBusy,
      user: state.account,
      profile: state.profile,
      error: state.accountError || state.authError,
      message: state.accountMessage
    }),
    leaderboard: () => renderLeaderboard({
      ...state.leaderboard,
      user: state.account
    })
  };
  const renderer = routeRenderers[route.name] || renderHome;
  root.innerHTML = `${showStorageWarning()}${renderer()}`;
  if (route.name === "library" && state.importDraft) {
    const preview = root.querySelector("[data-import-preview]");
    if (preview) preview.src = state.importDraft.previewUrl;
  }
  if (route.name === "search") {
    const pageSearch = root.querySelector("#page-search");
    if (pageSearch) pageSearch.value = state.query;
  }
  if (route.name === "leaderboard" && state.leaderboard.status === "idle") {
    void refreshLeaderboard();
  }
}

async function refreshLibraryState() {
  const [savedBooks, importedBooks, progress, pathProgress, collections, bookmarks] = await Promise.all([
    getSavedBooks(),
    getImportedBooks(),
    getReadingProgress(),
    getPathProgress(),
    getCollections(),
    getBookmarks()
  ]);
  const collectionEntries = await Promise.all(collections.map(async collection => [
    collection.collectionId,
    await getCollectionBooks(collection.collectionId)
  ]));
  state.savedBookIds = new Set(savedBooks.map(record => record.bookId));
  state.importedBooks = importedBooks;
  state.progress = progress;
  state.pathProgress = pathProgress;
  state.collections = collections;
  state.collectionBooks = new Map(collectionEntries);
  state.bookmarks = bookmarks;
  if (!collections.some(collection => collection.collectionId === state.selectedCollectionId)) {
    state.selectedCollectionId = "";
  }
  state.storageError = "";
}

function updateAccountRoute() {
  if (state.route.name === "account" || state.route.name === "leaderboard") {
    renderRoute(state.route);
  }
}

async function applyAccountSession(session) {
  const revision = ++state.accountRevision;
  state.account = session?.user || null;
  state.profile = null;
  state.accountError = "";
  state.accountMessage = "";
  state.accountLoading = Boolean(state.account);
  if (!state.account) {
    state.leaderboard = { status: "idle", entries: [], error: "" };
    updateAccountRoute();
    return;
  }

  updateAccountRoute();
  try {
    const userId = state.account.id;
    const { data: profile, error } = await state.supabase.from("profiles")
      .select("username,leaderboard_opt_in")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!profile) throw new Error("Your profile is missing. Run supabase/schema.sql in the Supabase SQL Editor.");
    const synced = await syncProgress(state.supabase, userId, state.progress, state.pathProgress);
    if (revision !== state.accountRevision) return;
    state.profile = profile;
    state.progress = synced.progress;
    state.pathProgress = synced.pathProgress;
    state.leaderboard = { status: "idle", entries: [], error: "" };
  } catch (error) {
    if (revision !== state.accountRevision) return;
    state.accountError = `Signed in, but account data could not be loaded or synced: ${error.message}`;
  } finally {
    if (revision === state.accountRevision) {
      state.accountLoading = false;
      updateAccountRoute();
    }
  }
}

async function initializeSupabase() {
  try {
    state.supabase = await createSupabaseClient();
    state.supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED") {
        window.setTimeout(() => void applyAccountSession(session), 0);
      }
    });
    const { data, error } = await state.supabase.auth.getSession();
    if (error) throw error;
    state.authInitializing = false;
    await applyAccountSession(data.session);
  } catch (error) {
    state.authInitializing = false;
    state.authError = error.message;
    updateAccountRoute();
  }
}

async function refreshLeaderboard() {
  if (!state.supabase || state.leaderboard.status === "loading") return;
  state.leaderboard = { status: "loading", entries: [], error: "" };
  if (state.route.name === "leaderboard") renderRoute(state.route);
  try {
    const { data, error } = await state.supabase.rpc("get_public_leaderboard");
    if (error) throw error;
    state.leaderboard = { status: "ready", entries: data || [], error: "" };
  } catch (error) {
    state.leaderboard = { status: "error", entries: [], error: error.message };
  }
  if (state.route.name === "leaderboard") renderRoute(state.route);
}

async function syncBookProgress(record) {
  if (!state.supabase || !state.account || record.bookId.startsWith("import-")) return;
  try {
    await saveBookProgressToCloud(state.supabase, state.account.id, record);
    state.leaderboard = { status: "idle", entries: [], error: "" };
    if (state.route.name === "leaderboard") renderRoute(state.route);
  } catch (error) {
    announce(`Progress was saved on this device but could not sync: ${error.message}`, true);
  }
}

async function syncPathProgress(record) {
  if (!state.supabase || !state.account) return;
  try {
    await savePathProgressToCloud(state.supabase, state.account.id, record);
  } catch (error) {
    announce(`Path progress was saved on this device but could not sync: ${error.message}`, true);
  }
}

function openBook(id, pageId = null, restart = false) {
  const publicBook = findBook(state.catalog, id);
  const imported = state.importedBooks.find(book => book.id === id);
  if (!publicBook && !imported) {
    announce("That book is not available in the catalog or local library.", true);
    return;
  }
  const route = `${imported ? "imported" : "read"}/${encodeURIComponent(id)}`;
  navigate(pageId ? `${route}/${encodeURIComponent(pageId)}` : `${route}${restart ? "?restart=1" : ""}`);
}

async function toggleSaved(id) {
  const saved = state.savedBookIds.has(id);
  try {
    await setBookSaved(id, !saved);
    if (saved) state.savedBookIds.delete(id);
    else state.savedBookIds.add(id);
    announce(saved ? "Removed from My Library." : "Saved to My Library.");
    if (state.route.name === "reader") {
      const button = root.querySelector("[data-toggle-save]");
      if (button) {
        button.setAttribute("aria-pressed", String(!saved));
        button.textContent = saved ? "☆ Save" : "★ Saved";
      }
    } else {
      renderRoute(state.route);
    }
  } catch (error) {
    announce(`Could not update your library: ${error.message}`, true);
  }
}

async function toggleCompleted(id) {
  const completed = state.progress.get(id)?.completed === true;
  try {
    const updated = await setBookCompleted(id, !completed);
    state.progress = await getReadingProgress();
    await syncBookProgress(updated);
    announce(completed ? "Book marked as in progress." : "Book marked complete.");
    if (state.route.name === "reader") {
      const button = root.querySelector("[data-toggle-complete]");
      if (button) {
        button.setAttribute("aria-pressed", String(!completed));
        button.textContent = completed ? "Mark complete" : "✓ Complete";
      }
    } else {
      renderRoute(state.route);
    }
  } catch (error) {
    announce(`Could not update reading progress: ${error.message}`, true);
  }
}

function updateReaderBookmarkButton(bookId, pageId) {
  const button = root.querySelector("[data-toggle-bookmark]");
  if (!button || button.dataset.toggleBookmark !== bookId) return;
  const bookmark = state.bookmarks.find(item =>
    item.bookRef.endsWith(`:${bookId}`) && item.pageId === pageId
  );
  button.dataset.pageId = pageId || "";
  button.disabled = !pageId;
  button.setAttribute("aria-pressed", String(Boolean(bookmark)));
  button.textContent = bookmark ? "★ Bookmarked" : "☆ Bookmark page";
  root.querySelector(".reader-bookmark-note")?.remove();
  if (bookmark) {
    const note = document.createElement("p");
    note.className = "reader-bookmark-note";
    note.setAttribute("role", "status");
    note.textContent = `Bookmarked: ${bookmark.label || bookmark.pageId}`;
    root.querySelector(".reader-bar")?.after(note);
  }
  const copyPageButton = root.querySelector("[data-copy-page]");
  if (copyPageButton) copyPageButton.disabled = !pageId;
}

async function toggleBookmark(bookId, pageId) {
  if (!pageId) {
    announce("Open a book page before adding a bookmark.", true);
    return;
  }
  const existing = state.bookmarks.find(item =>
    item.bookRef.endsWith(`:${bookId}`) && item.pageId === pageId
  );
  try {
    if (existing) {
      await deleteBookmark(existing.bookmarkId);
      state.bookmarks = state.bookmarks.filter(item => item.bookmarkId !== existing.bookmarkId);
      announce("Bookmark removed.");
    } else {
      const title = root.querySelector("#reader-title")?.textContent || "Book";
      await saveBookmark({
        bookmarkId: crypto.randomUUID(),
        bookId,
        pageId,
        label: `${title} · ${pageId}`,
        createdAt: Date.now()
      });
      state.bookmarks = await getBookmarks();
      announce("Page bookmarked.");
    }
    updateReaderBookmarkButton(bookId, pageId);
    if (state.route.name !== "reader") renderRoute(state.route);
  } catch (error) {
    announce(`Could not update bookmark: ${error.message}`, true);
  }
}

function getPublicShareUrl(bookId, includePage) {
  const book = findBook(state.catalog, bookId);
  if (!book) return null;
  const pageId = state.route.name === "reader" &&
    state.route.id === bookId &&
    state.route.pageId &&
    state.readerContext?.bookId === bookId &&
    hasBookPage(state.readerContext.pageIds, state.route.pageId)
    ? state.route.pageId
    : null;
  if (includePage && !pageId) return null;
  const hash = `#read/${encodeURIComponent(bookId)}${includePage && pageId ? `/${encodeURIComponent(pageId)}` : ""}`;
  return new URL(`${window.location.pathname}${window.location.search}${hash}`, window.location.origin).href;
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Continue with the browser-compatible copy fallback.
  }
  const previousFocus = document.activeElement;
  const input = document.createElement("textarea");
  let copied = false;
  try {
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    copied = document.execCommand("copy");
  } finally {
    input.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }
  if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
}

async function shareBook(bookId) {
  const url = getPublicShareUrl(bookId, false);
  if (!url) {
    announce("Only public catalog books can be shared. This import is available on this device only.", true);
    return;
  }
  const title = findBook(state.catalog, bookId).title;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      announce("Book link shared.");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  try {
    await copyTextToClipboard(url);
    announce("Sharing is unavailable; the book link was copied instead.");
  } catch (error) {
    announce(`Could not share or copy the book link: ${error.message}`, true);
  }
}

async function copyPageLink(bookId) {
  const url = getPublicShareUrl(bookId, true);
  if (!url) {
    announce("A page link is not available until a public book page has loaded.", true);
    return;
  }
  try {
    await copyTextToClipboard(url);
    announce("Page link copied.");
  } catch (error) {
    announce(`Could not copy the page link: ${error.message}`, true);
  }
}

async function createCollection(form) {
  const nameInput = form.elements.namedItem("name");
  const name = nameInput.value.trim();
  if (!name) return;
  try {
    const collection = await saveCollection({ collectionId: crypto.randomUUID(), name });
    await refreshLibraryState();
    state.selectedCollectionId = collection.collectionId;
    form.reset();
    renderRoute(state.route);
    announce(`Collection “${collection.name}” created.`);
  } catch (error) {
    announce(`Could not create collection: ${error.message}`, true);
  }
}

async function renameCollection(collectionId) {
  const collection = state.collections.find(item => item.collectionId === collectionId);
  if (!collection) return;
  const form = [...root.querySelectorAll("[data-rename-collection-form]")]
    .find(item => item.dataset.collectionId === collectionId);
  const name = form?.querySelector('input[name="name"]')?.value.trim();
  if (!name) {
    announce("Enter a collection name.", true);
    return;
  }
  try {
    await saveCollection({ ...collection, name });
    await refreshLibraryState();
    state.renamingCollectionId = "";
    renderRoute(state.route);
    announce("Collection renamed.");
  } catch (error) {
    announce(`Could not rename collection: ${error.message}`, true);
  }
}

async function removeCollection(collectionId) {
  const collection = state.collections.find(item => item.collectionId === collectionId);
  if (!collection || !window.confirm(`Delete “${collection.name}” and its memberships? Books will stay in your library.`)) return;
  try {
    await deleteCollection(collectionId);
    if (state.selectedCollectionId === collectionId) state.selectedCollectionId = "";
    if (state.renamingCollectionId === collectionId) state.renamingCollectionId = "";
    await refreshLibraryState();
    renderRoute(state.route);
    announce("Collection deleted. Its books remain in your library.");
  } catch (error) {
    announce(`Could not delete collection: ${error.message}`, true);
  }
}

async function addToCollection(bookId, button) {
  const select = button.closest("[data-book-id]")?.querySelector("[data-collection-select]");
  const collectionId = select?.value || state.selectedCollectionId;
  if (!collectionId) {
    announce("Create or select a collection first.", true);
    return;
  }
  try {
    await addBookToCollection(collectionId, bookId);
    await refreshLibraryState();
    renderRoute(state.route);
    announce("Book added to collection.");
  } catch (error) {
    announce(`Could not add book to collection: ${error.message}`, true);
  }
}

async function removeFromCollection(collectionId, bookId) {
  try {
    await removeBookFromCollection(collectionId, bookId);
    await refreshLibraryState();
    renderRoute(state.route);
    announce("Book removed from collection.");
  } catch (error) {
    announce(`Could not remove book from collection: ${error.message}`, true);
  }
}

async function removeSavedBook(bookId) {
  try {
    await setBookSaved(bookId, false);
    state.savedBookIds.delete(bookId);
    renderRoute(state.route);
    announce("Book removed from saved books.");
  } catch (error) {
    announce(`Could not remove saved book: ${error.message}`, true);
  }
}

async function removeBookmark(bookmarkId) {
  try {
    await deleteBookmark(bookmarkId);
    state.bookmarks = state.bookmarks.filter(bookmark => bookmark.bookmarkId !== bookmarkId);
    renderRoute(state.route);
    announce("Bookmark removed.");
  } catch (error) {
    announce(`Could not remove bookmark: ${error.message}`, true);
  }
}

async function clearLibrary() {
  if (!window.confirm("Clear all saved books, imported books, collections, bookmarks, and reading progress from this device? This cannot be undone.")) return;
  try {
    await clearReaderData();
    state.selectedLibraryTab = "all";
    state.selectedCollectionId = "";
    state.renamingCollectionId = "";
    await refreshLibraryState();
    if (state.route.name === "reader") navigate("library");
    else renderRoute(state.route);
    announce("Your local library data was cleared.");
  } catch (error) {
    announce(`Could not clear local library data: ${error.message}`, true);
  }
}

async function togglePathCompleted(id) {
  const completed = state.pathProgress.get(id)?.completed === true;
  try {
    const updated = await setPathCompleted(id, !completed);
    state.pathProgress = await getPathProgress();
    await syncPathProgress(updated);
    announce(completed ? "Learning path marked incomplete." : "Learning path marked complete.");
    renderRoute(state.route);
    focusControl("data-complete-path", id);
  } catch (error) {
    announce(`Could not update learning path: ${error.message}`, true);
  }
}

async function submitAuthForm(form) {
  if (!state.supabase || state.accountBusy) return;
  const formType = form.dataset.authForm;
  const email = form.elements.namedItem("email").value.trim();
  const password = form.elements.namedItem("password").value;
  state.accountBusy = true;
  state.accountError = "";
  state.accountMessage = "";
  try {
    if (formType === "signup") {
      const username = form.elements.namedItem("username").value.trim();
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`,
          data: { username }
        }
      });
      if (error) throw error;
      state.accountMessage = data.session
        ? "Account created. Your progress is syncing."
        : "Account created. Check your email to confirm the address, then sign in.";
    } else {
      const { error } = await state.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.accountMessage = "Signed in. Syncing your progress.";
    }
  } catch (error) {
    state.accountError = error.message;
  } finally {
    state.accountBusy = false;
    updateAccountRoute();
  }
}

async function saveAccountSettings(form) {
  if (!state.supabase || !state.account || state.accountBusy) return;
  const username = form.elements.namedItem("username").value.trim();
  const leaderboardOptIn = form.elements.namedItem("leaderboard_opt_in").checked;
  state.accountBusy = true;
  state.accountError = "";
  state.accountMessage = "";
  try {
    const { data, error } = await state.supabase.from("profiles")
      .update({ username, leaderboard_opt_in: leaderboardOptIn })
      .eq("id", state.account.id)
      .select("username,leaderboard_opt_in")
      .single();
    if (error) throw error;
    state.profile = data;
    state.accountMessage = "Account settings saved.";
    state.leaderboard = { status: "idle", entries: [], error: "" };
  } catch (error) {
    state.accountError = error.message;
  } finally {
    state.accountBusy = false;
    updateAccountRoute();
  }
}

async function signOut() {
  if (!state.supabase) return;
  try {
    const { error } = await state.supabase.auth.signOut();
    if (error) throw error;
    state.accountMessage = "You are signed out. Your local reading data remains on this device.";
  } catch (error) {
    state.accountError = error.message;
    updateAccountRoute();
  }
}

async function importHtmlFile(file) {
  if (!file) return;
  try {
    if (!/\.html?$/i.test(file.name)) {
      announce("Choose an .html or .htm file.", true);
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      announce("Choose an HTML file between 1 byte and 2 MiB.", true);
      return;
    }
    const content = await file.text();
    if (!content.trim() || new Blob([content]).size > 2 * 1024 * 1024) {
      announce("The selected HTML file must contain between 1 byte and 2 MiB of text.", true);
      return;
    }
    const parsed = new DOMParser().parseFromString(content, "text/html");
    discardImportDraft();
    const preview = createImportedBookUrl(content);
    const title = parsed.querySelector("title")?.textContent?.trim() ||
      file.name.replace(/\.html?$/i, "");
    state.importDraft = {
      mode: "new",
      id: `import-${crypto.randomUUID()}`,
      title: title.slice(0, 180),
      category: "",
      filename: file.name,
      content,
      importedAt: Date.now(),
      collectionId: state.selectedCollectionId,
      previewUrl: preview.url
    };
    state.selectedLibraryTab = "imported";
    renderRoute(state.route);
    root.querySelector("#import-title")?.focus();
    announce("Preview the book, edit its details, then choose Save to My Library.");
  } catch (error) {
    announce(`The HTML file could not be imported: ${error.message}`, true);
  } finally {
    importInput.value = "";
  }
}

function discardImportDraft() {
  if (state.importDraft?.previewUrl) URL.revokeObjectURL(state.importDraft.previewUrl);
  state.importDraft = null;
}

function cancelImportDraft() {
  discardImportDraft();
  renderRoute(state.route);
  announce("HTML import cancelled.");
}

async function editImportedBook(id) {
  try {
    const book = await getImportedBook(id);
    if (!book) {
      announce("This imported book is no longer available on this device.", true);
      return;
    }
    discardImportDraft();
    const preview = createImportedBookUrl(book.content);
    state.importDraft = {
      ...book,
      mode: "edit",
      category: book.category || "",
      previewUrl: preview.url
    };
    state.selectedLibraryTab = "imported";
    renderRoute(state.route);
    root.querySelector("#import-title")?.focus();
  } catch (error) {
    announce(`Could not open imported book details: ${error.message}`, true);
  }
}

async function saveImportDetails(form) {
  const draft = state.importDraft;
  if (!draft) return;
  const title = form.elements.namedItem("title").value.trim();
  const category = form.elements.namedItem("category").value.trim();
  const collectionId = form.elements.namedItem("collectionId")?.value || "";
  if (!title || title.length > 180) {
    announce("Enter a book title between 1 and 180 characters.", true);
    return;
  }
  if (category.length > 80) {
    announce("Category must be 80 characters or fewer.", true);
    return;
  }
  try {
    if (draft.mode === "new") {
      await saveImportedBook({
        id: draft.id,
        title,
        category,
        filename: draft.filename,
        content: draft.content,
        importedAt: draft.importedAt
      }, collectionId);
    } else {
      await updateImportedBook({
        id: draft.id,
        title,
        category,
        filename: draft.filename,
        content: draft.content,
        importedAt: draft.importedAt
      });
    }
  } catch (error) {
    announce(`The HTML book could not be saved: ${error.message}`, true);
    return;
  }
  discardImportDraft();
  state.selectedLibraryTab = "imported";
  try {
    await refreshLibraryState();
    renderRoute(state.route);
    announce(draft.mode === "new"
      ? `${title} was added to your local library.`
      : "Imported book details updated.");
  } catch (error) {
    state.storageError = `The HTML book was saved, but the library could not be refreshed: ${error.message}`;
    renderRoute(state.route);
    announce(state.storageError, true);
  }
}

async function removeImportedBook(id) {
  if (!window.confirm("Delete this imported book from this device?")) return;
  try {
    await deleteImportedBook(id);
    state.importedBooks = await getImportedBooks();
    state.progress.delete(id);
    await refreshLibraryState();
    announce("Imported book deleted from this device.");
    renderRoute(state.route);
  } catch (error) {
    announce(`Could not delete the imported book: ${error.message}`, true);
  }
}

async function handleBookMessage(event) {
  const context = state.readerContext;
  if (!context ||
      event.origin !== "null" ||
      event.source !== context.frame.contentWindow ||
      !isAllowedBookMessage(event.data, context.bookId, context.pageIds)) return;

  const { type, pageId } = event.data;
  if (type === "book-ready") {
    if (context.ready) return;
    context.ready = true;
  } else if (!context.ready) {
    return;
  }

  const routeName = context.imported ? "imported" : "read";
  const hash = `#${routeName}/${encodeURIComponent(context.bookId)}/${encodeURIComponent(pageId)}`;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  }
  state.route = { ...state.route, pageId };

  try {
    const progress = await recordBookPage(context.bookId, pageId);
    state.progress.set(context.bookId, progress);
    await syncBookProgress(progress);
    updateReaderBookmarkButton(context.bookId, pageId);
  } catch (error) {
    announce(`Reading position could not be saved: ${error.message}`, true);
  }
}

document.addEventListener("click", event => {
  const routeLink = event.target.closest("[data-route]");
  if (routeLink) {
    closeSidebar();
    return;
  }

  if (event.target.closest("[data-sign-out]")) {
    void signOut();
    return;
  }
  if (event.target.closest("[data-refresh-leaderboard]")) {
    state.leaderboard = { status: "idle", entries: [], error: "" };
    void refreshLeaderboard();
    return;
  }

  const groupToggle = event.target.closest("[data-group-toggle]");
  if (groupToggle) {
    const nav = document.getElementById(groupToggle.getAttribute("aria-controls"));
    const expanded = groupToggle.getAttribute("aria-expanded") !== "true";
    groupToggle.setAttribute("aria-expanded", String(expanded));
    nav.hidden = !expanded;
    return;
  }

  const open = event.target.closest("[data-open-book]");
  if (open) {
    openBook(open.dataset.openBook);
    return;
  }
  const openPage = event.target.closest("[data-open-book-page]");
  if (openPage) {
    openBook(openPage.dataset.openBookPage, openPage.dataset.pageId);
    return;
  }
  const resume = event.target.closest("[data-resume-book]");
  if (resume) {
    const pageId = state.progress.get(resume.dataset.resumeBook)?.currentPageId ||
      state.progress.get(resume.dataset.resumeBook)?.lastPageId;
    openBook(resume.dataset.resumeBook, pageId);
    return;
  }
  const restart = event.target.closest("[data-restart-book]");
  if (restart) {
    openBook(restart.dataset.restartBook, null, true);
    return;
  }
  const save = event.target.closest("[data-toggle-save]");
  if (save) {
    toggleSaved(save.dataset.toggleSave);
    return;
  }
  const complete = event.target.closest("[data-toggle-complete]");
  if (complete) {
    toggleCompleted(complete.dataset.toggleComplete);
    return;
  }
  const bookmark = event.target.closest("[data-toggle-bookmark]");
  if (bookmark) {
    toggleBookmark(bookmark.dataset.toggleBookmark, bookmark.dataset.pageId);
    return;
  }
  const shareBookButton = event.target.closest("[data-share-book]");
  if (shareBookButton) {
    shareBook(shareBookButton.dataset.shareBook);
    return;
  }
  const copyPageButton = event.target.closest("[data-copy-page]");
  if (copyPageButton) {
    copyPageLink(copyPageButton.dataset.copyPage);
    return;
  }
  const selectCollection = event.target.closest("[data-select-collection]");
  if (selectCollection) {
    state.selectedCollectionId = selectCollection.dataset.selectCollection;
    renderRoute(state.route);
    return;
  }
  const rename = event.target.closest("[data-rename-collection]");
  if (rename) {
    state.renamingCollectionId = rename.dataset.renameCollection;
    renderRoute(state.route);
    root.querySelector(`[data-rename-collection-form] input`)?.focus();
    return;
  }
  if (event.target.closest("[data-cancel-rename]")) {
    state.renamingCollectionId = "";
    renderRoute(state.route);
    return;
  }
  const deleteCollectionButton = event.target.closest("[data-delete-collection]");
  if (deleteCollectionButton) {
    removeCollection(deleteCollectionButton.dataset.deleteCollection);
    return;
  }
  const addToCollectionButton = event.target.closest("[data-add-to-collection]");
  if (addToCollectionButton) {
    addToCollection(addToCollectionButton.dataset.addToCollection, addToCollectionButton);
    return;
  }
  const editImportButton = event.target.closest("[data-edit-import]");
  if (editImportButton) {
    editImportedBook(editImportButton.dataset.editImport);
    return;
  }
  if (event.target.closest("[data-cancel-import]")) {
    cancelImportDraft();
    return;
  }
  const removeFromCollectionButton = event.target.closest("[data-remove-from-collection]");
  if (removeFromCollectionButton) {
    removeFromCollection(
      removeFromCollectionButton.dataset.collectionId,
      removeFromCollectionButton.dataset.removeFromCollection
    );
    return;
  }
  const removeSavedButton = event.target.closest("[data-remove-saved]");
  if (removeSavedButton) {
    removeSavedBook(removeSavedButton.dataset.removeSaved);
    return;
  }
  const deleteBookmarkButton = event.target.closest("[data-delete-bookmark]");
  if (deleteBookmarkButton) {
    removeBookmark(deleteBookmarkButton.dataset.deleteBookmark);
    return;
  }
  if (event.target.closest("[data-clear-library]")) {
    clearLibrary();
    return;
  }
  const pathComplete = event.target.closest("[data-complete-path]");
  if (pathComplete) {
    togglePathCompleted(pathComplete.dataset.completePath);
    return;
  }
  const topic = event.target.closest("[data-topic-id]");
  if (topic) {
    state.selectedTopic = topic.dataset.topicId;
    renderRoute(state.route);
    focusControl("data-topic-id", state.selectedTopic);
    return;
  }
  const concept = event.target.closest("[data-concept-id]");
  if (concept) {
    state.selectedConcept = concept.dataset.conceptId;
    renderRoute(state.route);
    focusControl("data-concept-id", state.selectedConcept);
    return;
  }
  const filter = event.target.closest("[data-search-filter]");
  if (filter) {
    state.filter = filter.dataset.searchFilter;
    renderRoute(state.route);
    focusControl("data-search-filter", state.filter);
    return;
  }
  const tab = event.target.closest("[data-library-tab]");
  if (tab) {
    state.selectedLibraryTab = tab.dataset.libraryTab;
    renderRoute(state.route);
    focusControl("data-library-tab", state.selectedLibraryTab);
    return;
  }
  if (event.target.closest("[data-import-book]")) {
    importInput.click();
    return;
  }
  const deleteButton = event.target.closest("[data-delete-import]");
  if (deleteButton) {
    removeImportedBook(deleteButton.dataset.deleteImport);
    return;
  }
  if (event.target.closest("[data-clear-search]")) {
    state.query = "";
    state.filter = "all";
    globalSearch.value = "";
    renderRoute(state.route);
    root.querySelector("#page-search")?.focus();
    return;
  }
  if (event.target.closest("[data-reader-back]")) navigate("library");
});

document.addEventListener("input", event => {
  if (event.target.matches("#global-search, #page-search")) {
    state.query = event.target.value;
    globalSearch.value = state.query;
    if (state.route.name !== "search") {
      navigate("search");
    } else {
      renderRoute(state.route);
      const replacementInput = root.querySelector("#page-search");
      replacementInput?.focus();
      replacementInput?.setSelectionRange(state.query.length, state.query.length);
    }
  }
});

document.addEventListener("submit", event => {
  const authForm = event.target.closest("[data-auth-form]");
  if (authForm) {
    event.preventDefault();
    void submitAuthForm(authForm);
    return;
  }
  const accountSettings = event.target.closest("[data-account-settings]");
  if (accountSettings) {
    event.preventDefault();
    void saveAccountSettings(accountSettings);
    return;
  }
  const importForm = event.target.closest("[data-import-details]");
  if (importForm) {
    event.preventDefault();
    saveImportDetails(importForm);
    return;
  }
  const renameForm = event.target.closest("[data-rename-collection-form]");
  if (renameForm) {
    event.preventDefault();
    renameCollection(renameForm.dataset.collectionId);
    return;
  }
  const form = event.target.closest("[data-create-collection]");
  if (!form) return;
  event.preventDefault();
  createCollection(form);
});

document.addEventListener("change", event => {
  if (event.target.matches("[data-descendant-toggle]")) {
    state.includeDescendants = event.target.checked;
    renderRoute(state.route);
    root.querySelector("[data-descendant-toggle]")?.focus();
  }
  if (event.target.matches("[data-collection-select]")) {
    state.selectedCollectionId = event.target.value;
  }
  if (event.target === importInput) importHtmlFile(event.target.files?.[0]);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && sidebar.classList.contains("open")) closeSidebar(true);
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".graph-node")) {
    event.preventDefault();
    state.selectedConcept = event.target.dataset.conceptId;
    renderRoute(state.route);
    focusControl("data-concept-id", state.selectedConcept);
  }
});

mobileMenu.addEventListener("click", toggleSidebar);
backdrop.addEventListener("click", () => closeSidebar(true));
window.addEventListener("resize", syncSidebarForViewport);
window.addEventListener("message", handleBookMessage);

async function start() {
  try {
    state.catalog = await loadCatalog();
  } catch (error) {
    root.innerHTML = `<section class="page-wrap"><div class="empty-state" role="alert"><h1>Index Dictionary couldn’t load.</h1><p>${escapeHtml(error.message)}</p><p>Serve the project over HTTP(S), then reload this page.</p></div></section>`;
    return;
  }

  try {
    await refreshLibraryState();
  } catch (error) {
    state.storageError = `Your browser’s local library could not be opened: ${error.message}`;
  }
  subscribeToRoutes(renderRoute);
  void initializeSupabase();
}

start();
