import { useCallback, useEffect, useRef, useState } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useContextMenuStore } from '../../stores/contextMenuStore';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { useTrackTargetStore } from '../../stores/trackTargetStore';
import { useCommandPaletteStore } from '../../stores/commandPaletteStore';
import { api } from '../../lib/tauri';
import { CoverArt } from './CoverArt';
import { StarRating } from '../Rating/StarRating';
import { TagPill } from '../TrackList/VirtualTrackList';

function formatDuration(secs?: number): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AlbumDetail() {
  const { selectedAlbum, loadArtist, updateAlbumRating } = useLibraryStore();
  const { playTrackInContext, setRating, currentTrack, isPlaying, addToQueue, insertNextInQueue } = usePlayerStore();
  const showContextMenu = useContextMenuStore((s) => s.show);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tagByTrackId, setTagByTrackId] = useState<Record<string, string[]>>({});

  const handleAlbumRating = async (rating: number) => {
    if (!selectedAlbum) return;
    try {
      await api.setRating(selectedAlbum.id, rating);
      updateAlbumRating(selectedAlbum.id, rating);
    } catch (e) {
      console.error('Failed to save album rating:', e);
    }
  };

  const songs = selectedAlbum?.song ?? [];

  const onActivate = useCallback(
    (i: number) => { if (songs[i]) playTrackInContext(songs, i); },
    [songs, playTrackInContext],
  );

  const { focusIndex, getItemProps, handleMouseMove } = useKeyboardNav({
    itemCount: songs.length,
    onActivate,
    scrollRef,
  });

  useEffect(() => {
    const song = focusIndex >= 0 ? songs[focusIndex] ?? null : null;
    useTrackTargetStore.getState().setKeyboardTarget(song);
    return () => {
      useTrackTargetStore.getState().setKeyboardTarget(null);
    };
  }, [focusIndex, songs]);

  useEffect(() => {
    if (songs.length === 0) {
      setTagByTrackId({});
      return;
    }
    const ids = songs.map((s) => s.id);
    const t = window.setTimeout(() => {
      api
        .getCachedTagsForTracks(ids)
        .then((entries) => {
          const next: Record<string, string[]> = {};
          for (const e of entries) {
            const id = 'trackId' in e ? e.trackId : (e as { track_id: string }).track_id;
            next[id] = e.tags;
          }
          setTagByTrackId(next);
        })
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [songs]);

  useEffect(() => {
    const onTags = () => {
      if (songs.length === 0) return;
      const ids = songs.map((s) => s.id);
      api
        .getCachedTagsForTracks(ids)
        .then((entries) => {
          const next: Record<string, string[]> = {};
          for (const e of entries) {
            const id = 'trackId' in e ? e.trackId : (e as { track_id: string }).track_id;
            next[id] = e.tags;
          }
          setTagByTrackId(next);
        })
        .catch(() => {});
    };
    window.addEventListener('aura-tags-changed', onTags);
    return () => window.removeEventListener('aura-tags-changed', onTags);
  }, [songs]);

  const handleRemoveTag = useCallback(
    async (trackId: string, tagName: string) => {
      try {
        await api.removePlaylistTag(trackId, tagName);
        setTagByTrackId((prev) => {
          const tags = prev[trackId];
          if (!tags) return prev;
          return { ...prev, [trackId]: tags.filter((t) => t !== tagName) };
        });
        window.dispatchEvent(new Event('aura-tags-changed'));
      } catch (e) {
        console.error('Failed to remove tag:', e);
      }
    },
    [],
  );

  const handleAlbumMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMouseMove();
      const el = (e.target as HTMLElement).closest('[data-track-row]');
      if (!el) useTrackTargetStore.getState().setHoverTarget(null);
    },
    [handleMouseMove],
  );

  if (!selectedAlbum) return null;

  return (
    <div ref={scrollRef} className="p-6 overflow-y-auto h-full" onMouseMove={handleAlbumMouseMove}>
      <div className="flex gap-6 mb-6">
        <CoverArt
          coverArt={selectedAlbum.cover_art}
          artist={selectedAlbum.artist}
          albumName={selectedAlbum.name}
          size={300}
          className="w-48 h-48 rounded-lg shrink-0"
        />
        <div className="flex flex-col justify-end">
          <h2 className="text-2xl font-bold text-themed-primary">
            {selectedAlbum.name}
          </h2>
          <p className="text-[13px] mt-1 text-themed-secondary">
            {selectedAlbum.artist_id ? (
              <button
                onClick={() => loadArtist(selectedAlbum.artist_id!)}
                className="bg-transparent border-0 p-0 cursor-pointer text-themed-secondary hover:underline text-[13px]"
              >
                {selectedAlbum.artist ?? 'Unknown Artist'}
              </button>
            ) : (
              selectedAlbum.artist ?? 'Unknown Artist'
            )}
          </p>
          <p className="text-xs mt-1 text-themed-muted">
            {selectedAlbum.year && `${selectedAlbum.year} \u00b7 `}
            {songs.length} track{songs.length !== 1 ? 's' : ''}
            {selectedAlbum.genre && ` \u00b7 ${selectedAlbum.genre}`}
          </p>
          <div className="mt-2">
            <StarRating
              rating={selectedAlbum.user_rating ?? 0}
              onChange={handleAlbumRating}
              size="md"
            />
          </div>
          <button
            onClick={() => {
              if (songs.length > 0) playTrackInContext(songs, 0);
            }}
            className="mt-3 px-6 py-2 rounded-full text-[13px] font-medium cursor-pointer w-fit btn-accent"
          >
            Play All
          </button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden bg-themed-secondary">
        {songs.map((song, i) => {
          const itemProps = getItemProps(i);
          const tags = tagByTrackId[song.id] ?? [];
          return (
          <div
            key={song.id}
            data-track-row
            className="track-row flex items-center gap-3 px-4 py-2 cursor-pointer group"
            onDoubleClick={() => playTrackInContext(songs, i)}
            onContextMenu={(e) => {
              e.preventDefault();
              showContextMenu(e.clientX, e.clientY, [
                { label: 'Play Next', onClick: () => insertNextInQueue(song) },
                { label: 'Add to Queue', onClick: () => addToQueue(song) },
                {
                  label: 'Tag…',
                  onClick: () => useCommandPaletteStore.getState().openPaletteTagStep(song),
                },
              ]);
            }}
            {...itemProps}
            onMouseEnter={() => {
              itemProps.onMouseEnter();
              useTrackTargetStore.getState().setHoverTarget(song);
            }}
          >
            <span className="w-8 flex items-center justify-end text-[11px] tabular-nums text-themed-muted">
              {currentTrack?.id === song.id ? (
                <span className="eq-bars" data-paused={!isPlaying}>
                  <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
                </span>
              ) : (
                song.track ?? i + 1
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] truncate ${currentTrack?.id === song.id ? 'text-themed-accent' : 'text-themed-primary'}`}>
                {song.title}
              </p>
              {song.artist && song.artist !== selectedAlbum.artist && (
                <p className="text-[11px] truncate text-themed-muted">
                  {song.artist_id ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); loadArtist(song.artist_id!); }}
                      className="bg-transparent border-0 p-0 cursor-pointer text-themed-muted hover:underline text-[11px]"
                    >
                      {song.artist}
                    </button>
                  ) : song.artist}
                </p>
              )}
            </div>
            {tags.length > 0 && (
              <div className="w-36 shrink-0 flex flex-wrap gap-0.5 overflow-hidden max-h-[34px] items-start">
                {tags.slice(0, 6).map((name) => (
                  <TagPill key={name} name={name} trackId={song.id} onRemove={handleRemoveTag} />
                ))}
                {tags.length > 6 && (
                  <span className="text-[8px] text-themed-muted shrink-0">+{tags.length - 6}</span>
                )}
              </div>
            )}
            <span className="text-[11px] tabular-nums w-14 text-right text-themed-muted">
              {song.bit_rate ? `${song.bit_rate}k` : ''}
            </span>
            <StarRating
              rating={song.user_rating ?? 0}
              onChange={(r) => setRating(song.id, r)}
              size="sm"
            />
            <span className="text-[11px] tabular-nums w-12 text-right text-themed-muted">
              {formatDuration(song.duration)}
            </span>
          </div>
        );
        })}
      </div>
    </div>
  );
}
