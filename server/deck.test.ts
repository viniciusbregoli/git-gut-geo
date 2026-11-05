import { describe, expect, it } from 'vitest';
import { openDb } from './db.ts';
import { cardsFrom, syncDeck } from './deck.ts';
import { guide, tip } from './testing/guides.ts';

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
