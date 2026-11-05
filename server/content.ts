import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Guide } from '../shared/plonkit.ts';

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
