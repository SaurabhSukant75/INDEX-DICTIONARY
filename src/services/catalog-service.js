const CATALOG_URL = new URL("../../data/catalog.json", import.meta.url);

export async function loadCatalog() {
  const response = await fetch(CATALOG_URL);
  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status}).`);
  }
  const catalog = await response.json();
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.books)) {
    throw new Error("The catalog format is invalid or unsupported.");
  }

  const taxonomyById = new Map(catalog.taxonomy.map(topic => [topic.id, topic]));
  const books = catalog.books.map(book => ({
    ...book,
    primaryTopicName: taxonomyById.get(book.primaryTaxonomyId)?.name || "Ideas"
  }));
  return { ...catalog, books, taxonomyById };
}

export function findBook(catalog, id) {
  return catalog.books.find(book => book.id === id) || null;
}

export function findConcept(catalog, id) {
  return catalog.concepts.find(concept => concept.id === id) || null;
}

export function topicAncestors(catalog, topicId) {
  const result = [];
  let topic = catalog.taxonomyById.get(topicId);
  while (topic) {
    result.unshift(topic);
    topic = topic.parentId ? catalog.taxonomyById.get(topic.parentId) : null;
  }
  return result;
}

export function topicDescendantIds(catalog, topicId) {
  const descendants = new Set([topicId]);
  let added = true;
  while (added) {
    added = false;
    for (const topic of catalog.taxonomy) {
      if (!descendants.has(topic.id) && descendants.has(topic.parentId)) {
        descendants.add(topic.id);
        added = true;
      }
    }
  }
  return descendants;
}
