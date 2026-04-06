import { create } from 'zustand';
import { themes, defaultThemeId, type Theme } from '../themes';

const STORAGE_KEY = 'ae_theme';

function applyThemeToDOM(theme: Theme) {
  const style = document.documentElement.style;
  for (const [prop, value] of Object.entries(theme.colors)) {
    style.setProperty(prop, value);
  }
}

function resolveTheme(id: string): Theme {
  return themes[id] ?? themes[defaultThemeId];
}

interface ThemeStore {
  themeId: string;
  setTheme: (id: string) => void;
}

export const useThemeStore = create<ThemeStore>((set) => {
  const saved = localStorage.getItem(STORAGE_KEY) ?? defaultThemeId;
  const theme = resolveTheme(saved);
  applyThemeToDOM(theme);

  return {
    themeId: theme.id,
    setTheme: (id: string) => {
      const next = resolveTheme(id);
      applyThemeToDOM(next);
      localStorage.setItem(STORAGE_KEY, next.id);
      set({ themeId: next.id });
    },
  };
});
