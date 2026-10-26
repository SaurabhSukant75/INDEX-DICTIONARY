import { searchBooks } from "../services/search-service.js";
import { bookCard, emptyState, escapeHtml } from "../ui/markup.js";

function filtersMarkup(catalog, selectedFilter) {
  const roots = catalog.taxonomy.filter(topic => topic.parentId === "ideas");
  const filterButtons = roots.map(topic => `<button class="chip${selectedFilter === topic.id ? " selected" : ""}" type="button" data-search-filter="${escapeHtml(topic.id)}" aria-pressed="${selectedFilter === topic.id}">${escapeHtml(topic.name)}</button>`).join("");
  return `<div class="filter-row" role="group" aria-label="Filter books">
    <button class="chip${selectedFilter === "all" ? " selected" : ""}" type="button" data-search-filter="all" aria-pressed="${selectedFilter === "all"}">All books</button>
    ${filterButtons}
    <button class="chip${selectedFilter === "learning-path" ? " selected" : ""}" type="button" data-search-filter="learning-path" aria-pressed="${selectedFilter === "learning-path"}">In a learning path</button>
  </div>`;
}

export function renderSearch(catalog, query, filter = "all") {
  const pathBookIds = new Set(catalog.learningPaths.flatMap(path => path.items.map(item => item.bookId)));
  const results = searchBooks(catalog, query, filter, pathBookIds);
  const resultLabel = `${results.length} ${results.length === 1 ? "book" : "books"} found`;
  const resultsMarkup = results.length
    ? `<div class="book-grid">${results.map(bookCard).join("")}</div>`
    : emptyState("No books found", `We couldn’t find a match for “${query.trim() || "your filters"}”. Try another search or browse all books.`, `<button class="button" type="button" data-clear-search>Clear search and filters</button>`);

  return `<section class="page-wrap" aria-labelledby="search-title">
    <p class="eyebrow">Discover</p>
    <h1 class="page-title" id="search-title">Search the library.</h1>
    <p class="lede">Search across book titles, descriptions, topics, and concepts.</p>
    <label class="searchbox searchbox-large"><span aria-hidden="true">⌕</span><input id="page-search" type="search" value="${escapeHtml(query)}" placeholder="Try “attention”, “technology”, or “incentives”…" aria-label="Search catalog"></label>
    ${filtersMarkup(catalog, filter)}
    <p class="result-count" role="status">${resultLabel}</p>
    ${resultsMarkup}
  </section>`;
}
