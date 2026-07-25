/**
 * Lazy sql.js bootstrap.
 *
 * `sql.js` ships a wasm binary that must never sit on the first-paint critical
 * path, so it is loaded via a dynamic `import()` the first time a caller
 * actually needs a database, and never at module-eval time. Concurrent
 * callers share a single in-flight promise so the wasm is only fetched once.
 */

import type { SqlJsStatic } from 'sql.js'
import initSqlJs from 'sql.js/dist/sql-wasm.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

let sqlJsPromise: Promise<SqlJsStatic> | null = null

/**
 * In the browser the wasm binary is served from `public/sql-wasm.wasm` at the
 * site root. Under Vitest (Node), there is no HTTP server, so we resolve the
 * same file straight off disk from within the sql.js package instead.
 */
function locateFile(_file: string): string {
  if (typeof window !== 'undefined') {
    return wasmUrl
  }
  // Tests only initialize the WASM build. Keep this URL fully static so Vite
  // does not turn the dist-directory template into a glob of every sql.js
  // debug/asm/worker artifact.
  return new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url).pathname
}

/**
 * Resolves to the shared `sql.js` module. Idempotent: the wasm is only
 * instantiated once no matter how many times this is called.
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    // This module is itself reached through App's lazy db import. A direct
    // specific entry keeps Vite's CJS interop reliable without pulling in the
    // package's asm/debug/worker variants.
    sqlJsPromise = initSqlJs({ locateFile })
      .catch((err: unknown) => {
        // Allow a subsequent call to retry rather than being stuck on a
        // permanently rejected promise (e.g. a transient network failure).
        sqlJsPromise = null
        throw err
      })
  }
  return sqlJsPromise
}
