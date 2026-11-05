import type { Country } from '../shared/deck.ts';

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32), so a card shows the same options until it is answered. */
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Four answer options: the correct country plus three wrong ones. Wrong options
 * come from the same continent, preferring countries that share the clue type,
 * so the answer cannot be found by ruling out the obvious.
 */
export function pickOptions(correct: Country, all: Country[], sharesClue: Set<string>, seed: string): Country[] {
  const random = rng(seed);
  // Plonk It has separate guides for territories (PT-MA, Madeira); never offer one as a wrong answer for its country.
  const base = (code: string) => code.split('-')[0];
  const others = all.filter((c) => base(c.code) !== base(correct.code));
  const tiers = [
    others.filter((c) => c.continent === correct.continent && sharesClue.has(c.code)),
    others.filter((c) => c.continent === correct.continent && !sharesClue.has(c.code)),
    others.filter((c) => c.continent !== correct.continent && sharesClue.has(c.code)),
    others.filter((c) => c.continent !== correct.continent && !sharesClue.has(c.code)),
  ];

  const wrong: Country[] = [];
  for (const tier of tiers) {
    for (const country of shuffled(tier, random)) {
      if (wrong.length === 3) break;
      wrong.push(country);
    }
  }
  return shuffled([correct, ...wrong], random);
}
