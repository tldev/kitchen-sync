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

Copy the provided template to configure local environment variables:

```bash
cp .env.example .env.local
```

Update the database credentials or OAuth secrets as needed. Provide a 32-byte `TOKEN_ENCRYPTION_KEY` (base64 or hex) so OAuth
refresh tokens can be encrypted before being stored in PostgreSQL. You can generate a compatible key with:

```bash
openssl rand -base64 32
```

The same keys are used by Docker Compose via `.env.docker` (copy the example to `.env.docker`).

## Docker Compose stack

The monolithic V1 can be started with PostgreSQL using Docker Compose:

```bash
cp .env.docker.example .env.docker
docker compose up --build
```

Apply Prisma migrations after the services are running:

```bash
docker compose run --rm web npx prisma migrate deploy
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
