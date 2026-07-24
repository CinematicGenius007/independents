/**
 * Lazy sql.js bootstrap.
 *
 * `sql.js` ships a wasm binary that must never sit on the first-paint critical
 * path, so it is loaded via a dynamic `import()` the first time a caller
 * actually needs a database, and never at module-eval time. Concurrent
 * callers share a single in-flight promise so the wasm is only fetched once.
 */

import type { SqlJsStatic } from 'sql.js'

let sqlJsPromise: Promise<SqlJsStatic> | null = null

/**
 * In the browser the wasm binary is served from `public/sql-wasm.wasm` at the
 * site root. Under Vitest (Node), there is no HTTP server, so we resolve the
 * same file straight off disk from within the sql.js package instead.
 */
function locateFile(file: string): string {
  if (typeof window !== 'undefined') {
    return `/${file}`
  }
  return new URL(`../../node_modules/sql.js/dist/${file}`, import.meta.url).pathname
}

/**
 * Resolves to the shared `sql.js` module. Idempotent: the wasm is only
 * instantiated once no matter how many times this is called.
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = import('sql.js')
      .then((mod) => {
        const initSqlJs = mod.default
        return initSqlJs({ locateFile })
      })
      .catch((err: unknown) => {
        // Allow a subsequent call to retry rather than being stuck on a
        // permanently rejected promise (e.g. a transient network failure).
        sqlJsPromise = null
        throw err
      })
  }
  return sqlJsPromise
}
