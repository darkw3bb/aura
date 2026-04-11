import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FlatSong, TagInfo } from '../../lib/tauri';
import { api } from '../../lib/tauri';
import { flatSongToSong } from '../../lib/flatSong';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useContextMenuStore } from '../../stores/contextMenuStore';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { useTrackTargetStore } from '../../stores/trackTargetStore';
import { useCommandPaletteStore } from '../../stores/commandPaletteStore';
import { StarRating } from '../Rating/StarRating';
import { CoverArt } from '../Library/CoverArt';
import { useSettingsStore } from '../../stores/settingsStore';

const PAGE_SIZE = 50;

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
// Tag pill with hover-to-remove
// ---------------------------------------------------------------------------

export function TagPill({ name, trackId, colorClass, onRemove }: {
  name: string;
  trackId: string;
  colorClass?: string;
  onRemove?: (trackId: string, tagName: string) => void;
}) {
  const pillClass = colorClass && colorClass !== 'pill-color-default'
    ? colorClass
    : '';
  return (
    <span
      className={`group text-[8px] leading-tight pl-1.5 pr-1 py-px rounded-full truncate max-w-[90px] shrink-0 inline-flex items-center gap-0.5 ${pillClass || 'bg-themed-tertiary text-themed-secondary'}`}
      title={name}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(trackId, name); }}
          className="hidden group-hover:inline-flex items-center justify-center w-2.5 h-2.5 rounded-full hover:bg-themed-secondary/30 text-themed-muted hover:text-themed-primary cursor-pointer bg-transparent border-0 p-0 text-[8px] leading-none"
        >
          &times;
        </button>
      )}
    </span>
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
  showArt?: boolean;
  showTagPills?: boolean;
  tagNames: TagInfo[];
  focused: boolean;
  onPlay: (index: number) => void;
  onRatingChange: (trackId: string, rating: number) => void;
  onRemoveTag?: (trackId: string, tagName: string) => void;
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
  showArt,
  showTagPills = true,
  tagNames,
  focused,
  onPlay,
  onRatingChange,
  onRemoveTag,
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
      data-track-row
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
      {showArt && <CoverArt coverArt={track.cover_art} artist={track.artist} albumName={track.album} size={80} className="w-8 h-8 rounded shrink-0" />}
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
      {showTagPills && (
        <div className="w-40 min-w-0 flex flex-wrap gap-0.5 overflow-hidden max-h-[30px] items-start">
          {tagNames.slice(0, 6).map((t) => (
            <TagPill key={t.name} name={t.name} trackId={track.id} colorClass={`pill-color-${t.color ?? 'default'}`} onRemove={onRemoveTag} />
          ))}
          {tagNames.length > 6 && (
            <span className="text-[8px] text-themed-muted shrink-0">+{tagNames.length - 6}</span>
          )}
        </div>
      )}
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
  prev.showArt === next.showArt &&
  prev.showTagPills === next.showTagPills &&
  prev.tagNames.length === next.tagNames.length &&
  prev.tagNames.every((t, i) => t.name === next.tagNames[i].name && t.color === next.tagNames[i].color) &&
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
  showTagPills?: boolean;
  onRemoveTag?: (trackId: string, tagName: string) => void;
}

const EMPTY_TAG_LIST: TagInfo[] = [];

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
  showTagPills = true,
  onRemoveTag: onRemoveTagProp,
}: VirtualTrackListProps) {
  const [tracks, setTracks] = useState<FlatSong[]>([]);
  const [tagByTrackId, setTagByTrackId] = useState<Record<string, TagInfo[]>>({});
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
  const showTrackListArt = useSettingsStore((s) => s.showTrackListArt);
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

  const rowHeight = 52;

  const rowVirtualizer = useVirtualizer({
    count: tracks.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
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

  useEffect(() => {
    const song = focusIndex >= 0 ? songsRef.current[focusIndex] ?? null : null;
    useTrackTargetStore.getState().setKeyboardTarget(song);
    return () => {
      useTrackTargetStore.getState().setKeyboardTarget(null);
    };
  }, [focusIndex, tracks]);

  useEffect(() => {
    return () => {
      useTrackTargetStore.getState().setHoverTarget(null);
    };
  }, [resetKey]);

  useEffect(() => {
    if (!showTagPills || tracks.length === 0) {
      setTagByTrackId({});
      return;
    }
    const ids = tracks.map((t) => t.id);
    const t = window.setTimeout(() => {
      const chunkSize = 120;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
      }
      Promise.all(chunks.map((c) => api.getCachedTagsForTracks(c)))
        .then((parts) => {
          const next: Record<string, TagInfo[]> = {};
          for (const part of parts) {
            for (const e of part) {
              const id = 'trackId' in e ? e.trackId : (e as { track_id: string }).track_id;
              next[id] = e.tags;
            }
          }
          setTagByTrackId(next);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [tracks, showTagPills]);

  useEffect(() => {
    const onTags = () => {
      if (!showTagPills || tracks.length === 0) return;
      const ids = tracks.map((t) => t.id);
      const chunkSize = 120;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
      }
      Promise.all(chunks.map((c) => api.getCachedTagsForTracks(c)))
        .then((parts) => {
          const next: Record<string, TagInfo[]> = {};
          for (const part of parts) {
            for (const e of part) {
              const id = 'trackId' in e ? e.trackId : (e as { track_id: string }).track_id;
              next[id] = e.tags;
            }
          }
          setTagByTrackId(next);
        })
        .catch(() => {});
    };
    window.addEventListener('aura-tags-changed', onTags);
    return () => window.removeEventListener('aura-tags-changed', onTags);
  }, [tracks, showTagPills]);

  const handleListMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMouseMove();
      const el = (e.target as HTMLElement).closest('[data-track-row]');
      if (!el) useTrackTargetStore.getState().setHoverTarget(null);
    },
    [handleMouseMove],
  );

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

  const handleRemoveTag = useCallback(
    async (trackId: string, tagName: string) => {
      try {
        await api.removePlaylistTag(trackId, tagName);
        setTagByTrackId((prev) => {
          const tags = prev[trackId];
          if (!tags) return prev;
          const next = tags.filter((t) => t.name !== tagName);
          return { ...prev, [trackId]: next };
        });
        window.dispatchEvent(new Event('aura-tags-changed'));
      } catch (e) {
        console.error('Failed to remove tag:', e);
      }
    },
    [],
  );

  const resolvedOnRemoveTag = onRemoveTagProp ?? handleRemoveTag;

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
        {showTrackListArt && <span className="w-8" />}
        <SortHeader field="title" label="Title" className="flex-1 min-w-0" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <SortHeader field="artist" label="Artist" className="w-36 min-w-0" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <span className="w-36 min-w-0">Album</span>
        {showTagPills && <span className="w-40 min-w-0">Tags</span>}
        {showBitRate && <span className="w-14 text-right">kbps</span>}
        <SortHeader field="user_rating" label="Rating" className="w-24" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        {showPlayCount && <SortHeader field="play_count" label="Plays" className="w-16 text-right" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />}
        {showAdded && <SortHeader field="created" label="Added" className="w-24 text-right" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />}
        <span className="w-14 text-right">Time</span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto" onMouseMove={handleListMouseMove}>
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
            const song = songsRef.current[virtualRow.index];

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
                showArt={showTrackListArt}
                showTagPills={showTagPills}
                tagNames={tagByTrackId[track.id] ?? EMPTY_TAG_LIST}
                focused={focusIndex === virtualRow.index}
                onPlay={handlePlay}
                onRatingChange={handleRatingChange}
                onRemoveTag={resolvedOnRemoveTag}
                onArtistClick={loadArtist}
                onAlbumClick={loadAlbum}
                onMouseEnter={() => {
                  itemProps.onMouseEnter();
                  if (song) useTrackTargetStore.getState().setHoverTarget(song);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (song) {
                    showContextMenu(e.clientX, e.clientY, [
                      { label: 'Play Next', onClick: () => insertNextInQueue(song) },
                      { label: 'Add to Queue', onClick: () => addToQueue(song) },
                      {
                        label: 'Tag…',
                        onClick: () => useCommandPaletteStore.getState().openPaletteTagStep(song),
                      },
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
