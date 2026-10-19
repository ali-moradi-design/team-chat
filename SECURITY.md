# Security notes

## Threat model

Users are authenticated workspace members. Message text, file names and uploaded files are **untrusted input**.
The server must stay correct when a member (or a stolen session) sends hostile payloads.

## What is in place

**Authentication & sessions**

- Passwords: argon2id (OWASP parameters). Login always performs a hash verification so unknown emails are not timing-distinguishable; the error message is identical.
- Access token: short-lived JWT (15 min, HS256) sent as a bearer token; the same token authenticates the Socket.IO handshake.
- Refresh token: random 256-bit value stored only as a SHA-256 hash, in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`; **rotated on every use** with reuse detection (replaying an old token revokes the whole family; a 10 s grace window covers two tabs racing).
- `/auth/refresh` additionally requires an `X-Requested-With` header. Login/register are rate limited per IP.
- Files are served with a separate `httpOnly` media cookie (`SameSite=Lax`, path `/api/files`) so `<img>` tags work without exposing the access token.

**Authorization**

- Every REST call and **every socket event** checks membership of the conversation (sockets join one room per conversation; leaving/removal revokes the room immediately). Private channels and DMs are invisible to non-members, including in search.
- Role checks: workspace admin, channel owner, message author (edit = author only; delete = author, channel owner or admin).

**Input handling**

- Zod validates every REST body/query and every socket payload (shared schemas).
- Message text: control and bidi-override characters stripped, length capped. Rendering is token-based (no `dangerouslySetInnerHTML` anywhere): links are limited to `http(s)` and get `rel="noopener noreferrer nofollow"`.
- Per-socket token-bucket rate limits (send, mutate, react, typing, read) and request limits on the REST API.

**Files**

- Allow-list of MIME types (no SVG/HTML), size cap, **magic-byte verification** (client-declared type is not trusted), pixel limit for images.
- Still images are re-encoded (strips EXIF/GPS and neutralises polyglots); thumbnails are generated server-side.
- Downloads: `X-Content-Type-Options: nosniff`, restrictive CSP, non-images forced to `attachment` / `application/octet-stream`; access limited to the uploader (before sending) and conversation members.
- Unattached uploads are swept after 24 h.

**Transport & headers**

- Helmet with a strict CSP (`script-src 'self'`, no inline scripts), CORS allow-list, same-origin WebSocket origin check, `X-Powered-By` removed.
- Terminate TLS at the reverse proxy; set `TRUST_PROXY=true` and `COOKIE_SECURE=true` (default in production).

## Production checklist

1. Set a strong `JWT_SECRET` (the server refuses to start in production without one).
2. Serve over HTTPS; proxy WebSockets (see `docs/deploy.md`).
3. Restrict `CORS_ORIGINS` to your real origin(s).
4. MongoDB: no published ports, authentication enabled if it is reachable by anything but the app container.
5. Back up the MongoDB volume **and** the uploads volume.
6. Run `DEMO_MODE=false` for real workspaces (demo mode exposes passwordless demo accounts and wipes data nightly).

## Reporting

Please report vulnerabilities privately to the repository owner rather than opening a public issue.
