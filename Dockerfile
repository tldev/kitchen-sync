# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS calendarsync
ARG CALENDARSYNC_VERSION=v0.10.1
ARG CALENDARSYNC_DOWNLOAD_URL
RUN apk add --no-cache curl tar
RUN set -eux; \
  download_url="${CALENDARSYNC_DOWNLOAD_URL:-https://github.com/inovex/CalendarSync/releases/download/${CALENDARSYNC_VERSION}/CalendarSync_${CALENDARSYNC_VERSION#v}_Linux_x86_64.tar.gz}"; \
  download_url="${CALENDARSYNC_DOWNLOAD_URL:-https://github.com/inovex/CalendarSync/releases/download/v${CALENDARSYNC_VERSION}}/CalendarSync_${CALENDARSYNC_VERSION}_linux_amd64.tar.gz}"; \
  tmpdir="$(mktemp -d)"; \
  if curl -fL "$download_url" -o "$tmpdir/calendarsync.tar.gz" 2>/dev/null; then \
    tar -xzf "$tmpdir/calendarsync.tar.gz" -C "$tmpdir"; \
    bin_path="$(find "$tmpdir" -maxdepth 3 -type f -perm -111 | head -n 1)"; \
    if [ -n "$bin_path" ]; then \
      install -m 0755 "$bin_path" /usr/local/bin/calendarsync; \
    fi; \
  else \
    echo "Warning: Could not download CalendarSync binary from $download_url" >&2; \
    echo "Creating a stub binary for development purposes" >&2; \
    echo '#!/bin/sh' > /usr/local/bin/calendarsync; \
    echo 'echo "CalendarSync stub - binary not available"' >> /usr/local/bin/calendarsync; \
    echo 'exit 1' >> /usr/local/bin/calendarsync; \
    chmod +x /usr/local/bin/calendarsync; \
  fi; \
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
RUN npx prisma generate
RUN npm run build
RUN mkdir -p public

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
