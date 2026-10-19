# Deployment notes

One container serves the API, the WebSocket endpoint and the built web app (`SERVE_WEB_DIR`). MongoDB runs next to it.

## Compose

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose --profile app up -d --build
```

- MongoDB: `--wiredTigerCacheSizeGB 0.25`, named volume, bound to `127.0.0.1` (do not publish it).
- App: `mem_limit: 512m`, uploads on the `uploads` named volume (include it in backups).
- Optional Redis (`--profile scale`, `REDIS_URL=redis://redis:6379`) lets you run several app instances;
  presence and room broadcasts then go through the Socket.IO Redis adapter. Keep it off on small VPSes.

## Environment

| Variable           | Default                    | Notes                                                       |
| ------------------ | -------------------------- | ----------------------------------------------------------- |
| `JWT_SECRET`       | —                          | **required** in production                                  |
| `MONGODB_URI`      | `mongodb://127.0.0.1:27017/team-chat` |                                                  |
| `CORS_ORIGINS`     | localhost dev origins      | same-origin deployments need no entry                       |
| `TRUST_PROXY`      | `false`                    | `true` behind nginx/Traefik (real client IPs for rate limits) |
| `COOKIE_SECURE`    | `true` in production       | set `false` only for plain-HTTP testing                     |
| `UPLOAD_DIR`       | `./uploads`                | `/data/uploads` in the image                                |
| `MAX_FILE_BYTES`   | `10485760`                 |                                                             |
| `DEMO_MODE`        | `false`                    | passwordless demo accounts + nightly reset (03:00 UTC)      |
| `DEMO_BOT`         | = `DEMO_MODE`              |                                                             |
| `REDIS_URL`        | —                          | enables the Redis adapter                                   |
| `AUTH_RATE_LIMIT`  | `30` / 15 min / IP         | login + register + demo                                     |

## Nginx (WebSockets!)

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;          # longer than the Socket.IO ping interval (25 s) + timeout (20 s)
    client_max_body_size 11m;         # uploads (10 MB) + multipart overhead
}
```

## Backups

`mongodump` of the `team-chat` database **and** a copy of the uploads volume. Restore both together: messages
reference files by id.

## Health

`GET /health` → `200 {"status":"ok"}` when MongoDB is connected (`503` otherwise). The image ships a `HEALTHCHECK`.
