import { useId, useMemo, useState } from 'react';
import type { Country } from '../../../shared/deck.ts';

interface Props {
  countries: Country[];
  onPick: (code: string) => void;
  disabled?: boolean;
}

function matches(countries: Country[], query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = countries.filter((c) => c.name.toLowerCase().startsWith(q));
  const contains = countries.filter((c) => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, 6);
}

/** Type-ahead country answer: the keyboard path for cards answered on the map. */
export function CountrySearch({ countries, onPick, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => matches(countries, query), [countries, query]);

  const pick = (country: Country | undefined) => {
    if (!country) return;
    onPick(country.code);
  };

  return (
    <div className="search">
      <input
        className="search__input"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${results[active].code}` : undefined}
        aria-label="Type the country"
        placeholder="Type the country…"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, results.length - 1));
          else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
          else if (e.key === 'Enter') pick(results[active]);
          else if (e.key === 'Escape') setQuery('');
          else return;
          e.preventDefault();
        }}
      />
      {results.length > 0 && (
        <ul className="search__list" id={listId} role="listbox" aria-label="Countries">
          {results.map((country, i) => (
            <li
              key={country.code}
              id={`${listId}-${country.code}`}
              role="option"
              aria-selected={i === active}
              className={`search__option${i === active ? ' search__option--active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(country);
              }}
            >
              {country.name}
              <span className="search__continent">{country.continent}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
