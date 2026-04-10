import { useEffect, useRef, useCallback } from 'react';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePlayerStore } from '../../stores/playerStore';
import { CoverArt } from '../Library/CoverArt';
import { StarRating } from '../Rating/StarRating';
import type { Song } from '../../lib/tauri';

function formatDuration(secs?: number): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QueuePanel() {
  const {
    queue, queueIndex, history, currentTrack, isPlaying,
    setRating, jumpToInQueue, removeFromQueue, moveInQueue, clearQueue,
    refreshQueue,
  } = usePlayerStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const nowPlayingRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (nowPlayingRef.current && scrollRef.current && !hasScrolled.current) {
      hasScrolled.current = true;
      const container = scrollRef.current;
      const el = nowPlayingRef.current;
      const containerHeight = container.clientHeight;
      const elTop = el.offsetTop;
      container.scrollTop = elTop - containerHeight / 2 + el.clientHeight / 2;
    }
  }, [queue, queueIndex, history]);

  // Reset scroll flag when queue changes substantially
  useEffect(() => {
    hasScrolled.current = false;
  }, [queueIndex]);

  const upcoming = queueIndex !== null ? queue.slice(queueIndex + 1) : [];
  const upcomingStartIndex = queueIndex !== null ? queueIndex + 1 : 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = Number(active.id);
    const newIdx = Number(over.id);
    if (!isNaN(oldIdx) && !isNaN(newIdx)) {
      moveInQueue(oldIdx, newIdx);
    }
  }, [moveInQueue]);

  const handleRating = useCallback((trackId: string, rating: number) => {
    setRating(trackId, rating);
  }, [setRating]);

  const isEmpty = !currentTrack && history.length === 0 && queue.length === 0;

  const nowPlayingCount = currentTrack ? 1 : 0;
  const totalItems = history.length + nowPlayingCount + upcoming.length;

  const onActivate = useCallback(
    (i: number) => {
      const upcomingStart = history.length + nowPlayingCount;
      if (i >= upcomingStart) {
        jumpToInQueue(upcomingStartIndex + (i - upcomingStart));
      }
    },
    [history.length, nowPlayingCount, jumpToInQueue, upcomingStartIndex],
  );

  const { getItemProps, handleMouseMove } = useKeyboardNav({
    itemCount: totalItems,
    onActivate,
    scrollRef,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-themed-primary">Queue</h2>
          <p className="text-[13px] mt-0.5 text-themed-muted">
            {queue.length} track{queue.length !== 1 ? 's' : ''}
            {history.length > 0 && ` \u00b7 ${history.length} played`}
          </p>
        </div>
        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="text-[12px] px-3 py-1 rounded-md cursor-pointer bg-transparent border border-themed text-themed-secondary hover:text-themed-primary"
          >
            Clear
          </button>
        )}
      </div>

      {isEmpty && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-themed-muted">No tracks in queue</p>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2" onMouseMove={handleMouseMove}>
        {/* History */}
        {history.length > 0 && (
          <div className="mb-1">
            <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-themed-muted">
              Previously Played
            </p>
            {history.map((track, i) => (
              <HistoryRow
                key={`h-${i}-${track.id}`}
                track={track}
                onRating={handleRating}
                itemProps={getItemProps(i)}
              />
            ))}
          </div>
        )}

        {/* Now Playing */}
        {currentTrack && (
          <div ref={nowPlayingRef}>
            <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-themed-muted">
              Now Playing
            </p>
            <NowPlayingRow track={currentTrack} isPlaying={isPlaying} onRating={handleRating} itemProps={getItemProps(history.length)} />
          </div>
        )}

        {/* Upcoming (draggable) */}
        {upcoming.length > 0 && (
          <div className="mt-1">
            <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-themed-muted">
              Up Next
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={upcoming.map((_, i) => upcomingStartIndex + i)}
                strategy={verticalListSortingStrategy}
              >
                {upcoming.map((track, i) => {
                  const queueIdx = upcomingStartIndex + i;
                  return (
                    <SortableQueueRow
                      key={`q-${queueIdx}-${track.id}`}
                      track={track}
                      queueIndex={queueIdx}
                      onJump={jumpToInQueue}
                      onRemove={removeFromQueue}
                      onRating={handleRating}
                      itemProps={getItemProps(history.length + nowPlayingCount + i)}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ track, onRating, itemProps }: { track: Song; onRating: (id: string, r: number) => void; itemProps?: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 rounded-md opacity-50 data-[focused=true]:opacity-100 data-[focused=true]:ring-1 data-[focused=true]:ring-[var(--accent)]" {...itemProps}>
      <CoverArt coverArt={track.cover_art} artist={track.artist} albumName={track.album} size={80} className="w-8 h-8 rounded shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate text-themed-secondary">{track.title}</p>
        <p className="text-[11px] truncate text-themed-muted">{track.artist ?? 'Unknown'}</p>
      </div>
      <StarRating rating={track.user_rating ?? 0} onChange={(r) => onRating(track.id, r)} size="sm" />
      <span className="text-[11px] tabular-nums text-themed-muted w-10 text-right shrink-0">
        {formatDuration(track.duration)}
      </span>
    </div>
  );
}

function NowPlayingRow({ track, isPlaying, onRating, itemProps }: { track: Song; isPlaying: boolean; onRating: (id: string, r: number) => void; itemProps?: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-themed-tertiary data-[focused=true]:ring-1 data-[focused=true]:ring-[var(--accent)]" {...itemProps}>
      <CoverArt coverArt={track.cover_art} artist={track.artist} albumName={track.album} size={100} className="w-10 h-10 rounded shrink-0" />
      <span className="shrink-0">
        <span className="eq-bars" data-paused={!isPlaying}>
          <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate text-themed-accent">{track.title}</p>
        <p className="text-[11px] truncate text-themed-muted">
          {track.artist ?? 'Unknown'}
          {track.album && ` \u00b7 ${track.album}`}
        </p>
      </div>
      <StarRating rating={track.user_rating ?? 0} onChange={(r) => onRating(track.id, r)} size="sm" />
      <span className="text-[11px] tabular-nums text-themed-muted w-10 text-right shrink-0">
        {formatDuration(track.duration)}
      </span>
    </div>
  );
}

function SortableQueueRow({
  track,
  queueIndex,
  onJump,
  onRemove,
  onRating,
  itemProps,
}: {
  track: Song;
  queueIndex: number;
  onJump: (idx: number) => void;
  onRemove: (idx: number) => void;
  onRating: (id: string, r: number) => void;
  itemProps?: Record<string, unknown>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: queueIndex });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-1.5 rounded-md track-row cursor-pointer group data-[focused=true]:ring-1 data-[focused=true]:ring-[var(--accent)]"
      onDoubleClick={() => onJump(queueIndex)}
      {...itemProps}
    >
      <button
        className="shrink-0 cursor-grab active:cursor-grabbing bg-transparent border-0 p-0 text-themed-muted touch-none"
        {...attributes}
        {...listeners}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
        </svg>
      </button>
      <CoverArt coverArt={track.cover_art} artist={track.artist} albumName={track.album} size={80} className="w-8 h-8 rounded shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate text-themed-primary">{track.title}</p>
        <p className="text-[11px] truncate text-themed-muted">{track.artist ?? 'Unknown'}</p>
      </div>
      <StarRating rating={track.user_rating ?? 0} onChange={(r) => onRating(track.id, r)} size="sm" />
      <span className="text-[11px] tabular-nums text-themed-muted w-10 text-right shrink-0">
        {formatDuration(track.duration)}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(queueIndex); }}
        className="shrink-0 p-1 rounded cursor-pointer bg-transparent border-0 text-themed-muted opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove from queue"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
