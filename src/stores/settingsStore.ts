import { create } from 'zustand';
import { DEFAULT_MODEL, MODELS } from '../lib/models';

const STORAGE_KEY = 'ae_settings';

interface Settings {
  showTrackListArt: boolean;
  anthropicApiKey: string;
  maestroModel: string;
}

interface SettingsStore extends Settings {
  setShowTrackListArt: (value: boolean) => void;
  setAnthropicApiKey: (value: string) => void;
  setMaestroModel: (value: string) => void;
}

const DEFAULTS: Settings = {
  showTrackListArt: true,
  anthropicApiKey: '',
  maestroModel: DEFAULT_MODEL,
};

const VALID_MODEL_IDS = new Set(MODELS.map(m => m.id));

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { ...DEFAULTS, ...JSON.parse(raw) };
      if (!VALID_MODEL_IDS.has(parsed.maestroModel)) {
        parsed.maestroModel = DEFAULT_MODEL;
      }
      return parsed;
    }
  } catch { /* ignore corrupt data */ }
  return { ...DEFAULTS };
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
  setAnthropicApiKey: (value) => {
    persist({ anthropicApiKey: value });
    set({ anthropicApiKey: value });
  },
  setMaestroModel: (value) => {
    persist({ maestroModel: value });
    set({ maestroModel: value });
  },
}));
