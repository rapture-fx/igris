# Igris BetterAuth upstream — production image.
#
# This service handles ALL customer signup / login / password-reset /
# email-verification. The Rails console proxies /api/auth/* to it
# (BETTER_AUTH_UPSTREAM_URL). Without this service deployed, every auth call
# returns 502/503 and no customer can sign up or log in.
#
# IMPORTANT: the build CONTEXT is the pnpm workspace root `web/`, NOT this app
# dir, because the app has no app-level lockfile — it resolves against
# web/pnpm-lock.yaml. Build it with:
#   docker build -f apps/better-auth-upstream/Dockerfile -t igris-auth ./web
# In CI this is the `igris-auth` matrix entry in build-container-images.yml
# (context: ./web).
#
# next.config.js pins outputFileTracingRoot to the workspace root, so the
# standalone output layout is deterministic:
#   .next/standalone/apps/better-auth-upstream/server.js
#   .next/standalone/node_modules/...
# which is exactly what the runner stage copies and runs.
#
# Runtime env (set on the deployment, never baked in): DATABASE_URL,
# BETTER_AUTH_SECRET, BETTER_AUTH_BASE_URL, NEXT_PUBLIC_LANDING_URL,
# RESEND_API_KEY, RESEND_FROM_EMAIL, and optional GOOGLE_/GITHUB_ OAuth pairs.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
# Pin pnpm to the version declared in the workspace's packageManager field.
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# ── builder: install (frozen) + build the standalone output in one stage ──
# Installing and building in the same stage avoids copying pnpm's symlinked
# node_modules across stages (which is fragile). The runner then takes only the
# self-contained `.next/standalone` tree.
FROM base AS builder
WORKDIR /app

# Manifests first for layer caching. Only the root + this app's manifest are
# needed for a `--filter @igris/better-auth-upstream...` frozen install; sibling
# apps under apps/* are not required and their absence is not an error.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/better-auth-upstream/package.json ./apps/better-auth-upstream/package.json
RUN pnpm install --frozen-lockfile --filter @igris/better-auth-upstream...

# App source, then build.
COPY apps/better-auth-upstream ./apps/better-auth-upstream
RUN pnpm --filter @igris/better-auth-upstream build

# ── runner: minimal, non-root standalone image ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# The standalone bundle is self-contained (includes its own node_modules). Copy
# it to /app, then drop the static assets into the app's .next/static so the
# server can serve them. There is no public/ dir in this app.
COPY --from=builder --chown=nextjs:nodejs /app/apps/better-auth-upstream/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/better-auth-upstream/.next/static ./apps/better-auth-upstream/.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME="0.0.0.0"

# Liveness: GET / answers 200 once the process is up (verified locally). It does
# not require a DB or a session, so it is a safe, secret-free health probe.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -fsS "http://localhost:3001/" >/dev/null 2>&1 || exit 1

CMD ["node", "apps/better-auth-upstream/server.js"]
