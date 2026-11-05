import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import type { AnswerRequest, AnswerResponse, ReviewCard, SessionResponse } from '../shared/api.ts';
import type { Country } from '../shared/deck.ts';
import { isSafeImagePath } from '../scripts/plonkit/sync.ts';
import type { Db } from './db.ts';
import { pickOptions } from './options.ts';
import { answerCard, countriesSharingClue, nextCard, queueCounts, setSuspended } from './queue.ts';

export interface AppDeps {
  db: Db;
  countries: Country[];
  /** Root of the fetched content, e.g. data/plonkit. */
  contentDir: string;
  now?: () => Date;
}

function isAnswerRequest(body: unknown): body is AnswerRequest {
  const b = body as Partial<AnswerRequest> | null;
  return (
    typeof b?.answer === 'string' &&
    typeof b.durationMs === 'number' &&
    Number.isFinite(b.durationMs) &&
    b.durationMs >= 0 &&
    (b.mode === 'choice' || b.mode === 'map')
  );
}

export function createApp(deps: AppDeps) {
  const { db, countries, contentDir } = deps;
  const now = deps.now ?? (() => new Date());
  const byCode = new Map(countries.map((c) => [c.code, c]));
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/countries', (c) => c.json(countries));

  app.get('/api/session', (c) => {
    const at = now();
    const queued = nextCard(db, at);
    let card: ReviewCard | null = null;

    if (queued) {
      card = {
        id: queued.id,
        clueType: queued.clueType,
        tier: queued.tier,
        mode: queued.mode,
        isNew: queued.isNew,
        imageUrl: `/api/images${queued.data.imageUrl}`,
      };
      const correct = byCode.get(queued.countryCode);
      if (queued.mode === 'choice' && correct) {
        const shares = countriesSharingClue(db, queued.clueType, queued.countryCode);
        card.options = pickOptions(correct, countries, shares, `${queued.id}:${queued.reps}`);
      }
    }

    return c.json({ counts: queueCounts(db, at), card } satisfies SessionResponse);
  });

  app.post('/api/cards/:id/answer', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!isAnswerRequest(body)) return c.json({ error: 'Expected { answer, durationMs, mode }' }, 400);

    const id = c.req.param('id');
    const at = now();
    const result = answerCard(db, id, body, at);
    if (!result) return c.json({ error: 'Unknown card' }, 404);

    const row = db.prepare('SELECT data FROM cards WHERE id = ?').get(id) as { data: string };
    const data = JSON.parse(row.data) as { countryName: string; section: string; text: string[]; sourceUrl: string };
    const correctCountry = byCode.get(result.correctCountry) ?? {
      code: result.correctCountry,
      name: data.countryName,
      continent: 'Unknown',
    };

    return c.json({
      correct: result.correct,
      correctCountry,
      tip: { countryName: data.countryName, section: data.section, text: data.text, sourceUrl: data.sourceUrl },
      dueAt: result.dueAt,
      counts: queueCounts(db, at),
    } satisfies AnswerResponse);
  });

  app.post('/api/cards/:id/suspend', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { suspended?: unknown } | null;
    if (typeof body?.suspended !== 'boolean') return c.json({ error: 'Expected { suspended: boolean }' }, 400);
    if (!setSuspended(db, c.req.param('id'), body.suspended)) return c.json({ error: 'Unknown card' }, 404);
    return c.json({ ok: true });
  });

  app.get('/api/images/*', async (c) => {
    const imageUrl = c.req.path.slice('/api'.length);
    if (!isSafeImagePath(imageUrl)) return c.json({ error: 'Not found' }, 404);
    try {
      const bytes = await readFile(join(contentDir, imageUrl));
      // The fetcher stores Plonk It's resized WebP under the original file name.
      return c.body(bytes, 200, { 'Content-Type': 'image/webp', 'Cache-Control': 'max-age=86400' });
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  });

  // Registered last so the static frontend fallback never answers an API path.
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  return app;
}
