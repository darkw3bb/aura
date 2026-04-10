import { create } from 'zustand';
import type { Song } from '../lib/tauri';

interface TrackTargetStore {
  keyboardTarget: Song | null;
  hoverTarget: Song | null;
  setKeyboardTarget: (song: Song | null) => void;
  setHoverTarget: (song: Song | null) => void;
}

export const useTrackTargetStore = create<TrackTargetStore>((set) => ({
  keyboardTarget: null,
  hoverTarget: null,
  setKeyboardTarget: (song) => set({ keyboardTarget: song }),
  setHoverTarget: (song) => set({ hoverTarget: song }),
}));
