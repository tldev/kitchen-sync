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
