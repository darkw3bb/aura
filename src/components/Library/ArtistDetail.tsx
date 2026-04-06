import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { api } from '../../lib/tauri';
import { CoverArt } from './CoverArt';
import { StarRating } from '../Rating/StarRating';
import type { AlbumDetail, Song } from '../../lib/tauri';

function formatDuration(secs?: number): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ArtistDetail() {
  const { selectedArtist, artistAlbums, goBack, updateAlbumRating } = useLibraryStore();
  const { playTrackInContext, setRating } = usePlayerStore();

  const handleAlbumRating = async (albumId: string, rating: number) => {
    try {
      await api.setRating(albumId, rating);
      updateAlbumRating(albumId, rating);
    } catch (e) {
      console.error('Failed to save album rating:', e);
    }
  };

  if (!selectedArtist) return null;

  const allSongs = artistAlbums.flatMap((a) => a.song ?? []);

  return (
    <div className="p-6 overflow-y-auto h-full">
      <button
        onClick={goBack}
        className="nav-item text-[13px] mb-4 cursor-pointer bg-transparent border-0 px-0"
      >
        &larr; Back
      </button>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-themed-primary">
          {selectedArtist.name}
        </h2>
        <p className="text-xs mt-1 text-themed-muted">
          {artistAlbums.length} album{artistAlbums.length !== 1 ? 's' : ''}
          {allSongs.length > 0 && ` \u00b7 ${allSongs.length} track${allSongs.length !== 1 ? 's' : ''}`}
        </p>
        {allSongs.length > 0 && (
          <button
            onClick={() => playTrackInContext(allSongs, 0)}
            className="mt-3 px-6 py-2 rounded-full text-[13px] font-medium cursor-pointer w-fit btn-accent"
          >
            Play All
          </button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {artistAlbums.map((album) => (
          <AlbumSection
            key={album.id}
            album={album}
            onPlayTrack={(songs, index) => playTrackInContext(songs, index)}
            onRate={(id, r) => setRating(id, r)}
            onAlbumRate={(r) => handleAlbumRating(album.id, r)}
          />
        ))}
      </div>
    </div>
  );
}

function AlbumSection({
  album,
  onPlayTrack,
  onRate,
  onAlbumRate,
}: {
  album: AlbumDetail;
  onPlayTrack: (songs: Song[], index: number) => void;
  onRate: (trackId: string, rating: number) => void;
  onAlbumRate: (rating: number) => void;
}) {
  const { currentTrack, isPlaying } = usePlayerStore();
  const { loadArtist } = useLibraryStore();
  const songs = album.song ?? [];

  return (
    <div>
      <div className="flex gap-4 mb-3">
        <CoverArt
          coverArt={album.cover_art}
          artist={album.artist}
          albumName={album.name}
          size={300}
          className="w-20 h-20 rounded-md shrink-0"
        />
        <div className="flex flex-col justify-end min-w-0">
          <p className="text-[14px] font-semibold truncate text-themed-primary">
            {album.name}
          </p>
          <p className="text-xs text-themed-muted">
            {album.year && `${album.year} \u00b7 `}
            {songs.length} track{songs.length !== 1 ? 's' : ''}
            {album.genre && ` \u00b7 ${album.genre}`}
          </p>
          <div className="mt-1">
            <StarRating
              rating={album.user_rating ?? 0}
              onChange={onAlbumRate}
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden bg-themed-secondary">
        {songs.map((song, i) => (
          <div
            key={song.id}
            className="track-row flex items-center gap-3 px-4 py-2 cursor-pointer group"
            onDoubleClick={() => onPlayTrack(songs, i)}
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
            </div>
            <span className="w-36 min-w-0 text-[13px] truncate text-themed-secondary">
              {song.artist_id ? (
                <button
                  onClick={(e) => { e.stopPropagation(); loadArtist(song.artist_id!); }}
                  className="bg-transparent border-0 p-0 cursor-pointer text-themed-secondary hover:underline text-[13px] truncate max-w-full text-left"
                >
                  {song.artist ?? 'Unknown'}
                </button>
              ) : (song.artist ?? 'Unknown')}
            </span>
            <span className="text-[11px] tabular-nums w-14 text-right text-themed-muted">
              {song.bit_rate ? `${song.bit_rate}k` : ''}
            </span>
            <StarRating
              rating={song.user_rating ?? 0}
              onChange={(r) => onRate(song.id, r)}
              size="sm"
            />
            <span className="text-[11px] tabular-nums w-12 text-right text-themed-muted">
              {formatDuration(song.duration)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
