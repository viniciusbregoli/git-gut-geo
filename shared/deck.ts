import type { ClueType, SectionTier } from './plonkit.ts';

export interface Country {
  code: string;
  name: string;
  continent: string;
}

/** What a tip card stores in `cards.data`. */
export interface TipCardData {
  guideSlug: string;
  countryName: string;
  section: string;
  text: string[];
  imageUrl: string;
  sourceUrl: string;
}

export interface DeckCard {
  id: string;
  kind: 'tip';
  countryCode: string;
  clueType: ClueType;
  tier: SectionTier;
  data: TipCardData;
}
