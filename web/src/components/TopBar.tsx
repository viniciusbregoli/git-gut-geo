import type { QueueCounts } from '../../../shared/api.ts';
import { Key } from './Key.tsx';

function sessionProgress(counts: QueueCounts | null) {
  if (!counts) return null;
  const total = counts.reviewedToday + counts.due + counts.newLeft;
  return { done: counts.reviewedToday, total, left: counts.due + counts.newLeft };
}

export function TopBar({ counts }: { counts: QueueCounts | null }) {
  const progress = sessionProgress(counts);
  const ratio = progress && progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <header className="topbar">
      <span className="topbar__logo">git-gut-geo</span>
      <nav className="topbar__nav" aria-label="Main">
        <a className="tab tab--active" href="/" aria-current="page">
          Review <Key>R</Key>
        </a>
      </nav>
      {progress && progress.total > 0 && (
        <p className="topbar__count">
          {progress.left > 0 ? (
            <>
              Card <b>{Math.min(progress.done + 1, progress.total)}</b> of <b>{progress.total}</b> ·{' '}
              <b>{progress.left}</b> left
            </>
          ) : (
            <>
              <b>{progress.done}</b> reviewed today
            </>
          )}
        </p>
      )}
      <div
        className="topbar__progress"
        role="progressbar"
        aria-label="Today's session"
        aria-valuemin={0}
        aria-valuemax={progress?.total ?? 0}
        aria-valuenow={progress?.done ?? 0}
        style={{ transform: `scaleX(${ratio})` }}
      />
    </header>
  );
}
