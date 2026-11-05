import { describe, expect, it } from 'vitest';
import { openDb } from './db.ts';
import { syncDeck } from './deck.ts';
import { NEW_PER_DAY, answerCard, dayStart, nextCard, queueCounts, setSuspended } from './queue.ts';
import { guide, tip } from './testing/guides.ts';

const at = (iso: string) => new Date(iso);
const fast = { durationMs: 3000, mode: 'choice' as const };

function deck(tipCount = 3) {
  const db = openDb(':memory:');
  const tips = Array.from({ length: tipCount }, (_, i) => tip(`t${i}`, `Plates number ${i}.`));
  syncDeck(db, [guide('testland', 'TL', 'Europe', [...tips, tip('r', 'Region trees.', { tier: 'region' })])]);
  return db;
}

describe('dayStart', () => {
  it('rolls the study day over at 4am local time', () => {
    expect(dayStart(new Date(2026, 0, 2, 3, 0)).getDate()).toBe(1);
    expect(dayStart(new Date(2026, 0, 2, 5, 0)).getDate()).toBe(2);
  });
});

describe('nextCard', () => {
  it('serves new cards in curriculum order with multiple choice', () => {
    const card = nextCard(deck(), at('2026-01-01T12:00:00Z'));
    expect(card).toMatchObject({ id: 'tip:testland:t0', isNew: true, mode: 'choice', reps: 0 });
  });

  it('keeps region tips locked until the country-level cards are mature', () => {
    const db = deck(1);
    const now = at('2026-01-01T12:00:00Z');
    answerCard(db, 'tip:testland:t0', { answer: 'TL', ...fast }, now);
    expect(nextCard(db, now)?.id).not.toBe('tip:testland:r');

    db.prepare('UPDATE schedule SET stability = 30, due_at = ?').run(at('2026-03-01T00:00:00Z').getTime());
    expect(nextCard(db, now)?.id).toBe('tip:testland:r');
  });

  it('stops introducing new cards after the daily limit', () => {
    const db = deck(NEW_PER_DAY + 2);
    const now = at('2026-01-01T12:00:00Z');
    for (let i = 0; i < NEW_PER_DAY; i += 1) {
      const card = nextCard(db, now);
      answerCard(db, card!.id, { answer: 'TL', ...fast }, now);
    }
    expect(queueCounts(db, now).newLeft).toBe(0);
    expect(nextCard(db, now)).toBeNull();
  });

  it('brings back a missed card within the learn-ahead window', () => {
    const db = deck(1);
    const now = at('2026-01-01T12:00:00Z');
    const result = answerCard(db, 'tip:testland:t0', { answer: 'XX', ...fast }, now);
    expect(result?.correct).toBe(false);
    expect(nextCard(db, now)?.id).toBe('tip:testland:t0');
  });

  it('skips suspended cards', () => {
    const db = deck(1);
    setSuspended(db, 'tip:testland:t0', true);
    // With no active country-level cards left, the region tip has no prerequisite.
    expect(nextCard(db, at('2026-01-01T12:00:00Z'))?.id).toBe('tip:testland:r');
    setSuspended(db, 'tip:testland:r', true);
    expect(nextCard(db, at('2026-01-01T12:00:00Z'))).toBeNull();
  });
});

describe('answerCard', () => {
  it('records the review and schedules a correct answer days ahead', () => {
    const db = deck(1);
    const now = at('2026-01-01T12:00:00Z');
    const result = answerCard(db, 'tip:testland:t0', { answer: 'TL', ...fast }, now);

    expect(result?.correct).toBe(true);
    expect(new Date(result!.dueAt).getTime() - now.getTime()).toBeGreaterThan(24 * 3600_000);
    expect(queueCounts(db, now)).toMatchObject({ due: 0, reviewedToday: 1 });
  });

  it('keeps multiple choice after one success and switches to the map after two', () => {
    const db = deck(1);
    const first = answerCard(db, 'tip:testland:t0', { answer: 'TL', ...fast }, at('2026-01-01T12:00:00Z'));
    const second = new Date(first!.dueAt);
    expect(nextCard(db, second)).toMatchObject({ id: 'tip:testland:t0', mode: 'choice', reps: 1 });

    const next = answerCard(db, 'tip:testland:t0', { answer: 'TL', ...fast }, second);
    expect(nextCard(db, new Date(next!.dueAt))).toMatchObject({ id: 'tip:testland:t0', mode: 'map', reps: 2 });
  });

  it('returns null for an unknown card', () => {
    expect(answerCard(deck(), 'tip:nope:x', { answer: 'TL', ...fast }, new Date())).toBeNull();
  });
});
