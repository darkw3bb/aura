import { useEffect, useState } from 'react';
import { api } from '../../lib/tauri';
import type { Genre } from '../../lib/tauri';
import { useLibraryStore } from '../../stores/libraryStore';

export function GenreList() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const { loadGenre, selectedGenre } = useLibraryStore();

  useEffect(() => {
    api.getGenres().then((g) => {
      setGenres(g);
      setLoading(false);
    }).catch((e) => {
      console.error('Load genres error:', e);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4">
        <h2 className="text-lg font-semibold text-themed-primary">Genres</h2>
        <p className="text-[13px] mt-0.5 text-themed-muted">
          {genres.length} genre{genres.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading && (
        <div className="px-6 py-4 text-[13px] text-themed-muted">Loading...</div>
      )}

      {!loading && genres.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-themed-secondary">No genres found.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-0.5">
          {genres.map((genre) => (
            <button
              key={genre.value}
              data-active={selectedGenre === genre.value}
              className="nav-item w-full flex items-center gap-2 text-left px-3 py-2 rounded-md text-[13px] cursor-pointer"
              onClick={() => loadGenre(genre.value)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-themed-muted">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span className="truncate flex-1 text-themed-primary">{genre.value}</span>
              <span className="text-[11px] text-themed-muted shrink-0 tabular-nums">
                {genre.song_count} track{genre.song_count !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
