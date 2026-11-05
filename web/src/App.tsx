import { useState } from 'react';
import type { QueueCounts } from '../../shared/api.ts';
import { TopBar } from './components/TopBar.tsx';
import { ReviewScreen } from './review/ReviewScreen.tsx';

export function App() {
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  return (
    <div className="app">
      <TopBar counts={counts} />
      <ReviewScreen onCounts={setCounts} />
    </div>
  );
}
