import { create } from 'zustand';

export type ThemePref = 'dark' | 'light' | 'system';
export type Lang = 'en' | 'fa';

export interface Prefs {
  theme: ThemePref;
  lang: Lang;
  /** Persian UI shows native digits by default; this switches to 0-9. */
  latinDigits: boolean;
  browserNotifications: boolean;
  sidebarSections: { channels: boolean; dms: boolean };
}

const KEY = 'tc:prefs';
const DEFAULTS: Prefs = {
  theme: 'dark',
  lang: 'en',
  latinDigits: false,
  browserNotifications: false,
  sidebarSections: { channels: true, dms: true },
};

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function persist(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode) — preferences just won't persist */
  }
}

export function resolveDark(theme: ThemePref): boolean {
  return theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
}

export function applyPrefsToDocument(p: Prefs): void {
  const el = document.documentElement;
  const dark = resolveDark(p.theme);
  el.classList.toggle('dark', dark);
  el.classList.toggle('light', !dark);
  el.lang = p.lang;
  el.dir = p.lang === 'fa' ? 'rtl' : 'ltr';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#170602' : '#fff8ef');
}

interface PrefsStore extends Prefs {
  set: (patch: Partial<Prefs>) => void;
}

export const usePrefs = create<PrefsStore>((set, get) => ({
  ...read(),
  set: (patch) => {
    set(patch);
    const { set: _s, ...prefs } = get();
    persist(prefs);
    applyPrefsToDocument(prefs);
  },
}));
