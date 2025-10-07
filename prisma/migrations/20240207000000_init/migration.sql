-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum definitions
CREATE TYPE "SyncJobStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "SyncJobCadence" AS ENUM ('FIFTEEN_MINUTES', 'HOURLY', 'DAILY');
CREATE TYPE "JobRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- Core tables
CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT,
  "email" TEXT,
  "emailVerified" TIMESTAMP(3),
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  "oauth_token_secret" TEXT,
  "oauth_token" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionToken" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Calendar" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "accountId" UUID NOT NULL,
  "googleCalendarId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "accessRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "sourceCalendarId" UUID NOT NULL,
  "destinationCalendarId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" "SyncJobStatus" NOT NULL DEFAULT 'ACTIVE',
  "cadence" "SyncJobCadence" NOT NULL,
  "config" JSONB,
  "lastRunAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jobId" UUID NOT NULL,
  "status" "JobRunStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "message" TEXT,
  "logLocation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX "Calendar_accountId_googleCalendarId_key" ON "Calendar"("accountId", "googleCalendarId");
CREATE INDEX "SyncJob_status_idx" ON "SyncJob"("status");
CREATE INDEX "SyncJob_cadence_idx" ON "SyncJob"("cadence");
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");
CREATE INDEX "JobRun_jobId_startedAt_idx" ON "JobRun"("jobId", "startedAt");

-- Foreign keys
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_sourceCalendarId_fkey"
  FOREIGN KEY ("sourceCalendarId") REFERENCES "Calendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_destinationCalendarId_fkey"
  FOREIGN KEY ("destinationCalendarId") REFERENCES "Calendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "SyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
