# Kitchen Sync

This repository hosts the CalendarSync automation dashboard. The initial infrastructure milestone (INF-001) scaffolds a
full-stack Next.js application with the following foundations:

- **TypeScript** via the Next.js App Router.
- **Tailwind CSS** for a composable design system.
- **next-auth** prepared for Google authentication flows, including multi-account linking with encrypted token storage.
- **Prisma** as the data access layer for PostgreSQL.
- **Dockerfile** for containerized builds and deployment.

Run the development server after installing dependencies:

```bash
npm install
npm run dev
```

The app renders a placeholder dashboard and exposes the NextAuth handler under `/api/auth/[...nextauth]`. Subsequent
milestones will introduce the Prisma schema, database services, and CalendarSync workflow integrations.

## Environment configuration

Create a `.env.local` file with the following variables (or copy from `env.local.example` if available):

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/calendarsync?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-here-generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Token Encryption (generate with: openssl rand -base64 32)
TOKEN_ENCRYPTION_KEY="your-32-byte-base64-encoded-key"

# CalendarSync Configuration
CALENDARSYNC_BINARY="/usr/local/bin/calendarsync"
CALENDARSYNC_LOG_DIR="./calendarsync-data/logs"

# Scheduler Configuration (optional)
SYNC_JOB_SCHEDULER_DISABLED="false"
SYNC_JOB_SCHEDULER_CRON="*/1 * * * *"

# Observability (optional)
# SENTRY_DSN=""
# LOGTAIL_SOURCE_TOKEN=""
```

Generate a secure `NEXTAUTH_SECRET` and `TOKEN_ENCRYPTION_KEY` with:

```bash
openssl rand -base64 32
```

For Docker Compose, create a `.env.docker` file (or copy from `env.docker.example`).

## Docker Compose stack

The monolithic V1 can be started with PostgreSQL using Docker Compose. First, create a `.env.docker` file (or copy from `env.docker.example`):

```bash
docker compose up --build
```

Apply Prisma migrations after the services are running:

```bash
docker compose run --rm web npx prisma migrate deploy
```

## Health checks

The application exposes a health check endpoint at `/api/health` that reports the status of the database connection and job scheduler. Use this for monitoring and load balancer health checks:

```bash
curl http://localhost:3000/api/health
```

### CalendarSync binary integration

The Docker image now bundles the CalendarSync CLI. The binary is downloaded during the build stage via the
`CALENDARSYNC_VERSION` build argument (default: `v0.6.2`). If you need to pin to a different release or provide an internal
mirror, override `CALENDARSYNC_DOWNLOAD_URL` when invoking `docker build`:

```bash
docker build \
  --build-arg CALENDARSYNC_VERSION=v0.6.3 \
  --build-arg CALENDARSYNC_DOWNLOAD_URL=https://example.com/calendarsync.tar.gz \
  -t calendarsync-app .
```

Within application code, use the `runCalendarSync` helper from `lib/calendarsync/executor` to generate configuration files and
stream CLI logs. The helper throws a `CalendarSyncExecutionError` when the process exits with a non-zero status, exposing the
captured stdout/stderr for debugging.
