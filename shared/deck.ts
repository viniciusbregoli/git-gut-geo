import type { ClueType, SectionTier } from './plonkit.ts';

export interface Country {
  code: string;
  name: string;
  continent: string;
}

/** A region of an image as fractions of its size, from the top left. */
export interface Box {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** What a tip card stores in `cards.data`. */
export interface TipCardData {
  guideSlug: string;
  countryName: string;
  section: string;
  text: string[];
  imageUrl: string;
  /** Parts of the image that give the answer away, hidden until the reveal. */
  covers?: Box[];
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
