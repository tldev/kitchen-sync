CREATE TYPE "TelemetryEventType" AS ENUM ('PAGE_VIEW');

CREATE TABLE "TelemetryEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eventType" "TelemetryEventType" NOT NULL,
  "route" TEXT NOT NULL,
  "userId" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelemetryEvent_eventType_createdAt_idx"
  ON "TelemetryEvent"("eventType", "createdAt");

CREATE INDEX "TelemetryEvent_route_idx"
  ON "TelemetryEvent"("route");

