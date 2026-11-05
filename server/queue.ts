import type { AnswerMode, AnswerRequest, QueueCounts } from '../shared/api.ts';
import type { DeckCard, TipCardData } from '../shared/deck.ts';
import type { ClueType, SectionTier } from '../shared/plonkit.ts';
import type { Db } from './db.ts';
import { MATURE_STABILITY_DAYS, newFsrsCard, parseFsrsCard, reviewFsrsCard, serializeFsrsCard } from './scheduler.ts';

export const NEW_PER_DAY = 10;
/** Like Anki, the study day rolls over at 4am, not midnight. */
export const DAY_START_HOUR = 4;
/** Cards due within this window are shown rather than ending the session early. */
export const LEARN_AHEAD_MS = 20 * 60_000;
/** A card is answered on the map once FSRS is this sure of it; before that, multiple choice. */
export const MAP_MODE_STABILITY_DAYS = 4;
const REVIEW_STATE = 2;

export interface QueuedCard extends DeckCard {
  isNew: boolean;
  mode: AnswerMode;
  reps: number;
}

interface CardRow {
  id: string;
  kind: 'tip';
  country_code: string;
  clue_type: ClueType;
  tier: SectionTier;
  data: string;
  state: number | null;
  stability: number | null;
  fsrs: string | null;
}

export function dayStart(now: Date): Date {
  const start = new Date(now);
  if (start.getHours() < DAY_START_HOUR) start.setDate(start.getDate() - 1);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  return start;
}

const SELECT_CARD = `
  SELECT c.id, c.kind, c.country_code, c.clue_type, c.tier, c.data, s.state, s.stability, s.fsrs
  FROM cards c LEFT JOIN schedule s ON s.card_id = c.id
`;

const ACTIVE = 'c.suspended = 0 AND c.retired = 0';

// Region tips unlock per country once all its country-level cards are mature.
const UNLOCKED = `
  (c.tier = 'country' OR NOT EXISTS (
    SELECT 1 FROM cards k LEFT JOIN schedule ks ON ks.card_id = k.id
    WHERE k.country_code = c.country_code AND k.tier = 'country' AND k.suspended = 0 AND k.retired = 0
      AND (ks.card_id IS NULL OR ks.state != ${REVIEW_STATE} OR ks.stability < ${MATURE_STABILITY_DAYS})
  ))
`;

function toQueued(row: CardRow): QueuedCard {
  const reviewed = row.state !== null;
  return {
    id: row.id,
    kind: row.kind,
    countryCode: row.country_code,
    clueType: row.clue_type,
    tier: row.tier,
    data: JSON.parse(row.data) as TipCardData,
    isNew: !reviewed,
    reps: row.fsrs ? parseFsrsCard(row.fsrs).reps : 0,
    mode:
      row.state === REVIEW_STATE && (row.stability ?? 0) >= MAP_MODE_STABILITY_DAYS ? 'map' : 'choice',
  };
}

function introducedToday(db: Db, now: Date): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM schedule WHERE introduced_at >= ?')
    .get(dayStart(now).getTime()) as { n: number };
  return row.n;
}

export function queueCounts(db: Db, now: Date): QueueCounts {
  const due = db
    .prepare(`SELECT COUNT(*) AS n FROM cards c JOIN schedule s ON s.card_id = c.id WHERE ${ACTIVE} AND s.due_at <= ?`)
    .get(now.getTime()) as { n: number };
  const available = db
    .prepare(`SELECT COUNT(*) AS n FROM (${SELECT_CARD} WHERE ${ACTIVE} AND s.card_id IS NULL AND ${UNLOCKED})`)
    .get() as { n: number };
  const reviewed = db
    .prepare('SELECT COUNT(*) AS n FROM reviews WHERE reviewed_at >= ?')
    .get(dayStart(now).getTime()) as { n: number };
  return {
    due: due.n,
    newLeft: Math.min(available.n, Math.max(0, NEW_PER_DAY - introducedToday(db, now))),
    reviewedToday: reviewed.n,
  };
}

/** The next card to show: due reviews first, then today's new cards, then soon-due relearning. */
export function nextCard(db: Db, now: Date): QueuedCard | null {
  const due = db
    .prepare(`${SELECT_CARD} WHERE ${ACTIVE} AND s.due_at <= ? ORDER BY s.due_at LIMIT 1`)
    .get(now.getTime()) as CardRow | undefined;
  if (due) return toQueued(due);

  if (introducedToday(db, now) < NEW_PER_DAY) {
    const fresh = db
      .prepare(`${SELECT_CARD} WHERE ${ACTIVE} AND s.card_id IS NULL AND ${UNLOCKED} ORDER BY c.position LIMIT 1`)
      .get() as CardRow | undefined;
    if (fresh) return toQueued(fresh);
  }

  const soon = db
    .prepare(`${SELECT_CARD} WHERE ${ACTIVE} AND s.due_at <= ? ORDER BY s.due_at LIMIT 1`)
    .get(now.getTime() + LEARN_AHEAD_MS) as CardRow | undefined;
  return soon ? toQueued(soon) : null;
}

export interface AnswerResult {
  correct: boolean;
  correctCountry: string;
  dueAt: string;
}

export function answerCard(db: Db, cardId: string, input: AnswerRequest, now: Date): AnswerResult | null {
  const row = db.prepare(`${SELECT_CARD} WHERE c.id = ?`).get(cardId) as CardRow | undefined;
  if (!row) return null;

  const correct = input.answer === row.country_code;
  const before = row.fsrs ? parseFsrsCard(row.fsrs) : newFsrsCard(now);
  const after = reviewFsrsCard(before, correct, input.durationMs, now);

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO schedule (card_id, fsrs, due_at, state, stability, introduced_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (card_id) DO UPDATE SET
         fsrs = excluded.fsrs, due_at = excluded.due_at, state = excluded.state, stability = excluded.stability`,
    ).run(cardId, serializeFsrsCard(after), after.dueAt.getTime(), after.state, after.stability, now.getTime());
    db.prepare(
      'INSERT INTO reviews (card_id, reviewed_at, answer, correct, mode, duration_ms) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(cardId, now.getTime(), input.answer, correct ? 1 : 0, input.mode, Math.round(input.durationMs));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { correct, correctCountry: row.country_code, dueAt: after.dueAt.toISOString() };
}

export function setSuspended(db: Db, cardId: string, suspended: boolean): boolean {
  return db.prepare('UPDATE cards SET suspended = ? WHERE id = ?').run(suspended ? 1 : 0, cardId).changes > 0;
}

/** Countries other than `code` that have cards of this clue type, for distractors. */
export function countriesSharingClue(db: Db, clueType: ClueType, code: string): Set<string> {
  const rows = db
    .prepare('SELECT DISTINCT country_code FROM cards WHERE clue_type = ? AND country_code != ? AND retired = 0')
    .all(clueType, code) as { country_code: string }[];
  return new Set(rows.map((r) => r.country_code));
}
