import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/tauri';
import type { PlaylistSummary } from '../../lib/tauri';
import { VirtualTrackList } from '../TrackList/VirtualTrackList';

const PILL_COLORS = [
  { key: 'default', label: 'Default' },
  { key: 'red', label: 'Red' },
  { key: 'orange', label: 'Orange' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'green', label: 'Green' },
  { key: 'blue', label: 'Blue' },
  { key: 'purple', label: 'Purple' },
  { key: 'pink', label: 'Pink' },
  { key: 'teal', label: 'Teal' },
] as const;

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 pill-color-${color}`}
    />
  );
}

export function PlaylistsView() {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

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

  const selected = useMemo(
    () => playlists.find((p) => p.id === selectedId) ?? null,
    [playlists, selectedId],
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.deletePlaylist(id);
      setConfirmDelete(null);
      if (selectedId === id) setSelectedId(null);
      refresh();
      window.dispatchEvent(new Event('aura-tags-changed'));
    } catch (e) {
      console.error('delete playlist failed', e);
    }
  }, [selectedId, refresh]);

  const handleColorChange = useCallback(async (id: string, color: string) => {
    try {
      await api.setPlaylistColor(id, color);
      setPlaylists((prev) =>
        prev.map((p) => (p.id === id ? { ...p, color } : p)),
      );
      setColorPickerOpen(false);
      window.dispatchEvent(new Event('aura-tags-changed'));
    } catch (e) {
      console.error('set color failed', e);
    }
  }, []);

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
              onClick={() => { setSelectedId(p.id); setConfirmDelete(null); setColorPickerOpen(false); }}
              className="nav-item w-full text-left px-2.5 py-2 rounded-md text-[13px] cursor-pointer truncate flex items-center gap-1.5"
            >
              <ColorDot color={p.color ?? 'default'} />
              <span className="truncate flex-1">
                {p.name}
                {p.song_count != null && (
                  <span className="block text-[10px] text-themed-muted tabular-nums">{p.song_count} tracks</span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-themed shrink-0">
              <ColorDot color={selected.color ?? 'default'} />
              <h3 className="text-[15px] font-semibold text-themed-primary truncate flex-1">{selected.name}</h3>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setColorPickerOpen((v) => !v); setConfirmDelete(null); }}
                  className="bg-transparent border border-themed rounded px-2 py-0.5 text-[11px] text-themed-secondary hover:text-themed-primary cursor-pointer"
                  title="Change color"
                >
                  Color
                </button>
                {colorPickerOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-themed-primary border border-themed rounded-lg shadow-lg p-2 z-50 flex gap-1.5">
                    {PILL_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => handleColorChange(selected.id, c.key)}
                        className={`w-5 h-5 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 pill-color-${c.key} ${(selected.color ?? 'default') === c.key ? 'border-themed-primary ring-1 ring-themed-primary' : 'border-transparent'}`}
                        title={c.label}
                      />
                    ))}
                  </div>
                )}
              </div>
              {confirmDelete === selected.id ? (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-themed-muted">Delete?</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(selected.id)}
                    className="bg-red-600 text-white rounded px-2 py-0.5 text-[11px] cursor-pointer border-0 hover:bg-red-700"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="bg-transparent border border-themed rounded px-2 py-0.5 text-[11px] text-themed-secondary cursor-pointer hover:text-themed-primary"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setConfirmDelete(selected.id); setColorPickerOpen(false); }}
                  className="bg-transparent border border-themed rounded px-2 py-0.5 text-[11px] text-themed-secondary hover:text-red-500 cursor-pointer"
                  title="Delete playlist"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <VirtualTrackList
                resetKey={selected.id}
                title={selected.name}
                showTagPills={false}
                fetchPage={async (offset, limit) => api.getCachedPlaylistTracks(selected.id, offset, limit)}
                subtitle={(count, hasMore) =>
                  `${count} track${count !== 1 ? 's' : ''}${hasMore ? ' · scroll for more' : ''}`}
                emptyContent={
                  <div className="px-6 py-8 text-[13px] text-themed-muted text-center">
                    No tracks in this playlist (or they are not in your local library cache yet).
                  </div>
                }
              />
            </div>
          </>
        ) : (
          <div className="p-8 text-[13px] text-themed-muted">
            Select a playlist on the left.
          </div>
        )}
      </div>
    </div>
  );
}
