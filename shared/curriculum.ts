import type { ClueType } from './plonkit.ts';

/**
 * Order in which clue types are introduced: the clues that cut the world down
 * fastest first. Driving side and scripts come from the fundamentals deck.
 */
export const CLUE_ORDER: readonly ClueType[] = [
  'coverage',
  'plates',
  'bollard',
  'pole',
  'language',
  'roadline',
  'sign',
  'guardrail',
  'vegetation',
  'landscape',
  'architecture',
  'other',
];

/**
 * ISO codes roughly ordered by how often a country comes up on the official
 * World map, most common first. An approximation of community round counts,
 * used only to order new cards; unlisted countries follow alphabetically.
 */
export const COUNTRY_FREQUENCY: readonly string[] = [
  'US', 'BR', 'RU', 'CA', 'AU', 'JP', 'FR', 'MX', 'AR', 'ZA', 'IN', 'ES', 'ID', 'TR',
  'GB', 'DE', 'IT', 'TH', 'CL', 'PL', 'SE', 'NO', 'FI', 'CO', 'PE', 'MY', 'PH', 'NZ',
  'UA', 'RO', 'KZ', 'KE', 'NG', 'PT', 'BD', 'MN', 'TW', 'KR', 'VN', 'KH', 'LA', 'LK',
  'IE', 'NL', 'BE', 'CZ', 'SK', 'HU', 'AT', 'CH', 'DK', 'GR', 'BG', 'RS', 'HR', 'EE',
  'LV', 'LT', 'IL', 'AE', 'JO', 'EC', 'BO', 'UY', 'GT', 'BW', 'GH', 'SN', 'UG', 'RW',
];

export function frequencyRank(code: string): number {
  const rank = COUNTRY_FREQUENCY.indexOf(code);
  return rank === -1 ? COUNTRY_FREQUENCY.length : rank;
}

export function clueRank(type: ClueType): number {
  return CLUE_ORDER.indexOf(type);
}

/**
 * Territories with their own Plonk It guide, by the country they belong to.
 * They share its plates, signs and coverage, so one is never a fair wrong
 * answer for the other. Subdivision codes (US-AK, PT-MA) group by prefix.
 */
const SOVEREIGN: Record<string, string> = {
  AS: 'US', GU: 'US', MP: 'US', PR: 'US', UM: 'US', VI: 'US',
  BM: 'GB', FK: 'GB', GI: 'GB', GS: 'GB', IM: 'GB', IO: 'GB', JE: 'GB', PN: 'GB',
  CC: 'AU', CX: 'AU',
  FO: 'DK', GL: 'DK',
  MQ: 'FR', PM: 'FR', RE: 'FR',
  CW: 'NL',
  SJ: 'NO',
  HK: 'CN', MO: 'CN',
};

/** The country a code belongs to: itself, or the sovereign of a territory or subdivision. */
export function sovereignOf(code: string): string {
  const base = code.split('-')[0] ?? code;
  return SOVEREIGN[base] ?? base;
}
