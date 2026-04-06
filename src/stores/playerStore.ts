import { create } from 'zustand';
import { api } from '../lib/tauri';
import type { Song, PlaybackState } from '../lib/tauri';

interface PlayerStore {
  isPlaying: boolean;
  currentTrack: Song | null;
  elapsedSecs: number;
  durationSecs: number | null;
  volume: number;
  shuffle: boolean;
  repeat: string;
  queue: Song[];
  /** Timestamp until which refreshState skips overwriting playback state (avoids clobbering optimistic updates). */
  _skipRefreshUntil: number;

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
  clearQueue: () => Promise<void>;
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
  _skipRefreshUntil: 0,

  playTrack: async (track: Song) => {
    set({
      isPlaying: true,
      currentTrack: track,
      elapsedSecs: 0,
      durationSecs: track.duration ?? null,
      _skipRefreshUntil: Date.now() + 2000,
    });
    try {
      await api.playTrack(track);
    } catch (e) {
      set({ isPlaying: false, currentTrack: null });
      console.error('Play error:', e);
    }
  },

  playTrackInContext: async (tracks: Song[], index: number) => {
    const track = tracks[index];
    if (!track) return;
    set({
      isPlaying: true,
      currentTrack: track,
      elapsedSecs: 0,
      durationSecs: track.duration ?? null,
      queue: tracks,
      _skipRefreshUntil: Date.now() + 2000,
    });
    try {
      await api.playTrackInContext(tracks, index);
    } catch (e) {
      set({ isPlaying: false, currentTrack: null });
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
    const track = await api.playNext();
    if (track) {
      set({
        isPlaying: true,
        currentTrack: track,
        elapsedSecs: 0,
        durationSecs: track.duration ?? null,
      });
    }
  },

  playPrevious: async () => {
    const track = await api.playPrevious();
    if (track) {
      set({
        isPlaying: true,
        currentTrack: track,
        elapsedSecs: 0,
        durationSecs: track.duration ?? null,
      });
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
    const queue = await api.getQueue();
    set({ queue });
  },

  clearQueue: async () => {
    await api.clearQueue();
    set({ queue: [] });
  },

  refreshState: async () => {
    try {
      const state: PlaybackState = await api.getPlaybackState();
      const skipping = Date.now() < get()._skipRefreshUntil;
      set({
        isPlaying: skipping ? get().isPlaying : state.isPlaying,
        currentTrack: skipping
          ? get().currentTrack
          : state.currentTrack
            ? { ...get().currentTrack, ...state.currentTrack }
            : get().currentTrack,
        elapsedSecs: skipping ? get().elapsedSecs : state.elapsedSecs,
        durationSecs: state.durationSecs ?? null,
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
      });
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
  },
}));
