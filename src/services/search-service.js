import { topicAncestors } from "./catalog-service.js";

export function searchBooks(catalog, query, filter = "all", pathBookIds = new Set()) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return catalog.books.filter(book => {
    const topicText = book.taxonomyIds.flatMap(id => topicAncestors(catalog, id).map(topic => topic.name));
    const conceptText = book.conceptLinks
      .map(link => catalog.concepts.find(concept => concept.id === link.conceptId)?.name || "");
    const indexedText = [
      book.title,
      book.summary,
      ...topicText,
      ...conceptText,
      ...(book.tags || [])
    ].join(" ").toLocaleLowerCase();
    const matchesQuery = !normalizedQuery || indexedText.includes(normalizedQuery);
    const matchesFilter = filter === "all"
      || (filter === "learning-path" && pathBookIds.has(book.id))
      || (filter !== "learning-path" && book.taxonomyIds.some(id => topicAncestors(catalog, id)
        .some(topic => topic.id === filter)));
    return matchesQuery && matchesFilter;
  });
}
