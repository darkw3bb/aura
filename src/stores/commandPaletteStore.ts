import { create } from 'zustand';
import type { Song } from '../lib/tauri';
import { useTrackTargetStore } from './trackTargetStore';

interface CommandPaletteStore {
  open: boolean;
  /** Open overlay directly on the tag-name step (e.g. from context menu). */
  startInTagStep: boolean;
  openPalette: () => void;
  openPaletteTagStep: (targetSong: Song) => void;
  closePalette: () => void;
  togglePalette: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  open: false,
  startInTagStep: false,
  openPalette: () => set({ open: true, startInTagStep: false }),
  openPaletteTagStep: (targetSong) => {
    useTrackTargetStore.getState().setKeyboardTarget(targetSong);
    set({ open: true, startInTagStep: true });
  },
  closePalette: () => set({ open: false, startInTagStep: false }),
  togglePalette: () =>
    set((s) =>
      s.open
        ? { open: false, startInTagStep: false }
        : { open: true, startInTagStep: false },
    ),
}));
