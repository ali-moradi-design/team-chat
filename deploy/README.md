# Deploy (VPS)

Live at https://team-chat.ali-moradi-develop.com. One VPS, host Nginx in front, every app in
`/srv/apps/<name>`. The reusable deploy comes from
[deploy-kit](https://github.com/ali-moradi-design/deploy-kit) (`deploy-app.yml` + `server/deploy-app`).
General notes (environment variables, backups): [docs/deploy.md](../docs/deploy.md).

- `compose.yaml` — the app and its own MongoDB 8 (auth on, `--wiredTigerCacheSizeGB 0.25`, internal network,
  no published port). The app is the only published port (`127.0.0.1:3106`), read-only, non-root,
  `no-new-privileges`, memory limits; uploads on the `uploads` volume. `DEMO_MODE` is on: demo accounts, the bot
  and the nightly reset (03:00 UTC, inside the app, no cron needed).
- `.env.example` — the names in `/srv/apps/team-chat/.env` (mode 600, owner `deploy`).
- `nginx.conf` — `/etc/nginx/sites-available/team-chat` with the WebSocket upgrade headers; `nginx -t` before
  `systemctl reload nginx`, then `certbot --nginx --redirect -d team-chat.ali-moradi-develop.com`.

## The image holds only build output

Like a Next.js standalone build: the final stage has the bundled server (`dist`), the built web app (`web`) and
the server's production dependencies (`pnpm deploy --prod`; `argon2` and `sharp` are native, so they cannot be
bundled). No source code, no dev dependencies. CI checks this on every PR and starts the image with this
`compose.yaml`.

## How a change reaches the server

PR → CI green → squash merge. CI on `main` then starts `.github/workflows/docker.yml` (`workflow_run`): it builds
and pushes `team-chat:<sha>`, and the deploy job connects with a key whose forced command is
`deploy-app team-chat`. The server sets `IMAGE_TAG`, pulls, runs `docker compose up -d --wait` and rolls back by
itself when the new container is not healthy. The deploy job then checks `/`, `/health` and `/api/config`
through Nginx.

## Once, after the first deploy

```bash
cd /srv/apps/team-chat && sudo -u deploy docker compose exec -T app node dist/scripts/seed.js
```

Manual rollback:

```bash
cd /srv/apps/team-chat && sudo -u deploy cp .env.previous .env && sudo -u deploy docker compose up -d --wait
```
