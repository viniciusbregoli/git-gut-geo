import { DefaultScheduler, Rating, type DefaultSchedulerCard } from 'ts-fsrs';

export type FsrsCard = DefaultSchedulerCard;

const scheduler = await DefaultScheduler({ desiredRetention: 0.9, enableFuzz: true });

/** Answers slower than this still count as correct, but as "Hard". */
export const SLOW_ANSWER_MS = 20_000;

/** Days of stability after which a card counts as mature (the Anki convention). */
export const MATURE_STABILITY_DAYS = 21;

export function newFsrsCard(now: Date): FsrsCard {
  return scheduler.newCard({ now });
}

export function gradeFor(correct: boolean, durationMs: number) {
  if (!correct) return Rating.Again;
  return durationMs > SLOW_ANSWER_MS ? Rating.Hard : Rating.Good;
}

export function reviewFsrsCard(card: FsrsCard, correct: boolean, durationMs: number, now: Date): FsrsCard {
  return scheduler.review({ card, grade: gradeFor(correct, durationMs), now }).card;
}

export function serializeFsrsCard(card: FsrsCard): string {
  return JSON.stringify(card);
}

// The scheduler rejects cards whose time fields are strings, so JSON needs reviving.
export function parseFsrsCard(json: string): FsrsCard {
  const raw = JSON.parse(json) as FsrsCard & { dueAt: string; lastReviewAt: string | null };
  return {
    ...raw,
    dueAt: new Date(raw.dueAt),
    lastReviewAt: raw.lastReviewAt === null ? null : new Date(raw.lastReviewAt),
  };
}
