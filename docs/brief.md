# Team chat: brief

Written 2026-10-19. Demo 9 in notes/demos.md (team chat with Node.js, Express,
Socket.IO and MongoDB). The only demo that shows the backend part of the CV
(Express, MongoDB, Mongoose). Built in its own public repo and sessions; this file
is the handoff and is safe to make public.

## Starting point: the user's own earlier chat repos

The user already has two public practice repos (their own code, no NDA issue):

- `ali-moradi-design/nodejs-chat-socket`: Express + Socket.IO + TypeScript backend.
  Rooms, guest auth in the handshake, message history in a JSON file, typing,
  presence (multi-tab aware), `clientMsgId` dedupe with ACK, cursor history
  (`afterId` / `beforeId`), Zod on every payload, CORS allowlist, Helmet,
  per-socket rate limit, SECURITY.md, Vitest tests.
- `ali-moradi-design/nodejs-chat-web`: Vite + React 19 + TypeScript + Tailwind v4,
  Feature-Sliced Design (with an FSD import check), dark-first UI, optimistic send
  with retry, resync on reconnect, typing and connection status.

This project grows them into a real team chat: accounts, MongoDB, channels and
direct messages, threads, reactions, files, read receipts, search.

## How the build session starts

1. Check the prerequisites (below) and report before writing code.
2. Confirm the open decisions (end of this file) with the user.
3. Copy this brief into the repo as `docs/brief.md`.
4. Design first: UI mockups as images (HTML/CSS rendered to PNG with Playwright),
   shown to the user; no app code before approval. The existing chat-web look is a
   good starting point.
5. Split the scope into versions with the user, then build step by step in small
   PRs (branch → PR → CI → squash merge), explaining each step.

Language rules: explain in Persian, every English term inside parentheses and
backticks, never start a line with an English word, repo files in English.

## Prerequisites to check first

- `git`, `node` (current LTS), `pnpm`, `docker` (MongoDB runs in Docker locally).
- The working folder is a clone of the new repo, on `main`, clean; report what is
  already in it.
- GitHub fetch/push works; the two old repos are readable.
- Playwright runs locally (mockups and two-user E2E tests).
- Read the current docs of Socket.IO v4, Mongoose and the MongoDB Node driver
  before coding.

## Pitch

A Slack-style team chat: channels and direct messages with threads, reactions,
mentions, files, read receipts and live presence, built on Socket.IO and MongoDB.

## Features

Accounts and access

- Sign up / sign in with email and password; JWT access token plus refresh token
  in an httpOnly cookie; the Socket.IO handshake is authenticated with the same
  session. Ready-made demo accounts.
- One workspace. Roles: workspace admin, member. Channel roles: owner, member.

Conversations

- Public and private channels; direct messages (1:1 and small groups).
- Join, leave, invite, channel topic and description.

Messages

- Text with light formatting (bold, italic, code, links), edit and delete
  (soft delete, "edited" label), replies in threads, emoji reactions,
  `@mentions`, pinned messages.
- File and image sharing: size and type limits, image thumbnails, stored on a
  Docker volume.
- Optimistic send with ACK and retry, `clientMsgId` dedupe (from the old repo).
- Cursor pagination for history; resync after reconnect without flooding.
- Search messages (MongoDB text index), filtered by channel and author.
- Mixed languages: every message uses `dir="auto"` so Persian and English
  messages each get the right direction inside the same thread.

Real-time

- Typing indicators, presence (online, away, offline; multi-tab aware).
- Read receipts: a last-read pointer per user and conversation; unread counts and
  "new messages" divider; "seen by" in direct messages.
- Notifications: unread badges, mention highlight, browser notifications
  (permission asked politely), per-channel mute.

Demo

- A demo bot posts and answers so the app looks alive for visitors.
- Demo data is reset every night.

## Architecture

```
apps/
  server   Express + Socket.IO + Mongoose (TypeScript)
  web      Vite + React (FSD), socket.io-client, TanStack Query
packages/
  shared   Zod schemas and TypeScript types for every REST payload and socket
           event (one source of truth for client and server)
```

- Turborepo monorepo (shared event types are the main reason).
- Server layers: routes / socket handlers → services → repositories (Mongoose).
  Every socket event is validated with Zod and checked for membership
  (authorization on every event, not only on connect).
- Socket.IO rooms per conversation and per user (for direct notifications).
- Scaling story: the Socket.IO Redis adapter allows several server instances.
  Explain it and keep it optional (a Compose profile), because Redis costs memory
  on the 6 GB VPS.
- MongoDB data model (why a document database fits: messages are independent
  documents, read and written by conversation, with flexible attachments and
  reactions):
  - `users`, `conversations` (type channel/dm, members, roles),
  - `messages` (conversationId, authorId, text, attachments, reactions,
    threadRootId, editedAt, deletedAt),
  - `readStates` (userId, conversationId, lastReadMessageId),
  - `files`.
  - Indexes: `{ conversationId: 1, _id: -1 }` for history pages, a text index for
    search, unique indexes where needed.
- Web: TanStack Query for REST data; socket events update the query cache;
  virtualized message list for long histories; FSD structure from the old repo.
- Security: keep everything from the old SECURITY.md, plus authenticated
  handshake, per-event authorization, file type/size checks, rate limits on login.
- Tests: Vitest for services and validators; server integration tests with a real
  MongoDB in Docker and `socket.io-client`; Playwright E2E with two browser
  contexts (two users chatting in real time); CI runs MongoDB as a service.

## Languages and UI

- English (default) and Persian (RTL), same rules as the other demos (logical CSS,
  native digits by default with a Latin-digit setting, Gregorian calendar).
- Dark-first with a light toggle; responsive (mobile sidebar).

## Deploy notes (for the later roadmap session, phase 8)

- Dynamic app: server image + web static files (or served by the server) + MongoDB
  container with `--wiredTigerCacheSizeGB 0.25`, a memory limit, a named volume
  and no published ports.
- Nginx must proxy WebSockets: `proxy_http_version 1.1`, `Upgrade` and
  `Connection` headers, and a longer `proxy_read_timeout`.
- Uploaded files on a named volume; include them in backups.

## Decisions (2026-10-19)

1. Repo: new public monorepo `ali-moradi-design/team-chat` (created by the user),
   subdomain `team-chat.ali-moradi-develop.com`.
2. Start from the two old repos, not from scratch (about 3,000 lines in total:
   reading and adapting them costs far fewer tokens and less time than writing it
   all again; the persistence layer and auth are rewritten anyway, while socket
   handling, dedupe, reconnect, validation, security and the FSD web app are kept).
3. Copy the code WITHOUT history (plain copy, no `git subtree`):
   `nodejs-chat-socket` → `apps/server`, `nodejs-chat-web` → `apps/web`, in the
   first commit, with a README note that the code started from those two repos.
   Then restructure into the monorepo. Read only the files a step touches.
4. Do not touch the two old repos at all (no README changes, no archiving).

## Open decisions (confirm at the start of the build session)

1. Languages: English and Persian (default proposal).
2. Redis adapter: optional profile (proposal) or always on.
