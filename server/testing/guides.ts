import type { Guide, Tip } from '../../shared/plonkit.ts';

/** Synthetic guides for tests. Not real Plonk It content. */
export function tip(id: string, text: string, overrides: Partial<Tip> = {}): Tip {
  return {
    id,
    tier: 'country',
    section: 'Identifying',
    clueType: 'other',
    tags: [],
    text: [text],
    imageUrl: `/images/test/${id}.png`,
    ...overrides,
  };
}

export function guide(slug: string, code: string, continent: string, tips: Tip[]): Guide {
  return {
    slug,
    code,
    title: slug[0]?.toUpperCase() + slug.slice(1),
    continent,
    updatedAt: '2026-01-01T00:00:00.000Z',
    sourceUrl: `https://www.plonkit.net/${slug}`,
    tips,
  };
}
