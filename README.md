# Kitchen Sync

This repository hosts the CalendarSync automation dashboard. The initial infrastructure milestone (INF-001) scaffolds a
full-stack Next.js application with the following foundations:

- **TypeScript** via the Next.js App Router.
- **Tailwind CSS** for a composable design system.
- **next-auth** prepared for Google authentication flows.
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

Update the database credentials or OAuth secrets as needed. The same keys are used by Docker Compose via `.env.docker` (copy the
example to `.env.docker`).

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
