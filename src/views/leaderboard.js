import { escapeHtml } from "../ui/markup.js";

export function renderLeaderboard({ status, entries, error, user }) {
  let content;
  if (status === "loading" || status === "idle") {
    content = `<p class="muted-copy" role="status">Loading leaderboard…</p>`;
  } else if (status === "error") {
    content = `<p class="account-notice error" role="alert">${escapeHtml(error || "The leaderboard could not be loaded.")}</p>`;
  } else if (!entries.length) {
    content = `<div class="empty-state compact"><h2>No public scores yet</h2><p>Sign in and opt in from your account page to appear here.</p><a class="button light" href="#account" data-route="account">${user ? "Manage account" : "Create an account"}</a></div>`;
  } else {
    content = `<ol class="leaderboard-list">${entries.map((entry, index) => `<li class="leaderboard-row">
      <span class="leaderboard-rank">${index + 1}</span>
      <strong>${escapeHtml(entry.username)}</strong>
      <span>${Number(entry.completed_books) || 0} ${Number(entry.completed_books) === 1 ? "book" : "books"} complete</span>
    </li>`).join("")}</ol>`;
  }

  return `<section class="page-wrap" aria-labelledby="leaderboard-title">
    <p class="eyebrow">Community</p><h1 class="page-title" id="leaderboard-title">Learning leaderboard.</h1>
    <p class="lede">Readers who choose to share their public-book completion count. These scores are self-reported, not verified.</p>
    <article class="panel leaderboard-panel">
      <div class="path-heading"><h2 class="panel-title">Completed books</h2><button class="button light small" type="button" data-refresh-leaderboard>Refresh</button></div>
      ${content}
    </article>
    <p class="privacy-note">${user ? "You can change your public leaderboard preference in " : "Want to participate? "}
      <a href="#account" data-route="account">${user ? "account settings" : "your account"}</a>.
    </p>
  </section>`;
}
