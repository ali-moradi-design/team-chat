# nodejs-chat-web

Grok-like realtime chat UI — **Vite + React 19 + TypeScript + Feature-Sliced Design + Tailwind CSS v4**.

Companion backend: [nodejs-chat-socket](https://github.com/ali-moradi-design/nodejs-chat-socket).

## Features

- Dark-first chat layout (near-black / charcoal), optional light toggle
- Sidebar rooms + presence counts (collapsible on mobile)
- Message thread with own/other bubbles, initials avatars, timestamps
- Composer: Enter send / Shift+Enter newline; auto-grow; draft preserved
- Typing indicator, connection status pill, offline/error banners
- Smooth scroll + “new messages” jump chip
- Display-name gate (localStorage guest session)
- Optimistic send + ACK reconcile / fail + Retry
- Dedupe by `clientMsgId` / server id; history resync on reconnect (`afterId`)
- Keyboard: Escape closes mobile sidebar; Ctrl/⌘+/ focuses composer

## Architecture (FSD)

```
src/app/        providers, styles, App shell
src/pages/      chat page composition
src/widgets/    chat-sidebar, chat-thread, chat-composer
src/features/   send-message, join-room, typing, presence, auth-display-name
src/entities/   message, room, user
src/shared/     ui, lib/socket, lib/chat, config, api
```

Public APIs via `index.ts` barrels. Cross-slice imports must use the barrel (enforced by `pnpm check:fsd`).

## Run with backend

```bash
# terminal 1 — backend
cd ../nodejs-chat-socket
cp .env.example .env
npm install && npm run dev

# terminal 2 — frontend
cd ../nodejs-chat-web
cp .env.example .env
pnpm install   # or npm install
pnpm approve-builds esbuild   # first time if pnpm blocks scripts
# or ensure .npmrc / pnpm-workspace allowBuilds for esbuild
pnpm dev       # http://localhost:5173
```

Set `VITE_SOCKET_URL` to the backend origin (default `http://localhost:3001`).

```bash
pnpm build
pnpm typecheck
pnpm check:fsd
```

## Environment

| Variable | Description |
| --- | --- |
| `VITE_SOCKET_URL` | Socket.IO / REST backend origin |

See `.env.example` and [SECURITY.md](./SECURITY.md).

## Remaining limitations

- Guest auth only (no passwords / OAuth).
- History is capped by client fetch limits (no infinite scroll / virtualization yet).
- Presence is best-effort across multi-tab; typing indicators expire client-side.
- JSON persistence on the backend is single-node (no Redis adapter).

## License

MIT
