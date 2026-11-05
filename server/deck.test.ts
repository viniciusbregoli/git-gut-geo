import { describe, expect, it } from 'vitest';
import { openDb } from './db.ts';
import { cardsFrom, syncDeck } from './deck.ts';
import { guide, tip } from './testing/guides.ts';
import type { Box } from '../shared/deck.ts';
import type { Verdict } from '../scripts/plonkit/vision.ts';

const guides = [
  guide('testland', 'TL', 'Europe', [
    tip('a', 'Look at the trees.'),
    tip('b', 'Plates are purple.'),
    tip('c', 'Northern plates are green.', { tier: 'region' }),
  ]),
  guide('brazil', 'BR', 'South America', [tip('d', 'Plates are grey.')]),
];

describe('cardsFrom', () => {
  it('orders by tier, clue type, country frequency, then guide order', () => {
    expect(cardsFrom(guides).map((c) => c.id)).toEqual([
      'tip:brazil:d', // plates, and Brazil is more common than Testland
      'tip:testland:b', // plates
      'tip:testland:a', // vegetation
      'tip:testland:c', // region tier last
    ]);
  });

  const verdict = (giveaway: boolean, covers: Box[] = []): Verdict => ({ giveaway, reason: '', covers, model: 'm', prompt: 2 });
  const corner = { top: 0.6, left: 0.7, bottom: 1, right: 1 };

  it('leaves out tips whose whole image gives the answer away', () => {
    const ids = cardsFrom(guides, new Map([['/images/test/b.png', verdict(true)]])).map((c) => c.id);
    expect(ids).not.toContain('tip:testland:b');
    expect(ids).toHaveLength(3);
  });

  it('keeps tips whose giveaway can be covered, with the covers on the card', () => {
    const verdicts = new Map([
      ['/images/test/b.png', verdict(true, [corner])],
      ['/images/test/a.png', verdict(false)],
    ]);
    const cards = cardsFrom(guides, verdicts);
    expect(cards.find((c) => c.id === 'tip:testland:b')?.data.covers).toEqual([corner]);
    expect(cards.find((c) => c.id === 'tip:testland:a')?.data.covers).toBeUndefined();
  });

  it('reclassifies tips from their text instead of trusting the stored type', () => {
    expect(cardsFrom(guides).find((c) => c.id === 'tip:testland:a')?.clueType).toBe('vegetation');
  });
});

describe('syncDeck', () => {
  it('inserts cards and retires ones whose tip disappeared, keeping them', () => {
    const db = openDb(':memory:');
    expect(syncDeck(db, guides)).toEqual({ cards: 4, retired: 0 });

    const [testland, brazil] = guides;
    const fewer = [{ ...testland!, tips: testland!.tips.slice(0, 1) }, brazil!];
    expect(syncDeck(db, fewer)).toEqual({ cards: 2, retired: 2 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM cards').get()).toEqual({ n: 4 });

    expect(syncDeck(db, guides).retired).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM cards WHERE retired = 1').get()).toEqual({ n: 0 });
  });
});
