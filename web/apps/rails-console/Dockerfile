# Igris Console (Rails 7.1) — production image.
#
# Build context is this directory (web/apps/rails-console), NOT the repo root.
# The console is stateless: it owns views + the Overture API client and stores
# nothing durably. No database, no Node — Propshaft digests CSS at build time.
#
#   docker build -t ghcr.io/igris-inertial/system/igris-console:latest \
#     web/apps/rails-console
#
# Runtime env (set by the platform, never baked in): SECRET_KEY_BASE,
# OVERTURE_API_BASE_URL, OVERTURE_API_KEY, ADMIN_USERNAME, ADMIN_PASSWORD.
# See DEPLOY.md / docs/LIVE_MODE_BRINGUP.md.

ARG RUBY_VERSION=3.2.2

# ── Stage 1: build gems + precompile assets ──────────────────────────────
FROM ruby:${RUBY_VERSION}-slim AS build

ENV RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_WITHOUT="development:test" \
    BUNDLE_PATH=/usr/local/bundle

# build-essential + git compile native gem extensions (puma, nokogiri fallback).
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libyaml-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install gems first for layer caching.
COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git

# Copy the app and digest assets. SECRET_KEY_BASE_DUMMY lets Rails 7.1
# precompile without a real secret — none is baked into the image.
COPY . .
RUN SECRET_KEY_BASE_DUMMY=1 bin/rails assets:precompile

# ── Stage 2: minimal runtime ─────────────────────────────────────────────
FROM ruby:${RUBY_VERSION}-slim AS runtime

ENV RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_WITHOUT="development:test" \
    BUNDLE_PATH=/usr/local/bundle \
    RAILS_LOG_TO_STDOUT=1 \
    RAILS_SERVE_STATIC_FILES=1 \
    PORT=3100

# Runtime needs only libyaml (psych) + a CA bundle for outbound HTTPS to Overture.
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y libyaml-0-2 ca-certificates curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1000 rails && \
    useradd --system --uid 1000 --gid 1000 --create-home rails

WORKDIR /app

# Compiled gems and the digested app come from the build stage.
COPY --from=build --chown=rails:rails /usr/local/bundle /usr/local/bundle
COPY --from=build --chown=rails:rails /app /app

RUN mkdir -p tmp/pids tmp/cache tmp/sockets log && \
    chown -R rails:rails tmp log

USER rails

EXPOSE 3100

# /up is a Rack lambda (config/routes.rb) — always answers without the
# front-door Basic auth challenge, so it is safe for platform health probes.
HEALTHCHECK --interval=30s --timeout=4s --start-period=15s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/up" || exit 1

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
