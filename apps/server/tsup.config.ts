import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/seed.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Workspace packages are TypeScript sources: bundle them in.
  noExternal: ['@team-chat/shared'],
});
