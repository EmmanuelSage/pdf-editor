// Persists an in-progress "Edit document" session (the filled PDF bytes) in
// IndexedDB so a refresh or accidental close doesn't lose the user's work.
// IndexedDB (not localStorage) because the PDF is multi-MB binary data.
const DB_NAME = 'pdf-toolkit';
const STORE = 'sessions';
const EDIT_KEY = 'edit';
const VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// session: { fileName, bytes: Uint8Array, scale, savedAt }
export const saveEditSession = (session) =>
  withStore('readwrite', (store) => store.put(session, EDIT_KEY));

export const loadEditSession = () =>
  withStore('readonly', (store) => store.get(EDIT_KEY));

export const clearEditSession = () =>
  withStore('readwrite', (store) => store.delete(EDIT_KEY));
