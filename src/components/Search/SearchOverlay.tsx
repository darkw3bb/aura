import { useSearch } from '../../hooks/useSearch';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { CoverArt } from '../Library/CoverArt';
import type { FlatSong } from '../../lib/tauri';

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

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const { query, results, loading, search, clear } = useSearch();
  const { playTrack } = usePlayerStore();
  const { loadArtist, loadAlbum } = useLibraryStore();

  if (!open) return null;

  const { artists, albums, songs } = results;
  const hasResults = artists.length > 0 || albums.length > 0 || songs.length > 0;

  const handlePlay = (song: FlatSong) => {
    playTrack(flatSongToSong(song));
    onClose();
  };

  const handleArtistClick = (id: string) => {
    loadArtist(id);
    onClose();
  };

  const handleAlbumClick = (id: string) => {
    loadAlbum(id);
    onClose();
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
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
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
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
          <div className="max-h-96 overflow-y-auto">
            {artists.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted">Artists</p>
                </div>
                {artists.map((artist) => (
                  <div
                    key={artist.id}
                    className="track-row flex items-center gap-3 px-4 py-2 cursor-pointer"
                    onClick={() => handleArtistClick(artist.id)}
                  >
                    <CoverArt coverArt={artist.cover_art} size={80} className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] truncate text-themed-primary">{artist.name}</p>
                      {artist.album_count != null && (
                        <p className="text-[11px] text-themed-muted">{artist.album_count} album{artist.album_count !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {albums.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted">Albums</p>
                </div>
                {albums.map((album) => (
                  <div
                    key={album.id}
                    className="track-row flex items-center gap-3 px-4 py-2 cursor-pointer"
                    onClick={() => handleAlbumClick(album.id)}
                  >
                    <CoverArt coverArt={album.cover_art} artist={album.artist} albumName={album.name} size={80} className="w-8 h-8 rounded shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] truncate text-themed-primary">{album.name}</p>
                      <p className="text-[11px] truncate text-themed-muted">
                        {album.artist ?? 'Unknown Artist'}
                        {album.year ? ` \u00b7 ${album.year}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {songs.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-themed-muted">Tracks</p>
                </div>
                {songs.map((song) => (
                  <div
                    key={song.id}
                    className="track-row flex items-center gap-3 px-4 py-2 cursor-pointer"
                    onClick={() => handlePlay(song)}
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
                    <span className="text-[11px] tabular-nums text-themed-muted">
                      {formatDuration(song.duration)}
                    </span>
                  </div>
                ))}
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
