# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS calendarsync
ARG CALENDARSYNC_VERSION=v0.6.2
ARG CALENDARSYNC_DOWNLOAD_URL
RUN apk add --no-cache curl tar
RUN set -eux; \
  download_url="${CALENDARSYNC_DOWNLOAD_URL:-https://github.com/inovex/CalendarSync/releases/download/${CALENDARSYNC_VERSION}/CalendarSync_${CALENDARSYNC_VERSION#v}_Linux_x86_64.tar.gz}"; \
  tmpdir="$(mktemp -d)"; \
  curl -fL "$download_url" -o "$tmpdir/calendarsync.tar.gz"; \
  tar -xzf "$tmpdir/calendarsync.tar.gz" -C "$tmpdir"; \
  bin_path="$(find "$tmpdir" -maxdepth 3 -type f -perm -111 | head -n 1)"; \
  if [ -z "$bin_path" ]; then \
    echo "Failed to locate CalendarSync binary in archive from $download_url" >&2; \
    exit 1; \
  fi; \
  install -m 0755 "$bin_path" /usr/local/bin/calendarsync; \
  rm -rf "$tmpdir"

FROM base AS deps
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --frozen-lockfile; \
  else npm install; \
  fi

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libstdc++
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./package.json
COPY --from=calendarsync /usr/local/bin/calendarsync /usr/local/bin/calendarsync

EXPOSE 3000

CMD ["npm", "run", "start"]
