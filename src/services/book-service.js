const SAFE_PAGE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,99}$/;
const BOOK_MESSAGE_PROTOCOL = "index-dictionary.book";
const BOOK_MESSAGE_KEYS = "bookId,pageId,protocol,type,version";
const IMPORT_CONTENT_POLICY = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline' data:; font-src data:; script-src 'unsafe-inline' blob:; connect-src 'none'; media-src data: blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export function inspectBookHtml(html) {
  if (typeof html !== "string" ||
      !/<(?:!doctype\s+html|html\b)/i.test(html)) {
    throw new Error("The book file does not contain an HTML document.");
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  if (document.documentElement?.localName !== "html" ||
      !document.body ||
      (!document.body.textContent.trim() && document.body.childElementCount === 0)) {
    throw new Error("The book file is empty or malformed.");
  }

  const idCounts = new Map();
  for (const element of document.body.querySelectorAll("[id]")) {
    const id = element.id;
    if (SAFE_PAGE_ID.test(id)) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  const pageIds = new Set([...idCounts].filter(([, count]) => count === 1).map(([id]) => id));
  return { pageIds };
}

export function createImportedBookUrl(html) {
  const inspection = inspectBookHtml(html);
  const document = new DOMParser().parseFromString(html, "text/html");
  const contentPolicy = document.createElement("meta");
  contentPolicy.httpEquiv = "Content-Security-Policy";
  contentPolicy.content = IMPORT_CONTENT_POLICY;
  document.head.prepend(contentPolicy);
  const blob = new Blob([`<!doctype html>\n${document.documentElement.outerHTML}`], { type: "text/html;charset=utf-8" });
  return { url: URL.createObjectURL(blob), pageIds: inspection.pageIds };
}

export async function loadBookDocument(book) {
  if (typeof book?.contentPath !== "string" ||
      !book.contentPath.startsWith("book/") ||
      !/\.html?$/i.test(book.contentPath) ||
      book.contentPath.includes("\\") ||
      book.contentPath.split("/").some(part => !part || part === "." || part === "..") ||
      /[?#]/.test(book.contentPath)) {
    throw new Error("The catalog contains an invalid book path.");
  }

  const url = new URL(book.contentPath, window.location.href);
  const appDirectory = new URL(".", window.location.href);
  if (url.origin !== appDirectory.origin || !url.pathname.startsWith(`${appDirectory.pathname}book/`)) {
    throw new Error("The catalog book path resolves outside the book folder.");
  }

  const response = await fetch(url, { credentials: "omit", redirect: "error" });
  if (!response.ok) {
    throw new Error(`The book file could not be loaded (${response.status}).`);
  }
  const html = await response.text();
  return { url, ...inspectBookHtml(html) };
}

export function createBookPageUrl(url, pageId) {
  if (!pageId) return url.href;
  if (!SAFE_PAGE_ID.test(pageId)) {
    throw new Error("The requested page link is invalid.");
  }
  const pageUrl = new URL(url.href);
  pageUrl.hash = pageId;
  return pageUrl.href;
}

export function hasBookPage(pageIds, pageId) {
  return typeof pageId === "string" && SAFE_PAGE_ID.test(pageId) && pageIds.has(pageId);
}

export function isAllowedBookMessage(message, bookId, pageIds) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return false;
  if (Object.keys(message).sort().join(",") !== BOOK_MESSAGE_KEYS) return false;
  return message.protocol === BOOK_MESSAGE_PROTOCOL &&
    message.version === 1 &&
    (message.type === "book-ready" || message.type === "page-changed") &&
    message.bookId === bookId &&
    hasBookPage(pageIds, message.pageId);
}
