import { describe, expect, it } from 'vitest';
import type { Country } from '../shared/deck.ts';
import { pickOptions } from './options.ts';

const c = (code: string, continent: string): Country => ({ code, name: code, continent });
const world = [
  c('CZ', 'Europe'), c('SK', 'Europe'), c('PL', 'Europe'), c('HU', 'Europe'), c('AT', 'Europe'),
  c('BR', 'South America'), c('AR', 'South America'), c('JP', 'Asia'),
];

describe('pickOptions', () => {
  it('returns the answer plus three distinct wrong options', () => {
    const options = pickOptions(world[0]!, world, new Set(), 'seed');
    expect(options).toHaveLength(4);
    expect(new Set(options.map((o) => o.code)).size).toBe(4);
    expect(options.map((o) => o.code)).toContain('CZ');
  });

  it('prefers same-continent countries that share the clue type', () => {
    const options = pickOptions(world[0]!, world, new Set(['SK', 'PL', 'HU', 'BR']), 'seed');
    expect(options.map((o) => o.code).sort()).toEqual(['CZ', 'HU', 'PL', 'SK']);
  });

  it('falls back to other continents when the continent runs out', () => {
    const options = pickOptions(world[6]!, world, new Set(), 'seed');
    expect(options.map((o) => o.continent)).toContain('Europe');
  });

  it('never offers a territory of the correct country, or the country of a territory', () => {
    const withTerritory = [...world, c('CZ-XY', 'Europe')];
    expect(pickOptions(world[0]!, withTerritory, new Set(['CZ-XY']), 'seed').map((o) => o.code)).not.toContain('CZ-XY');
    expect(pickOptions(c('CZ-XY', 'Europe'), withTerritory, new Set(), 'seed').map((o) => o.code)).not.toContain('CZ');
  });

  it('is stable for the same seed', () => {
    const a = pickOptions(world[0]!, world, new Set(), 'card:1').map((o) => o.code);
    const b = pickOptions(world[0]!, world, new Set(), 'card:1').map((o) => o.code);
    expect(a).toEqual(b);
  });
});
