import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FlatSong, Song } from '../../lib/tauri';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useContextMenuStore } from '../../stores/contextMenuStore';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { StarRating } from '../Rating/StarRating';

const PAGE_SIZE = 50;

export function flatSongToSong(f: FlatSong): Song {
  return {
    id: f.id,
    title: f.title,
    album: f.album,
    album_id: f.album_id,
    artist: f.artist,
    artist_id: f.artist_id,
    track: f.track,
    year: f.year,
    genre: f.genre,
    duration: f.duration,
    bit_rate: f.bit_rate,
    suffix: f.suffix,
    content_type: f.content_type,
    cover_art: f.cover_art,
    user_rating: f.user_rating,
    disc_number: f.disc_number,
    play_count: f.play_count,
    created: f.created,
  };
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDuration(secs?: number): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Sort header
// ---------------------------------------------------------------------------

function SortHeader({
  field,
  label,
  className,
  sortField,
  sortDirection,
  onSortChange,
}: {
  field: string;
  label: string;
  className?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (field: string) => void;
}) {
  if (!onSortChange) return <span className={className}>{label}</span>;

  const active = sortField === field;
  return (
    <button
      onClick={() => onSortChange(field)}
      className={`${className ?? ''} bg-transparent border-0 p-0 cursor-pointer flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${active ? 'text-themed-primary' : 'text-themed-muted hover:text-themed-secondary'}`}
    >
      {label}
      {active && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          {sortDirection === 'asc'
            ? <path d="M5 2L8 7H2L5 2Z" />
            : <path d="M5 8L2 3H8L5 8Z" />}
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Memoized row
// ---------------------------------------------------------------------------

interface TrackRowProps {
  track: FlatSong;
  index: number;
  size: number;
  start: number;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  showBitRate?: boolean;
  showPlayCount?: boolean;
  showAdded?: boolean;
  focused: boolean;
  onPlay: (index: number) => void;
  onRatingChange: (trackId: string, rating: number) => void;
  onArtistClick: (artistId: string) => void;
  onAlbumClick: (albumId: string) => void;
  onMouseEnter: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const TrackRow = memo(function TrackRow({
  track,
  index,
  size,
  start,
  isCurrentTrack,
  isPlaying,
  showBitRate,
  showPlayCount,
  showAdded,
  focused,
  onPlay,
  onRatingChange,
  onArtistClick,
  onAlbumClick,
  onMouseEnter,
  onContextMenu,
}: TrackRowProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${size}px`,
        transform: `translateY(${start}px)`,
      }}
      className="track-row flex items-center gap-3 px-6 cursor-pointer"
      data-kbd-idx={index}
      data-focused={focused}
      onDoubleClick={() => onPlay(index)}
      onMouseEnter={onMouseEnter}
      onContextMenu={onContextMenu}
    >
      <span className="w-10 flex items-center justify-end text-[11px] tabular-nums text-themed-muted">
        {isCurrentTrack ? (
          <span className="eq-bars" data-paused={!isPlaying}>
            <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
          </span>
        ) : (
          index + 1
        )}
      </span>
      <span className={`flex-1 min-w-0 text-[13px] truncate ${isCurrentTrack ? 'text-themed-accent' : 'text-themed-primary'}`}>
        {track.title}
      </span>
      <span className="w-36 min-w-0 text-[13px] truncate text-themed-secondary">
        {track.artist_id ? (
          <button
            onClick={(e) => { e.stopPropagation(); onArtistClick(track.artist_id!); }}
            className="bg-transparent border-0 p-0 cursor-pointer text-themed-secondary hover:underline text-[13px] truncate max-w-full text-left"
          >
            {track.artist ?? 'Unknown'}
          </button>
        ) : (track.artist ?? 'Unknown')}
      </span>
      <span className="w-36 min-w-0 text-[13px] truncate text-themed-secondary">
        {track.album_id ? (
          <button
            onClick={(e) => { e.stopPropagation(); onAlbumClick(track.album_id!); }}
            className="bg-transparent border-0 p-0 cursor-pointer text-themed-secondary hover:underline text-[13px] truncate max-w-full text-left"
          >
            {track.album ?? 'Unknown'}
          </button>
        ) : (track.album ?? 'Unknown')}
      </span>
      {showBitRate && (
        <span className="w-14 text-right text-[11px] tabular-nums text-themed-muted">
          {track.bit_rate ? `${track.bit_rate}k` : ''}
        </span>
      )}
      <span className="w-24">
        <StarRating
          rating={track.user_rating ?? 0}
          onChange={(r) => onRatingChange(track.id, r)}
          size="sm"
        />
      </span>
      {showPlayCount && (
        <span className="w-16 text-right text-[11px] tabular-nums text-themed-muted">
          {track.play_count ?? 0}
        </span>
      )}
      {showAdded && (
        <span className="w-24 text-right text-[11px] truncate text-themed-muted">
          {formatDate(track.created)}
        </span>
      )}
      <span className="w-14 text-right text-[11px] tabular-nums text-themed-muted">
        {formatDuration(track.duration)}
      </span>
    </div>
  );
}, (prev, next) =>
  prev.track === next.track &&
  prev.index === next.index &&
  prev.size === next.size &&
  prev.start === next.start &&
  prev.isCurrentTrack === next.isCurrentTrack &&
  prev.isPlaying === next.isPlaying &&
  prev.showBitRate === next.showBitRate &&
  prev.showPlayCount === next.showPlayCount &&
  prev.showAdded === next.showAdded &&
  prev.focused === next.focused
);

// ---------------------------------------------------------------------------
// VirtualTrackList
// ---------------------------------------------------------------------------

interface VirtualTrackListProps {
  fetchPage: (offset: number, pageSize: number) => Promise<FlatSong[]>;
  resetKey: string;
  title: string;
  subtitle?: (count: number, hasMore: boolean) => string;
  emptyContent: React.ReactNode;
  showBitRate?: boolean;
  showPlayCount?: boolean;
  showAdded?: boolean;
  /** When true, setting a rating to 0 removes the track from the list. */
  removeOnZeroRating?: boolean;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (field: string) => void;
}

export function VirtualTrackList({
  fetchPage,
  resetKey,
  title,
  subtitle,
  emptyContent,
  showBitRate,
  showPlayCount,
  showAdded,
  removeOnZeroRating,
  sortField,
  sortDirection,
  onSortChange,
}: VirtualTrackListProps) {
  const [tracks, setTracks] = useState<FlatSong[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  // Synchronous guard prevents race-condition double-fetches
  const loadingRef = useRef(false);
  const offsetRef = useRef(0);
  const seenIdsRef = useRef(new Set<string>());
  const hasMoreRef = useRef(true);
  // Generation counter: incremented on reset so in-flight fetches are discarded
  const generationRef = useRef(0);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const tracksCountRef = useRef(0);
  tracksCountRef.current = tracks.length;

  const { playTrackInContext, setRating, currentTrack, isPlaying, addToQueue, insertNextInQueue } = usePlayerStore();
  const { loadArtist, loadAlbum } = useLibraryStore();
  const showContextMenu = useContextMenuStore((s) => s.show);

  // Stable loadMore — all mutable values accessed via refs
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const gen = generationRef.current;
    try {
      const newTracks = await fetchPageRef.current(offsetRef.current, PAGE_SIZE);
      if (gen !== generationRef.current) return;

      if (newTracks.length < PAGE_SIZE) {
        setHasMore(false);
        hasMoreRef.current = false;
      }

      // Advance offset by fetched count (matches DB LIMIT/OFFSET pagination)
      offsetRef.current += newTracks.length;

      // Deduplicate against already-loaded IDs
      const unique = newTracks.filter((t) => !seenIdsRef.current.has(t.id));
      for (const t of unique) seenIdsRef.current.add(t.id);
      if (unique.length > 0) {
        setTracks((prev) => [...prev, ...unique]);
      }
    } catch (e) {
      if (gen !== generationRef.current) return;
      console.error('Load tracks error:', e);
    } finally {
      if (gen === generationRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  // Reset all pagination state when the view key changes
  useEffect(() => {
    generationRef.current += 1;
    loadingRef.current = false;
    offsetRef.current = 0;
    seenIdsRef.current = new Set();
    hasMoreRef.current = true;
    setTracks([]);
    setHasMore(true);
    setLoading(false);
  }, [resetKey]);

  // Trigger first page load after a reset empties the list
  useEffect(() => {
    if (tracks.length === 0 && hasMoreRef.current && !loadingRef.current) {
      loadMore();
    }
  }, [tracks.length, resetKey, loadMore]);

  // ---- Virtualizer (onChange replaces the old unstable-dep useEffect) ----

  const rowVirtualizer = useVirtualizer({
    count: tracks.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 20,
    onChange: (instance) => {
      const items = instance.getVirtualItems();
      const lastItem = items[items.length - 1];
      if (
        lastItem &&
        lastItem.index >= tracksCountRef.current - 5 &&
        hasMoreRef.current &&
        !loadingRef.current
      ) {
        loadMore();
      }
    },
  });

  const scrollToIndex = useCallback(
    (i: number) => rowVirtualizer.scrollToIndex(i, { align: 'auto' }),
    [rowVirtualizer],
  );

  // Memoize Song[] conversion so it runs once per tracks change, not per click
  const songs = useMemo(() => tracks.map(flatSongToSong), [tracks]);
  const songsRef = useRef(songs);
  songsRef.current = songs;

  const handlePlay = useCallback(
    (i: number) => {
      if (songsRef.current[i]) playTrackInContext(songsRef.current, i);
    },
    [playTrackInContext],
  );

  const { focusIndex, getItemProps, handleMouseMove } = useKeyboardNav({
    itemCount: tracks.length,
    onActivate: handlePlay,
    scrollToIndex,
  });

  const handleRatingChange = useCallback(
    async (trackId: string, rating: number) => {
      try {
        await setRating(trackId, rating);
        setTracks((prev) => {
          if (removeOnZeroRating && rating === 0) {
            seenIdsRef.current.delete(trackId);
            offsetRef.current = Math.max(0, offsetRef.current - 1);
            return prev.filter((t) => t.id !== trackId);
          }
          return prev.map((t) => (t.id === trackId ? { ...t, user_rating: rating } : t));
        });
      } catch (e) {
        console.error('Failed to save rating:', e);
      }
    },
    [setRating, removeOnZeroRating],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4">
        <h2 className="text-lg font-semibold text-themed-primary">{title}</h2>
        {subtitle && (
          <p className="text-[13px] mt-0.5 text-themed-muted">
            {subtitle(tracks.length, hasMore)}
          </p>
        )}
      </div>

      {!loading && tracks.length === 0 && emptyContent}

      <div className="flex items-center gap-3 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-themed-muted border-b border-themed bg-themed-primary sticky top-0 z-10">
        <span className="w-10 text-right tabular-nums">#</span>
        <SortHeader field="title" label="Title" className="flex-1 min-w-0" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <SortHeader field="artist" label="Artist" className="w-36 min-w-0" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <span className="w-36 min-w-0">Album</span>
        {showBitRate && <span className="w-14 text-right">kbps</span>}
        <SortHeader field="user_rating" label="Rating" className="w-24" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        {showPlayCount && <SortHeader field="play_count" label="Plays" className="w-16 text-right" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />}
        {showAdded && <SortHeader field="created" label="Added" className="w-24 text-right" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />}
        <span className="w-14 text-right">Time</span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto" onMouseMove={handleMouseMove}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const track = tracks[virtualRow.index];
            if (!track) {
              return (
                <div
                  key="loader"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-center justify-center text-sm text-themed-muted"
                >
                  {loading ? 'Loading...' : ''}
                </div>
              );
            }

            const itemProps = getItemProps(virtualRow.index);

            return (
              <TrackRow
                key={track.id}
                track={track}
                index={virtualRow.index}
                size={virtualRow.size}
                start={virtualRow.start}
                isCurrentTrack={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                showBitRate={showBitRate}
                showPlayCount={showPlayCount}
                showAdded={showAdded}
                focused={focusIndex === virtualRow.index}
                onPlay={handlePlay}
                onRatingChange={handleRatingChange}
                onArtistClick={loadArtist}
                onAlbumClick={loadAlbum}
                onMouseEnter={itemProps.onMouseEnter}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const song = songsRef.current[virtualRow.index];
                  if (song) {
                    showContextMenu(e.clientX, e.clientY, [
                      { label: 'Play Next', onClick: () => insertNextInQueue(song) },
                      { label: 'Add to Queue', onClick: () => addToQueue(song) },
                    ]);
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
