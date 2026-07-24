-- Local-only SQLite schema (sql.js in the browser, persisted as a blob in IndexedDB).
-- OWNED BY THE ORCHESTRATOR. The db agent adds migrations in db/migrations/, never
-- by editing statements below — this file is migration 1 and must stay frozen once shipped.

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  player_id  TEXT PRIMARY KEY,
  nickname   TEXT NOT NULL,
  color      TEXT NOT NULL,
  avatar     INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS word_packs (
  pack_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  word_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id    INTEGER NOT NULL REFERENCES word_packs(pack_id) ON DELETE CASCADE,
  word       TEXT NOT NULL,
  -- 1 easy, 2 medium, 3 hard
  difficulty INTEGER NOT NULL DEFAULT 1,
  category   TEXT NOT NULL,
  UNIQUE (pack_id, word)
);

CREATE INDEX IF NOT EXISTS idx_words_category ON words (category);
CREATE INDEX IF NOT EXISTS idx_words_pack ON words (pack_id);

CREATE TABLE IF NOT EXISTS stats (
  stat_name  TEXT PRIMARY KEY,
  stat_value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_history (
  entry_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     TEXT NOT NULL,
  player_name TEXT NOT NULL,
  score       INTEGER NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('drawer', 'guesser')),
  word        TEXT NOT NULL,
  timestamp   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_game ON game_history (game_id);
CREATE INDEX IF NOT EXISTS idx_history_time ON game_history (timestamp);

-- Saved drawings, kept as encoded op logs rather than images so they can be replayed.
CREATE TABLE IF NOT EXISTS drawings (
  drawing_id INTEGER PRIMARY KEY AUTOINCREMENT,
  word       TEXT NOT NULL,
  ops        BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
