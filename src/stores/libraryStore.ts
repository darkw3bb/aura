import { create } from 'zustand';
import { api } from '../lib/tauri';
import type { Artist, Album, AlbumDetail, ArtistDetail } from '../lib/tauri';

type View = 'albums' | 'artists' | 'artist-detail' | 'album-detail' | 'rated' | 'settings';

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

  setView: (view: View) => void;
  connect: (url: string, username: string, password: string) => Promise<void>;
  loadArtists: () => Promise<void>;
  loadAlbums: (type?: string) => Promise<void>;
  loadAlbum: (id: string) => Promise<void>;
  loadArtist: (id: string) => Promise<void>;
  syncLibrary: () => Promise<void>;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
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

  setView: (view) => set({ view, selectedAlbum: null, selectedArtist: null, artistAlbums: [] }),

  connect: async (url, username, password) => {
    try {
      set({ error: null });
      await api.connect(url, username, password);
      localStorage.setItem('ae_server_url', url);
      localStorage.setItem('ae_username', username);
      localStorage.setItem('ae_password', password);
      set({ connected: true, serverUrl: url, view: 'albums' });
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
      set({ selectedAlbum: album, view: 'album-detail' });
    } catch (e) {
      console.error('Load album error:', e);
    }
  },

  loadArtist: async (id: string) => {
    try {
      const artist = await api.getArtist(id);
      set({ selectedArtist: artist, artistAlbums: [], view: 'artist-detail' });
      const albumDetails = await Promise.all(
        (artist.album ?? []).map((a) => api.getAlbum(a.id))
      );
      set({ artistAlbums: albumDetails });
    } catch (e) {
      console.error('Load artist error:', e);
    }
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
}));
