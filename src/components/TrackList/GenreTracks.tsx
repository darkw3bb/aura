import { useCallback, useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '../../lib/tauri';
import type { FlatSong } from '../../lib/tauri';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { StarRating } from '../Rating/StarRating';

function formatDuration(secs?: number): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function flatSongToSong(f: FlatSong) {
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
    cover_art: f.cover_art,
    user_rating: f.user_rating,
    disc_number: f.disc_number,
  };
}

const PAGE_SIZE = 50;

export function GenreTracks() {
  const [tracks, setTracks] = useState<FlatSong[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const { playTrackInContext, setRating, currentTrack, isPlaying } = usePlayerStore();
  const { selectedGenre, loadArtist, loadAlbum } = useLibraryStore();

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !selectedGenre) return;
    setLoading(true);
    try {
      const newTracks = await api.getSongsByGenre(selectedGenre, PAGE_SIZE, tracks.length);
      if (newTracks.length < PAGE_SIZE) setHasMore(false);
      setTracks((prev) => [...prev, ...newTracks]);
    } catch (e) {
      console.error('Load genre tracks error:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedGenre, tracks.length, loading, hasMore]);

  useEffect(() => {
    setTracks([]);
    setHasMore(true);
    setLoading(false);
  }, [selectedGenre]);

  useEffect(() => {
    if (tracks.length === 0 && hasMore && !loading && selectedGenre) {
      loadMore();
    }
  }, [tracks.length, hasMore, loading, selectedGenre, loadMore]);

  const rowVirtualizer = useVirtualizer({
    count: tracks.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 20,
  });

  useEffect(() => {
    const items = rowVirtualizer.getVirtualItems();
    const lastItem = items[items.length - 1];
    if (lastItem && lastItem.index >= tracks.length - 5 && hasMore && !loading) {
      loadMore();
    }
  }, [rowVirtualizer.getVirtualItems(), tracks.length, hasMore, loading, loadMore]);

  const scrollToIndex = useCallback(
    (i: number) => rowVirtualizer.scrollToIndex(i, { align: 'auto' }),
    [rowVirtualizer],
  );

  const onActivate = useCallback(
    (i: number) => { if (tracks[i]) playTrackInContext(tracks.map(flatSongToSong), i); },
    [tracks, playTrackInContext],
  );

  const { getItemProps, handleMouseMove } = useKeyboardNav({
    itemCount: tracks.length,
    onActivate,
    scrollToIndex,
  });

  const handleRatingChange = async (trackId: string, rating: number) => {
    try {
      await setRating(trackId, rating);
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, user_rating: rating } : t))
      );
    } catch (e) {
      console.error('Failed to save rating:', e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4">
        <h2 className="text-lg font-semibold text-themed-primary">{selectedGenre}</h2>
        <p className="text-[13px] mt-0.5 text-themed-muted">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          {hasMore ? '+' : ''}
        </p>
      </div>

      {!loading && tracks.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-themed-secondary">No tracks in this genre.</p>
        </div>
      )}

      <div
        className="flex items-center gap-3 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-themed-muted border-b border-themed bg-themed-primary sticky top-0 z-10"
      >
        <span className="w-10 text-right tabular-nums">#</span>
        <span className="flex-1 min-w-0">Title</span>
        <span className="w-36 min-w-0">Artist</span>
        <span className="w-36 min-w-0">Album</span>
        <span className="w-24">Rating</span>
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

            return (
              <div
                key={track.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="track-row flex items-center gap-3 px-6 cursor-pointer"
                onDoubleClick={() => playTrackInContext(tracks.map(flatSongToSong), virtualRow.index)}
                {...getItemProps(virtualRow.index)}
              >
                <span className="w-10 flex items-center justify-end text-[11px] tabular-nums text-themed-muted">
                  {currentTrack?.id === track.id ? (
                    <span className="eq-bars" data-paused={!isPlaying}>
                      <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
                    </span>
                  ) : (
                    virtualRow.index + 1
                  )}
                </span>
                <span className={`flex-1 min-w-0 text-[13px] truncate ${currentTrack?.id === track.id ? 'text-themed-accent' : 'text-themed-primary'}`}>
                  {track.title}
                </span>
                <span className="w-36 min-w-0 text-[13px] truncate text-themed-secondary">
                  {track.artist_id ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); loadArtist(track.artist_id!); }}
                      className="bg-transparent border-0 p-0 cursor-pointer text-themed-secondary hover:underline text-[13px] truncate max-w-full text-left"
                    >
                      {track.artist ?? 'Unknown'}
                    </button>
                  ) : (track.artist ?? 'Unknown')}
                </span>
                <span className="w-36 min-w-0 text-[13px] truncate text-themed-secondary">
                  {track.album_id ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); loadAlbum(track.album_id!); }}
                      className="bg-transparent border-0 p-0 cursor-pointer text-themed-secondary hover:underline text-[13px] truncate max-w-full text-left"
                    >
                      {track.album ?? 'Unknown'}
                    </button>
                  ) : (track.album ?? 'Unknown')}
                </span>
                <span className="w-24">
                  <StarRating
                    rating={track.user_rating ?? 0}
                    onChange={(r) => handleRatingChange(track.id, r)}
                    size="sm"
                  />
                </span>
                <span className="w-14 text-right text-[11px] tabular-nums text-themed-muted">
                  {formatDuration(track.duration)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
