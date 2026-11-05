import { Check, ExternalLink, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { AnswerResponse } from '../../../shared/api.ts';
import { Key } from '../components/Key.tsx';
import { inlineMarkdown } from '../lib/markdown.tsx';

function untilText(dueAt: string, now = Date.now()): string {
  const minutes = Math.round((new Date(dueAt).getTime() - now) / 60_000);
  if (minutes < 60) return `in ${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

interface Props {
  result: AnswerResponse;
  pickedName: string | null;
  onNext: () => void;
  onSuspend: () => void;
}

export function Reveal({ result, pickedName, onNext, onSuspend }: Props) {
  const { correct, correctCountry, tip } = result;
  const nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => nextButton.current?.focus({ preventScroll: true }), []);
  return (
    <section className={`reveal${correct ? ' reveal--correct' : ' reveal--wrong'}`} aria-live="polite">
      <div className="reveal__verdict">
        {correct ? <Check aria-hidden size={22} /> : <X aria-hidden size={22} />}
        <h2>{correctCountry.name}</h2>
        <p className="reveal__note">
          {correct ? 'Correct' : pickedName ? `You answered ${pickedName}` : 'Revealed'} · next review{' '}
          {untilText(result.dueAt)}
        </p>
      </div>
      <div className="reveal__tip">
        {tip.text.map((paragraph, i) => (
          <p key={i}>{inlineMarkdown(paragraph)}</p>
        ))}
      </div>
      <div className="reveal__footer">
        <a className="reveal__source" href={tip.sourceUrl} target="_blank" rel="noreferrer">
          Plonk It · {tip.countryName} guide · {tip.section}
          <ExternalLink aria-hidden size={14} />
        </a>
        <div className="reveal__actions">
          <button type="button" className="button button--quiet" onClick={onSuspend}>
            Suspend card <Key>S</Key>
          </button>
          <button ref={nextButton} type="button" className="button button--primary" onClick={onNext}>
            Next <Key>Space</Key>
          </button>
        </div>
      </div>
    </section>
  );
}
