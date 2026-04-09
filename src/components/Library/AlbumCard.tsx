import { usePlayerStore } from '../../stores/playerStore';
import { api } from '../../lib/tauri';
import type { Album } from '../../lib/tauri';
import { CoverArt } from './CoverArt';

export async function playAlbum(albumId: string) {
  const detail = await api.getAlbum(albumId);
  const songs = detail.song ?? [];
  if (songs.length > 0) {
    usePlayerStore.getState().playTrackInContext(songs, 0);
  }
}

export function AlbumCard({ album, onClick, onArtistClick, showYear = true, itemProps }: {
  album: Album;
  onClick: () => void;
  onArtistClick?: () => void;
  showYear?: boolean;
  itemProps?: Record<string, unknown>;
}) {
  return (
    <div
      onClick={onClick}
      className="group row-hover text-left rounded-lg p-2.5 cursor-pointer bg-themed-secondary"
      {...itemProps}
    >
      <div className="relative mb-2">
        <CoverArt coverArt={album.cover_art} artist={album.artist} albumName={album.name} size={300} className="w-full aspect-square rounded-md" />
        <button
          onClick={(e) => { e.stopPropagation(); playAlbum(album.id); }}
          className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity btn-accent shadow-lg"
          title="Play album"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="none">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      </div>
      <p className="text-[13px] font-medium truncate text-themed-primary">
        {album.name}
      </p>
      <p className="text-[11px] truncate text-themed-secondary">
        {onArtistClick ? (
          <button
            onClick={(e) => { e.stopPropagation(); onArtistClick(); }}
            className="bg-transparent border-0 p-0 cursor-pointer text-themed-secondary hover:underline text-[11px]"
          >
            {album.artist ?? 'Unknown Artist'}
          </button>
        ) : (
          album.artist ?? 'Unknown Artist'
        )}
      </p>
      {showYear && album.year && (
        <p className="text-[11px] text-themed-muted">{album.year}</p>
      )}
    </div>
  );
}
