import { topicAncestors, topicDescendantIds } from "../services/catalog-service.js";
import { bookRow, escapeHtml, emptyState } from "../ui/markup.js";

function countFor(catalog, topicId, includeDescendants) {
  const topicIds = includeDescendants ? topicDescendantIds(catalog, topicId) : new Set([topicId]);
  return catalog.books.filter(book => book.taxonomyIds.some(id => topicIds.has(id))).length;
}

function renderTree(catalog, selectedId, includeDescendants) {
  const childrenByParent = new Map();
  for (const topic of catalog.taxonomy) {
    const siblings = childrenByParent.get(topic.parentId) || [];
    siblings.push(topic);
    childrenByParent.set(topic.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) siblings.sort((a, b) => a.order - b.order);
  const items = [];
  const visit = (parentId, depth) => {
    for (const topic of childrenByParent.get(parentId) || []) {
      items.push(`<button class="topic-item depth-${Math.min(depth, 2)}${selectedId === topic.id ? " selected" : ""}" type="button" data-topic-id="${escapeHtml(topic.id)}" aria-pressed="${selectedId === topic.id}">
        <span>${depth < 2 ? "⌄" : "·"}</span>${escapeHtml(topic.name)}<small>${countFor(catalog, topic.id, includeDescendants)}</small>
      </button>`);
      visit(topic.id, depth + 1);
    }
  };
  visit(null, 0);
  return items.join("");
}

export function renderTopics(catalog, selectedId = "ideas", includeDescendants = true) {
  const selected = catalog.taxonomyById.get(selectedId) || catalog.taxonomyById.get("ideas");
  const topicIds = includeDescendants ? topicDescendantIds(catalog, selected.id) : new Set([selected.id]);
  const books = catalog.books.filter(book => book.taxonomyIds.some(id => topicIds.has(id)));
  const crumbs = topicAncestors(catalog, selected.id);
  return `<section class="page-wrap" aria-labelledby="topics-title">
    <p class="eyebrow">Browse by subject</p>
    <h1 class="page-title" id="topics-title">Topics, connected.</h1>
    <p class="lede">Move from broad areas of curiosity to focused subjects.</p>
    <div class="two-column topic-layout">
      <section class="panel" aria-labelledby="taxonomy-heading">
        <h2 class="panel-title" id="taxonomy-heading">Topic taxonomy</h2>
        <div class="topic-tree" role="group" aria-label="Topics">${renderTree(catalog, selected.id, includeDescendants)}</div>
      </section>
      <section class="topic-results" aria-labelledby="topic-name">
        <p class="eyebrow">${crumbs.map(topic => escapeHtml(topic.name)).join(" / ")}</p>
        <h2 class="section-title" id="topic-name">${escapeHtml(selected.name)}</h2>
        <label class="check-option"><input type="checkbox" data-descendant-toggle ${includeDescendants ? "checked" : ""}> Include books in subtopics</label>
        ${books.length ? `<div class="book-list">${books.map(bookRow).join("")}</div>` : emptyState("No books in this topic yet", "Try another topic or include its subtopics.")}
      </section>
    </div>
  </section>`;
}
