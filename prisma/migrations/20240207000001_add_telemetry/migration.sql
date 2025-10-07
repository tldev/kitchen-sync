-- Add TelemetryEventType enum
CREATE TYPE "TelemetryEventType" AS ENUM ('PAGE_VIEW');

-- Add TelemetryEvent table
CREATE TABLE "TelemetryEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "type" "TelemetryEventType" NOT NULL,
  "path" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- Add indexes
CREATE INDEX "TelemetryEvent_type_createdAt_idx" ON "TelemetryEvent"("type", "createdAt");
CREATE INDEX "TelemetryEvent_userId_createdAt_idx" ON "TelemetryEvent"("userId", "createdAt");

-- Add foreign key
ALTER TABLE "TelemetryEvent" ADD CONSTRAINT "TelemetryEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

