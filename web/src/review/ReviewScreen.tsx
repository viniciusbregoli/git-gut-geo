import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnswerResponse, QueueCounts, ReviewCard, SessionResponse } from '../../../shared/api.ts';
import type { Country } from '../../../shared/deck.ts';
import { Key } from '../components/Key.tsx';
import { api } from '../lib/api.ts';
import { useHotkeys } from '../lib/hotkeys.ts';
import { promptFor } from '../lib/prompts.ts';
import { Choices } from './Choices.tsx';
import { CountrySearch } from './CountrySearch.tsx';
import { Reveal } from './Reveal.tsx';

type Phase =
  | { kind: 'loading' }
  | { kind: 'question'; card: ReviewCard; submitting: boolean }
  | { kind: 'revealed'; card: ReviewCard; result: AnswerResponse; picked: string }
  | { kind: 'done'; counts: QueueCounts }
  | { kind: 'error'; message: string };

export function ReviewScreen({ onCounts }: { onCounts: (counts: QueueCounts) => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [countries, setCountries] = useState<Country[]>([]);
  const shownAt = useRef(0);

  const apply = useCallback(
    (session: SessionResponse) => {
      onCounts(session.counts);
      if (session.card) {
        shownAt.current = performance.now();
        setPhase({ kind: 'question', card: session.card, submitting: false });
      } else {
        setPhase({ kind: 'done', counts: session.counts });
      }
    },
    [onCounts],
  );

  const fail = useCallback((error: unknown) => {
    setPhase({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }, []);

  const load = useCallback(() => api.session().then(apply, fail), [apply, fail]);

  useEffect(() => {
    api.session().then(apply, fail);
    api.countries().then(setCountries, () => setCountries([]));
  }, [apply, fail]);

  const submit = async (answer: string) => {
    if (phase.kind !== 'question' || phase.submitting) return;
    const { card } = phase;
    setPhase({ kind: 'question', card, submitting: true });
    try {
      const result = await api.answer(card.id, {
        answer,
        durationMs: performance.now() - shownAt.current,
        mode: card.mode,
      });
      onCounts(result.counts);
      setPhase({ kind: 'revealed', card, result, picked: answer });
    } catch (error) {
      fail(error);
    }
  };

  const suspend = async () => {
    if (phase.kind !== 'revealed') return;
    await api.suspend(phase.card.id).catch(() => undefined);
    void load();
  };

  const next = () => {
    setPhase({ kind: 'loading' });
    void load();
  };

  const choose = (index: number) => {
    if (phase.kind === 'question' && phase.card.options) {
      const option = phase.card.options[index];
      if (option) void submit(option.code);
    }
  };

  useHotkeys({
    '1': () => choose(0),
    '2': () => choose(1),
    '3': () => choose(2),
    '4': () => choose(3),
    ' ': () => (phase.kind === 'revealed' ? next() : void submit('')),
    Enter: () => phase.kind === 'revealed' && next(),
    s: () => void suspend(),
  });

  if (phase.kind === 'loading') return <main className="review" aria-busy="true" />;

  if (phase.kind === 'error') {
    return (
      <main className="review review--message">
        <h1>Something went wrong</h1>
        <p>{phase.message}. Check that the server is running (`pnpm dev`), then reload.</p>
      </main>
    );
  }

  if (phase.kind === 'done') {
    const empty = phase.counts.cards === 0;
    return (
      <main className="review review--message">
        <h1>{empty ? 'No clues yet' : 'Done for now'}</h1>
        <p>
          {empty
            ? 'Fetch the Plonk It guides with `pnpm fetch:plonkit`, then restart the server.'
            : `${phase.counts.reviewedToday} reviews today. New cards and due reviews come back tomorrow.`}
        </p>
      </main>
    );
  }

  const { card } = phase;
  const revealed = phase.kind === 'revealed' ? phase : null;
  const pickedName =
    revealed && revealed.picked
      ? (countries.find((c) => c.code === revealed.picked)?.name ?? revealed.picked)
      : null;

  return (
    <main className={`review${revealed ? ' review--revealed' : ''}`}>
      <h1 className="review__prompt">{promptFor(card.clueType)}</h1>
      <div className="review__stage">
        <figure className="plate">
          <img key={card.id} src={card.imageUrl} alt="The clue for this card" />
        </figure>
        {!revealed && <p className="review__credit">Clue from Plonk It · CC BY-NC-SA 4.0</p>}

        {card.mode === 'choice' && card.options ? (
          <Choices
            options={card.options}
            onPick={(code) => void submit(code)}
            disabled={phase.kind === 'question' && phase.submitting}
            outcome={revealed ? { correct: revealed.result.correctCountry.code, picked: revealed.picked } : undefined}
          />
        ) : (
          !revealed && (
            <CountrySearch
              countries={countries}
              onPick={(code) => void submit(code)}
              disabled={phase.kind === 'question' && phase.submitting}
            />
          )
        )}

        {!revealed && (
          <p className="review__hint">
            <Key>Space</Key> I don't know, show me
          </p>
        )}
      </div>

      {revealed && (
        <Reveal result={revealed.result} pickedName={pickedName} onNext={next} onSuspend={() => void suspend()} />
      )}
    </main>
  );
}
