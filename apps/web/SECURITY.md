# Security notes (frontend)

## Trust boundaries

- `VITE_SOCKET_URL` must point only at a trusted backend (this value is public in the browser bundle).
- Guest `displayName` / `userId` live in `localStorage` — they are not secrets and can be spoofed.
- Message text is rendered as React text nodes (escaped). Never introduce `dangerouslySetInnerHTML` for chat bodies.

## Recommendations

- Serve the SPA over HTTPS.
- Keep backend CORS allowlist aligned with the deployed SPA origin.
- Treat all remote payloads as untrusted even after Zod validation on the server.
