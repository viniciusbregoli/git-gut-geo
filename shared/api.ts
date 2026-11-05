import type { Country } from './deck.ts';
import type { ClueType, SectionTier } from './plonkit.ts';

export type AnswerMode = 'choice' | 'map';

export interface QueueCounts {
  due: number;
  newLeft: number;
  reviewedToday: number;
}

/** A card as the review screen sees it: nothing that gives the answer away. */
export interface ReviewCard {
  id: string;
  clueType: ClueType;
  tier: SectionTier;
  mode: AnswerMode;
  isNew: boolean;
  imageUrl: string;
  /** Only for multiple choice. */
  options?: Country[];
}

export interface SessionResponse {
  counts: QueueCounts;
  card: ReviewCard | null;
}

export interface AnswerRequest {
  answer: string;
  durationMs: number;
  mode: AnswerMode;
}

export interface RevealedTip {
  countryName: string;
  section: string;
  text: string[];
  sourceUrl: string;
}

export interface AnswerResponse {
  correct: boolean;
  correctCountry: Country;
  tip: RevealedTip;
  dueAt: string;
  counts: QueueCounts;
}
