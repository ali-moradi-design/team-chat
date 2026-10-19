import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from './locales/en';
import { fa } from './locales/fa';

function flatten(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !p.includes('/locales/'))
      out.push(p);
  }
  return out;
}

describe('translations', () => {
  const enKeys = flatten(en).sort();
  const faKeys = flatten(fa).sort();

  it('English and Persian define exactly the same keys', () => {
    expect(faKeys).toEqual(enKeys);
  });

  it('has no empty strings', () => {
    for (const [lang, bundle] of [
      ['en', en],
      ['fa', fa],
    ] as const) {
      const empty = flatten(bundle).filter(
        (k) =>
          k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], bundle) === '',
      );
      expect(empty, lang).toEqual([]);
    }
  });

  it('every literal t("key") used in the source exists', () => {
    const known = new Set(enKeys);
    const missing: string[] = [];
    for (const file of sourceFiles(join(import.meta.dirname, '../../'))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        const key = m[1]!;
        if (!known.has(key) && !known.has(`${key}_one`) && !known.has(`${key}_other`))
          missing.push(`${file.split('/src/')[1]}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('Persian placeholders match the English ones', () => {
    const ph = (s: string) =>
      [...s.matchAll(/\{\{(\w+)\}\}/g)]
        .map((m) => m[1])
        .sort()
        .join(',');
    const get = (b: object, k: string) =>
      k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], b) as string;
    for (const k of enKeys) expect(ph(get(fa, k)), k).toBe(ph(get(en, k)));
  });
});
