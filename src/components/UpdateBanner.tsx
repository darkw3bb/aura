import { useUpdater } from '../hooks/useUpdater';

export function UpdateBanner() {
  const { update, installing, installUpdate, dismiss } = useUpdater();

  if (!update) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-blue-600/90 text-white text-[13px] shrink-0">
      <span>
        Aura {update.version} is available.
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={installUpdate}
          disabled={installing}
          className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {installing ? 'Installing…' : 'Update & Restart'}
        </button>
        <button
          onClick={dismiss}
          className="px-2 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
