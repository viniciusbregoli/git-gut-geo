import type { Country } from '../../../shared/deck.ts';
import { Key } from '../components/Key.tsx';

interface Props {
  options: Country[];
  onPick: (code: string) => void;
  /** After the answer: the correct code and what was picked. */
  outcome?: { correct: string; picked: string };
  disabled?: boolean;
}

export function Choices({ options, onPick, outcome, disabled }: Props) {
  return (
    <div className="choices" role="group" aria-label="Answers">
      {options.map((country, i) => {
        const state = !outcome
          ? ''
          : country.code === outcome.correct
            ? ' choice--correct'
            : country.code === outcome.picked
              ? ' choice--wrong'
              : ' choice--dim';
        return (
          <button
            key={country.code}
            type="button"
            className={`choice${state}`}
            disabled={disabled || Boolean(outcome)}
            onClick={() => onPick(country.code)}
          >
            <Key>{i + 1}</Key>
            <span>{country.name}</span>
          </button>
        );
      })}
    </div>
  );
}
