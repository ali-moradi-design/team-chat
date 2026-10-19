# Performance notes

Performance was a first-class requirement. What was done, and how it is verified.

## Server

- **Indexes match the queries**: history = equality on `(conversationId, threadRootId=null)` + range on `_id`
  (no sort stage); unread counters are one bounded aggregate per conversation (`$limit 100`);
  idempotent send is a unique index, not a read-then-write.
- `lean()` reads and field projections; no N+1 in conversation summaries (batched read-state lookup).
- Cursor pagination everywhere (`beforeId` / `afterId` / `aroundId`); no `skip`.
- Socket.IO: websocket-first, `perMessageDeflate` off, 64 KB packet cap, `volatile` typing events,
  O(1) membership authorization via rooms, presence derived from sockets (works with the Redis adapter).
- REST: gzip, ETag-able static assets with immutable caching, file responses `Cache-Control: immutable`.
- Uploads: streamed to disk through `sendFile` (Range supported); thumbnails are 480 px WebP.

## Web

- **Virtualized timeline** (TanStack Virtual) — DOM stays at ~30–60 rows regardless of history length.
- **Scroll anchoring**: prepending older pages does not move the viewport; sticks to the bottom only when the user
  is at the bottom; shows “N new messages” otherwise.
- **Fine-grained state**: sidebar rows subscribe to their own conversation; typing/presence live in separate stores
  so a keystroke elsewhere never re-renders the timeline; message rows are memoised.
- **Optimistic UI**: sends and reactions render instantly and reconcile with the ACK / server event.
- **Instant conversation switching**: up to 10 recent timelines stay cached; a background `afterId` fetch catches up.
- **Code splitting & budget**: eager JS ≈ 187 KB gzip (React, router, socket.io, query, i18n) with a CI budget of
  200 KB; login/chat pages, dialogs, side panels, emoji picker and the Persian bundle are lazy chunks.
  Fonts are self-hosted variable fonts split by unicode-range (Persian glyphs load only when needed).
- Images reserve their aspect ratio (no layout shift), lazy-load and decode asynchronously.

## Verified by tests

`apps/web/e2e/performance.spec.ts` seeds a 2,500-message channel and asserts: fewer than 80 rows in the DOM on open,
fewer than 120 while paging upwards six times, the reading position stays within 120 px when a page is prepended, and
“Jump to latest” returns to the bottom. Opening a long conversation must complete in under 2.5 s.

## Contrast check used for the palette

```js
// relative luminance → contrast ratio (WCAG). Key pairs, dark/light:
// fg/panel 17.5 / 19.0 · muted/panel 8.3 / 7.3 · white/primary 5.6 · accent-fg/accent 9.7 · faint/panel 5.7 / 5.5
```
