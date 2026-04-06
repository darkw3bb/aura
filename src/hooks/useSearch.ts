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

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults(emptyResults);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [localSongs, sr] = await Promise.allSettled([
          api.searchLocal(q),
          api.search(q),
        ]);

        const serverResult = sr.status === 'fulfilled' ? sr.value : null;
        let songs: FlatSong[] = [];

        if (localSongs.status === 'fulfilled' && localSongs.value.length > 0) {
          songs = localSongs.value;
        } else if (serverResult) {
          songs = (serverResult.song ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            album: s.album,
            album_id: s.album_id,
            artist: s.artist,
            artist_id: s.artist_id,
            track: s.track,
            year: s.year,
            genre: s.genre,
            duration: s.duration,
            bit_rate: s.bit_rate,
            cover_art: s.cover_art,
            user_rating: s.user_rating,
            disc_number: s.disc_number,
          }));
        }

        const albums = (serverResult?.album ?? []).filter(
          (a) => !a.artist || a.artist.toLowerCase() !== 'various artists',
        );

        const artists = (serverResult?.artist ?? []).filter(
          (a) => !a.name.includes(' & '),
        );

        setResults({ artists, albums, songs });
      } catch {
        setResults(emptyResults);
      } finally {
        setLoading(false);
      }
    }, 150);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults(emptyResults);
  }, []);

  return { query, results, loading, search, clear };
}
