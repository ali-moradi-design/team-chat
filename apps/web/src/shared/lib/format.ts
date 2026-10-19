import { useMemo } from 'react';
import { usePrefs, type Lang } from './prefs';

/** Gregorian calendar always; Persian UI uses native digits unless "latin digits" is on. */
export function localeFor(lang: Lang, latinDigits: boolean): string {
  if (lang === 'fa') return latinDigits ? 'fa-u-ca-gregory-nu-latn' : 'fa-u-ca-gregory';
  return 'en-u-ca-gregory';
}

export interface Formatters {
  time: (d: Date | string | number) => string;
  dayLabel: (d: Date | string | number, labels: { today: string; yesterday: string }) => string;
  dateTime: (d: Date | string | number) => string;
  number: (n: number) => string;
  bytes: (n: number) => string;
  relative: (d: Date | string | number) => string;
}

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));

export function createFormatters(locale: string): Formatters {
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const date = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const dateYear = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const num = new Intl.NumberFormat(locale);
  const dec = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  return {
    time: (d) => time.format(toDate(d)),
    dateTime: (d) => dateTime.format(toDate(d)),
    number: (n) => num.format(n),
    dayLabel: (d, labels) => {
      const date_ = toDate(d);
      const diff = Math.round((startOfDay(new Date()) - startOfDay(date_)) / 86_400_000);
      if (diff === 0) return labels.today;
      if (diff === 1) return labels.yesterday;
      return (date_.getFullYear() === new Date().getFullYear() ? date : dateYear).format(date_);
    },
    bytes: (n) => {
      if (n < 1024) return `${num.format(n)} B`;
      if (n < 1024 * 1024) return `${dec.format(n / 1024)} KB`;
      return `${dec.format(n / 1024 / 1024)} MB`;
    },
    relative: (d) => {
      const s = Math.round((toDate(d).getTime() - Date.now()) / 1000);
      const abs = Math.abs(s);
      if (abs < 60) return rel.format(s, 'second');
      if (abs < 3600) return rel.format(Math.round(s / 60), 'minute');
      if (abs < 86400) return rel.format(Math.round(s / 3600), 'hour');
      return rel.format(Math.round(s / 86400), 'day');
    },
  };
}

export function useFormatters(): Formatters {
  const lang = usePrefs((s) => s.lang);
  const latin = usePrefs((s) => s.latinDigits);
  return useMemo(() => createFormatters(localeFor(lang, latin)), [lang, latin]);
}
