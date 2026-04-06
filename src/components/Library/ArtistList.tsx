import { useEffect } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';

export function ArtistList() {
  const { artists, selectedArtist, loadArtists, loadArtist } = useLibraryStore();

  useEffect(() => {
    loadArtists();
  }, [loadArtists]);

  return (
    <div className="px-3 pt-1 pb-2 overflow-y-auto h-full">
      <p className="section-label">Artists</p>
      <div className="flex flex-col">
        {artists.map((artist) => (
          <button
            key={artist.id}
            data-active={selectedArtist?.id === artist.id}
            className="nav-item w-full flex items-center gap-1 text-left px-2.5 py-[5px] rounded text-[12px] cursor-pointer text-themed-secondary"
            onClick={() => loadArtist(artist.id)}
          >
            <span className="truncate flex-1">{artist.name}</span>
            {artist.album_count != null && (
              <span className="text-[10px] text-themed-muted shrink-0 tabular-nums opacity-60">
                {artist.album_count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
