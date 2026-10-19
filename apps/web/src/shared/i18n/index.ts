import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { applyPrefsToDocument, usePrefs, type Lang } from '../lib/prefs';
import { en } from './locales/en';

export type Resources = typeof en;

const loaders: Record<Lang, () => Promise<{ default: Resources } | { fa: Resources } | { en: Resources }>> = {
  en: async () => ({ default: en }),
  fa: () => import('./locales/fa'),
};

async function loadBundle(lang: Lang): Promise<void> {
  if (i18next.hasResourceBundle(lang, 'translation')) return;
  const mod = await loaders[lang]();
  const bundle = 'default' in mod ? mod.default : lang in mod ? (mod as Record<string, Resources>)[lang]! : en;
  i18next.addResourceBundle(lang, 'translation', bundle, true, true);
}

export async function initI18n(): Promise<void> {
  const lang = usePrefs.getState().lang;
  await i18next.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  if (lang !== 'en') {
    await loadBundle(lang);
    await i18next.changeLanguage(lang);
  }
}

/** Switches the UI language (loads the bundle on demand) and updates <html lang dir>. */
export async function setLanguage(lang: Lang): Promise<void> {
  await loadBundle(lang);
  await i18next.changeLanguage(lang);
  usePrefs.getState().set({ lang });
  applyPrefsToDocument(usePrefs.getState());
}

export { i18next };
