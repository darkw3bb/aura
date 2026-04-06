import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { api } from '../../lib/tauri';
import { CoverArt } from './CoverArt';
import { StarRating } from '../Rating/StarRating';

function formatDuration(secs?: number): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AlbumDetail() {
  const { selectedAlbum, setView, loadArtist, updateAlbumRating } = useLibraryStore();
  const { playTrackInContext, setRating, currentTrack, isPlaying } = usePlayerStore();

  const handleAlbumRating = async (rating: number) => {
    if (!selectedAlbum) return;
    try {
      await api.setRating(selectedAlbum.id, rating);
      updateAlbumRating(selectedAlbum.id, rating);
    } catch (e) {
      console.error('Failed to save album rating:', e);
    }
  };

  if (!selectedAlbum) return null;

  const songs = selectedAlbum.song ?? [];

  return (
    <div className="p-6 overflow-y-auto h-full">
      <button
        onClick={() => setView('albums')}
        className="nav-item text-[13px] mb-4 cursor-pointer bg-transparent border-0 px-0"
      >
        &larr; Back to Albums
      </button>

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
            className="mt-3 px-6 py-2 rounded-full text-[13px] font-medium text-white cursor-pointer w-fit"
            style={{ background: 'var(--accent)' }}
          >
            Play All
          </button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden bg-themed-secondary">
        {songs.map((song, i) => (
          <div
            key={song.id}
            className="track-row flex items-center gap-3 px-4 py-2 cursor-pointer group"
            onDoubleClick={() => playTrackInContext(songs, i)}
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
              <p className={`text-[13px] truncate ${currentTrack?.id === song.id ? '' : 'text-themed-primary'}`} style={currentTrack?.id === song.id ? { color: 'var(--accent)' } : undefined}>
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
        ))}
      </div>
    </div>
  );
}
