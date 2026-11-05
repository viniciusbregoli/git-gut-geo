import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGuideIndex, parseGuidePage } from './parse.ts';

const page = readFileSync(new URL('./fixtures/guide-page.html', import.meta.url), 'utf8');

describe('parseGuidePage', () => {
  const guide = parseGuidePage(page);

  it('reads the guide metadata', () => {
    expect(guide).toMatchObject({
      slug: 'testland',
      title: 'Testland',
      code: 'TL',
      continent: 'Europe',
      updatedAt: '2026-01-02T00:00:00.000Z',
      sourceUrl: 'https://www.plonkit.net/testland',
    });
  });

  it('keeps image tips and drops images, moving-only and imageless tips', () => {
    expect(guide.tips.map((t) => t.id)).toEqual(['t1', 't2', 't5']);
  });

  it('assigns tiers from the section title', () => {
    expect(guide.tips.map((t) => t.tier)).toEqual(['country', 'country', 'region']);
  });

  it('classifies tips and trims empty paragraphs', () => {
    const [plate, bollard, north] = guide.tips;
    expect(plate).toMatchObject({ clueType: 'plates', text: ['Testland plates have a **purple strip**.'] });
    expect(bollard).toMatchObject({ clueType: 'bollard', tags: ['bollard'] });
    expect(north).toMatchObject({ clueType: 'vegetation', section: 'Region-specific clues' });
  });

  it('rejects a page without embedded data', () => {
    expect(() => parseGuidePage('<html></html>')).toThrow('__PRELOADED_DATA__');
  });
});

describe('parseGuideIndex', () => {
  it('maps entries and drops malformed ones', () => {
    const index = parseGuideIndex({
      success: true,
      data: [
        { title: 'Testland', slug: 'testland', code: 'TL', cat: ['Europe'], updatedAt: '2026-01-02T00:00:00.000Z' },
        { title: 'Broken', slug: 42 },
        null,
        'not an object',
      ],
    });
    expect(index).toEqual([
      { title: 'Testland', slug: 'testland', code: 'TL', continent: 'Europe', updatedAt: '2026-01-02T00:00:00.000Z' },
    ]);
  });

  it('rejects a response without data', () => {
    expect(() => parseGuideIndex({ success: false })).toThrow('no data array');
  });
});
