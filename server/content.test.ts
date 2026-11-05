import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCountries, loadGiveaways, loadGuides } from './content.ts';
import { guide } from './testing/guides.ts';

describe('loadGuides', () => {
  it('returns no guides before the first fetch', () => {
    expect(loadGuides(join(tmpdir(), 'ggg-does-not-exist'))).toEqual([]);
  });

  it('reads every country guide file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ggg-'));
    mkdirSync(join(dir, 'guides'));
    writeFileSync(join(dir, 'guides', 'testland.json'), JSON.stringify(guide('testland', 'TL', 'Europe', [])));
    writeFileSync(join(dir, 'guides', 'beginners.json'), JSON.stringify(guide('beginners', 'XX-BEGINNERS', 'General Guide', [])));
    writeFileSync(join(dir, 'guides', 'notes.txt'), 'ignored');
    expect(loadGuides(dir).map((g) => g.slug)).toEqual(['testland']);
  });
});

describe('loadCountries', () => {
  it('lists every indexed country, not just fetched ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ggg-'));
    const index = [
      { slug: 'b', title: 'Bland', code: 'BL', continent: 'Asia', updatedAt: '' },
      { slug: 'a', title: 'Aland', code: 'AL', continent: 'Europe', updatedAt: '' },
      { slug: 'maps', title: 'Map directory', code: 'XX-MAPS', continent: 'General Guide', updatedAt: '' },
    ];
    writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
    expect(loadCountries(dir, []).map((c) => c.code)).toEqual(['AL', 'BL']);
  });

  it('falls back to the fetched guides without an index', () => {
    const guides = [guide('testland', 'TL', 'Europe', [])];
    expect(loadCountries(join(tmpdir(), 'ggg-none'), guides)).toEqual([{ code: 'TL', name: 'Testland', continent: 'Europe' }]);
  });
});

describe('loadGiveaways', () => {
  it('returns nothing before images are checked', () => {
    expect(loadGiveaways(join(tmpdir(), 'ggg-none')).size).toBe(0);
  });

  it('returns only the images judged to be giveaways', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ggg-'));
    const verdict = (giveaway: boolean) => ({ giveaway, reason: '', model: 'm' });
    writeFileSync(join(dir, 'vision.json'), JSON.stringify({ '/images/a.png': verdict(true), '/images/b.png': verdict(false) }));
    expect([...loadGiveaways(dir)]).toEqual(['/images/a.png']);
  });
});
