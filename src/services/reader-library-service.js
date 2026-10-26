const DATABASE_NAME = "index-dictionary-reader-library";
const DATABASE_VERSION = 2;
const STORES = {
  saved: "savedBooks",
  local: "localBooks",
  collections: "collections",
  collectionBooks: "collectionBooks",
  bookmarks: "bookmarks",
  progress: "readingProgress",
  paths: "pathProgress"
};

let databasePromise;

export class LibraryStorageError extends Error {
  constructor(message, code = "storage-error") {
    super(message);
    this.name = "LibraryStorageError";
    this.code = code;
  }
}

function storageError(error, fallback) {
  if (error instanceof LibraryStorageError) return error;
  if (error?.name === "QuotaExceededError") {
    return new LibraryStorageError("Browser storage is full. Free space on this device and try again.", "quota-exceeded");
  }
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return new LibraryStorageError("Browser storage is unavailable or permission was denied.", "storage-unavailable");
  }
  const detail = typeof error?.message === "string" ? ` ${error.message}` : "";
  return new LibraryStorageError(`${fallback}${detail}`, "storage-error");
}

function addIndex(store, name, keyPath, options = {}) {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
}

function bookReference(bookId) {
  return `${bookId.startsWith("import-") ? "local" : "public"}:${bookId}`;
}

function failUpgrade(transaction, error, reportError) {
  reportError(error);
  try {
    transaction.abort();
  } catch {
    return;
  }
}

function migrateReferences(transaction, storeName, reportError) {
  if (!transaction.objectStoreNames.contains(storeName)) return;
  const cursorRequest = transaction.objectStore(storeName).openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    const record = cursor.value;
    if (typeof record.bookId !== "string" || !record.bookId) {
      failUpgrade(transaction, new Error("An existing library record has no book ID."), reportError);
      return;
    }
    try {
      record.bookRef = bookReference(record.bookId);
      cursor.update(record);
      cursor.continue();
    } catch (error) {
      failUpgrade(transaction, error, reportError);
    }
  };
  cursorRequest.onerror = () => failUpgrade(transaction, cursorRequest.error, reportError);
}

function createSchema(database, transaction, oldVersion, reportError) {
  if (!database.objectStoreNames.contains(STORES.saved)) {
    database.createObjectStore(STORES.saved, { keyPath: "bookId" });
  }
  if (!database.objectStoreNames.contains(STORES.local)) {
    database.createObjectStore(STORES.local, { keyPath: "localId" });
  }
  if (!database.objectStoreNames.contains(STORES.collections)) {
    database.createObjectStore(STORES.collections, { keyPath: "collectionId" });
  }
  if (!database.objectStoreNames.contains(STORES.collectionBooks)) {
    database.createObjectStore(STORES.collectionBooks, { keyPath: ["collectionId", "bookRef"] });
  }
  if (!database.objectStoreNames.contains(STORES.bookmarks)) {
    database.createObjectStore(STORES.bookmarks, { keyPath: "bookmarkId" });
  }
  if (!database.objectStoreNames.contains(STORES.progress)) {
    database.createObjectStore(STORES.progress, { keyPath: "bookId" });
  }
  if (!database.objectStoreNames.contains(STORES.paths)) {
    database.createObjectStore(STORES.paths, { keyPath: "pathId" });
  }

  const saved = transaction.objectStore(STORES.saved);
  addIndex(saved, "savedAt", "savedAt");
  addIndex(saved, "bookRef", "bookRef");

  const localBooks = transaction.objectStore(STORES.local);
  addIndex(localBooks, "title", "title");
  addIndex(localBooks, "importedAt", "importedAt");

  const collections = transaction.objectStore(STORES.collections);
  addIndex(collections, "updatedAt", "updatedAt");

  const collectionBooks = transaction.objectStore(STORES.collectionBooks);
  addIndex(collectionBooks, "collectionId", "collectionId");
  addIndex(collectionBooks, "bookRef", "bookRef");
  addIndex(collectionBooks, "addedAt", "addedAt");

  const bookmarks = transaction.objectStore(STORES.bookmarks);
  addIndex(bookmarks, "bookRef", "bookRef");
  addIndex(bookmarks, "createdAt", "createdAt");

  const progress = transaction.objectStore(STORES.progress);
  addIndex(progress, "bookRef", "bookRef");
  addIndex(progress, "lastOpenedAt", "lastOpenedAt");
  addIndex(progress, "completed", "completed");

  const paths = transaction.objectStore(STORES.paths);
  addIndex(paths, "updatedAt", "updatedAt");

  if (oldVersion < 2) {
    migrateReferences(transaction, STORES.saved, reportError);
    migrateReferences(transaction, STORES.progress, reportError);

    if (database.objectStoreNames.contains("importedBooks")) {
      const legacyBooks = transaction.objectStore("importedBooks");
      const cursorRequest = legacyBooks.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          try {
            database.deleteObjectStore("importedBooks");
          } catch (error) {
            failUpgrade(transaction, error, reportError);
          }
          return;
        }
        const { id, ...record } = cursor.value;
        if (typeof id !== "string" || !id) {
          failUpgrade(transaction, new Error("An existing imported book has no ID."), reportError);
          return;
        }
        try {
          transaction.objectStore(STORES.local).put({ ...record, localId: id });
          cursor.continue();
        } catch (error) {
          failUpgrade(transaction, error, reportError);
        }
      };
      cursorRequest.onerror = () => failUpgrade(transaction, cursorRequest.error, reportError);
    }
  }
}

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new LibraryStorageError("This browser does not support local library storage.", "storage-unavailable"));
  }
  if (!databasePromise) {
    const pending = new Promise((resolve, reject) => {
      let wasBlocked = false;
      let upgradeError;
      let request;
      try {
        request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      } catch (error) {
        reject(storageError(error, "Could not open local library storage."));
        return;
      }

      request.onupgradeneeded = event => {
        try {
          createSchema(request.result, request.transaction, event.oldVersion, error => {
            upgradeError = error;
          });
        } catch (error) {
          upgradeError = error;
          request.transaction.abort();
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (wasBlocked) {
          database.close();
          return;
        }
        database.onversionchange = () => {
          database.close();
          if (databasePromise === pending) databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => reject(storageError(upgradeError || request.error, "Could not open local library storage."));
      request.onblocked = () => {
        wasBlocked = true;
        reject(new LibraryStorageError("Local library storage is blocked by another open tab. Close other app tabs and retry.", "storage-blocked"));
      };
    });
    databasePromise = pending;
    pending.catch(() => {
      if (databasePromise === pending) databasePromise = null;
    });
  }
  return databasePromise;
}

async function transact(storeNames, mode, action, fallback = "Local library storage transaction failed.") {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction;
    let result;
    try {
      transaction = database.transaction(storeNames, mode);
    } catch (error) {
      reject(storageError(error, fallback));
      return;
    }
    let actionError;
    const abortWithError = error => {
      actionError = storageError(error, fallback);
      try {
        transaction.abort();
      } catch {
        reject(actionError);
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(actionError || storageError(transaction.error, fallback));
    transaction.onabort = () => reject(actionError || storageError(transaction.error, fallback));
    try {
      result = action(transaction, value => { result = value; }, abortWithError);
    } catch (error) {
      abortWithError(error);
    }
  });
}

function putSafely(transaction, store, record, abortWithError) {
  try {
    store.put(record);
  } catch (error) {
    abortWithError(error);
  }
}

function validateIdentifier(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > 256 || /[\u0000-\u001f]/.test(value)) {
    throw new TypeError(`${label} must be a non-empty string of at most 256 characters.`);
  }
  return value;
}

function validateBookReference(value) {
  if (typeof value !== "string" || !/^(public|local):[^:\u0000-\u001f]{1,256}$/.test(value)) {
    throw new TypeError("Book reference must use the public:{bookId} or local:{bookId} format.");
  }
  return value;
}

function normalizeBookReference(value) {
  if (typeof value !== "string") throw new TypeError("Book reference must be a string.");
  return value.startsWith("public:") || value.startsWith("local:")
    ? validateBookReference(value)
    : bookReference(validateIdentifier(value, "Book ID"));
}

function validateImportedBook(book) {
  if (!book || typeof book !== "object" || Array.isArray(book)) throw new TypeError("Imported book must be an object.");
  validateIdentifier(book.id, "Imported book ID");
  if (!book.id.startsWith("import-")) throw new TypeError("Imported book ID must start with import-.");
  if (typeof book.title !== "string" || !book.title.trim() || book.title.trim().length > 180) {
    throw new TypeError("Imported book title must be between 1 and 180 characters.");
  }
  if (typeof book.category !== "undefined" &&
      (typeof book.category !== "string" || book.category.trim().length > 80)) {
    throw new TypeError("Imported book category must be 80 characters or fewer.");
  }
  if (typeof book.filename !== "string" ||
      !book.filename.trim() ||
      book.filename.length > 255 ||
      /[\\/\u0000-\u001f]/.test(book.filename) ||
      !/\.html?$/i.test(book.filename)) {
    throw new TypeError("Imported book filename must be an .html or .htm file name of at most 255 characters.");
  }
  if (typeof book.content !== "string" || !book.content.trim()) throw new TypeError("Imported book HTML content is required.");
  if (new Blob([book.content]).size > 2 * 1024 * 1024) {
    throw new TypeError("Imported book HTML content cannot exceed 2 MiB.");
  }
  if (!Number.isFinite(book.importedAt) || book.importedAt <= 0) throw new TypeError("Imported book timestamp is invalid.");
}

function validatePageId(pageId) {
  if (typeof pageId !== "string" || !pageId.trim() || pageId.length > 256 || /[\u0000-\u001f]/.test(pageId)) {
    throw new TypeError("Page ID must be a non-empty string of at most 256 characters.");
  }
  return pageId;
}

function importedRecord(record) {
  if (!record) return record;
  const { localId, ...book } = record;
  return { ...book, id: localId };
}

function deleteMatching(index, key) {
  const cursorRequest = index.openCursor(key);
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
}

export async function getSavedBooks() {
  return transact(STORES.saved, "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(STORES.saved).getAll();
    request.onsuccess = () => setResult(request.result);
  });
}

export async function isBookSaved(bookId) {
  validateIdentifier(bookId, "Book ID");
  return Boolean(await transact(STORES.saved, "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(STORES.saved).get(bookId);
    request.onsuccess = () => setResult(request.result);
  }));
}

export async function setBookSaved(bookId, saved) {
  validateIdentifier(bookId, "Book ID");
  if (typeof saved !== "boolean") throw new TypeError("Saved state must be true or false.");
  return transact(STORES.saved, "readwrite", transaction => {
    const store = transaction.objectStore(STORES.saved);
    if (saved) store.put({ bookId, bookRef: bookReference(bookId), savedAt: Date.now() });
    else store.delete(bookId);
  }, "Could not update the saved-book list.");
}

export async function getImportedBooks() {
  const books = await transact(STORES.local, "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(STORES.local).getAll();
    request.onsuccess = () => setResult(request.result);
  }, "Could not read local books.");
  return books.map(({ content, localId, ...metadata }) => ({ ...metadata, id: localId }));
}

export async function getImportedBook(id) {
  validateIdentifier(id, "Imported book ID");
  const record = await transact(STORES.local, "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(STORES.local).get(id);
    request.onsuccess = () => setResult(request.result);
  }, "Could not read the imported book.");
  return importedRecord(record);
}

export async function saveImportedBook(book, collectionId = "") {
  validateImportedBook(book);
  const normalizedBook = {
    ...book,
    title: book.title.trim(),
    category: typeof book.category === "string" ? book.category.trim() : ""
  };
  const { id, ...record } = normalizedBook;
  const stores = collectionId
    ? [STORES.local, STORES.collections, STORES.collectionBooks]
    : [STORES.local];
  if (collectionId) validateIdentifier(collectionId, "Collection ID");
  const bookRef = bookReference(id);
  return transact(stores, "readwrite", (transaction, _setResult, abortWithError) => {
    transaction.objectStore(STORES.local).put({ ...record, localId: id });
    if (collectionId) {
      const collectionRead = transaction.objectStore(STORES.collections).get(collectionId);
      collectionRead.onsuccess = () => {
        if (!collectionRead.result) {
          abortWithError(new Error(`Collection "${collectionId}" no longer exists.`));
          return;
        }
        putSafely(transaction, transaction.objectStore(STORES.collectionBooks), {
          collectionId,
          bookRef,
          addedAt: Date.now()
        }, abortWithError);
      };
      collectionRead.onerror = () => abortWithError(collectionRead.error);
    }
  }, "Could not save the imported book. Check available browser storage.");
}

export async function updateImportedBook(book) {
  validateImportedBook(book);
  const normalizedBook = {
    ...book,
    title: book.title.trim(),
    category: typeof book.category === "string" ? book.category.trim() : ""
  };
  const { id, ...record } = normalizedBook;
  return transact(STORES.local, "readwrite", (transaction, _setResult, abortWithError) => {
    const store = transaction.objectStore(STORES.local);
    const read = store.get(id);
    read.onsuccess = () => {
      if (!read.result) {
        abortWithError(new Error("This imported book is no longer available on this device."));
        return;
      }
      putSafely(transaction, store, { ...record, localId: id }, abortWithError);
    };
    read.onerror = () => abortWithError(read.error);
  }, "Could not update the imported book.");
}

export async function deleteImportedBook(id) {
  validateIdentifier(id, "Imported book ID");
  const bookRef = bookReference(id);
  return transact(
    [STORES.local, STORES.saved, STORES.progress, STORES.bookmarks, STORES.collectionBooks],
    "readwrite",
    transaction => {
      transaction.objectStore(STORES.local).delete(id);
      transaction.objectStore(STORES.saved).delete(id);
      transaction.objectStore(STORES.progress).delete(id);
      deleteMatching(transaction.objectStore(STORES.bookmarks).index("bookRef"), bookRef);
      deleteMatching(transaction.objectStore(STORES.collectionBooks).index("bookRef"), bookRef);
    },
    "Could not delete the imported book and its local reading data."
  );
}

export async function getReadingProgress() {
  const items = await transact(STORES.progress, "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(STORES.progress).getAll();
    request.onsuccess = () => setResult(request.result);
  }, "Could not read reading progress.");
  return new Map(items.map(item => [item.bookId, item]));
}

export async function recordBookOpened(bookId) {
  validateIdentifier(bookId, "Book ID");
  const now = Date.now();
  let updatedRecord;
  return transact(STORES.progress, "readwrite", (transaction, _setResult, abortWithError) => {
    const store = transaction.objectStore(STORES.progress);
    const read = store.get(bookId);
    read.onsuccess = () => {
      const existing = read.result || {};
      updatedRecord = {
        ...existing,
        bookId,
        bookRef: bookReference(bookId),
        firstOpenedAt: existing.firstOpenedAt || now,
        lastOpenedAt: now,
        completed: existing.completed === true
      };
      putSafely(transaction, store, updatedRecord, abortWithError);
    };
  }, "Could not save reading history. Check available browser storage.").then(() => updatedRecord);
}

export async function recordBookPage(bookId, pageId) {
  validateIdentifier(bookId, "Book ID");
  validatePageId(pageId);
  const now = Date.now();
  let updatedRecord;
  return transact(STORES.progress, "readwrite", (transaction, _setResult, abortWithError) => {
    const store = transaction.objectStore(STORES.progress);
    const read = store.get(bookId);
    read.onsuccess = () => {
      const existing = read.result || {};
      updatedRecord = {
        ...existing,
        bookId,
        bookRef: bookReference(bookId),
        firstOpenedAt: existing.firstOpenedAt || now,
        lastOpenedAt: now,
        currentPageId: pageId,
        lastPageId: pageId,
        lastPageChangedAt: now,
        completed: existing.completed === true
      };
      putSafely(transaction, store, updatedRecord, abortWithError);
    };
  }, "Could not save your reading position. Check available browser storage.").then(() => updatedRecord);
}

export async function setBookCompleted(bookId, completed) {
  validateIdentifier(bookId, "Book ID");
  if (typeof completed !== "boolean") throw new TypeError("Completion state must be true or false.");
  const now = Date.now();
  let updatedRecord;
  return transact(STORES.progress, "readwrite", (transaction, _setResult, abortWithError) => {
    const store = transaction.objectStore(STORES.progress);
    const read = store.get(bookId);
    read.onsuccess = () => {
      const existing = read.result || {};
      updatedRecord = {
        ...existing,
        bookId,
        bookRef: bookReference(bookId),
        firstOpenedAt: existing.firstOpenedAt || now,
        lastOpenedAt: now,
        completed
      };
      putSafely(transaction, store, updatedRecord, abortWithError);
    };
  }, "Could not update book completion. Check available browser storage.").then(() => updatedRecord);
}

export async function getPathProgress() {
  const records = await transact(STORES.paths, "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(STORES.paths).getAll();
    request.onsuccess = () => setResult(request.result);
  }, "Could not read learning-path progress.");
  return new Map(records.map(record => [record.pathId, record]));
}

export async function setPathCompleted(pathId, completed) {
  validateIdentifier(pathId, "Learning path ID");
  if (typeof completed !== "boolean") throw new TypeError("Completion state must be true or false.");
  const now = Date.now();
  let updatedRecord;
  return transact(STORES.paths, "readwrite", (transaction, _setResult, abortWithError) => {
    const store = transaction.objectStore(STORES.paths);
    const read = store.get(pathId);
    read.onsuccess = () => {
      updatedRecord = {
        ...(read.result || {}),
        pathId,
        completed,
        updatedAt: now
      };
      putSafely(transaction, store, updatedRecord, abortWithError);
    };
  }, "Could not update learning-path progress. Check available browser storage.").then(() => updatedRecord);
}

export async function getCollections() {
  return transact(STORES.collections, "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(STORES.collections).getAll();
    request.onsuccess = () => setResult(request.result);
  }, "Could not read collections.");
}

export async function saveCollection(collection) {
  if (!collection || typeof collection !== "object" || Array.isArray(collection)) {
    throw new TypeError("Collection must be an object.");
  }
  const collectionId = validateIdentifier(collection.collectionId, "Collection ID");
  const name = typeof collection.name === "string" ? collection.name.trim() : "";
  if (!name || name.length > 80) throw new TypeError("Collection name must be between 1 and 80 characters.");
  const now = Date.now();
  let savedRecord;
  return transact(STORES.collections, "readwrite", (transaction, _setResult, abortWithError) => {
    const store = transaction.objectStore(STORES.collections);
    const read = store.get(collectionId);
    read.onsuccess = () => {
      const existing = read.result || {};
      savedRecord = {
        ...existing,
        collectionId,
        name,
        createdAt: existing.createdAt || collection.createdAt || now,
        updatedAt: now
      };
      putSafely(transaction, store, savedRecord, abortWithError);
    };
  }, "Could not save the collection. Check available browser storage.").then(() => savedRecord);
}

export async function deleteCollection(collectionId) {
  validateIdentifier(collectionId, "Collection ID");
  return transact([STORES.collections, STORES.collectionBooks], "readwrite", transaction => {
    transaction.objectStore(STORES.collections).delete(collectionId);
    deleteMatching(transaction.objectStore(STORES.collectionBooks).index("collectionId"), collectionId);
  }, "Could not delete the collection and its book memberships.");
}

export async function getCollectionBooks(collectionId) {
  validateIdentifier(collectionId, "Collection ID");
  return transact(STORES.collectionBooks, "readonly", (transaction, setResult) => {
    const request = transaction.objectStore(STORES.collectionBooks)
      .index("collectionId")
      .getAll(collectionId);
    request.onsuccess = () => setResult(request.result);
  }, "Could not read collection books.");
}

export async function addBookToCollection(collectionId, book) {
  validateIdentifier(collectionId, "Collection ID");
  const bookRef = normalizeBookReference(book);
  const addedAt = Date.now();
  let membership;
  let collectionMissing = false;
  return transact([STORES.collections, STORES.collectionBooks], "readwrite", (transaction, _setResult, abortWithError) => {
    const collectionRead = transaction.objectStore(STORES.collections).get(collectionId);
    collectionRead.onsuccess = () => {
      if (!collectionRead.result) {
        collectionMissing = true;
        transaction.abort();
        return;
      }
      const store = transaction.objectStore(STORES.collectionBooks);
      const read = store.get([collectionId, bookRef]);
      read.onsuccess = () => {
        membership = read.result || { collectionId, bookRef, addedAt };
        putSafely(transaction, store, membership, abortWithError);
      };
    };
  }, "Could not add the book to this collection. Check available browser storage.")
    .then(() => membership)
    .catch(error => {
      if (collectionMissing) throw new Error(`Collection "${collectionId}" does not exist.`);
      throw error;
    });
}

export async function removeBookFromCollection(collectionId, book) {
  validateIdentifier(collectionId, "Collection ID");
  const bookRef = normalizeBookReference(book);
  return transact(STORES.collectionBooks, "readwrite", transaction => {
    transaction.objectStore(STORES.collectionBooks).delete([collectionId, bookRef]);
  }, "Could not remove the book from this collection.");
}

export async function getBookmarks(book) {
  const bookRef = book === undefined ? null : normalizeBookReference(book);
  return transact(STORES.bookmarks, "readonly", (transaction, setResult) => {
    const store = transaction.objectStore(STORES.bookmarks);
    const request = bookRef
      ? store.index("bookRef").getAll(bookRef)
      : store.getAll();
    request.onsuccess = () => setResult(request.result);
  }, "Could not read bookmarks.");
}

export async function saveBookmark(bookmark) {
  if (!bookmark || typeof bookmark !== "object" || Array.isArray(bookmark)) {
    throw new TypeError("Bookmark must be an object.");
  }
  const bookmarkId = validateIdentifier(bookmark.bookmarkId, "Bookmark ID");
  const bookRef = normalizeBookReference(bookmark.bookRef || bookmark.bookId);
  const pageId = validatePageId(bookmark.pageId);
  const label = typeof bookmark.label === "string" ? bookmark.label.trim() : "";
  if (label.length > 120) throw new TypeError("Bookmark label must be 120 characters or fewer.");
  const createdAt = Number.isFinite(bookmark.createdAt) && bookmark.createdAt > 0
    ? bookmark.createdAt
    : Date.now();
  return transact(STORES.bookmarks, "readwrite", transaction => {
    transaction.objectStore(STORES.bookmarks).put({ bookmarkId, bookRef, pageId, label, createdAt });
  }, "Could not save the bookmark. Check available browser storage.");
}

export async function deleteBookmark(bookmarkId) {
  validateIdentifier(bookmarkId, "Bookmark ID");
  return transact(STORES.bookmarks, "readwrite", transaction => {
    transaction.objectStore(STORES.bookmarks).delete(bookmarkId);
  }, "Could not delete the bookmark.");
}

export async function clearReaderData() {
  return transact(Object.values(STORES), "readwrite", transaction => {
    for (const storeName of Object.values(STORES)) {
      transaction.objectStore(storeName).clear();
    }
  }, "Could not clear local library data.");
}
