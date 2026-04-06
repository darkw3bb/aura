import { create } from 'zustand';
import { api } from '../lib/tauri';
import type { Song, PlaybackState } from '../lib/tauri';
import { useLibraryStore } from './libraryStore';

interface QueueSource {
  artistId?: string;
  albumId?: string;
}

interface PlayerStore {
  isPlaying: boolean;
  currentTrack: Song | null;
  elapsedSecs: number;
  durationSecs: number | null;
  volume: number;
  shuffle: boolean;
  repeat: string;
  queue: Song[];
  queueIndex: number | null;
  history: Song[];
  queueSource: QueueSource | null;
  /** Timestamp until which refreshState skips overwriting playback state (avoids clobbering optimistic updates). */
  _skipRefreshUntil: number;
  /** Monotonic guard so only the latest play command clears the skip window. */
  _playGuard: number;
  /** Prevents re-entrant auto-advance while one is already in flight. */
  _advancing: boolean;

  playTrack: (track: Song) => Promise<void>;
  playTrackInContext: (tracks: Song[], index: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  toggleRepeat: () => Promise<void>;
  seek: (positionSecs: number) => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  addToQueue: (track: Song) => Promise<void>;
  insertNextInQueue: (track: Song) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  moveInQueue: (from: number, to: number) => Promise<void>;
  jumpToInQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  refreshQueue: () => Promise<void>;
  refreshState: () => Promise<void>;
  setRating: (trackId: string, rating: number) => Promise<void>;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  isPlaying: false,
  currentTrack: null,
  elapsedSecs: 0,
  durationSecs: null,
  volume: 0.8,
  shuffle: false,
  repeat: 'off',
  queue: [],
  queueIndex: null,
  history: [],
  queueSource: null,
  _skipRefreshUntil: 0,
  _playGuard: 0,
  _advancing: false,

  playTrack: async (track: Song) => {
    const guard = Date.now();
    set({
      isPlaying: true,
      currentTrack: track,
      elapsedSecs: 0,
      durationSecs: track.duration ?? null,
      _skipRefreshUntil: Infinity,
      _playGuard: guard,
    });
    try {
      await api.playTrack(track);
      if (get()._playGuard === guard) set({ _skipRefreshUntil: 0 });
      api.scrobble(track.id).catch(() => {});
    } catch (e) {
      if (get()._playGuard === guard) {
        set({ isPlaying: false, currentTrack: null, _skipRefreshUntil: 0 });
      }
      console.error('Play error:', e);
    }
  },

  playTrackInContext: async (tracks: Song[], index: number) => {
    const track = tracks[index];
    if (!track) return;
    const guard = Date.now();
    const source: QueueSource = {
      artistId: track.artist_id ?? undefined,
      albumId: track.album_id ?? undefined,
    };
    set({
      isPlaying: true,
      currentTrack: track,
      elapsedSecs: 0,
      durationSecs: track.duration ?? null,
      queue: tracks,
      queueIndex: index,
      history: [],
      queueSource: source,
      _skipRefreshUntil: Infinity,
      _playGuard: guard,
    });
    try {
      await api.playTrackInContext(tracks, index);
      if (get()._playGuard === guard) set({ _skipRefreshUntil: 0 });
      api.scrobble(track.id).catch(() => {});
      get().refreshQueue();
    } catch (e) {
      if (get()._playGuard === guard) {
        set({ isPlaying: false, currentTrack: null, _skipRefreshUntil: 0 });
      }
      console.error('Play error:', e);
    }
  },

  pause: async () => {
    set({ isPlaying: false, _skipRefreshUntil: Date.now() + 2000 });
    await api.pause();
  },

  resume: async () => {
    set({ isPlaying: true, _skipRefreshUntil: Date.now() + 2000 });
    await api.resume();
  },

  stop: async () => {
    await api.stop();
    set({ isPlaying: false, currentTrack: null, elapsedSecs: 0, _skipRefreshUntil: Date.now() + 2000 });
  },

  playNext: async () => {
    if (get()._advancing) return;
    const prev = get().currentTrack;
    set({ _advancing: true, _skipRefreshUntil: Date.now() + 10000 });
    try {
      const track = await api.playNext();
      if (track) {
        set((s) => ({
          isPlaying: true,
          currentTrack: track,
          elapsedSecs: 0,
          durationSecs: track.duration ?? null,
          history: prev ? [...s.history, prev] : s.history,
          _skipRefreshUntil: 0,
        }));
        api.scrobble(track.id).catch(() => {});
        get().refreshQueue();
      } else {
        // Queue exhausted -- try auto-advancing to next album
        const { queueSource } = get();
        if (queueSource?.artistId && queueSource.albumId) {
          try {
            const artist = await api.getArtist(queueSource.artistId);
            const albums = artist.album ?? [];
            const curIdx = albums.findIndex((a) => a.id === queueSource.albumId);
            if (curIdx >= 0 && curIdx < albums.length - 1) {
              const nextAlbum = await api.getAlbum(albums[curIdx + 1].id);
              const songs = nextAlbum.song ?? [];
              if (songs.length > 0) {
                const oldHistory = prev ? [...get().history, prev] : get().history;
                const guard = Date.now();
                const newSource: QueueSource = {
                  artistId: queueSource.artistId,
                  albumId: nextAlbum.id,
                };
                set({
                  isPlaying: true,
                  currentTrack: songs[0],
                  elapsedSecs: 0,
                  durationSecs: songs[0].duration ?? null,
                  queue: songs,
                  queueIndex: 0,
                  history: oldHistory,
                  queueSource: newSource,
                  _skipRefreshUntil: Infinity,
                  _playGuard: guard,
                });
                await api.playTrackInContext(songs, 0);
                if (get()._playGuard === guard) set({ _skipRefreshUntil: 0 });
                api.scrobble(songs[0].id).catch(() => {});
                get().refreshQueue();
              }
            }
          } catch (e) {
            console.error('Auto-advance error:', e);
          }
        }
        if (get()._skipRefreshUntil > Date.now()) set({ _skipRefreshUntil: 0 });
      }
    } finally {
      set({ _advancing: false });
    }
  },

  playPrevious: async () => {
    const { history } = get();
    set({ _skipRefreshUntil: Date.now() + 10000 });
    try {
      const track = await api.playPrevious();
      if (track) {
        set({
          isPlaying: true,
          currentTrack: track,
          elapsedSecs: 0,
          durationSecs: track.duration ?? null,
          history: history.length > 0 ? history.slice(0, -1) : history,
          _skipRefreshUntil: 0,
        });
        api.scrobble(track.id).catch(() => {});
        get().refreshQueue();
      } else {
        set({ _skipRefreshUntil: 0 });
      }
    } catch {
      set({ _skipRefreshUntil: 0 });
    }
  },

  toggleShuffle: async () => {
    const shuffle = await api.toggleShuffle();
    set({ shuffle });
  },

  toggleRepeat: async () => {
    const repeat = await api.toggleRepeat();
    set({ repeat });
  },

  seek: async (positionSecs: number) => {
    set({ elapsedSecs: positionSecs });
    await api.seek(positionSecs);
  },

  setVolume: async (v: number) => {
    await api.setVolume(v);
    set({ volume: v });
  },

  addToQueue: async (track: Song) => {
    await api.addToQueue(track);
    get().refreshQueue();
  },

  insertNextInQueue: async (track: Song) => {
    await api.insertNextInQueue(track);
    get().refreshQueue();
  },

  removeFromQueue: async (index: number) => {
    await api.removeFromQueue(index);
    get().refreshQueue();
  },

  moveInQueue: async (from: number, to: number) => {
    await api.moveInQueue(from, to);
    get().refreshQueue();
  },

  jumpToInQueue: async (index: number) => {
    const prev = get().currentTrack;
    const track = await api.jumpToInQueue(index);
    if (track) {
      set((s) => ({
        isPlaying: true,
        currentTrack: track,
        elapsedSecs: 0,
        durationSecs: track.duration ?? null,
        history: prev ? [...s.history, prev] : s.history,
      }));
      api.scrobble(track.id).catch(() => {});
      get().refreshQueue();
    }
  },

  clearQueue: async () => {
    await api.clearQueue();
    set({ queue: [], queueIndex: null });
  },

  refreshQueue: async () => {
    try {
      const info = await api.getQueue();
      set({ queue: info.tracks, queueIndex: info.currentIndex });
    } catch {
      // ignore
    }
  },

  refreshState: async () => {
    try {
      const state: PlaybackState = await api.getPlaybackState();
      const s = get();
      const skipping = Date.now() < s._skipRefreshUntil;

      if (state.finished && s.isPlaying && !s._advancing && !skipping) {
        set({ isPlaying: false });
        get().playNext();
        return;
      }

      const prevTrackId = s.currentTrack?.id;

      set({
        isPlaying: skipping ? s.isPlaying : state.isPlaying,
        currentTrack: skipping
          ? s.currentTrack
          : state.currentTrack
            ? { ...s.currentTrack, ...Object.fromEntries(Object.entries(state.currentTrack).filter(([, v]) => v !== undefined && v !== null)) } as Song
            : s.currentTrack,
        elapsedSecs: skipping ? s.elapsedSecs : state.elapsedSecs,
        durationSecs: state.durationSecs ?? null,
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
      });

      const newTrackId = get().currentTrack?.id;
      if (newTrackId && newTrackId !== prevTrackId) {
        get().refreshQueue();
      }
    } catch {
      // Not connected yet
    }
  },

  setRating: async (trackId: string, rating: number) => {
    try {
      await api.setRating(trackId, rating);
    } catch (e) {
      console.error('Failed to save rating:', e);
      throw e;
    }
    const current = get().currentTrack;
    if (current && current.id === trackId) {
      set({ currentTrack: { ...current, user_rating: rating } });
    }
    set((s) => ({
      queue: s.queue.map((t) => (t.id === trackId ? { ...t, user_rating: rating } : t)),
      history: s.history.map((t) => (t.id === trackId ? { ...t, user_rating: rating } : t)),
    }));
    useLibraryStore.getState().updateTrackRating(trackId, rating);
  },
}));
