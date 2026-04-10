import { midnight } from './midnight';
import { nord } from './nord';
import { catppuccin } from './catppuccin';
import { auraLight } from './aura-light';
import { winamp } from './winamp';
import { matrix } from './matrix';
import { itunesClassic } from './itunes-classic';
import { cyberdeck } from './cyberdeck';
import { phosphor } from './phosphor';
import { vaporwave } from './vaporwave';
import { bloodmoon } from './bloodmoon';
import { espresso } from './espresso';
import { sahara } from './sahara';
import { y2k } from './y2k';
import { cybertruck } from './cybertruck';

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
  winamp,
  matrix,
  'itunes-classic': itunesClassic,
  cyberdeck,
  phosphor,
  vaporwave,
  bloodmoon,
  espresso,
  sahara,
  y2k,
  cybertruck,
};

export const defaultThemeId = 'midnight';
