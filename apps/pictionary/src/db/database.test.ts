import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATEGORIES } from '../shared/types'
import type { GameConfig, PlayerProfile } from '../shared/types'
import { DB_NAME, MIN_SEED_WORDS } from './types'

function deleteUnderlyingDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onblocked = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to delete test database'))
  })
}

/**
 * `openDatabase` is a per-module singleton by contract, so getting a fresh
 * boot (to simulate a new tab / reload) means resetting the module registry
 * and re-importing. The underlying fake-indexeddb data is untouched unless
 * the caller also deletes it, which is what lets the round-trip tests below
 * simulate "close tab, reopen tab" instead of "wipe and start over".
 */
async function freshImport() {
  vi.resetModules()
  return import('./index')
}

describe('openDatabase', () => {
  beforeEach(async () => {
    await deleteUnderlyingDatabase()
    vi.resetModules()
  })

  it('seeds >= MIN_SEED_WORDS words on a fresh boot, with every category non-empty', async () => {
    const { openDatabase } = await freshImport()
    const db = await openDatabase()

    const total = await db.words.count()
    expect(total).toBeGreaterThanOrEqual(MIN_SEED_WORDS)

    for (const category of CATEGORIES) {
      const rows = await db.words.byCategories([category])
      expect(rows.length).toBeGreaterThan(0)
    }

    const packs = await db.words.packs()
    expect(packs.some((p) => p.isBuiltin)).toBe(true)
  })

  it('returns the same instance for concurrent callers', async () => {
    const { openDatabase } = await freshImport()
    const [a, b] = await Promise.all([openDatabase(), openDatabase()])
    expect(a).toBe(b)
  })

  it('round-trips a saved profile across a simulated reopen', async () => {
    const mod1 = await freshImport()
    const db1 = await mod1.openDatabase()

    const profile: PlayerProfile = { id: 'player-1', nickname: 'Ash', color: '#F5D311', avatar: 0 }
    await db1.players.save(profile)
    await db1.flush()

    const mod2 = await freshImport()
    const db2 = await mod2.openDatabase()
    const restored = await db2.players.current()

    expect(restored).toEqual(profile)
  })

  it('does not reseed or duplicate words when reopening an already-seeded database', async () => {
    const mod1 = await freshImport()
    const db1 = await mod1.openDatabase()
    const countBefore = await db1.words.count()
    await db1.flush()

    const mod2 = await freshImport()
    const db2 = await mod2.openDatabase()
    const countAfter = await db2.words.count()

    expect(countAfter).toBe(countBefore)
  })

  it('exportBytes -> importBytes preserves data', async () => {
    const { openDatabase } = await freshImport()
    const db = await openDatabase()

    const profile: PlayerProfile = { id: 'player-2', nickname: 'Bex', color: '#3C7DF2', avatar: 1 }
    await db.players.save(profile)
    const bytes = await db.exportBytes()

    // Mutate state after the export so we can prove import restores the
    // exported snapshot, not just leaves current state untouched.
    await db.players.save({ ...profile, nickname: 'Changed' })
    expect((await db.players.current())?.nickname).toBe('Changed')

    await db.importBytes(bytes)
    const restored = await db.players.current()
    expect(restored?.nickname).toBe('Bex')
  })

  it('importBytes on garbage bytes rejects without destroying the existing database', async () => {
    const { openDatabase } = await freshImport()
    const db = await openDatabase()

    const profile: PlayerProfile = { id: 'player-3', nickname: 'Cy', color: '#3CB371', avatar: 2 }
    await db.players.save(profile)

    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    await expect(db.importBytes(garbage)).rejects.toThrow()

    // The existing database must be completely unharmed.
    const stillThere = await db.players.current()
    expect(stillThere?.nickname).toBe('Cy')
    const wordCount = await db.words.count()
    expect(wordCount).toBeGreaterThanOrEqual(MIN_SEED_WORDS)
  })

  it('stats.bump accumulates additive deltas and tracks bestStreak as a max', async () => {
    const { openDatabase } = await freshImport()
    const db = await openDatabase()

    await db.stats.bump({ gamesPlayed: 1, wordsGuessed: 3, wordsDrawn: 1, bestStreak: 2 })
    await db.stats.bump({ gamesPlayed: 1, wordsGuessed: 5, bestStreak: 1 })
    await db.stats.bump({ gamesPlayed: 1, wordsGuessed: 2, bestStreak: 4 })

    const stats = await db.stats.read()
    expect(stats.gamesPlayed).toBe(3)
    expect(stats.wordsGuessed).toBe(10)
    expect(stats.wordsDrawn).toBe(1)
    expect(stats.bestStreak).toBe(4)
  })

  it('derives favoriteCategory from game_history joined against the word library', async () => {
    const { openDatabase } = await freshImport()
    const db = await openDatabase()

    const [animalWord] = await db.words.byCategories(['animals'])
    expect(animalWord).toBeDefined()

    await db.stats.recordGame([
      {
        gameId: 'g1',
        playerName: 'Ash',
        score: 100,
        role: 'guesser',
        word: animalWord.word,
        timestamp: Date.now(),
      },
      {
        gameId: 'g1',
        playerName: 'Ash',
        score: 90,
        role: 'guesser',
        word: animalWord.word,
        timestamp: Date.now(),
      },
    ])

    const stats = await db.stats.read()
    expect(stats.favoriteCategory).toBe('animals')

    const history = await db.stats.history()
    expect(history.length).toBe(2)
  })

  it('preferences round-trip typed values including the last game config', async () => {
    const { openDatabase } = await freshImport()
    const db = await openDatabase()

    expect(await db.preferences.get('missing-key', 'fallback')).toBe('fallback')

    await db.preferences.set('sound', true)
    expect(await db.preferences.get('sound', false)).toBe(true)

    expect(await db.preferences.lastConfig()).toBeNull()
    const config: GameConfig = {
      turnSeconds: 90,
      rounds: 4,
      categories: ['general', 'animals'],
      customWordsOnly: false,
      customWords: [],
      hintsEnabled: true,
    }
    await db.preferences.saveConfig(config)
    expect(await db.preferences.lastConfig()).toEqual(config)
  })

  it('custom word packs are additive to builtin words for byCategories', async () => {
    const { openDatabase } = await freshImport()
    const db = await openDatabase()

    const before = await db.words.byCategories(['general'])
    const packId = await db.words.createPack('My Pack')
    await db.words.addWords(packId, [{ word: 'zzz-custom-word', category: 'general', difficulty: 1 }])

    const after = await db.words.byCategories(['general'])
    expect(after.length).toBe(before.length + 1)
    expect(after.some((w) => w.word === 'zzz-custom-word')).toBe(true)

    await db.words.removePack(packId)
    const afterRemoval = await db.words.byCategories(['general'])
    expect(afterRemoval.length).toBe(before.length)
  })
})
