#!/usr/bin/env node
/**
 * Architecture check for the server (the counterpart of check-fsd in the web app).
 *
 *  1. Inside a module, layers only depend inward:
 *       presentation → application → domain      infrastructure → application / domain
 *     (domain imports nothing from the other layers; application never imports infrastructure/presentation)
 *  2. A module may only use another module through its public entry (`modules/<name>/index.ts`).
 *  3. Modules never import the composition root, the app or the socket layer.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const MODULES = join(SRC, 'modules');
const errors = [];

const forbiddenLayers = {
  domain: ['application', 'infrastructure', 'presentation'],
  application: ['infrastructure', 'presentation'],
  infrastructure: ['presentation'],
  presentation: [],
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const IMPORT_RE = /(?:from|import)\s+['"](\.[^'"]*)['"]/g;

for (const file of walk(MODULES)) {
  const rel = relative(MODULES, file).split(sep);
  const [mod, layer] = rel;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) {
    const target = resolve(dirname(file), m[1]);
    const toRel = relative(SRC, target).split(sep);

    if (toRel[0] !== 'modules') {
      if (
        ['container', 'app', 'server', 'index', 'socket'].includes(
          toRel[0]?.replace(/\.ts$/, '') ?? '',
        )
      ) {
        errors.push(`${rel.join('/')}: modules must not import '${m[1]}'`);
      }
      continue;
    }
    const [, toMod, toLayer] = toRel;
    if (toMod === mod) {
      if (layer && toLayer && forbiddenLayers[layer]?.includes(toLayer)) {
        errors.push(`${rel.join('/')}: layer '${layer}' must not import '${toLayer}' (${m[1]})`);
      }
    } else {
      const isPublicEntry = toRel.length === 2 || (toRel.length === 3 && toRel[2] === 'index');
      if (!isPublicEntry)
        errors.push(
          `${rel.join('/')}: import '${m[1]}' reaches into module '${toMod}' — use its index.ts`,
        );
      if (!existsSync(join(MODULES, toMod, 'index.ts')))
        errors.push(`modules/${toMod}: missing index.ts`);
    }
  }
}

if (errors.length) {
  console.error(
    `Module check failed (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'),
  );
  process.exit(1);
}
console.log(`Module check passed (${walk(MODULES).length} files).`);
