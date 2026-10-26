import { escapeHtml } from "../ui/markup.js";

const POSITIONS = [
  { x: 110, y: 165, fill: "#d5ff58" },
  { x: 315, y: 78, fill: "#b9d7f6" },
  { x: 315, y: 252, fill: "#ffb99d" },
  { x: 535, y: 165, fill: "#ded7f5" },
  { x: 535, y: 275, fill: "#e7e3d4" }
];

export function renderConcepts(catalog, selectedId = "attention") {
  const selected = catalog.concepts.find(concept => concept.id === selectedId) || catalog.concepts[0];
  const positionById = new Map(catalog.concepts.map((concept, index) => [
    concept.id,
    POSITIONS[index % POSITIONS.length]
  ]));
  const relations = catalog.conceptRelations.map(relation => {
    const from = positionById.get(relation.fromConceptId);
    const to = positionById.get(relation.toConceptId);
    const fromConcept = catalog.concepts.find(concept => concept.id === relation.fromConceptId);
    const toConcept = catalog.concepts.find(concept => concept.id === relation.toConceptId);
    if (!from || !to || !fromConcept || !toConcept) return "";
    const middleX = (from.x + to.x) / 2;
    const middleY = (from.y + to.y) / 2 - 8;
    return `<g aria-hidden="true"><path class="graph-edge" marker-end="url(#edge-arrow)" d="M${from.x + 38} ${from.y} L${to.x - 45} ${to.y}"></path><text class="edge-label" x="${middleX}" y="${middleY}" text-anchor="middle">${escapeHtml(relation.type.replaceAll("_", " "))}</text><title>${escapeHtml(fromConcept.name)} ${escapeHtml(relation.type.replaceAll("_", " "))} ${escapeHtml(toConcept.name)}</title></g>`;
  }).join("");
  const nodes = catalog.concepts.map((concept, index) => {
    const point = positionById.get(concept.id);
    return `<g class="graph-node${selected.id === concept.id ? " selected" : ""}" role="button" tabindex="0" aria-label="Select ${escapeHtml(concept.name)}" aria-pressed="${selected.id === concept.id}" data-concept-id="${escapeHtml(concept.id)}">
      <circle cx="${point.x}" cy="${point.y}" r="${index === 0 ? 44 : 41}" fill="${point.fill}"></circle>
      <text x="${point.x}" y="${point.y + 4}" text-anchor="middle">${escapeHtml(concept.name)}</text>
    </g>`;
  }).join("");
  const linkedBooks = catalog.books.filter(book => book.conceptLinks.some(link => link.conceptId === selected.id));
  const bookMarkup = linkedBooks.length
    ? `<div class="book-list">${linkedBooks.map(book => `<article class="book-row"><button class="book-row-open" type="button" data-open-book="${escapeHtml(book.id)}"><span class="mini-cover c1" aria-hidden="true">${escapeHtml(book.id.slice(-2))}</span><span class="row-copy"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.conceptLinks.find(link => link.conceptId === selected.id)?.role || "related")} · ${escapeHtml(book.primaryTopicName)}</small></span><span class="row-arrow" aria-hidden="true">→</span></button></article>`).join("")}</div>`
    : `<p class="muted-copy">No books are linked to this concept yet.</p>`;
  const relationList = catalog.conceptRelations
    .filter(relation => relation.fromConceptId === selected.id || relation.toConceptId === selected.id)
    .map(relation => {
      const from = catalog.concepts.find(concept => concept.id === relation.fromConceptId);
      const to = catalog.concepts.find(concept => concept.id === relation.toConceptId);
      return `<li><strong>${escapeHtml(from?.name || "")}</strong> ${escapeHtml(relation.type.replaceAll("_", " "))} <strong>${escapeHtml(to?.name || "")}</strong></li>`;
    }).join("");

  return `<section class="page-wrap" aria-labelledby="concepts-title">
    <p class="eyebrow">Explore connections</p>
    <h1 class="page-title" id="concepts-title">Follow an idea.</h1>
    <p class="lede">The knowledge graph shows how concepts relate. It suggests connections—not what order you must learn them in.</p>
    <div class="two-column concept-layout">
      <div>
        <div class="graph-box">
          <svg viewBox="0 0 650 330" role="group" aria-label="Interactive concept relationship graph">
            <defs><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#99998d"></path></marker></defs>
            ${relations}${nodes}
          </svg>
          <p class="muted-copy">Select a concept to see linked books. Connections are editorially curated.</p>
        </div>
        <details class="relationship-list"><summary>Read relationships as a list</summary><ul>${relationList || "<li>No relationships are currently listed.</li>"}</ul></details>
      </div>
      <aside class="panel selected-concept" aria-live="polite">
        <p class="eyebrow">Selected concept</p>
        <h2>${escapeHtml(selected.name)}</h2>
        <p class="muted-copy">${escapeHtml(selected.description)}</p>
        <h3 class="panel-subtitle">Books that explain it</h3>
        ${bookMarkup}
      </aside>
    </div>
  </section>`;
}
