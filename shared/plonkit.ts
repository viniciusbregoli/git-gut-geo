/** Clue categories used by the trainer's curriculum. */
export const CLUE_TYPES = [
  'coverage',
  'plates',
  'bollard',
  'pole',
  'roadline',
  'language',
  'sign',
  'guardrail',
  'vegetation',
  'landscape',
  'architecture',
  'other',
] as const;

export type ClueType = (typeof CLUE_TYPES)[number];

/** "country" tips identify the country; "region" tips narrow it down inside one. */
export type SectionTier = 'country' | 'region';

export interface GuideIndexEntry {
  slug: string;
  title: string;
  code: string;
  continent: string;
  updatedAt: string;
}

export interface Tip {
  /** Plonk It's id for the tip, unique within its guide. */
  id: string;
  tier: SectionTier;
  section: string;
  clueType: ClueType;
  /** Plonk It's own tags, verbatim. Most tips have none. */
  tags: string[];
  /** Paragraphs in Plonk It's markdown flavour (bold with **). */
  text: string[];
  /** Site-relative image path on plonkit.net, e.g. /images/portugal/x.png. */
  imageUrl: string;
}

export interface Guide extends GuideIndexEntry {
  sourceUrl: string;
  tips: Tip[];
}
