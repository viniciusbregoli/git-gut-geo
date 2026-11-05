import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Country } from '../shared/deck.ts';
import type { Guide, GuideIndexEntry } from '../shared/plonkit.ts';

/** Loads every guide `pnpm fetch:plonkit` wrote; an empty list before the first fetch. */
export function loadGuides(dir: string): Guide[] {
  let files: string[];
  try {
    files = readdirSync(join(dir, 'guides')).filter((f) => f.endsWith('.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return files.map((f) => JSON.parse(readFileSync(join(dir, 'guides', f), 'utf8')) as Guide);
}

/**
 * Every country Plonk It covers, from the guide index, so answers and the
 * country search include countries whose guides are not fetched yet.
 */
export function loadCountries(dir: string, guides: Guide[]): Country[] {
  let index: GuideIndexEntry[];
  try {
    index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as GuideIndexEntry[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    index = guides;
  }
  return index
    .map((g) => ({ code: g.code, name: g.title, continent: g.continent }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
