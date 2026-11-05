import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Guide } from '../../shared/plonkit.ts';
import { isSafeSlug } from './parse.ts';
import { fileStore } from './store.ts';

const guide = (slug: string): Guide => ({
  slug,
  title: 'Testland',
  code: 'TL',
  continent: 'Europe',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sourceUrl: `https://www.plonkit.net/${slug}`,
  tips: [],
});

describe('fileStore', () => {
  it('round-trips guides and leaves no temporary files behind', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ggg-store-'));
    const store = fileStore(root);

    await store.writeGuide(guide('testland'));
    await store.writeImage('/images/testland/a.png', new Uint8Array([1, 2]));

    expect(await store.readGuide('testland')).toEqual(guide('testland'));
    expect(await store.readGuide('missing')).toBeNull();
    expect(await store.hasImage('/images/testland/a.png')).toBe(true);
    expect(readdirSync(join(root, 'guides'))).toEqual(['testland.json']);
  });

  it('refuses slugs that would escape the guides folder', async () => {
    const store = fileStore(mkdtempSync(join(tmpdir(), 'ggg-store-')));
    await expect(store.writeGuide(guide('../outside'))).rejects.toThrow('Unsafe guide slug');
    await expect(store.readGuide('../../etc/passwd')).rejects.toThrow('Unsafe guide slug');
  });
});

describe('isSafeSlug', () => {
  it('accepts Plonk It slugs only', () => {
    expect(isSafeSlug('united-states')).toBe(true);
    expect(isSafeSlug('../x')).toBe(false);
    expect(isSafeSlug('a/b')).toBe(false);
    expect(isSafeSlug('')).toBe(false);
  });
});
