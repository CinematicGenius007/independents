import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPersistence, readBlob, writeBlob } from './persist'
import { DB_NAME } from './types'

function deleteUnderlyingDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onblocked = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'))
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('persist', () => {
  beforeEach(async () => {
    await deleteUnderlyingDatabase()
  })

  it('writeBlob/readBlob round-trip raw bytes', async () => {
    const bytes = new Uint8Array([9, 8, 7, 6, 5])
    await writeBlob(bytes)
    const back = await readBlob()
    expect(back).toEqual(bytes)
  })

  it('readBlob returns null when nothing has been written yet', async () => {
    const back = await readBlob()
    expect(back).toBeNull()
  })

  it('coalesces rapid scheduleSave calls into a single debounced write', async () => {
    let getBytesCalls = 0
    const persistence = createPersistence(() => {
      getBytesCalls++
      return new Uint8Array([1, 2, 3])
    }, 30)

    persistence.scheduleSave()
    persistence.scheduleSave()
    persistence.scheduleSave()

    // Well before the debounce window: nothing should have written yet.
    await wait(10)
    expect(getBytesCalls).toBe(0)

    // Past the debounce window: exactly one write, not three.
    await wait(40)
    expect(getBytesCalls).toBe(1)

    const persisted = await readBlob()
    expect(persisted).toEqual(new Uint8Array([1, 2, 3]))

    persistence.dispose()
  })

  it('flush() writes immediately, bypassing the debounce timer', async () => {
    let getBytesCalls = 0
    const persistence = createPersistence(() => {
      getBytesCalls++
      return new Uint8Array([4, 5, 6])
    }, 5000)

    persistence.scheduleSave()
    await persistence.flush()

    expect(getBytesCalls).toBe(1)
    const persisted = await readBlob()
    expect(persisted).toEqual(new Uint8Array([4, 5, 6]))

    persistence.dispose()
  })

  it('flush() with nothing pending is a safe no-op', async () => {
    let getBytesCalls = 0
    const persistence = createPersistence(() => {
      getBytesCalls++
      return new Uint8Array([7, 7, 7])
    }, 30)

    await persistence.flush()
    expect(getBytesCalls).toBe(0)

    persistence.dispose()
  })

  describe('lifecycle flush hooks', () => {
    let originalDocument: unknown
    let originalWindow: unknown

    beforeEach(() => {
      originalDocument = (globalThis as Record<string, unknown>).document
      originalWindow = (globalThis as Record<string, unknown>).window
    })

    afterEach(() => {
      ;(globalThis as Record<string, unknown>).document = originalDocument
      ;(globalThis as Record<string, unknown>).window = originalWindow
    })

    it('flushes a pending write when the page is hidden (visibilitychange)', async () => {
      const listeners = new Map<string, () => void>()
      const fakeDocument = {
        visibilityState: 'visible',
        addEventListener: (type: string, cb: () => void) => listeners.set(type, cb),
        removeEventListener: (type: string) => listeners.delete(type),
      }
      ;(globalThis as Record<string, unknown>).document = fakeDocument

      let getBytesCalls = 0
      const persistence = createPersistence(() => {
        getBytesCalls++
        return new Uint8Array([1])
      }, 5000)

      persistence.scheduleSave()
      expect(getBytesCalls).toBe(0)

      fakeDocument.visibilityState = 'hidden'
      listeners.get('visibilitychange')?.()

      // The flush is async (IndexedDB round trip); give it a tick.
      await wait(10)
      expect(getBytesCalls).toBe(1)

      persistence.dispose()
    })

    it('flushes a pending write on pagehide', async () => {
      const listeners = new Map<string, () => void>()
      const fakeWindow = {
        addEventListener: (type: string, cb: () => void) => listeners.set(type, cb),
        removeEventListener: (type: string) => listeners.delete(type),
      }
      ;(globalThis as Record<string, unknown>).window = fakeWindow

      let getBytesCalls = 0
      const persistence = createPersistence(() => {
        getBytesCalls++
        return new Uint8Array([2])
      }, 5000)

      persistence.scheduleSave()
      listeners.get('pagehide')?.()

      await wait(10)
      expect(getBytesCalls).toBe(1)

      persistence.dispose()
    })
  })
})
