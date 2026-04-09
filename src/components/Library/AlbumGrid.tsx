import { useCallback, useEffect, useRef } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { AlbumCard } from './AlbumCard';

export function AlbumGrid() {
  const { albums, loadAlbums, loadAlbum, loadArtist } = useLibraryStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAlbums('recent');
  }, [loadAlbums]);

  const onActivate = useCallback(
    (i: number) => { if (albums[i]) loadAlbum(albums[i].id); },
    [albums, loadAlbum],
  );

  const { getItemProps, handleMouseMove } = useKeyboardNav({
    itemCount: albums.length,
    onActivate,
    scrollRef,
  });

  return (
    <div ref={scrollRef} className="p-6 overflow-y-auto h-full" onMouseMove={handleMouseMove}>
      <h2 className="text-lg font-semibold mb-4 text-themed-primary">Recently Played</h2>
      {albums.length === 0 ? (
        <p className="text-themed-secondary text-sm">Albums will appear here as you listen.</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))' }}>
          {albums.map((album, i) => (
            <AlbumCard key={album.id} album={album} onClick={() => loadAlbum(album.id)} onArtistClick={album.artist_id ? () => loadArtist(album.artist_id!) : undefined} itemProps={getItemProps(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
