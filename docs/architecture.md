# Architecture

Decisions confirmed with the owner (2026-10-19) and how they turned out in code. Where this file and
`brief.md` differ, this file wins.

## Stack

| Concern    | Choice                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------- |
| Web        | Vite + React 19 + Tailwind v4 (not Next.js: logged-in SPA, long-lived WebSocket, no SEO need) |
| Server     | Express 5, Socket.IO 4, Mongoose 9, Zod 4                                                    |
| Auth       | argon2id, `jose` JWT (15 min) + rotating refresh token in an httpOnly cookie                  |
| Tooling    | pnpm workspaces + Turborepo, TypeScript 6, ESLint 9, **Prettier**, Vitest, Playwright        |
| Languages  | English (default) and Persian (RTL); Gregorian dates; native digits with a Latin-digit switch |
| Scale-out  | `@socket.io/redis-adapter` behind `REDIS_URL` (Compose profile `scale`); off by default       |

## Packages

`packages/shared` is consumed as TypeScript source (no build step): Zod schemas for every REST payload and socket
event, the typed `ClientToServerEvents` / `ServerToClientEvents`, the rich-text tokenizer and shared limits. The
server bundles it with tsup; Vite compiles it for the web.

## Server: modular monolith with light layering

```
modules/<module>/{domain, application, infrastructure, presentation}/ + index.ts
```

- Dependencies point inward: presentation → application → domain; infrastructure implements application ports.
- Modules import each other **only through `index.ts`** (checked by `pnpm check`).
- Cross-module collaboration that would create cycles goes through small ports wired in `src/container.ts`
  (the composition root), e.g. conversations need per-user read state, read state needs message counts.
- Real-time fan-out: services publish typed domain events on an in-process bus; `src/socket/realtime.ts`
  subscribes and emits to Socket.IO rooms. Services never import Socket.IO.
- Not full DDD: no aggregates/value-object ceremony — only the layering and the pure domain rules.

Modules: `users`, `auth`, `conversations`, `messages`, `read-states`, `files`.

### Data model (MongoDB)

| Collection      | Notes / indexes                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `users`         | unique `handle`, unique `email`; role `admin`/`member`; bots flagged                                                    |
| `conversations` | `type` channel/dm, `members[{userId, role}]`, `lastMessage` snapshot; `{members.userId, lastMessageAt}`; unique channel name (partial) and unique DM key (partial) |
| `messages`      | `{conversationId, threadRootId, _id:-1}` history range scans; unique `{conversationId, authorId, clientMsgId}` (idempotent send); text index (`language: none`); `{conversationId, mentions, _id}` |
| `readstates`    | one pointer per (user, conversation): `lastReadMessageId` (monotonic via `$max`), `muted`                                |
| `files`         | owner, kind, dimensions, storage keys, `conversationId`/`messageId` once attached                                       |
| `refreshtokens` | SHA-256 hash, family id, TTL index                                                                                       |

Why a document database fits: messages are independent documents read and written by conversation; attachments,
reactions and mentions are naturally embedded; history pages are index range scans on `_id` (ObjectIds sort by time).

### Real-time protocol

- Rooms: `conv:<id>` per conversation, `user:<id>` per user (multi-tab notifications, read sync).
- Client → server events carry an ACK: `message:send|edit|delete|pin`, `reaction:toggle`, `read:update`;
  `typing` and `presence:set` are fire-and-forget (`volatile` for typing).
- Server → client: `message:new|updated`, `reaction:updated`, `thread:updated`, `typing`, `presence:update`,
  `read:updated`, `conversation:upsert|updated|removed`, `user:upsert`, `ready` (snapshot on connect).
- Reconnect: the client refetches the conversation list (counters), fetches newer messages of the open conversation
  with `afterId`, and re-sends anything still pending (safe: the server dedupes on `clientMsgId`).

## Web: Feature-Sliced Design

`app → pages → widgets → features → entities → shared`, boundaries checked by `scripts/check-fsd.mjs`.

- **Timeline state** (per conversation: ids, byId, pending, cursors) lives in a normalized Zustand store updated by
  socket events; **everything else REST-shaped** (users, search, pins, thread loads, browse) uses TanStack Query.
  The timeline is deliberately not a Query cache: it needs bi-directional paging, optimistic pending rows and
  per-message updates without re-creating page arrays.
- The message list is virtualized; scroll behaviour (open at first unread, stick to bottom, anchor on prepend,
  jump-to-message) is isolated in `useTimelineScroll`.
- Code splitting: login and chat pages, the rarely used dialogs, side panels, the emoji picker and the Persian
  bundle are separate chunks.
- i18n: i18next with typed-by-test resources (a unit test keeps EN/FA keys and placeholders identical and checks
  that every literal `t('…')` exists). CSS uses logical properties so RTL needs no special cases.

## Theming

Design tokens are CSS variables (`--surface`, `--panel`, `--accent`, …) set per theme and mapped into Tailwind via
`@theme inline`. Palette: `#220901` (base), `#621708`, `#941b0c`, `#bc3908` (primary), `#f6aa1c` (accent). Contrast of
the key pairs is verified (text ≥ 4.5:1; see `docs/performance.md` for the check script notes).
