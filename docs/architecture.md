# CalendarSync Automation Front-End Architecture Proposal

## Overview
This document outlines a proposed architecture for a web application that manages Google-to-Google calendar synchronization jobs by orchestrating the [inovex/CalendarSync](https://github.com/inovex/CalendarSync) CLI.

The goal is to give users a Google-authenticated dashboard where they can connect multiple Google accounts, configure sync jobs with CalendarSync transformers/filters, and schedule recurring executions.

## High-Level Architecture

The diagram below represents the long-term target state ("run" phase) we aligned on previously.

```
+---------------------------+           +---------------------------+
|        Web Client         |  HTTPS    |        API Backend        |
| (Next.js + React + UI lib)| <-------> | (NestJS / Node.js)        |
+------------+--------------+           +-----------+---------------+
             |                                          |
             | GraphQL/REST                            | gRPC/Jobs
             v                                          v
+------------+--------------+           +---------------------------+
|   Job Orchestrator        |           |   Persistence Layer       |
| (Temporal.io worker)      |           | (PostgreSQL + Redis)      |
+------------+--------------+           +------------+--------------+
             |                                          |
             | CLI invocation                           |
             v                                          v
+------------+--------------+           +---------------------------+
| CalendarSync CLI Runner   |           |  Secrets & Files          |
| (Dockerized binary)       |           | (Google Secret Manager)   |
+---------------------------+           +---------------------------+
```

### Key choices
- **Frontend**: Next.js (App Router) with TypeScript and TailwindCSS. Rationale: excellent developer ergonomics, built-in routing, SSR, and flexible integration with Google OAuth flows.
- **Backend**: Node.js with NestJS (TypeScript). Rationale: aligns with frontend stack, structured DI, easy REST/GraphQL APIs, and broad library support for Google APIs.
- **Job Orchestrator**: Temporal.io worker (Node.js SDK). Rationale: first-class support for reliable, stateful workflows and scheduling, integrates naturally with NestJS, and can run long-lived activities such as invoking the CalendarSync CLI. Alternative: use BullMQ/Celery + cron, but Temporal offers better visibility and retries.
- **CLI Execution**: Containerized CalendarSync CLI invoked within Temporal activities. The worker spins up short-lived Docker containers (or uses a prebuilt image) to run the CLI with generated configuration files.
- **Storage**: PostgreSQL for relational data (users, connected accounts, calendars, sync jobs, workflow state) and Redis for caching tokens and Temporal visibility (if self-hosted). Secrets such as Google refresh tokens stored in Google Secret Manager or encrypted using KMS.

## Crawl: V1 Validation Architecture

To reach user value quickly, the first milestone focuses on a monolithic deployment that can validate that
CalendarSync-driven automations are useful before investing in Temporal or multi-service infrastructure.

### Guiding principles
- **Keep everything in one deployable**: a single Next.js (App Router) project handles UI and backend APIs.
- **Use managed services where possible**: rely on hosted PostgreSQL (e.g., Supabase or Neon) and Vercel/Render for fast setup.
- **Accept manual/limited scheduling**: use `node-cron` inside the backend to trigger syncs at coarse cadences (hourly/daily).
- **Instrument for learning**: capture job outcomes and basic telemetry to understand usage patterns for subsequent iterations.

### V1 component overview

```
+---------------------------+
|  Next.js Full-Stack App   |
|  (UI + API Routes)        |
+---------------------------+
            |
            | REST/JSON (fetch)
            v
+---------------------------+
|  PostgreSQL (hosted)      |
+---------------------------+
            |
            | child_process exec
            v
+---------------------------+
| CalendarSync CLI (local)  |
+---------------------------+
```

- **Frontend / Backend**: Next.js with React Server Components for the dashboard UI and Next.js API routes for backend logic.
- **Authentication**: [next-auth](https://next-auth.js.org/) with the Google provider. Users must sign in with Google; additional
  account linking uses the same library's multiple-account support.
- **Persistence**: Prisma ORM connected to a managed PostgreSQL instance. Tables for users, linked Google accounts, calendars,
  sync jobs, and job run history. Secrets (refresh tokens) are encrypted with a symmetric key stored as an environment variable
  (rotated manually in V1).
- **Scheduling**: `node-cron` (or the built-in `cron` feature in hosting platforms like Render) triggers a worker script that
  looks up due jobs and executes them serially. Initial cadence options are limited to presets (every 15 minutes, hourly, daily).
- **CLI Execution**: the hosting container bundles the CalendarSync binary. The worker spawns it via `child_process.spawn`, writes
  a temporary YAML config, streams logs back to the database, and marks job success/failure. No Docker orchestration required yet.
- **Observability**: simple logging to stdout plus job history persisted in PostgreSQL. Optional integration with a hosted log
  service (Logtail/Datadog) for debugging.

### Single `docker-compose` deployment

To minimise setup friction, V1 ships with a `docker-compose.yml` that orchestrates the complete stack:

- **`web` service**
  - Image built from the Next.js project using multi-stage Dockerfile (builder + production runtime based on `node:20-alpine`).
  - Exposes port 3000, runs `next start`, and mounts a shared volume containing generated CalendarSync configs/logs.
  - Contains the CalendarSync binary baked into the image so scheduled jobs can execute locally via `child_process.spawn`.
- **`db` service**
  - Based on the official `postgres:15` image with a persisted named volume for data durability.
  - Bootstrapped with a superuser/password defined via environment variables loaded from `.env`.
- **`scheduler` service (optional for dev vs prod)**
  - Lightweight Node.js worker container sharing the same codebase as `web` but running `node scripts/run-cron.js`.
  - Reads the database and filesystem via shared volumes to keep API load isolated from job execution.
- **Shared volumes & network**
  - `node_modules` cached per service to speed up rebuilds.
  - `calendarsync-data` volume holds temp configs/logs for CLI runs, making debugging easier during local development.

Developers run `docker compose up --build` to start the entire environment, after which migrations and seeding are handled by a
one-shot command (`docker compose run --rm web pnpm prisma migrate deploy`). Production deployment can reuse the same compose
file or be migrated to a managed platform once validated.

### Critical user journeys supported in V1
1. **Authenticate with Google** (primary account only required).
2. **Link additional Google accounts** via next-auth's account linking flow.
3. **Discover calendars** for each linked account using Google Calendar API, store metadata in the database.
4. **Configure a sync job** with limited options: choose source/destination calendar, select a preset cadence, and toggle a
   small subset of CalendarSync transformers/filters (e.g., title transformer, time window filter).
5. **Execute scheduled runs** using `node-cron`, display recent run status and logs in the dashboard.

### Constraints and trade-offs
- Single-process scheduling means missed runs if the instance restarts; mitigation is persisting last-run timestamps and
  catching up on boot.
- OAuth tokens are encrypted at rest but not yet stored in an external secret manager.
- Parallelism is limited; jobs run sequentially to avoid overloading the host. This is acceptable for early adopters.
- Manual operations (database migrations, key rotation) are expected during validation.

## Walk/Run: Idealized Architecture (for reference)

Once the V1 validates user value, the system can evolve toward the previously proposed target state. Key upgrades include:

- Split the monolith into a dedicated frontend (Next.js) and backend (NestJS) to enable independent scaling.
- Replace `node-cron` with Temporal workflows for reliable scheduling, retries, and visibility.
- Introduce Docker-based CLI execution workers to improve isolation and allow horizontal scaling.
- Adopt managed secrets (Google Secret Manager/KMS) and more granular token handling.
- Add richer observability (metrics, tracing) and alerting.
- Support advanced CalendarSync transformers/filters and multi-destination syncs.

The remainder of this document describes that future architecture in more detail for planning purposes.

## Authentication & Account Linking
1. **Primary Login**: Users must sign in with Google using OAuth 2.0 / OpenID Connect via Google Identity Services. Frontend receives tokens, backend verifies and issues a session (JWT or cookie-based).
2. **Additional Accounts**: Backend initiates OAuth flows using Google OAuth `offline` access. Linked accounts stored with encrypted refresh tokens and metadata. Each account periodically refreshed to maintain valid access tokens.
3. **Token Storage Strategy**:
   - Encrypt refresh tokens using envelope encryption (e.g., Google Cloud KMS) before persisting in PostgreSQL.
   - Maintain short-lived access tokens in Redis cache when jobs are running; otherwise regenerate via refresh tokens within Temporal activities.

## Calendar Discovery & Configuration Flow
1. User selects "Add account"; frontend calls backend to start OAuth consent for another Google account.
2. After linking, backend fetches available calendars via Google Calendar API and stores metadata.
3. Frontend displays a selector UI (email -> calendar list) for **Source** and **Destination**. Data fetched via REST/GraphQL.
4. Transformers & filters exposed as configurable forms mapped to CalendarSync CLI options (e.g., titleTransformer, attendeeFilter). The backend maintains a schema describing available options for dynamic UI generation.

## Sync Job Lifecycle
1. User creates a sync definition with:
   - Source account/calendar
   - Destination account/calendar
   - Selected transformers/filters + parameters
   - Schedule cadence (cron-like expression or presets)
2. Backend persists definition and schedules a Temporal workflow:
   - Cron schedule triggers workflow execution.
   - Workflow activity builds CalendarSync config YAML based on selection.
   - Activity runs CalendarSync Docker container with config and Google credentials passed via environment or mounted secrets.
   - Workflow handles retries, failure reporting, and emits logs/metrics.
3. Results surfaced in UI with recent run status, next run time, and error messages.

## Scheduler & Execution Environment
- Deploy Temporal server (self-hosted or managed) and register a worker service colocated with backend or separate service.
- Worker fetches job definitions from PostgreSQL as part of workflow execution.
- Each run:
  1. Prepare a working directory with generated config.
  2. Exchange refresh tokens for access tokens (using Google API libraries).
  3. Execute CLI inside Docker using Node.js `child_process` or Docker SDK.
  4. Capture stdout/stderr logs and persist to PostgreSQL (possibly object storage for large logs).

## Deployment Considerations
- Host on Google Cloud (Cloud Run or GKE) for proximity to Google APIs and KMS/Secret Manager integration.
- Use Cloud SQL for PostgreSQL, Memorystore for Redis.
- Deploy front-end via Vercel or Cloud Run static hosting.
- Temporal server managed via Temporal Cloud or self-hosted on GKE.

## Next Steps / Open Questions
- Confirm acceptance of Node.js stack for both frontend and backend.
- Validate Temporal adoption vs simpler cron/BullMQ approach based on team familiarity.
- Decide on GraphQL vs REST for API contract.
- Determine exact transformer/filter schema and whether to auto-generate UI from CLI metadata.
- Security review for storing and rotating Google tokens.

## Implementation tickets

> **Legend**: points roughly follow "small = 1 point" and "medium = 2 points". Tickets within the same swimlane can be tackled
> concurrently.

### Foundation & Infrastructure
- **[INF-001] (1pt)**: Scaffold monolithic Next.js app with TypeScript, Tailwind, next-auth, Prisma, and Dockerfile.
- **[INF-002] (1pt, parallel with INF-001)**: Author `docker-compose.yml`, database volume, `.env` templates, and Prisma schema
  migrations.
- **[INF-003] (2pt, depends on INF-001/002)**: Integrate CalendarSync binary into container image and implement `child_process`
  execution helper with config generation and logging.

### Authentication & Accounts
- **[AUTH-001] (1pt)**: Implement Google-only authentication flow with next-auth, secure session handling, and sign-in gating.
- **[AUTH-002] (1pt, parallel with AUTH-001)**: Enable secondary Google account linking, token encryption utilities, and
  persistence in PostgreSQL.

### Calendar & Sync Configuration
- **[SYNC-001] (1pt)**: Build API routes + Prisma models for calendars, sync jobs, and job run history.
- **[SYNC-002] (2pt, depends on SYNC-001)**: Implement Google Calendar discovery service that fetches calendars per linked
  account and stores metadata.
- **[SYNC-003] (1pt, parallel with SYNC-002)**: Create UI workflow for selecting source/destination calendars and choosing
  preset cadences.
- **[SYNC-004] (2pt, depends on SYNC-001)**: Map a curated set of CalendarSync transformers/filters into configurable form
  components and backend validation.

### Scheduling & Operations
- **[OPS-001] (1pt)**: Implement `node-cron` scheduler (in web or dedicated worker) that enqueues due sync jobs.
- **[OPS-002] (2pt, depends on OPS-001 & INF-003)**: Execute CalendarSync runs, capture stdout/stderr, persist job status, and
  expose logs via UI/API.
- **[OPS-003] (1pt, parallel with OPS-002)**: Add health checks, structured logging, and observability hooks (e.g., Sentry/Logta
  il integration stub).

### UX & Feedback Loop
- **[UX-001] (1pt)**: Dashboard to list sync jobs, display run history, and surface error states.
- **[UX-002] (1pt, parallel with UX-001)**: Instrument basic analytics/telemetry (page views, job success rate) to guide
  iteration.

### Future Evolution (optional stretch)
- **[FUT-001] (2pt, depends on OPS-002)**: Prototype migration path from cron-based execution to Temporal or another durable
  scheduler by abstracting the job execution interface.

