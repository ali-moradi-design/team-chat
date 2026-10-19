# Architecture decisions

Confirmed with the owner on 2026-10-19. Refines `brief.md`; where they differ,
this file wins.

## Stack

- **Web:** Vite + React 19 + Tailwind v4 (not Next.js: the app is a logged-in SPA
  with a long-lived Socket.IO connection, no SEO needs, and the backend is the
  showcase). Feature-Sliced Design with an import-boundary check.
- **Server:** Express 5, Socket.IO 4, Mongoose, Zod. Modular monolith.
- **Tooling:** pnpm workspaces + Turborepo, TypeScript 6, ESLint, **Prettier**,
  Vitest, Playwright.
- **Languages:** English (default) and Persian (RTL).
- **Redis adapter:** optional Compose profile.

## Server: modular monolith with light layering

```
apps/server/src/modules/<module>/
  domain/          pure rules, no Mongoose, no Express
  application/     services / use cases, depend on repository interfaces
  infrastructure/  Mongoose models and repository implementations
  presentation/    REST routes and socket handlers
  index.ts         the only public entry of the module
```

- Dependencies point inward: presentation → application → domain.
- Other modules import only from a module's `index.ts` (checked in CI, like the
  FSD check in the web app).
- Domain events only where they pay off (e.g. "message created" updates unread
  counters and notifications).
- Not full DDD: no aggregates/value objects ceremony.

## Shared package

`packages/shared` holds the Zod schemas and the typed Socket.IO event maps used
by both apps.

## Web libraries

React Router, TanStack Query (server data) + Zustand (realtime UI state),
TanStack Virtual, Radix UI primitives + class-variance-authority, React Hook Form
with the shared Zod schemas, i18next, lucide-react, sonner, emoji-picker-react
(lazy). Dates and numbers via `Intl`.

## Server libraries

jose (JWT), argon2, helmet, cors, express-rate-limit, multer, sharp, pino,
`@socket.io/redis-adapter` (profile only).
