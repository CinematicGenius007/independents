/**
 * A store for the tests.
 *
 * jsdom has `localStorage`; Node 22 also defines one, experimentally, and hands
 * back undefined unless it was given a file to back. Whichever shadows whichever
 * depends on the runtime, so the tests install a plain one and stop caring. The
 * app itself never assumes storage exists — every read and write is guarded.
 */
class MemoryStorage {
  private entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value))
  }
}

if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
}
