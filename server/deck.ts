import { clueRank, frequencyRank } from '../shared/curriculum.ts';
import type { Country, DeckCard } from '../shared/deck.ts';
import type { Guide } from '../shared/plonkit.ts';
import { classifyTip } from '../scripts/plonkit/classify.ts';
import type { Db } from './db.ts';

export const tipCardId = (slug: string, tipId: string) => `tip:${slug}:${tipId}`;

export function countriesFrom(guides: Guide[]): Country[] {
  return guides
    .map((g) => ({ code: g.code, name: g.title, continent: g.continent }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Cards in curriculum order: country-level tips before region-level ones,
 * then by clue type, then by how common the country is, then guide order.
 */
export function cardsFrom(guides: Guide[]): (DeckCard & { position: number })[] {
  const cards = guides.flatMap((guide) =>
    guide.tips.map((tip, index) => {
      // Reclassify on load, so classifier improvements apply without re-fetching.
      const clueType = classifyTip(tip.tags, tip.text);
      const card: DeckCard = {
        id: tipCardId(guide.slug, tip.id),
        kind: 'tip',
        countryCode: guide.code,
        clueType,
        tier: tip.tier,
        data: {
          guideSlug: guide.slug,
          countryName: guide.title,
          section: tip.section,
          text: tip.text,
          imageUrl: tip.imageUrl,
          sourceUrl: guide.sourceUrl,
        },
      };
      const key = [tip.tier === 'country' ? 0 : 1, clueRank(clueType), frequencyRank(guide.code), guide.title, index];
      return { card, key };
    }),
  );

  cards.sort((a, b) => {
    for (let i = 0; i < a.key.length; i += 1) {
      const x = a.key[i] as number | string;
      const y = b.key[i] as number | string;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  });

  return cards.map(({ card }, position) => ({ ...card, position }));
}

/** Upserts the deck and retires cards whose tips no longer exist. Progress is never deleted. */
export function syncDeck(db: Db, guides: Guide[]): { cards: number; retired: number } {
  const cards = cardsFrom(guides);
  const upsert = db.prepare(`
    INSERT INTO cards (id, kind, country_code, clue_type, tier, position, data, retired)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT (id) DO UPDATE SET
      country_code = excluded.country_code, clue_type = excluded.clue_type, tier = excluded.tier,
      position = excluded.position, data = excluded.data, retired = 0
  `);

  db.exec('BEGIN');
  try {
    db.exec("CREATE TEMP TABLE IF NOT EXISTS live (id TEXT PRIMARY KEY); DELETE FROM live;");
    const live = db.prepare('INSERT INTO live (id) VALUES (?)');
    for (const c of cards) {
      upsert.run(c.id, c.kind, c.countryCode, c.clueType, c.tier, c.position, JSON.stringify(c.data));
      live.run(c.id);
    }
    const retired = db
      .prepare("UPDATE cards SET retired = 1 WHERE kind = 'tip' AND retired = 0 AND id NOT IN (SELECT id FROM live)")
      .run().changes;
    db.exec('COMMIT');
    return { cards: cards.length, retired: Number(retired) };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
