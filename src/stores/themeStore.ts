import { create } from 'zustand';
import { themes, defaultThemeId, type Theme } from '../themes';

const STORAGE_KEY = 'ae_theme';

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, c)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const ra = parseInt(a.slice(1, 3), 16), ga = parseInt(a.slice(3, 5), 16), ba = parseInt(a.slice(5, 7), 16);
  const rb = parseInt(b.slice(1, 3), 16), gb = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${mix(ra, rb).toString(16).padStart(2, '0')}${mix(ga, gb).toString(16).padStart(2, '0')}${mix(ba, bb).toString(16).padStart(2, '0')}`;
}

const PILL_SHADES: [string, number][] = [
  ['red',    0.30],
  ['orange', 0.37],
  ['yellow', 0.44],
  ['green',  0.51],
  ['teal',   0.58],
  ['blue',   0.65],
  ['purple', 0.72],
  ['pink',   0.79],
];

function derivePillColors(accent: string, bgTertiary: string, textPrimary: string) {
  const [accentH, accentS] = hexToHsl(accent);
  const vars: Record<string, string> = {};
  const s = Math.max(accentS, 0.3);

  for (const [name, lightness] of PILL_SHADES) {
    const tint = hslToHex(accentH, s, lightness);
    vars[`--pill-${name}-bg`] = mixHex(bgTertiary, tint, 0.28);
    vars[`--pill-${name}-text`] = mixHex(textPrimary, tint, 0.6);
  }
  return vars;
}

function applyThemeToDOM(theme: Theme) {
  const style = document.documentElement.style;
  for (const [prop, value] of Object.entries(theme.colors)) {
    style.setProperty(prop, value);
  }
  const pillVars = derivePillColors(
    theme.colors['--accent'],
    theme.colors['--bg-tertiary'],
    theme.colors['--text-primary'],
  );
  for (const [prop, value] of Object.entries(pillVars)) {
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
