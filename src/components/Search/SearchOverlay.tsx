import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearch } from '../../hooks/useSearch';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useCommandPaletteStore } from '../../stores/commandPaletteStore';
import { useTrackTargetStore } from '../../stores/trackTargetStore';
import { CoverArt } from '../Library/CoverArt';
import { api } from '../../lib/tauri';
import type { FlatSong, Artist, Album, Genre, PlaylistSummary } from '../../lib/tauri';
import { flatSongToSong } from '../../lib/flatSong';

function formatDuration(secs?: number): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function matchesApplyTagCommand(query: string): boolean {
  const n = query.trim().toLowerCase();
  if (n.length < 1) return false;
  if ('apply tag'.includes(n)) return true;
  if (n.includes('tag')) return true;
  if (n.includes('apply')) return true;
  return false;
}

type SearchItem =
  | { type: 'artist'; data: Artist }
  | { type: 'album'; data: Album }
  | { type: 'genre'; data: Genre }
  | { type: 'song'; data: FlatSong };

type PaletteRow =
  | { kind: 'command'; cmd: 'apply-tag'; disabled: boolean }
  | { kind: 'search'; item: SearchItem };

type TagRow = { type: 'playlist'; pl: PlaylistSummary } | { type: 'create'; name: string };

function ArtistIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AlbumIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function GenreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function TrackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function SearchOverlay() {
  const open = useCommandPaletteStore((s) => s.open);
  const startInTagStep = useCommandPaletteStore((s) => s.startInTagStep);
  const closePalette = useCommandPaletteStore((s) => s.closePalette);

  const keyboardTarget = useTrackTargetStore((s) => s.keyboardTarget);
  const hoverTarget = useTrackTargetStore((s) => s.hoverTarget);
  const targetSong = keyboardTarget ?? hoverTarget;

  const [step, setStep] = useState<'palette' | 'tag'>('palette');
  const [tagQuery, setTagQuery] = useState('');
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [tagListIndex, setTagListIndex] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [tagBusy, setTagBusy] = useState(false);
  const openedDirectToTag = useRef(false);

  const { query, results, loading, search, clear } = useSearch();
  const { playTrack } = usePlayerStore();
  const { loadArtist, loadAlbum, loadGenre } = useLibraryStore();

  const loadPlaylists = useCallback(() => {
    return api.listCachedPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  useEffect(() => {
    if (!open) {
      setStep('palette');
      setTagQuery('');
      setTagListIndex(0);
      setHint(null);
      setTagBusy(false);
      openedDirectToTag.current = false;
      clear();
      return;
    }
    if (startInTagStep) {
      setStep('tag');
      openedDirectToTag.current = true;
      useCommandPaletteStore.setState({ startInTagStep: false });
      void loadPlaylists();
    }
  }, [open, startInTagStep, loadPlaylists, clear]);

  const flatItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    for (const a of results.artists) items.push({ type: 'artist', data: a });
    for (const a of results.albums) items.push({ type: 'album', data: a });
    for (const g of results.genres) items.push({ type: 'genre', data: g });
    for (const s of results.songs) items.push({ type: 'song', data: s });
    return items;
  }, [results]);

  const paletteRows = useMemo<PaletteRow[]>(() => {
    const rows: PaletteRow[] = [];
    if (matchesApplyTagCommand(query)) {
      rows.push({ kind: 'command', cmd: 'apply-tag', disabled: !targetSong });
    }
    for (const item of flatItems) {
      rows.push({ kind: 'search', item });
    }
    return rows;
  }, [query, flatItems, targetSong]);

  const [activeIndex, setActiveIndex] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const keyboardNavRef = useRef(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results, step]);

  useEffect(() => {
    rowRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const tagRows = useMemo<TagRow[]>(() => {
    const n = tagQuery.trim().toLowerCase();
    const sorted = [...playlists].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const filtered = n ? sorted.filter((p) => p.name.toLowerCase().includes(n)) : sorted;
    const rows: TagRow[] = filtered.slice(0, 50).map((pl) => ({ type: 'playlist', pl }));
    const trimmed = tagQuery.trim();
    const exact =
      trimmed.length > 0 &&
      playlists.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (trimmed && !exact) {
      rows.push({ type: 'create', name: trimmed });
    }
    return rows;
  }, [playlists, tagQuery]);

  useEffect(() => {
    setTagListIndex(0);
  }, [tagQuery, playlists]);

  useEffect(() => {
    if (tagListIndex >= tagRows.length) {
      setTagListIndex(Math.max(0, tagRows.length - 1));
    }
  }, [tagRows, tagListIndex]);

  const executeSearchItem = useCallback(
    (item: SearchItem) => {
      switch (item.type) {
        case 'artist':
          loadArtist(item.data.id);
          break;
        case 'album':
          loadAlbum(item.data.id);
          break;
        case 'genre':
          loadGenre(item.data.value);
          break;
        case 'song':
          playTrack(flatSongToSong(item.data));
          break;
      }
      closePalette();
    },
    [loadArtist, loadAlbum, loadGenre, playTrack, closePalette],
  );

  const goToTagStep = useCallback(() => {
    setHint(null);
    setStep('tag');
    setTagQuery('');
    openedDirectToTag.current = false;
    void loadPlaylists();
  }, [loadPlaylists]);

  const applyTag = useCallback(
    async (name: string) => {
      if (!targetSong || !name.trim()) return;
      setTagBusy(true);
      setHint(null);
      try {
        await api.applyPlaylistTag(targetSong, name.trim());
        window.dispatchEvent(new CustomEvent('aura-tags-changed'));
        closePalette();
      } catch (e) {
        setHint(String(e));
      } finally {
        setTagBusy(false);
      }
    },
    [targetSong, closePalette],
  );

  const handlePaletteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (step !== 'palette') return;
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closePalette();
          break;
        case 'ArrowDown':
          e.preventDefault();
          keyboardNavRef.current = true;
          setActiveIndex((i) => Math.min(i + 1, Math.max(0, paletteRows.length - 1)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          keyboardNavRef.current = true;
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter': {
          e.preventDefault();
          const row = paletteRows[activeIndex];
          if (!row) return;
          if (row.kind === 'command') {
            if (row.disabled) {
              setHint('Select a track first (use J/K or hover a row).');
              return;
            }
            goToTagStep();
            return;
          }
          executeSearchItem(row.item);
          break;
        }
      }
    },
    [step, closePalette, paletteRows, activeIndex, goToTagStep, executeSearchItem],
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (step !== 'tag') return;
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          if (openedDirectToTag.current) {
            closePalette();
          } else {
            setStep('palette');
            setTagQuery('');
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          setTagListIndex((i) => Math.min(i + 1, Math.max(0, tagRows.length - 1)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setTagListIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter': {
          e.preventDefault();
          const row = tagRows[tagListIndex];
          if (!row || tagBusy) return;
          if (row.type === 'playlist') {
            void applyTag(row.pl.name);
          } else {
            void applyTag(row.name);
          }
          break;
        }
      }
    },
    [step, tagRows, tagListIndex, tagBusy, applyTag, closePalette],
  );

  const handleMouseMove = useCallback(() => {
    keyboardNavRef.current = false;
  }, []);

  const handleMouseEnterPalette = useCallback((flatIdx: number) => {
    if (!keyboardNavRef.current) setActiveIndex(flatIdx);
  }, []);

  if (!open) return null;

  const { artists, albums, songs, genres } = results;
  const hasResults = artists.length > 0 || albums.length > 0 || genres.length > 0 || songs.length > 0;
  const showCommand = matchesApplyTagCommand(query);

  const artistStartIdx = showCommand ? 1 : 0;
  const albumStartIdx = artistStartIdx + artists.length;
  const genreStartIdx = albumStartIdx + albums.length;
  const songStartIdx = genreStartIdx + genres.length;

  const setRowRef = (flatIdx: number) => (el: HTMLDivElement | null) => {
    rowRefs.current[flatIdx] = el;
  };

  if (step === 'tag') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-24"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={() => closePalette()}
      >
        <div
          className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl bg-themed-secondary"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-themed">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted mb-1">Apply tag</p>
            {targetSong && (
              <p className="text-[13px] text-themed-primary truncate">
                {targetSong.title}
                <span className="text-themed-muted"> — {targetSong.artist ?? 'Unknown'}</span>
              </p>
            )}
            {!targetSong && (
              <p className="text-[13px] text-themed-muted">No track selected.</p>
            )}
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-themed">
            <input
              autoFocus
              type="text"
              placeholder="Tag or playlist name…"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              onKeyDown={handleTagKeyDown}
              disabled={!targetSong || tagBusy}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] text-themed-primary"
            />
          </div>
          {hint && <div className="px-4 py-2 text-[12px] text-red-400">{hint}</div>}
          <div className="max-h-80 overflow-y-auto">
            {tagRows.length === 0 && (
              <div className="px-4 py-4 text-[13px] text-themed-muted">
                {playlists.length === 0 ? 'No playlists yet — type a new tag name and press Enter.' : 'No matches — press Enter to create this tag.'}
              </div>
            )}
            {tagRows.map((row, i) => (
              <div
                key={row.type === 'playlist' ? row.pl.id : `create-${row.name}`}
                className={`track-row px-4 py-2 cursor-pointer text-[13px] ${i === tagListIndex ? 'track-row-active' : 'text-themed-primary'}`}
                onClick={() => {
                  if (!targetSong || tagBusy) return;
                  if (row.type === 'playlist') void applyTag(row.pl.name);
                  else void applyTag(row.name);
                }}
                onMouseEnter={() => setTagListIndex(i)}
              >
                {row.type === 'playlist' ? (
                  <span>{row.pl.name}</span>
                ) : (
                  <span className="text-themed-accent">Create &ldquo;{row.name}&rdquo;</span>
                )}
              </div>
            ))}
          </div>
          {tagBusy && <div className="px-4 py-2 text-[12px] text-themed-muted">Saving…</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={() => closePalette()}
    >
      <div
        className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl bg-themed-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-themed">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="stroke-themed-muted" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            autoFocus
            type="text"
            placeholder="Search or type a command (e.g. tag)…"
            value={query}
            onChange={(e) => search(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-themed-primary"
            onKeyDown={handlePaletteKeyDown}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                clear();
              }}
              className="text-[11px] cursor-pointer bg-transparent border-0 text-themed-muted"
            >
              Clear
            </button>
          )}
        </div>

        {hint && <div className="px-4 py-2 text-[12px] text-amber-400 border-b border-themed">{hint}</div>}

        {loading && (
          <div className="px-4 py-3 text-[13px] text-themed-muted">
            Searching...
          </div>
        )}

        {(showCommand || hasResults) && (
          <div className="max-h-96 overflow-y-auto" onMouseMove={handleMouseMove}>
            {showCommand && (
              <div className="search-group">
                <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-themed-secondary border-b border-themed">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted">Commands</span>
                </div>
                <div
                  ref={setRowRef(0)}
                  className={`track-row flex items-center gap-3 px-4 py-2 cursor-pointer ${activeIndex === 0 ? 'track-row-active' : ''} ${!targetSong ? 'opacity-50' : ''}`}
                  onClick={() => {
                    if (!targetSong) {
                      setHint('Select a track first (use J/K or hover a row).');
                      return;
                    }
                    goToTagStep();
                  }}
                  onMouseEnter={() => handleMouseEnterPalette(0)}
                >
                  <span className="text-[13px] text-themed-primary">Apply tag</span>
                  <span className="search-type-pill ml-auto">Command</span>
                </div>
              </div>
            )}

            {artists.length > 0 && (
              <div className="search-group">
                <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-themed-secondary border-b border-themed">
                  <span className="text-themed-muted"><ArtistIcon /></span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted">Artists</span>
                  <span className="text-[10px] text-themed-muted opacity-60">{artists.length}</span>
                </div>
                {artists.map((artist, i) => {
                  const flatIdx = artistStartIdx + i;
                  return (
                    <div
                      key={artist.id}
                      ref={setRowRef(flatIdx)}
                      className={`track-row flex items-center gap-3 px-4 py-2 cursor-pointer ${flatIdx === activeIndex ? 'track-row-active' : ''}`}
                      onClick={() => {
                        loadArtist(artist.id);
                        closePalette();
                      }}
                      onMouseEnter={() => handleMouseEnterPalette(flatIdx)}
                    >
                      <CoverArt coverArt={artist.cover_art} size={80} className="w-8 h-8 rounded-full shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate text-themed-primary">{artist.name}</p>
                        {artist.album_count != null && (
                          <p className="text-[11px] text-themed-muted">{artist.album_count} album{artist.album_count !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                      <span className="search-type-pill">Artist</span>
                    </div>
                  );
                })}
              </div>
            )}

            {albums.length > 0 && (
              <div className="search-group">
                <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-themed-secondary border-b border-themed">
                  <span className="text-themed-muted"><AlbumIcon /></span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted">Albums</span>
                  <span className="text-[10px] text-themed-muted opacity-60">{albums.length}</span>
                </div>
                {albums.map((album, i) => {
                  const flatIdx = albumStartIdx + i;
                  return (
                    <div
                      key={album.id}
                      ref={setRowRef(flatIdx)}
                      className={`track-row flex items-center gap-3 px-4 py-2 cursor-pointer ${flatIdx === activeIndex ? 'track-row-active' : ''}`}
                      onClick={() => {
                        loadAlbum(album.id);
                        closePalette();
                      }}
                      onMouseEnter={() => handleMouseEnterPalette(flatIdx)}
                    >
                      <CoverArt coverArt={album.cover_art} artist={album.artist} albumName={album.name} size={80} className="w-8 h-8 rounded shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate text-themed-primary">{album.name}</p>
                        <p className="text-[11px] truncate text-themed-muted">
                          {album.artist ?? 'Unknown Artist'}
                          {album.year ? ` \u00b7 ${album.year}` : ''}
                        </p>
                      </div>
                      <span className="search-type-pill">Album</span>
                    </div>
                  );
                })}
              </div>
            )}

            {genres.length > 0 && (
              <div className="search-group">
                <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-themed-secondary border-b border-themed">
                  <span className="text-themed-muted"><GenreIcon /></span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted">Genres</span>
                  <span className="text-[10px] text-themed-muted opacity-60">{genres.length}</span>
                </div>
                {genres.map((genre, i) => {
                  const flatIdx = genreStartIdx + i;
                  return (
                    <div
                      key={genre.value}
                      ref={setRowRef(flatIdx)}
                      className={`track-row flex items-center gap-3 px-4 py-2 cursor-pointer ${flatIdx === activeIndex ? 'track-row-active' : ''}`}
                      onClick={() => {
                        loadGenre(genre.value);
                        closePalette();
                      }}
                      onMouseEnter={() => handleMouseEnterPalette(flatIdx)}
                    >
                      <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center bg-themed-tertiary text-themed-muted">
                        <GenreIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate text-themed-primary">{genre.value}</p>
                        <p className="text-[11px] text-themed-muted">
                          {genre.song_count} track{genre.song_count !== 1 ? 's' : ''}
                          {' \u00b7 '}
                          {genre.album_count} album{genre.album_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="search-type-pill">Genre</span>
                    </div>
                  );
                })}
              </div>
            )}

            {songs.length > 0 && (
              <div className="search-group">
                <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-themed-secondary border-b border-themed">
                  <span className="text-themed-muted"><TrackIcon /></span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted">Tracks</span>
                  <span className="text-[10px] text-themed-muted opacity-60">{songs.length}</span>
                </div>
                {songs.map((song, i) => {
                  const flatIdx = songStartIdx + i;
                  return (
                    <div
                      key={song.id}
                      ref={setRowRef(flatIdx)}
                      className={`track-row flex items-center gap-3 px-4 py-2 cursor-pointer ${flatIdx === activeIndex ? 'track-row-active' : ''}`}
                      onClick={() => {
                        playTrack(flatSongToSong(song));
                        closePalette();
                      }}
                      onMouseEnter={() => handleMouseEnterPalette(flatIdx)}
                    >
                      <CoverArt coverArt={song.cover_art} artist={song.artist} albumName={song.album} size={80} className="w-8 h-8 rounded shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate text-themed-primary">
                          {song.title}
                        </p>
                        <p className="text-[11px] truncate text-themed-secondary">
                          {song.artist ?? 'Unknown'} &middot; {song.album ?? 'Unknown Album'}
                        </p>
                      </div>
                      <span className="text-[11px] tabular-nums text-themed-muted mr-2">
                        {formatDuration(song.duration)}
                      </span>
                      <span className="search-type-pill">Track</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {query && !loading && !showCommand && !hasResults && (
          <div className="px-4 py-6 text-center text-[13px] text-themed-muted">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
