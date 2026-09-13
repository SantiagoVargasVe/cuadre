# Multi-stage build producing a standalone Next server.
#
# Built by CI on GitHub's amd64 runners, not on the dev machine (which is
# arm64) — see docs/adr/0010-deploy-via-ghcr-and-pull-timer.md. The deploy
# target is linux/amd64; the release workflow passes --platform for that.
#
# Build context is the repo root:  docker build -f infra/Dockerfile .

# ---- dependencies ---------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build --------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Config validation is lazy (src/server/config.ts), so no secrets are needed
# to build. If this ever fails on a missing variable, something started
# reading config at import time — fix that rather than adding placeholders.
RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Never run as root. Cuadre writes no files in v1 — no receipt uploads, no
# image mount — so the runtime filesystem is entirely read-only in practice.
RUN addgroup -g 1001 -S nodejs \
 && adduser -S -u 1001 -G nodejs nextjs

# `output: "standalone"` (next.config.ts) emits a self-contained server with a
# minimal node_modules holding only what Next traced — including postgres,
# drizzle-orm and @node-rs/argon2, reached at runtime via instrumentation.ts.
# The migration .sql files are raw reads Next can't follow through imports;
# next.config.ts's outputFileTracingIncludes puts them in this tree.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# An HTTP probe detects a failed instrumentation hook; a live Node process or
# listening TCP port alone is not readiness. Docker reports unhealthy but does
# not restart on health status: fatal initialization explicitly exits instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=130s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/login',r=>{r.resume();process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1)).setTimeout(4000,function(){this.destroy();process.exit(1)})"

# Migrations run at startup from src/instrumentation.ts (production only, and
# safe only at a single instance — see the comment there). No separate migrate
# step in the deploy.
CMD ["node", "server.js"]
