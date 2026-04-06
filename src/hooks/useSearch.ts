import { useState, useCallback, useRef } from 'react';
import { api } from '../lib/tauri';
import type { Artist, Album, Song, FlatSong } from '../lib/tauri';

export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  songs: FlatSong[];
}

const emptyResults: SearchResults = { artists: [], albums: [], songs: [] };

function mapServerSong(s: Song): FlatSong {
  return {
    id: s.id, title: s.title, album: s.album, album_id: s.album_id,
    artist: s.artist, artist_id: s.artist_id, track: s.track, year: s.year,
    genre: s.genre, duration: s.duration, bit_rate: s.bit_rate,
    cover_art: s.cover_art, user_rating: s.user_rating, disc_number: s.disc_number,
  };
}

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

      api.searchLocal(q).then((localSongs) => {
        if (id !== reqIdRef.current) return;
        if (localSongs.length > 0) {
          setResults((prev) => ({ ...prev, songs: localSongs }));
        }
      }).catch(() => {});

      api.search(q).then((sr) => {
        if (id !== reqIdRef.current) return;

        const albums = (sr.album ?? []).filter(
          (a) => !a.artist || a.artist.toLowerCase() !== 'various artists',
        );
        const artists = (sr.artist ?? []).filter(
          (a) => !a.name.includes(' & '),
        );
        const serverSongs = (sr.song ?? []).map(mapServerSong);

        setResults((prev) => ({
          artists,
          albums,
          songs: prev.songs.length > 0 ? prev.songs : serverSongs,
        }));
      }).catch(() => {}).finally(() => {
        if (id === reqIdRef.current) setLoading(false);
      });
    }, 150);
  }, []);

  const clear = useCallback(() => {
    reqIdRef.current++;
    setQuery('');
    setResults(emptyResults);
    setLoading(false);
  }, []);

  return { query, results, loading, search, clear };
}
