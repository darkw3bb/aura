import { useEffect, useRef, useState, useCallback } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { api } from '../../lib/tauri';
import type { Album } from '../../lib/tauri';
import { AlbumCard } from './AlbumCard';

let albumCache: Map<number | null, Album[]> | null = null;

export function YearsView() {
  const { loadAlbum, loadArtist, saveScrollTop } = useLibraryStore();
  const savedScrollTop = useLibraryStore((s) => s.navStack[s.navIndex]?.scrollTop ?? 0);
  const [grouped, setGrouped] = useState<Map<number | null, Album[]>>(albumCache ?? new Map());
  const [loading, setLoading] = useState(!albumCache);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (albumCache) return;
    let cancelled = false;

    api.getAllAlbums()
      .then((albums) => {
        if (cancelled) return;

        const map = new Map<number | null, Album[]>();
        for (const album of albums) {
          const key = album.year ?? null;
          const list = map.get(key);
          if (list) {
            list.push(album);
          } else {
            map.set(key, [album]);
          }
        }

        albumCache = map;
        setGrouped(map);
        setLoading(false);
      })
      .catch((e) => {
        console.error('Years view load error:', e);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loading && savedScrollTop > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = savedScrollTop;
    }
  }, [loading, savedScrollTop]);

  const handleAlbumClick = useCallback((id: string) => {
    if (scrollRef.current) {
      saveScrollTop(scrollRef.current.scrollTop);
    }
    loadAlbum(id);
  }, [saveScrollTop, loadAlbum]);

  const handleArtistClick = useCallback((id: string) => {
    if (scrollRef.current) {
      saveScrollTop(scrollRef.current.scrollTop);
    }
    loadArtist(id);
  }, [saveScrollTop, loadArtist]);

  const sortedYears = Array.from(grouped.keys())
    .filter((y): y is number => y !== null)
    .sort((a, b) => b - a);

  const unknownAlbums = grouped.get(null);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p className="text-sm text-themed-secondary">Loading albums...</p>
      </div>
    );
  }

  if (grouped.size === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p className="text-sm text-themed-secondary">No albums found. Sync your library first in Settings.</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="overflow-y-auto h-full">
      <div className="p-6 pb-0">
        <h2 className="text-lg font-semibold text-themed-primary">Years</h2>
      </div>
      {sortedYears.map((year) => {
        const albums = grouped.get(year)!;
        return (
          <section key={year}>
            <div className="sticky top-0 z-10 px-6 py-3 bg-themed-primary backdrop-blur-sm">
              <h3 className="text-[15px] font-semibold text-themed-primary">{year}</h3>
            </div>
            <div className="px-6 pb-4">
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))' }}>
                {albums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => handleAlbumClick(album.id)}
                    onArtistClick={album.artist_id ? () => handleArtistClick(album.artist_id!) : undefined}
                    showYear={false}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
      {unknownAlbums && unknownAlbums.length > 0 && (
        <section>
          <div className="sticky top-0 z-10 px-6 py-3 bg-themed-primary backdrop-blur-sm">
            <h3 className="text-[15px] font-semibold text-themed-primary">Unknown Year</h3>
          </div>
          <div className="px-6 pb-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))' }}>
              {unknownAlbums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  onClick={() => handleAlbumClick(album.id)}
                  onArtistClick={album.artist_id ? () => handleArtistClick(album.artist_id!) : undefined}
                  showYear={false}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
