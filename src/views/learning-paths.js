import { escapeHtml } from "../ui/markup.js";

export function renderLearningPaths(catalog, progress, pathProgress) {
  if (!catalog.learningPaths.length) {
    return `<section class="page-wrap"><p class="eyebrow">Curated learning sequence</p><h1 class="page-title">Learning paths.</h1><p class="lede">No learning paths have been published yet.</p></section>`;
  }
  const paths = catalog.learningPaths.map(path => {
    const complete = pathProgress.get(path.id)?.completed === true;
    const completedCount = path.items.filter(item => progress.get(item.bookId)?.completed).length;
    const estimated = path.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    const steps = path.items.map(item => {
      const book = catalog.books.find(entry => entry.id === item.bookId);
      const isComplete = progress.get(item.bookId)?.completed === true;
      if (!book) return "";
      return `<li class="path-step">
        <span class="step-number" aria-hidden="true">${item.position}</span>
        <div class="step-copy"><strong>${escapeHtml(book.title)}</strong><small>${item.required ? "Required" : "Optional"} · ${item.estimatedMinutes} min${isComplete ? " · Complete" : ""}</small></div>
        <button class="step-action" type="button" data-open-book="${escapeHtml(book.id)}">${item.position === 1 ? "Start book" : "Open book"} →</button>
      </li>`;
    }).join("");
    return `<article class="path-panel panel">
      <div class="path-heading"><div><p class="eyebrow">Curated learning sequence</p><h2>${escapeHtml(path.title)}</h2></div><span class="tag">${complete ? "COMPLETE" : "BEGINNER"}</span></div>
      <p class="muted-copy">${escapeHtml(path.description)}</p>
      <div class="progress-track" role="progressbar" aria-label="${escapeHtml(path.title)} progress" aria-valuemin="0" aria-valuemax="${path.items.length}" aria-valuenow="${completedCount}"><span style="width:${path.items.length ? completedCount / path.items.length * 100 : 0}%"></span></div>
      <p class="progress-copy">${completedCount} of ${path.items.length} books complete · About ${estimated} minutes</p>
      <ol class="path-list">${steps}</ol>
      <button class="button ${complete ? "light" : ""}" type="button" data-complete-path="${escapeHtml(path.id)}" aria-pressed="${complete}">${complete ? "Mark path incomplete" : "Mark path complete"}</button>
    </article>`;
  }).join("");

  return `<section class="page-wrap" aria-labelledby="paths-title">
    <p class="eyebrow">Curated learning sequence</p>
    <h1 class="page-title" id="paths-title">Understand attention<br>by design.</h1>
    <p class="lede">Three books, in an intentional order. Take each path at your own pace.</p>
    <div class="learning-paths">${paths}</div>
  </section>`;
}
