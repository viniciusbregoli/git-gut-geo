import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Guide, GuideIndexEntry } from '../../shared/plonkit.ts';
import { imageDownloadUrl, isSafeImagePath, syncGuides, type GuideStore, type SyncDeps } from './sync.ts';

const page = readFileSync(new URL('./fixtures/guide-page.html', import.meta.url), 'utf8');

const entry = (slug: string, updatedAt = '2026-01-02T00:00:00.000Z'): GuideIndexEntry => ({
  slug,
  title: slug,
  code: 'TL',
  continent: 'Europe',
  updatedAt,
});

function memoryStore(guides: Guide[] = []): GuideStore & { images: Set<string>; guides: Map<string, Guide> } {
  const byslug = new Map(guides.map((g) => [g.slug, g]));
  const images = new Set<string>();
  return {
    guides: byslug,
    images,
    readIndex: async () => null,
    writeIndex: async () => {},
    readGuide: async (slug) => byslug.get(slug) ?? null,
    writeGuide: async (guide) => void byslug.set(guide.slug, guide),
    hasImage: async (url) => images.has(url),
    writeImage: async (url) => void images.add(url),
  };
}

function deps(index: GuideIndexEntry[], store: GuideStore, pages: Record<string, string> = {}) {
  const requests: string[] = [];
  const sleeps: number[] = [];
  const d: SyncDeps = {
    fetchJson: async () => ({ success: true, data: index }),
    fetchText: async (url) => {
      requests.push(url);
      const html = pages[url];
      if (html === undefined) throw new Error('HTTP 500');
      return html;
    },
    fetchBytes: async (url) => {
      requests.push(url);
      if (url.includes('missing')) throw new Error('HTTP 404');
      return new Uint8Array([1]);
    },
    sleep: async (ms) => void sleeps.push(ms),
    store,
    log: () => {},
  };
  return { d, requests, sleeps };
}

const options = { pageDelayMs: 2000, imageDelayMs: 250 };

describe('syncGuides', () => {
  it('fetches a new guide and its images, pausing between requests', async () => {
    const store = memoryStore();
    const { d, sleeps } = deps([entry('testland')], store, { 'https://www.plonkit.net/testland': page });

    const result = await syncGuides(d, options);

    expect(result).toMatchObject({ fetched: ['testland'], skipped: [], failed: [], images: 3, imageFailures: 0 });
    expect(store.guides.get('testland')?.tips).toHaveLength(3);
    expect([...store.images]).toContain('/images/testland/plate.png');
    expect(sleeps).toEqual([250, 250, 250]);
  });

  it('skips guides whose updatedAt is unchanged', async () => {
    const local = { ...entry('testland'), sourceUrl: '', tips: [] };
    const { d, requests } = deps([entry('testland')], memoryStore([local]));

    const result = await syncGuides(d, options);

    expect(result.skipped).toEqual(['testland']);
    expect(requests).toEqual([]);
  });

  it('re-fetches a changed guide and does not re-download images it has', async () => {
    const local = { ...entry('testland', '2025-01-01T00:00:00.000Z'), sourceUrl: '', tips: [] };
    const store = memoryStore([local]);
    store.images.add('/images/testland/plate.png');
    const { d } = deps([entry('testland')], store, { 'https://www.plonkit.net/testland': page });

    const result = await syncGuides(d, options);

    expect(result).toMatchObject({ fetched: ['testland'], images: 2 });
  });

  it('retries missing images of an unchanged guide without fetching its page', async () => {
    const tip = {
      id: 't1',
      tier: 'country' as const,
      section: 'Identifying Testland',
      clueType: 'plates' as const,
      tags: [],
      text: ['Plates are purple.'],
      imageUrl: '/images/testland/plate.png',
    };
    const store = memoryStore([{ ...entry('testland'), sourceUrl: '', tips: [tip] }]);
    const { d, requests } = deps([entry('testland')], store);

    const result = await syncGuides(d, options);

    expect(result).toMatchObject({ skipped: ['testland'], images: 1 });
    expect(requests).toEqual(['https://www.plonkit.net/images/resize/1920/80/testland/plate.png']);
  });

  it('keeps the guide when one image fails, so the next run retries it', async () => {
    const store = memoryStore();
    const html = page.replace('/images/testland/plate.png', '/images/testland/missing.png');
    const { d } = deps([entry('testland')], store, { 'https://www.plonkit.net/testland': html });

    const result = await syncGuides(d, options);

    expect(result).toMatchObject({ fetched: ['testland'], images: 2, imageFailures: 1 });
    expect(store.images.has('/images/testland/missing.png')).toBe(false);
  });

  it('records a failure and keeps going', async () => {
    const store = memoryStore();
    const index = [entry('broken'), entry('testland')];
    const { d, sleeps } = deps(index, store, { 'https://www.plonkit.net/testland': page });

    const result = await syncGuides(d, options);

    expect(result.failed).toEqual([{ slug: 'broken', error: 'HTTP 500' }]);
    expect(result.fetched).toEqual(['testland']);
    expect(sleeps[0]).toBe(2000);
    expect(store.guides.has('broken')).toBe(false);
  });

  it('limits the run to the requested slugs', async () => {
    const { d, requests } = deps([entry('a'), entry('testland')], memoryStore(), {
      'https://www.plonkit.net/testland': page,
    });

    await syncGuides(d, { ...options, only: ['testland'] });

    expect(requests.filter((r) => !r.includes('/images/'))).toEqual(['https://www.plonkit.net/testland']);
  });
});

describe('imageDownloadUrl', () => {
  it('uses the resize endpoint the site itself serves pages with', () => {
    expect(imageDownloadUrl('/images/portugal/licenceplate.png')).toBe(
      'https://www.plonkit.net/images/resize/1920/80/portugal/licenceplate.png',
    );
  });
});

describe('isSafeImagePath', () => {
  it('accepts site image paths and rejects traversal or absolute URLs', () => {
    expect(isSafeImagePath('/images/portugal/licenceplate.png')).toBe(true);
    expect(isSafeImagePath('/images/../etc/passwd')).toBe(false);
    expect(isSafeImagePath('https://evil.example/x.png')).toBe(false);
  });
});
