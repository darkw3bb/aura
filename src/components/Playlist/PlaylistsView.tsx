import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/tauri';
import type { PlaylistSummary } from '../../lib/tauri';
import { VirtualTrackList } from '../TrackList/VirtualTrackList';
import { useLibraryStore } from '../../stores/libraryStore';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';

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
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [focus, setFocus] = useState<'sidebar' | 'tracks'>('sidebar');
  const selectedPlaylistName = useLibraryStore((s) => s.selectedPlaylistName);
  const appliedNameRef = useRef<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const refresh = useCallback(() => {
    api.listCachedPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedPlaylistName || playlists.length === 0) return;
    if (appliedNameRef.current === selectedPlaylistName) return;
    const match = playlists.find(
      (p) => p.name.toLowerCase() === selectedPlaylistName.toLowerCase(),
    );
    if (match) {
      setSelectedId(match.id);
      setFocus('tracks');
      appliedNameRef.current = selectedPlaylistName;
    }
  }, [selectedPlaylistName, playlists]);

  useEffect(() => {
    const onTags = () => refresh();
    window.addEventListener('aura-tags-changed', onTags);
    return () => window.removeEventListener('aura-tags-changed', onTags);
  }, [refresh]);

  const selected = useMemo(
    () => playlists.find((p) => p.id === selectedId) ?? null,
    [playlists, selectedId],
  );

  const handleSidebarActivate = useCallback(
    (index: number) => {
      const p = playlists[index];
      if (p) {
        setSelectedId(p.id);
        setConfirmDelete(null);
        setColorPickerOpen(false);
        setFocus('tracks');
      }
    },
    [playlists],
  );

  const handleEscapeToSidebar = useCallback(() => {
    setFocus('sidebar');
  }, []);

  const { focusIndex: sidebarFocusIndex, getItemProps: getSidebarItemProps } = useKeyboardNav({
    itemCount: playlists.length,
    onActivate: handleSidebarActivate,
    scrollRef: sidebarRef,
    enabled: focus === 'sidebar',
  });

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.deletePlaylist(id);
      setConfirmDelete(null);
      if (selectedId === id) {
        setSelectedId(null);
        setFocus('sidebar');
      }
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

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingName(id);
    setEditValue(currentName);
    setConfirmDelete(null);
    setColorPickerOpen(false);
  }, []);

  const commitRename = useCallback(async () => {
    if (!editingName) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingName(null);
      return;
    }
    const prev = playlists.find((p) => p.id === editingName);
    if (prev && prev.name === trimmed) {
      setEditingName(null);
      return;
    }
    try {
      await api.renamePlaylist(editingName, trimmed);
      setPlaylists((prev) =>
        prev.map((p) => (p.id === editingName ? { ...p, name: trimmed } : p)),
      );
      window.dispatchEvent(new Event('aura-tags-changed'));
    } catch (e) {
      console.error('rename playlist failed', e);
    }
    setEditingName(null);
  }, [editingName, editValue, playlists]);

  return (
    <div className="flex h-full min-h-0">
      <nav
        ref={sidebarRef}
        className="w-52 shrink-0 border-r border-themed overflow-y-auto bg-themed-secondary flex flex-col"
      >
        <div className="px-3 py-3 border-b border-themed">
          <h2 className="text-[13px] font-semibold text-themed-primary">Playlists</h2>
          <p className="text-[11px] text-themed-muted mt-0.5">Tags from Navidrome</p>
        </div>
        {playlists.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-themed-muted leading-relaxed">
            No playlists in the local cache yet. Tags sync in the background after you connect, or use Cmd+K to tag a track (creates a playlist on the server).
          </p>
        )}
        <div className="flex flex-col gap-0.5 p-2">
          {playlists.map((p, i) => {
            const itemProps = getSidebarItemProps(i);
            const isKbdFocused = focus === 'sidebar' && sidebarFocusIndex === i;
            return (
              <button
                key={p.id}
                type="button"
                data-active={selectedId === p.id}
                data-kbd-idx={itemProps['data-kbd-idx']}
                data-focused={itemProps['data-focused']}
                onClick={() => { setSelectedId(p.id); setConfirmDelete(null); setColorPickerOpen(false); setFocus('tracks'); }}
                onMouseEnter={itemProps.onMouseEnter}
                className={`nav-item w-full text-left px-2.5 py-2 rounded-md text-[13px] cursor-pointer truncate flex items-center gap-1.5 ${isKbdFocused ? 'ring-1 ring-themed-accent' : ''}`}
              >
                <ColorDot color={p.color ?? 'default'} />
                <span className="truncate flex-1">
                  {p.name}
                  {p.song_count != null && (
                    <span className="block text-[10px] text-themed-muted tabular-nums">{p.song_count} tracks</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-themed shrink-0">
              <ColorDot color={selected.color ?? 'default'} />
              {editingName === selected.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingName(null);
                  }}
                  className="flex-1 min-w-0 text-[15px] font-semibold text-themed-primary bg-themed-tertiary border border-themed rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-themed-accent"
                />
              ) : (
                <h3
                  className="text-[15px] font-semibold text-themed-primary truncate flex-1 cursor-pointer"
                  onDoubleClick={() => startRename(selected.id, selected.name)}
                  title="Double-click to rename"
                >
                  {selected.name}
                </h3>
              )}
              <button
                type="button"
                onClick={() => startRename(selected.id, selected.name)}
                className="bg-transparent border border-themed rounded px-2 py-0.5 text-[11px] text-themed-secondary hover:text-themed-primary cursor-pointer"
                title="Rename playlist"
              >
                Rename
              </button>
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
                keyboardNavEnabled={focus === 'tracks'}
                onEscape={handleEscapeToSidebar}
              />
            </div>
          </>
        ) : (
          <div className="p-8 text-[13px] text-themed-muted">
            {focus === 'sidebar' && playlists.length > 0
              ? 'Use J/K to navigate playlists, Enter to select.'
              : 'Select a playlist on the left.'}
          </div>
        )}
      </div>
    </div>
  );
}
