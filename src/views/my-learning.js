import { escapeHtml, bookRow } from "../ui/markup.js";

export function renderMyLearning(catalog, progress, pathProgress) {
  const inProgress = catalog.books.filter(book => {
    const record = progress.get(book.id);
    return record && !record.completed;
  });
  const current = inProgress.sort((a, b) =>
    (progress.get(b.id)?.lastOpenedAt || 0) - (progress.get(a.id)?.lastOpenedAt || 0))[0];
  const firstPath = catalog.learningPaths[0];
  const completedCount = firstPath?.items.filter(item => progress.get(item.bookId)?.completed).length || 0;
  const continueContent = current
    ? bookRow({ ...current, statusLabel: "In progress" })
    : `<div class="empty-state compact"><span class="empty-icon" aria-hidden="true">◷</span><h2>Nothing in progress yet</h2><p>Open a book or choose a learning path to get started.</p><a class="button light" href="#search" data-route="search">Find a book</a></div>`;

  return `<section class="page-wrap" aria-labelledby="learning-title">
    <p class="eyebrow">Your learning</p>
    <h1 class="page-title" id="learning-title">Keep the ideas moving.</h1>
    <p class="lede">Pick up a book you started or return to a learning sequence.</p>
    <div class="learning-columns">
      <article class="panel learning-summary">
        <p class="eyebrow">In progress</p>
        <h2>${current ? escapeHtml(current.title) : "Your next good idea is waiting."}</h2>
        <p>${current ? "Pick up where you left off." : "Your reading activity will appear here when you open a book."}</p>
        ${current ? bookRow({ ...current, statusLabel: "Continue reading" }) : `<a class="button" href="#search" data-route="search">Browse books →</a>`}
      </article>
      <article class="panel learning-summary">
        <p class="eyebrow">Learning sequence</p>
        <h2>${escapeHtml(firstPath?.title || "Choose a path")}</h2>
        <p>${escapeHtml(firstPath?.description || "Explore ideas in an intentional order.")}</p>
        <p class="progress-copy">${completedCount} of ${firstPath?.items.length || 0} books complete · ${pathProgress.get(firstPath?.id)?.completed ? "Path complete" : "Continue at your own pace"}</p>
        <a class="button light" href="#paths" data-route="paths">Open Learning Path →</a>
      </article>
    </div>
  </section>`;
}
