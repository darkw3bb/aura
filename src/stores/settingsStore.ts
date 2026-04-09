import { create } from 'zustand';

const STORAGE_KEY = 'ae_settings';

interface Settings {
  showTrackListArt: boolean;
}

interface SettingsStore extends Settings {
  setShowTrackListArt: (value: boolean) => void;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { showTrackListArt: true, ...JSON.parse(raw) };
  } catch { /* ignore corrupt data */ }
  return { showTrackListArt: true };
}

function persist(patch: Partial<Settings>) {
  const current = load();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...load(),
  setShowTrackListArt: (value) => {
    persist({ showTrackListArt: value });
    set({ showTrackListArt: value });
  },
}));
