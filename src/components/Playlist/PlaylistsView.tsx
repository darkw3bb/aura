import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/tauri';
import type { PlaylistSummary } from '../../lib/tauri';
import { VirtualTrackList } from '../TrackList/VirtualTrackList';

export function PlaylistsView() {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.listCachedPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onTags = () => refresh();
    window.addEventListener('aura-tags-changed', onTags);
    return () => window.removeEventListener('aura-tags-changed', onTags);
  }, [refresh]);

  const selectedName = useMemo(
    () => playlists.find((p) => p.id === selectedId)?.name ?? 'Playlist',
    [playlists, selectedId],
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="w-52 shrink-0 border-r border-themed overflow-y-auto bg-themed-secondary flex flex-col">
        <div className="px-3 py-3 border-b border-themed">
          <h2 className="text-[13px] font-semibold text-themed-primary">Playlists</h2>
          <p className="text-[11px] text-themed-muted mt-0.5">Tags from Navidrome</p>
        </div>
        {playlists.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-themed-muted leading-relaxed">
            No playlists in the local cache yet. Tags sync in the background after you connect, or use Cmd+K to tag a track (creates a playlist on the server).
          </p>
        )}
        <nav className="flex flex-col gap-0.5 p-2">
          {playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              data-active={selectedId === p.id}
              onClick={() => setSelectedId(p.id)}
              className="nav-item w-full text-left px-2.5 py-2 rounded-md text-[13px] cursor-pointer truncate"
            >
              {p.name}
              {p.song_count != null && (
                <span className="block text-[10px] text-themed-muted tabular-nums">{p.song_count} tracks</span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedId ? (
          <VirtualTrackList
            resetKey={selectedId}
            title={selectedName}
            showTagPills={false}
            fetchPage={async (offset, limit) => api.getCachedPlaylistTracks(selectedId, offset, limit)}
            subtitle={(count, hasMore) =>
              `${count} track${count !== 1 ? 's' : ''}${hasMore ? ' · scroll for more' : ''}`}
            emptyContent={
              <div className="px-6 py-8 text-[13px] text-themed-muted text-center">
                No tracks in this playlist (or they are not in your local library cache yet).
              </div>
            }
          />
        ) : (
          <div className="p-8 text-[13px] text-themed-muted">
            Select a playlist on the left.
          </div>
        )}
      </div>
    </div>
  );
}
