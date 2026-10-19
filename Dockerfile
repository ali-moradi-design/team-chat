# syntax=docker/dockerfile:1.7
# One image: the API/WebSocket server also serves the built web app (SERVE_WEB_DIR).

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

# ---- dependencies (cached while manifests do not change) ----------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ---- build ------------------------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm --filter @team-chat/web build \
 && pnpm --filter @team-chat/server build \
 && pnpm --filter @team-chat/server deploy --prod --legacy /out

# ---- runtime ------------------------------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production PORT=3001 HOST=0.0.0.0 UPLOAD_DIR=/data/uploads SERVE_WEB_DIR=/app/web TRUST_PROXY=true
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/server/dist ./dist
COPY --from=build /repo/apps/web/dist ./web
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
VOLUME /data/uploads
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
