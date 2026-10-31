const ROUTES = new Set(["home", "my-learning", "search", "topics", "concepts", "paths", "library", "account", "leaderboard"]);
const listeners = new Set();

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [pathPart = "home", queryPart = ""] = hash.split("?");
  let segments;
  try {
    segments = pathPart.split("/").map(segment => decodeURIComponent(segment));
  } catch {
    return { name: "invalid", query: "" };
  }
  const params = new URLSearchParams(queryPart);
  if (segments[0] === "read") {
    return {
      name: "reader",
      id: segments[1] || "",
      pageId: segments[2] || null,
      invalid: segments.length > 3 || !segments[1],
      restart: params.get("restart") === "1",
      query: params.get("q") || ""
    };
  }
  if (segments[0] === "imported") {
    return {
      name: "reader",
      id: segments[1] || "",
      pageId: segments[2] || null,
      imported: true,
      invalid: segments.length > 3 || !segments[1],
      restart: params.get("restart") === "1",
      query: params.get("q") || ""
    };
  }
  const name = ROUTES.has(segments[0]) ? segments[0] : "home";
  return { name, query: params.get("q") || "" };
}

export function getCurrentRoute() {
  return parseHash();
}

export function navigate(route, options = {}) {
  const nextHash = route.startsWith("#") ? route : `#${route}`;
  if (options.replace) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    notify();
  } else if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  } else {
    notify();
  }
}

function notify() {
  const route = parseHash();
  for (const listener of listeners) listener(route);
}

export function subscribeToRoutes(listener) {
  listeners.add(listener);
  window.addEventListener("hashchange", notify);
  listener(parseHash());
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("hashchange", notify);
  };
}
