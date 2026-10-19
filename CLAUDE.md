# Working in this repo

- Monorepo (pnpm + Turborepo): `apps/server`, `apps/web`, `packages/shared`. Repo files are in English.
- Before pushing: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm check`. `pnpm e2e` needs MongoDB.
- Server layering rules are enforced by `apps/server/scripts/check-modules.mjs`; web layering by
  `apps/web/scripts/check-fsd.mjs`. Add new server code inside a module (`domain/application/infrastructure/presentation`)
  and expose it only through the module's `index.ts`.
- New socket events: add the Zod schema + type in `packages/shared`, handle it in `apps/server/src/socket/realtime.ts`
  (validation, rate limit and membership are done by the `handle()` wrapper), and mirror it in the web realtime hook.
- UI strings go in both `apps/web/src/shared/i18n/locales/en.ts` and `fa.ts` (a test keeps them in sync).
- Use CSS logical properties (`ms-*`, `ps-*`, `start-*`, `text-start`) so RTL works without special cases.
- Tests that need MongoDB use `TEST_MONGODB_URI` (default `mongodb://127.0.0.1:27017`); each run uses a throwaway database.
