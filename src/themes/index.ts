import { midnight } from './midnight';
import { nord } from './nord';
import { catppuccin } from './catppuccin';
import { auraLight } from './aura-light';

export interface Theme {
  id: string;
  name: string;
  colors: {
    '--bg-primary': string;
    '--bg-secondary': string;
    '--bg-tertiary': string;
    '--bg-hover': string;
    '--text-primary': string;
    '--text-secondary': string;
    '--text-muted': string;
    '--accent': string;
    '--accent-hover': string;
    '--border': string;
    '--rating-star': string;
    '--error': string;
    '--success': string;
  };
}

export const themes: Record<string, Theme> = {
  midnight,
  nord,
  catppuccin,
  'aura-light': auraLight,
};

export const defaultThemeId = 'midnight';
