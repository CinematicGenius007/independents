/**
 * IndexedDB blob persistence.
 *
 * The sql.js database only ever lives in memory (wasm heap); this module is
 * the other half — it debounces `db.export()` snapshots and writes the raw
 * bytes into a single-record IndexedDB object store so a returning visitor
 * can restore exactly where they left off.
 *
 * Writes are coalesced: many `scheduleSave()` calls in quick succession (e.g.
 * a batch of word inserts) collapse into a single write ~500ms after the
 * last one. A pending write is force-flushed on `visibilitychange` (tab
 * hidden) and `pagehide` so closing or backgrounding the tab never loses the
 * last few hundred milliseconds of state.
 */

import { DB_KEY, DB_NAME, DB_STORE } from './types'

const DB_VERSION = 1
const DEFAULT_DEBOUNCE_MS = 500

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const idb = request.result
      if (!idb.objectStoreNames.contains(DB_STORE)) {
        idb.createObjectStore(DB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

/** Reads the persisted blob, or `null` if nothing has been saved yet. */
export async function readBlob(): Promise<Uint8Array | null> {
  const idb = await openIdb()
  try {
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = idb.transaction(DB_STORE, 'readonly')
      const store = tx.objectStore(DB_STORE)
      const request = store.get(DB_KEY)
      request.onsuccess = () => {
        const value = request.result as Uint8Array | ArrayBuffer | undefined
        if (!value) {
          resolve(null)
        } else if (value instanceof Uint8Array) {
          resolve(value)
        } else {
          resolve(new Uint8Array(value))
        }
      }
      request.onerror = () => reject(request.error ?? new Error('Failed to read database blob'))
    })
  } finally {
    idb.close()
  }
}

/** Overwrites the persisted blob with `bytes`. */
export async function writeBlob(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).put(bytes, DB_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write database blob'))
      tx.onabort = () => reject(tx.error ?? new Error('Database blob write aborted'))
    })
  } finally {
    idb.close()
  }
}

export interface PersistedStore {
  /** Marks the database dirty and (re)starts the debounce timer. */
  scheduleSave: () => void
  /** Cancels any pending timer and writes immediately. Safe to call anytime; resolves once the write (if any) lands. */
  flush: () => Promise<void>
  /** Removes lifecycle listeners and cancels any pending timer. */
  dispose: () => void
}

/**
 * Creates a debounced persistence controller. `getBytes` is only invoked
 * when a write is actually about to happen (never eagerly), since
 * `db.export()` serialises the whole database and can be relatively costly.
 */
export function createPersistence(
  getBytes: () => Uint8Array,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): PersistedStore {
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let chain: Promise<void> = Promise.resolve()

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const writeNow = async (): Promise<void> => {
    clearTimer()
    if (!dirty) return
    dirty = false
    const bytes = getBytes()
    await writeBlob(bytes)
  }

  // Serialise flushes so concurrent callers never race two writes against
  // IndexedDB at once; each flush waits for whatever came before it.
  const flush = (): Promise<void> => {
    chain = chain.then(writeNow, writeNow)
    return chain
  }

  const scheduleSave = (): void => {
    dirty = true
    clearTimer()
    timer = setTimeout(() => {
      void flush()
    }, debounceMs)
  }

  const onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && dirty) {
      void flush()
    }
  }

  const onPageHide = (): void => {
    if (dirty) void flush()
  }

  const hasWindow = typeof window !== 'undefined'
  const hasDocument = typeof document !== 'undefined'

  if (hasDocument) {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
  if (hasWindow) {
    window.addEventListener('pagehide', onPageHide)
  }

  const dispose = (): void => {
    clearTimer()
    if (hasDocument) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    if (hasWindow) {
      window.removeEventListener('pagehide', onPageHide)
    }
  }

  return { scheduleSave, flush, dispose }
}
