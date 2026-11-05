import type { ReactNode } from 'react';

/** A keyboard shortcut chip. */
export function Key({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <kbd className="key" aria-label={label}>
      {children}
    </kbd>
  );
}
