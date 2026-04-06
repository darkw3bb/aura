import { useEffect } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import type { Album } from '../../lib/tauri';
import { CoverArt } from './CoverArt';

export function AlbumGrid() {
  const { albums, loadAlbums, loadAlbum, loadArtist } = useLibraryStore();

  useEffect(() => {
    loadAlbums('newest');
  }, [loadAlbums]);

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-lg font-semibold mb-4 text-themed-primary">Albums</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))' }}>
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} onClick={() => loadAlbum(album.id)} onArtistClick={album.artist_id ? () => loadArtist(album.artist_id!) : undefined} />
        ))}
      </div>
    </div>
  );
}

function AlbumCard({ album, onClick, onArtistClick }: { album: Album; onClick: () => void; onArtistClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="row-hover text-left rounded-lg p-2.5 cursor-pointer bg-themed-secondary"
    >
      <CoverArt coverArt={album.cover_art} artist={album.artist} albumName={album.name} size={300} className="w-full aspect-square rounded-md mb-2" />
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
      {album.year && (
        <p className="text-[11px] text-themed-muted">{album.year}</p>
      )}
    </div>
  );
}
