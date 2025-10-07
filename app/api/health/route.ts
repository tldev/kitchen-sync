import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type HealthStatus = "healthy" | "degraded" | "unhealthy";

interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  services: {
    database: {
      status: HealthStatus;
      latency?: number;
      error?: string;
    };
    scheduler: {
      status: HealthStatus;
      error?: string;
    };
  };
}

async function checkDatabase(): Promise<{ status: HealthStatus; latency?: number; error?: string }> {
  const startTime = Date.now();
  try {
    // Simple query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    return { status: "healthy", latency };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

async function checkScheduler(): Promise<{ status: HealthStatus; error?: string }> {
  const isDisabled = process.env.SYNC_JOB_SCHEDULER_DISABLED === "true";
  
  if (isDisabled) {
    return { status: "degraded", error: "Scheduler is explicitly disabled via SYNC_JOB_SCHEDULER_DISABLED" };
  }

  // Check if the global scheduler task exists (set in lib/scheduler/sync-job-scheduler.ts)
  if (globalThis.__syncJobSchedulerTask) {
    return { status: "healthy" };
  }

  return { status: "unhealthy", error: "Scheduler task is not running" };
}

export async function GET() {
  const [database, scheduler] = await Promise.all([
    checkDatabase(),
    checkScheduler(),
  ]);

  // Determine overall status
  let overallStatus: HealthStatus = "healthy";
  if (database.status === "unhealthy" || scheduler.status === "unhealthy") {
    overallStatus = "unhealthy";
  } else if (database.status === "degraded" || scheduler.status === "degraded") {
    overallStatus = "degraded";
  }

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      database,
      scheduler,
    },
  };

  const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return NextResponse.json(result, { status: statusCode });
}

