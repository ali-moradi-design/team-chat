#!/usr/bin/env node
/**
 * Feature-Sliced Design boundary checks for chat web.
 * Layers (top → bottom): app → pages → widgets → features → entities → shared
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const errors = [];

const LAYER_RANK = {
  app: 6,
  pages: 5,
  widgets: 4,
  features: 3,
  entities: 2,
  shared: 1,
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g;

function layerOf(fileRel) {
  const top = fileRel.split('/')[0];
  // Entry / ambient files sit above app
  if (top === 'main.tsx' || top === 'vite-env.d.ts' || !fileRel.includes('/')) {
    return 'app';
  }
  return top;
}

function sliceOf(fileRel, layer) {
  if (!['features', 'entities', 'widgets', 'pages'].includes(layer)) return null;
  const parts = fileRel.split('/');
  return parts[1] ?? null;
}

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const src = readFileSync(file, 'utf8');
  const fromLayer = layerOf(rel);
  const fromSlice = sliceOf(rel, fromLayer);
  const fromRank = LAYER_RANK[fromLayer] ?? 0;
  const fileDir = dirname(file);

  for (const match of src.matchAll(IMPORT_RE)) {
    const spec = match[1];

    if (spec.startsWith('@/')) {
      const toLayer = spec.slice(2).split('/')[0];
      const toRank = LAYER_RANK[toLayer];
      if (toRank == null) continue;

      if (fromRank < toRank) {
        errors.push(`${rel}: layer '${fromLayer}' must not import higher '${spec}'`);
      }

      if (fromLayer === 'shared' && ['app','pages','widgets','features','entities'].includes(toLayer)) {
        errors.push(`${rel}: shared must not import '${spec}'`);
      }
      if (fromLayer === 'entities' && ['app','pages','widgets','features'].includes(toLayer)) {
        errors.push(`${rel}: entities must not import '${spec}'`);
      }
      if (fromLayer === 'features' && ['app','pages','widgets'].includes(toLayer)) {
        errors.push(`${rel}: features must not import '${spec}'`);
      }

      const m = spec.match(/^@\/(features|entities|widgets|pages)\/([^/]+)(?:\/(.*))?$/);
      if (m) {
        const [, layer, slice, rest] = m;
        const same = fromLayer === layer && fromSlice === slice;
        if (!same && rest && rest !== '' && rest !== 'index') {
          errors.push(
            `${rel}: deep cross-slice import '${spec}' — use @/${layer}/${slice}`,
          );
        }
      }
      continue;
    }

    if (spec.startsWith('.') && fromSlice) {
      const resolved = normalize(resolve(fileDir, spec));
      const resolvedRel = relative(ROOT, resolved).replaceAll('\\', '/');
      const toLayer = layerOf(resolvedRel);
      const toSlice = sliceOf(resolvedRel, toLayer);
      if (
        toSlice &&
        fromLayer === toLayer &&
        toSlice !== fromSlice &&
        ['features', 'entities', 'widgets'].includes(fromLayer)
      ) {
        errors.push(
          `${rel}: relative cross-slice import '${spec}' → ${toLayer}/${toSlice}`,
        );
      }
    }
  }
}

for (const layer of ['features', 'entities', 'widgets', 'pages']) {
  const layerRoot = join(ROOT, layer);
  if (!existsSync(layerRoot)) continue;
  for (const name of readdirSync(layerRoot)) {
    const p = join(layerRoot, name);
    if (!statSync(p).isDirectory()) continue;
    if (!existsSync(join(p, 'index.ts')) && !existsSync(join(p, 'index.tsx'))) {
      errors.push(`${layer}/${name}: missing public index.ts`);
    }
  }
}

if (errors.length) {
  console.error(
    `FSD check failed (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'),
  );
  process.exit(1);
}
console.log(`FSD check passed (${walk(ROOT).length} files).`);
