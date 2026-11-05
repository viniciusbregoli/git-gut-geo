import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    country_code TEXT NOT NULL,
    clue_type TEXT NOT NULL,
    tier TEXT NOT NULL,
    -- Curriculum order for introducing new cards; lower comes first.
    position INTEGER NOT NULL,
    data TEXT NOT NULL,
    suspended INTEGER NOT NULL DEFAULT 0,
    -- Set when a tip disappears from its guide; its history is kept.
    retired INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS schedule (
    card_id TEXT PRIMARY KEY REFERENCES cards(id),
    fsrs TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    state INTEGER NOT NULL,
    stability REAL NOT NULL,
    introduced_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id),
    reviewed_at INTEGER NOT NULL,
    answer TEXT NOT NULL,
    correct INTEGER NOT NULL,
    mode TEXT NOT NULL,
    duration_ms INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS schedule_due ON schedule (due_at);
  CREATE INDEX IF NOT EXISTS cards_position ON cards (position);
  CREATE INDEX IF NOT EXISTS reviews_time ON reviews (reviewed_at);
`;

export type Db = DatabaseSync;

export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}
