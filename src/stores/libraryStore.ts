import { create } from 'zustand';
import { api } from '../lib/tauri';
import type { Artist, Album, AlbumDetail, ArtistDetail } from '../lib/tauri';

type View = 'albums' | 'artists' | 'artist-detail' | 'album-detail' | 'rated' | 'settings';

interface NavEntry {
  view: View;
  selectedAlbum: AlbumDetail | null;
  selectedArtist: ArtistDetail | null;
  artistAlbums: AlbumDetail[];
}

interface LibraryStore {
  connected: boolean;
  serverUrl: string;
  view: View;
  artists: Artist[];
  albums: Album[];
  selectedAlbum: AlbumDetail | null;
  selectedArtist: ArtistDetail | null;
  artistAlbums: AlbumDetail[];
  syncing: boolean;
  syncMessage: string;
  error: string | null;

  navStack: NavEntry[];
  navIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;

  setView: (view: View) => void;
  connect: (url: string, username: string, password: string) => Promise<void>;
  loadArtists: () => Promise<void>;
  loadAlbums: (type?: string) => Promise<void>;
  loadAlbum: (id: string) => Promise<void>;
  loadArtist: (id: string) => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  syncLibrary: () => Promise<void>;
  updateTrackRating: (trackId: string, rating: number) => void;
  updateAlbumRating: (albumId: string, rating: number) => void;
}

const initialNavEntry: NavEntry = {
  view: 'settings',
  selectedAlbum: null,
  selectedArtist: null,
  artistAlbums: [],
};

function pushNav(state: LibraryStore, entry: NavEntry) {
  const stack = state.navStack.slice(0, state.navIndex + 1);
  stack.push(entry);
  const navIndex = stack.length - 1;
  return {
    ...entry,
    navStack: stack,
    navIndex,
    canGoBack: navIndex > 0,
    canGoForward: false,
  };
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  connected: false,
  serverUrl: '',
  view: 'settings',
  artists: [],
  albums: [],
  selectedAlbum: null,
  selectedArtist: null,
  artistAlbums: [],
  syncing: false,
  syncMessage: '',
  error: null,

  navStack: [initialNavEntry],
  navIndex: 0,
  canGoBack: false,
  canGoForward: false,

  setView: (view) => {
    const entry: NavEntry = { view, selectedAlbum: null, selectedArtist: null, artistAlbums: [] };
    set((s) => pushNav(s, entry));
  },

  connect: async (url, username, password) => {
    try {
      set({ error: null });
      await api.connect(url, username, password);
      localStorage.setItem('ae_server_url', url);
      localStorage.setItem('ae_username', username);
      localStorage.setItem('ae_password', password);
      const entry: NavEntry = { view: 'albums', selectedAlbum: null, selectedArtist: null, artistAlbums: [] };
      set({
        connected: true,
        serverUrl: url,
        view: 'albums',
        selectedAlbum: null,
        selectedArtist: null,
        artistAlbums: [],
        navStack: [entry],
        navIndex: 0,
        canGoBack: false,
        canGoForward: false,
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadArtists: async () => {
    try {
      const artists = await api.getArtists();
      set({ artists });
    } catch (e) {
      console.error('Load artists error:', e);
    }
  },

  loadAlbums: async (type = 'newest') => {
    try {
      const albums = await api.getAlbumList(type, 100, 0);
      set({ albums });
    } catch (e) {
      console.error('Load albums error:', e);
    }
  },

  loadAlbum: async (id: string) => {
    try {
      const album = await api.getAlbum(id);
      const entry: NavEntry = { view: 'album-detail', selectedAlbum: album, selectedArtist: null, artistAlbums: [] };
      set((s) => pushNav(s, entry));
    } catch (e) {
      console.error('Load album error:', e);
    }
  },

  loadArtist: async (id: string) => {
    try {
      const artist = await api.getArtist(id);
      const entry: NavEntry = { view: 'artist-detail', selectedAlbum: null, selectedArtist: artist, artistAlbums: [] };
      set((s) => pushNav(s, entry));
      const albumDetails = await Promise.all(
        (artist.album ?? []).map((a) => api.getAlbum(a.id))
      );
      set((s) => {
        const stack = [...s.navStack];
        stack[s.navIndex] = { ...stack[s.navIndex], artistAlbums: albumDetails };
        return { artistAlbums: albumDetails, navStack: stack };
      });
    } catch (e) {
      console.error('Load artist error:', e);
    }
  },

  goBack: () => {
    const { navStack, navIndex } = get();
    if (navIndex <= 0) return;
    const newIndex = navIndex - 1;
    const entry = navStack[newIndex];
    set({
      ...entry,
      navIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: true,
    });
  },

  goForward: () => {
    const { navStack, navIndex } = get();
    if (navIndex >= navStack.length - 1) return;
    const newIndex = navIndex + 1;
    const entry = navStack[newIndex];
    set({
      ...entry,
      navIndex: newIndex,
      canGoBack: true,
      canGoForward: newIndex < navStack.length - 1,
    });
  },

  syncLibrary: async () => {
    set({ syncing: true, syncMessage: 'Syncing library...' });
    try {
      const msg = await api.syncLibrary();
      set({ syncing: false, syncMessage: msg });
    } catch (e) {
      set({ syncing: false, syncMessage: `Sync failed: ${e}` });
    }
  },

  updateTrackRating: (trackId: string, rating: number) => {
    const patchSongs = (songs: AlbumDetail['song']) =>
      songs?.map((s) => (s.id === trackId ? { ...s, user_rating: rating } : s));

    const { selectedAlbum, artistAlbums } = get();

    if (selectedAlbum?.song?.some((s) => s.id === trackId)) {
      set({ selectedAlbum: { ...selectedAlbum, song: patchSongs(selectedAlbum.song) } });
    }

    if (artistAlbums.some((a) => a.song?.some((s) => s.id === trackId))) {
      set({
        artistAlbums: artistAlbums.map((a) =>
          a.song?.some((s) => s.id === trackId)
            ? { ...a, song: patchSongs(a.song) }
            : a
        ),
      });
    }
  },

  updateAlbumRating: (albumId: string, rating: number) => {
    const { selectedAlbum, artistAlbums } = get();

    if (selectedAlbum?.id === albumId) {
      set({ selectedAlbum: { ...selectedAlbum, user_rating: rating } });
    }

    if (artistAlbums.some((a) => a.id === albumId)) {
      set({
        artistAlbums: artistAlbums.map((a) =>
          a.id === albumId ? { ...a, user_rating: rating } : a
        ),
      });
    }
  },
}));
