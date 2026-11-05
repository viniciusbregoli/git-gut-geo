import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AnswerResponse, SessionResponse } from '../shared/api.ts';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { countriesFrom, syncDeck } from './deck.ts';
import { guide, tip } from './testing/guides.ts';

const guides = [
  guide('testland', 'TL', 'Europe', [tip('t1', 'Plates are purple.')]),
  guide('otherland', 'OL', 'Europe', [tip('o1', 'Plates are orange.')]),
  guide('thirdland', 'HL', 'Europe', [tip('h1', 'Plates are teal.')]),
  guide('farland', 'FL', 'Asia', [tip('f1', 'Plates are grey.')]),
];

function setup() {
  const db = openDb(':memory:');
  syncDeck(db, guides);
  const contentDir = mkdtempSync(join(tmpdir(), 'ggg-'));
  mkdirSync(join(contentDir, 'images', 'test'), { recursive: true });
  writeFileSync(join(contentDir, 'images', 'test', 't1.png'), 'webp-bytes');
  const app = createApp({ db, countries: countriesFrom(guides), contentDir, now: () => new Date('2026-01-01T12:00:00Z') });
  return { app, db };
}

const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('API', () => {
  it('answers the health check', async () => {
    const res = await setup().app.request('/api/health');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('serves the next card with four options and no answer in the payload', async () => {
    const res = await setup().app.request('/api/session');
    const session = (await res.json()) as SessionResponse;

    expect(session.counts).toEqual({ cards: 4, due: 0, newLeft: 4, reviewedToday: 0 });
    expect(session.card).toMatchObject({ mode: 'choice', isNew: true, clueType: 'plates' });
    expect(session.card?.options).toHaveLength(4);
    expect(session.card?.imageUrl).toMatch(/^\/api\/images\/test\/\w+\.png$/);
    expect(JSON.stringify(session.card)).not.toMatch(/purple|orange|teal|grey/);
  });

  it('reveals the answer and tip after an answer', async () => {
    const { app } = setup();
    const { card } = (await (await app.request('/api/session')).json()) as SessionResponse;
    const correct = card!.id.split(':')[1] === 'testland' ? 'TL' : 'XX';

    const res = await app.request(`/api/cards/${card!.id}/answer`, post({ answer: correct, durationMs: 4000, mode: 'choice' }));
    const answer = (await res.json()) as AnswerResponse;

    expect(res.status).toBe(200);
    expect(answer.tip.sourceUrl).toMatch(/^https:\/\/www\.plonkit\.net\//);
    expect(answer.counts.reviewedToday).toBe(1);
  });

  it('rejects malformed answers and unknown cards', async () => {
    const { app } = setup();
    expect((await app.request('/api/cards/tip:testland:t1/answer', post({ answer: 'TL' }))).status).toBe(400);
    const unknown = post({ answer: 'TL', durationMs: 1, mode: 'choice' });
    expect((await app.request('/api/cards/tip:nope:x/answer', unknown)).status).toBe(404);
  });

  it('suspends a card', async () => {
    const { app, db } = setup();
    const res = await app.request('/api/cards/tip:testland:t1/suspend', post({ suspended: true }));
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT suspended FROM cards WHERE id = 'tip:testland:t1'").get()).toEqual({ suspended: 1 });
  });

  it('serves fetched images as WebP and refuses path traversal', async () => {
    const { app } = setup();
    const res = await app.request('/api/images/test/t1.png');
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(await res.text()).toBe('webp-bytes');
    expect((await app.request('/api/images/test/missing.png')).status).toBe(404);
    expect((await app.request('/api/images/..%2F..%2Fsecret')).status).toBe(404);
  });

  it('returns a JSON 404 for unknown API paths', async () => {
    const res = await setup().app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
