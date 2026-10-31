import {
  getPathProgress,
  getReadingProgress,
  mergeSyncedBookProgress,
  mergeSyncedPathProgress
} from "./reader-library-service.js";

export const SUPABASE_URL = "https://tlygkjoiinshwfayjcjw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aHSEdKaFW3DKxG4X-QyvoA_bw4lXaM1";

let clientPromise;

export async function createSupabaseClient() {
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          detectSessionInUrl: true,
          autoRefreshToken: true
        }
      }))
      .catch(error => {
        clientPromise = null;
        throw new Error(`Could not load the Supabase client: ${error.message}`);
      });
  }
  return clientPromise;
}

function localTimestamp(record) {
  return Number(record.updatedAt || record.lastPageChangedAt || record.lastOpenedAt || record.firstOpenedAt || 0);
}

function cloudTimestamp(record) {
  return Date.parse(record.updated_at) || 0;
}

function toCloudBookProgress(userId, record) {
  return {
    user_id: userId,
    book_id: record.bookId,
    page_id: record.currentPageId || record.lastPageId || null,
    completed: record.completed === true,
    updated_at: new Date(localTimestamp(record) || Date.now()).toISOString()
  };
}

function toCloudPathProgress(userId, record) {
  return {
    user_id: userId,
    path_id: record.pathId,
    completed: record.completed === true,
    updated_at: new Date(localTimestamp(record) || Date.now()).toISOString()
  };
}

export async function syncProgress(client, userId, localProgress, localPathProgress) {
  const [bookResult, pathResult] = await Promise.all([
    client.from("reading_progress")
      .select("book_id,page_id,completed,updated_at")
      .eq("user_id", userId),
    client.from("path_progress")
      .select("path_id,completed,updated_at")
      .eq("user_id", userId)
  ]);
  if (bookResult.error) throw bookResult.error;
  if (pathResult.error) throw pathResult.error;

  const cloudBooks = new Map(bookResult.data.map(record => [record.book_id, record]));
  const cloudPaths = new Map(pathResult.data.map(record => [record.path_id, record]));
  const booksToUpload = [];
  const pathsToUpload = [];

  for (const [bookId, record] of localProgress) {
    if (bookId.startsWith("import-")) continue;
    const remote = cloudBooks.get(bookId);
    if (!remote || localTimestamp(record) >= cloudTimestamp(remote)) {
      booksToUpload.push(toCloudBookProgress(userId, record));
    }
  }
  for (const remote of cloudBooks.values()) {
    const local = localProgress.get(remote.book_id);
    if (!local || cloudTimestamp(remote) > localTimestamp(local)) {
      await mergeSyncedBookProgress({
        bookId: remote.book_id,
        bookRef: `public:${remote.book_id}`,
        currentPageId: remote.page_id,
        lastPageId: remote.page_id,
        completed: remote.completed,
        updatedAt: cloudTimestamp(remote),
        lastOpenedAt: cloudTimestamp(remote)
      });
    }
  }

  for (const [pathId, record] of localPathProgress) {
    const remote = cloudPaths.get(pathId);
    if (!remote || localTimestamp(record) >= cloudTimestamp(remote)) {
      pathsToUpload.push(toCloudPathProgress(userId, record));
    }
  }
  for (const remote of cloudPaths.values()) {
    const local = localPathProgress.get(remote.path_id);
    if (!local || cloudTimestamp(remote) > localTimestamp(local)) {
      await mergeSyncedPathProgress({
        pathId: remote.path_id,
        completed: remote.completed,
        updatedAt: cloudTimestamp(remote)
      });
    }
  }

  const uploads = [];
  if (booksToUpload.length) {
    uploads.push(client.from("reading_progress").upsert(booksToUpload, { onConflict: "user_id,book_id" }));
  }
  if (pathsToUpload.length) {
    uploads.push(client.from("path_progress").upsert(pathsToUpload, { onConflict: "user_id,path_id" }));
  }
  const results = await Promise.all(uploads);
  const failedUpload = results.find(result => result.error);
  if (failedUpload) throw failedUpload.error;

  return {
    progress: await getReadingProgress(),
    pathProgress: await getPathProgress()
  };
}

export async function saveBookProgressToCloud(client, userId, record) {
  if (record.bookId.startsWith("import-")) return;
  const { error } = await client.from("reading_progress")
    .upsert([toCloudBookProgress(userId, record)], { onConflict: "user_id,book_id" });
  if (error) throw error;
}

export async function savePathProgressToCloud(client, userId, record) {
  const { error } = await client.from("path_progress")
    .upsert([toCloudPathProgress(userId, record)], { onConflict: "user_id,path_id" });
  if (error) throw error;
}
