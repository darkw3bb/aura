import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { CoverArt } from '../Library/CoverArt';
import { StarRating } from '../Rating/StarRating';
import type { Song } from '../../lib/tauri';

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlayerBar() {
  const {
    isPlaying, currentTrack, elapsedSecs, durationSecs, volume,
    shuffle, repeat, pause, resume, playNext, playPrevious,
    toggleShuffle, toggleRepeat, seek, setVolume, refreshState, setRating,
  } = usePlayerStore();

  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(refreshState, 1000);
    return () => clearInterval(intervalRef.current);
  }, [refreshState]);

  const progress = durationSecs ? (elapsedSecs / durationSecs) * 100 : 0;

  return (
    <div
      className="h-20 flex items-center px-4 gap-4 shrink-0 overflow-hidden"
      style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}
    >
      {/* Track info */}
      <div className="flex items-center gap-3 w-72 min-w-0">
        {currentTrack ? (
          <>
            <CoverArt coverArt={currentTrack.cover_art} artist={currentTrack.artist} albumName={currentTrack.album} size={100} className="w-12 h-12 rounded" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {currentTrack.title}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {currentTrack.artist ?? 'Unknown'}
              </p>
            </div>
            <StarRating
              rating={currentTrack.user_rating ?? 0}
              onChange={(r) => setRating(currentTrack.id, r)}
              size="sm"
            />
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No track playing</p>
        )}
      </div>

      {/* Transport controls */}
      <div className="flex-1 flex flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <ControlButton
            active={shuffle}
            onClick={toggleShuffle}
            title="Shuffle"
          >
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </ControlButton>

          <ControlButton onClick={playPrevious} title="Previous">
            <polygon points="19 20 9 12 19 4 19 20" />
            <line x1="5" y1="19" x2="5" y2="5" />
          </ControlButton>

          <button
            onClick={isPlaying ? pause : resume}
            className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            style={{ background: 'var(--text-primary)' }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--bg-primary)" stroke="var(--bg-primary)" strokeWidth="2">
              {isPlaying ? (
                <>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </>
              ) : (
                <polygon points="5 3 19 12 5 21 5 3" />
              )}
            </svg>
          </button>

          <ControlButton onClick={playNext} title="Next">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </ControlButton>

          <ControlButton
            active={repeat !== 'off'}
            onClick={toggleRepeat}
            title={`Repeat: ${repeat}`}
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            {repeat === 'one' && (
              <text x="12" y="14" fontSize="8" fill="currentColor" textAnchor="middle" fontWeight="bold">1</text>
            )}
          </ControlButton>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 w-full max-w-lg">
          <span className="text-xs w-10 text-right" style={{ color: 'var(--text-muted)' }}>
            {formatTime(elapsedSecs)}
          </span>
          <div
            className="flex-1 h-1.5 rounded-full cursor-pointer group relative"
            style={{ background: 'var(--bg-tertiary)' }}
            onClick={(e) => {
              if (!durationSecs) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seek(pct * durationSecs);
            }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, background: 'var(--accent)' }}
            />
          </div>
          <span className="text-xs w-10" style={{ color: 'var(--text-muted)' }}>
            {durationSecs ? formatTime(durationSecs) : '--:--'}
          </span>
        </div>
      </div>

      {/* Volume + Format */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 w-32">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="shrink-0">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
            {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ background: 'var(--bg-tertiary)', accentColor: 'var(--accent)' }}
          />
        </div>
        {currentTrack && <FormatPill track={currentTrack} isPlaying={isPlaying} />}
      </div>
    </div>
  );
}

function getFormatLabel(track: Song): string | null {
  if (track.suffix) return track.suffix.toUpperCase();
  if (track.content_type) {
    const mime = track.content_type.split('/').pop();
    if (mime) return mime.replace('x-', '').toUpperCase();
  }
  return null;
}

function FormatPill({ track, isPlaying }: { track: Song; isPlaying: boolean }) {
  const format = getFormatLabel(track);
  const bitRate = track.bit_rate;

  if (!format && !bitRate) return null;

  return (
    <div className="format-pill" data-playing={isPlaying}>
      <div className="eq-bars" data-paused={!isPlaying}>
        <span className="eq-bar" />
        <span className="eq-bar" />
        <span className="eq-bar" />
        <span className="eq-bar" />
      </div>
      {format && (
        <span className="text-[10px] font-bold tracking-wide" style={{ color: 'var(--accent)' }}>
          {format}
        </span>
      )}
      {bitRate && (
        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          {bitRate}k
        </span>
      )}
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded transition-colors cursor-pointer bg-transparent border-0"
      title={title}
      style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = active ? 'var(--accent-hover)' : 'var(--text-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = active ? 'var(--accent)' : 'var(--text-secondary)')}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
