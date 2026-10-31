import { escapeHtml } from "../ui/markup.js";

export function renderAccount({ configured, loading, user, profile, error, message }) {
  const notice = error
    ? `<p class="account-notice error" role="alert">${escapeHtml(error)}</p>`
    : message
      ? `<p class="account-notice" role="status">${escapeHtml(message)}</p>`
      : "";

  if (loading) {
    return `<section class="page-wrap" aria-labelledby="account-title">
      <p class="eyebrow">Your account</p><h1 class="page-title" id="account-title">Loading account…</h1>
      <p class="lede" role="status">Connecting to Supabase or syncing your progress.</p>
    </section>`;
  }

  if (!configured) {
    return `<section class="page-wrap" aria-labelledby="account-title">
      <p class="eyebrow">Your account</p><h1 class="page-title" id="account-title">Sign in to sync.</h1>
      <p class="lede">${escapeHtml(error || "Supabase could not be initialized. Check your internet connection and reload the page.")}</p>
    </section>`;
  }

  if (!user) {
    return `<section class="page-wrap" aria-labelledby="account-title">
      <p class="eyebrow">Your account</p><h1 class="page-title" id="account-title">Your learning, across devices.</h1>
      <p class="lede">Sign in to sync public-book reading progress and learning-path completion. Your imported books and private library stay on this device.</p>
      ${notice}
      <div class="learning-columns account-columns">
        <form class="panel account-form" data-auth-form="signin">
          <h2 class="panel-title">Sign in</h2>
          <label>Email<input class="account-input" type="email" name="email" autocomplete="email" required></label>
          <label>Password<input class="account-input" type="password" name="password" autocomplete="current-password" minlength="8" required></label>
          <button class="button" type="submit">Sign in</button>
        </form>
        <form class="panel account-form" data-auth-form="signup">
          <h2 class="panel-title">Create account</h2>
          <label>Public username<input class="account-input" type="text" name="username" autocomplete="nickname" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required><small>3–24 letters, numbers, or underscores. This name is shown if you opt in to the leaderboard.</small></label>
          <label>Email<input class="account-input" type="email" name="email" autocomplete="email" required></label>
          <label>Password<input class="account-input" type="password" name="password" autocomplete="new-password" minlength="8" required></label>
          <button class="button" type="submit">Create account</button>
        </form>
      </div>
    </section>`;
  }

  return `<section class="page-wrap" aria-labelledby="account-title">
    <p class="eyebrow">Your account</p><h1 class="page-title" id="account-title">Learning, in sync.</h1>
    <p class="lede">Signed in as ${escapeHtml(user.email || "your account")}. Only public-book and learning-path progress syncs.</p>
    ${notice}
    <form class="panel account-form account-settings" data-account-settings>
      <h2 class="panel-title">Profile and privacy</h2>
      <label>Public username<input class="account-input" type="text" name="username" autocomplete="nickname" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" value="${escapeHtml(profile?.username || "")}" required></label>
      <label class="account-checkbox"><input type="checkbox" name="leaderboard_opt_in" ${profile?.leaderboard_opt_in ? "checked" : ""}> Show my username and completed-book count on the public leaderboard</label>
      <p class="privacy-note">The leaderboard shows your username and number of completed public books only. Completions are self-reported and are not a verified score.</p>
      <div class="account-actions"><button class="button" type="submit">Save settings</button><button class="button light" type="button" data-sign-out>Sign out</button></div>
    </form>
  </section>`;
}
