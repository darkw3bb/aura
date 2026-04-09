import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePlayerStore } from '../../stores/playerStore';

export function OutputSelector() {
  const {
    maConnected, maPlayers, maOutputId,
    maSetOutput, maRefreshPlayers,
  } = usePlayerStore();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && maConnected) {
      maRefreshPlayers();
    }
  }, [open, maConnected, maRefreshPlayers]);

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.top, left: r.right });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!maConnected) return null;

  const isRemote = maOutputId !== null;
  const activeName = isRemote
    ? maPlayers.find((p) => p.id === maOutputId)?.name ?? 'Speaker'
    : null;

  const itemBase = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-left cursor-pointer border-0';
  const itemActive = `${itemBase} text-themed-accent`;
  const itemInactive = `${itemBase} text-themed-primary`;

  const hoverOn = (e: React.MouseEvent) => { e.currentTarget.style.background = 'var(--bg-hover)'; };
  const hoverOff = (e: React.MouseEvent, active: boolean) => {
    e.currentTarget.style.background = active ? 'var(--bg-tertiary)' : 'transparent';
  };

  return (
    <div className="flex items-center gap-1.5">
      {activeName && (
        <span className="text-[11px] text-themed-accent truncate max-w-24">{activeName}</span>
      )}
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="control-btn p-1.5 rounded cursor-pointer bg-transparent border-0"
        data-active={isRemote}
        title={isRemote ? `Playing on: ${activeName}` : 'Output: This Computer'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isRemote ? (
            <>
              <path d="M2 10.5a8.38 8.38 0 0 1 5-1.5c2.36 0 4.5.97 6 2.5" />
              <path d="M5 14a4.94 4.94 0 0 1 4 2" />
              <line x1="7" y1="18" x2="7.01" y2="18" />
              <path d="M16 8V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
            </>
          ) : (
            <>
              <rect x="4" y="3" width="16" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </>
          )}
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed w-56 rounded-lg shadow-lg border border-themed bg-themed-primary overflow-hidden"
          style={{ top: pos.top, left: pos.left, transform: 'translate(-100%, -100%)', marginTop: -8, zIndex: 9999 }}
        >
          <div className="px-3 py-2 text-xs font-semibold text-themed-muted uppercase tracking-wide">
            Output
          </div>

          <button
            onClick={() => { maSetOutput(null); setOpen(false); }}
            className={!isRemote ? itemActive : itemInactive}
            style={{ background: !isRemote ? 'var(--bg-tertiary)' : 'transparent' }}
            onMouseEnter={hoverOn}
            onMouseLeave={(e) => hoverOff(e, !isRemote)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            This Computer
          </button>

          {maPlayers.length > 0 && (
            <div className="px-3 py-1.5 text-xs font-semibold text-themed-muted uppercase tracking-wide border-t border-themed">
              Speakers
            </div>
          )}

          {maPlayers.map((player) => {
            const active = maOutputId === player.id;
            return (
              <button
                key={player.id}
                onClick={() => { maSetOutput(player.id); setOpen(false); }}
                className={active ? itemActive : itemInactive}
                style={{ background: active ? 'var(--bg-tertiary)' : 'transparent' }}
                onMouseEnter={hoverOn}
                onMouseLeave={(e) => hoverOff(e, active)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                <span className="truncate flex-1">{player.name}</span>
                {!player.available && (
                  <span className="text-[10px] text-themed-muted">offline</span>
                )}
              </button>
            );
          })}

          {maPlayers.length === 0 && (
            <div className="px-3 py-2 text-xs text-themed-muted">
              No speakers found
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
