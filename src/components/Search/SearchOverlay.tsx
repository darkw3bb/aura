import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearch } from '../../hooks/useSearch';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { CoverArt } from '../Library/CoverArt';
import type { FlatSong, Artist, Album } from '../../lib/tauri';

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

type SearchItem =
  | { type: 'artist'; data: Artist }
  | { type: 'album'; data: Album }
  | { type: 'song'; data: FlatSong };

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

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

function TrackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const { query, results, loading, search, clear } = useSearch();
  const { playTrack } = usePlayerStore();
  const { loadArtist, loadAlbum } = useLibraryStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const keyboardNavRef = useRef(false);

  const flatItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    for (const a of results.artists) items.push({ type: 'artist', data: a });
    for (const a of results.albums) items.push({ type: 'album', data: a });
    for (const s of results.songs) items.push({ type: 'song', data: s });
    return items;
  }, [results]);

  useEffect(() => { setActiveIndex(0); }, [results]);

  useEffect(() => {
    rowRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const executeItem = useCallback((item: SearchItem) => {
    switch (item.type) {
      case 'artist': loadArtist(item.data.id); break;
      case 'album': loadAlbum(item.data.id); break;
      case 'song': playTrack(flatSongToSong(item.data)); break;
    }
    onClose();
  }, [loadArtist, loadAlbum, playTrack, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        keyboardNavRef.current = true;
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        keyboardNavRef.current = true;
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[activeIndex]) executeItem(flatItems[activeIndex]);
        break;
    }
  }, [onClose, flatItems, activeIndex, executeItem]);

  const handleMouseMove = useCallback(() => {
    keyboardNavRef.current = false;
  }, []);

  const handleMouseEnter = useCallback((flatIdx: number) => {
    if (!keyboardNavRef.current) setActiveIndex(flatIdx);
  }, []);

  if (!open) return null;

  const { artists, albums, songs } = results;
  const hasResults = artists.length > 0 || albums.length > 0 || songs.length > 0;

  const artistStartIdx = 0;
  const albumStartIdx = artists.length;
  const songStartIdx = artists.length + albums.length;

  const setRowRef = (flatIdx: number) => (el: HTMLDivElement | null) => {
    rowRefs.current[flatIdx] = el;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
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
            placeholder="Search tracks, albums, artists..."
            value={query}
            onChange={(e) => search(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-themed-primary"
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => { clear(); }}
              className="text-[11px] cursor-pointer bg-transparent border-0 text-themed-muted"
            >
              Clear
            </button>
          )}
        </div>

        {loading && (
          <div className="px-4 py-3 text-[13px] text-themed-muted">
            Searching...
          </div>
        )}

        {hasResults && (
          <div className="max-h-96 overflow-y-auto" onMouseMove={handleMouseMove}>
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
                      onClick={() => { loadArtist(artist.id); onClose(); }}
                      onMouseEnter={() => handleMouseEnter(flatIdx)}
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
                      onClick={() => { loadAlbum(album.id); onClose(); }}
                      onMouseEnter={() => handleMouseEnter(flatIdx)}
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
                      onClick={() => { playTrack(flatSongToSong(song)); onClose(); }}
                      onMouseEnter={() => handleMouseEnter(flatIdx)}
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

        {query && !loading && !hasResults && (
          <div className="px-4 py-6 text-center text-[13px] text-themed-muted">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
