export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export function bookCard(book) {
  const number = escapeHtml(book.id.slice(-2));
  const cover = `c${number}`;
  return `<article class="book-card">
    <button class="book-card-open" type="button" data-open-book="${escapeHtml(book.id)}" aria-label="Open ${escapeHtml(book.title)}">
      <span class="cover-art ${cover}">
        <span class="cover-smallcap">Index Dictionary · Visual book</span>
        <strong>${escapeHtml(book.title)}</strong>
        <span>Open book ${number}</span>
      </span>
      <span class="card-body">
        <span class="card-meta"><span>${escapeHtml(book.primaryTopicName || "Ideas")}</span><span>${book.readingMinutes} min</span></span>
        <span class="card-title">${escapeHtml(book.title)}</span>
        <span class="card-summary">${escapeHtml(book.summary)}</span>
        <span class="tags">${(book.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span>
      </span>
    </button>
  </article>`;
}

export function bookRow(book, options = {}) {
  const action = options.action || `Open ${book.title}`;
  const controls = options.deleteImport
    ? `<button class="icon-button danger" type="button" data-delete-import="${escapeHtml(book.id)}" aria-label="Delete ${escapeHtml(book.title)}">Delete</button>`
    : "";
  return `<article class="book-row">
    <button class="book-row-open" type="button" data-open-book="${escapeHtml(book.id)}" aria-label="${escapeHtml(action)}">
      <span class="mini-cover ${book.tone || "c1"}" aria-hidden="true">${escapeHtml(book.id.slice(-2))}</span>
      <span class="row-copy"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.statusLabel || book.primaryTopicName || "HTML book")} · ${book.readingMinutes || 0} min</small></span>
      <span class="row-arrow" aria-hidden="true">→</span>
    </button>${controls}
  </article>`;
}

export function emptyState(title, message, action = "") {
  return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">⌕</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${action}</div>`;
}
