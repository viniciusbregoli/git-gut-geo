import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadGuides } from './content.ts';
import { guide } from './testing/guides.ts';

describe('loadGuides', () => {
  it('returns no guides before the first fetch', () => {
    expect(loadGuides(join(tmpdir(), 'ggg-does-not-exist'))).toEqual([]);
  });

  it('reads every guide file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ggg-'));
    mkdirSync(join(dir, 'guides'));
    writeFileSync(join(dir, 'guides', 'testland.json'), JSON.stringify(guide('testland', 'TL', 'Europe', [])));
    writeFileSync(join(dir, 'guides', 'notes.txt'), 'ignored');
    expect(loadGuides(dir).map((g) => g.slug)).toEqual(['testland']);
  });
});
