import { useState, useCallback, useRef } from 'react';
import { api } from '../lib/tauri';
import type { Artist, Album, FlatSong, Genre } from '../lib/tauri';

export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  songs: FlatSong[];
  genres: Genre[];
}

const emptyResults: SearchResults = { artists: [], albums: [], songs: [], genres: [] };

export function useSearch() {
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reqIdRef = useRef(0);
  const genreCacheRef = useRef<Genre[] | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      reqIdRef.current++;
      setResults(emptyResults);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const id = ++reqIdRef.current;
      setLoading(true);

      const genrePromise = genreCacheRef.current
        ? Promise.resolve(genreCacheRef.current)
        : api.getGenres().then((g) => { genreCacheRef.current = g; return g; }).catch(() => [] as Genre[]);

      Promise.all([api.searchAll(q), genrePromise]).then(([local, allGenres]) => {
        if (id !== reqIdRef.current) return;
        const lower = q.toLowerCase();
        const matchedGenres = allGenres.filter((g) => g.value.toLowerCase().includes(lower));
        setResults({ ...local, genres: matchedGenres });
        setLoading(false);
      }).catch(() => {
        if (id !== reqIdRef.current) return;
        setLoading(false);
      });
    }, 50);
  }, []);

  const clear = useCallback(() => {
    reqIdRef.current++;
    setQuery('');
    setResults(emptyResults);
    setLoading(false);
  }, []);

  return { query, results, loading, search, clear };
}
