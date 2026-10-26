import { escapeHtml } from "../ui/markup.js";

export function renderReader(book, saved, completed, isImported, pageId, bookmarks = []) {
  const bookmark = bookmarks.find(item => item.pageId === pageId);
  return `<section class="reader-view" aria-label="Book reader">
    <div class="reader-bar">
      <div class="reader-book">
        <button class="reader-back" type="button" data-reader-back>← Library</button>
        <div><strong id="reader-title">${escapeHtml(book.title)}</strong><small>${isImported ? "Private HTML import · Stored on this device" : `Independent HTML book · ${escapeHtml(book.id)}`}</small></div>
      </div>
      <div class="reader-actions">
        ${isImported
          ? `<span class="reader-private-note">Private to this device · Sharing unavailable</span>`
          : `<button class="reader-action" type="button" data-share-book="${escapeHtml(book.id)}">Share book</button>
             <button class="reader-action" type="button" data-copy-page="${escapeHtml(book.id)}"${pageId ? "" : " disabled"}>Copy page link</button>`}
        <button class="reader-action" type="button" data-toggle-save="${escapeHtml(book.id)}" aria-pressed="${saved}">${saved ? "★ Saved" : "☆ Save"}</button>
        <button class="reader-action" type="button" data-toggle-complete="${escapeHtml(book.id)}" aria-pressed="${completed}">${completed ? "✓ Complete" : "Mark complete"}</button>
        <button class="reader-action" type="button" data-toggle-bookmark="${escapeHtml(book.id)}" data-page-id="${escapeHtml(pageId || "")}" aria-pressed="${Boolean(bookmark)}"${pageId ? "" : " disabled"}>${bookmark ? "★ Bookmarked" : "☆ Bookmark page"}</button>
      </div>
    </div>
    ${bookmark ? `<p class="reader-bookmark-note" role="status">Bookmarked: ${escapeHtml(bookmark.label || bookmark.pageId)}</p>` : ""}
    <div class="reader-frame-wrap">
      <iframe class="reader-frame" title="${escapeHtml(book.title)} reading canvas" sandbox="allow-scripts" referrerpolicy="no-referrer" data-reader-frame></iframe>
    </div>
  </section>`;
}
