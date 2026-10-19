#!/usr/bin/env node
/**
 * Performance budget for the production build (run after `vite build`).
 * Sums the gzip size of everything the entry HTML loads eagerly (scripts + stylesheets).
 * Lazy chunks (chat page, dialogs, emoji picker, Persian bundle) are intentionally excluded.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.log('Budget check skipped (no dist/ — run `pnpm build` first).');
  process.exit(0);
}

const BUDGET_JS_KB = 200; // eager JS (React, router, socket.io, query, i18n) before the lazy page chunk
const BUDGET_CSS_KB = 14;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
let js = 0;
let css = 0;
for (const ref of refs) {
  const size = gzipSync(readFileSync(join(dist, ref))).length;
  if (ref.endsWith('.js')) js += size;
  else css += size;
}
const kb = (n) => (n / 1024).toFixed(1);
console.log(
  `Eager JS: ${kb(js)} KB gzip (budget ${BUDGET_JS_KB}) · CSS: ${kb(css)} KB gzip (budget ${BUDGET_CSS_KB})`,
);

const failures = [];
if (js / 1024 > BUDGET_JS_KB) failures.push(`JS ${kb(js)} KB exceeds ${BUDGET_JS_KB} KB`);
if (css / 1024 > BUDGET_CSS_KB) failures.push(`CSS ${kb(css)} KB exceeds ${BUDGET_CSS_KB} KB`);
if (failures.length) {
  console.error('Performance budget failed:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
