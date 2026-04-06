import { useState, useCallback, useRef } from 'react';
import { api } from '../lib/tauri';
import type { Artist, Album, FlatSong } from '../lib/tauri';

export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  songs: FlatSong[];
}

const emptyResults: SearchResults = { artists: [], albums: [], songs: [] };

export function useSearch() {
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);

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

      api.searchAll(q).then((local) => {
        if (id !== reqIdRef.current) return;
        setResults(local);
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
