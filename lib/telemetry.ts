import { JobRunStatus, TelemetryEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getDateDaysAgo(days: number) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return now;
}

export async function recordPageView(route: string, userId?: string) {
  try {
    await prisma.telemetryEvent.create({
      data: {
        eventType: TelemetryEventType.PAGE_VIEW,
        route,
        userId,
      }
    });
  } catch (error) {
    console.error("Failed to record page view", { error });
  }
}

export type AnalyticsSummary = {
  totalPageViews: number;
  pageViewsLastSevenDays: number;
  jobRunSampleSize: number;
  jobSuccessRate: number | null;
};

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const sevenDaysAgo = getDateDaysAgo(7);
  const thirtyDaysAgo = getDateDaysAgo(30);

  const [totalPageViews, pageViewsLastSevenDays, completedRuns, successfulRuns] = await Promise.all([
    prisma.telemetryEvent.count({
      where: { eventType: TelemetryEventType.PAGE_VIEW }
    }),
    prisma.telemetryEvent.count({
      where: {
        eventType: TelemetryEventType.PAGE_VIEW,
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    }),
    prisma.jobRun.count({
      where: {
        status: {
          in: [JobRunStatus.SUCCESS, JobRunStatus.FAILED]
        },
        startedAt: {
          gte: thirtyDaysAgo
        }
      }
    }),
    prisma.jobRun.count({
      where: {
        status: JobRunStatus.SUCCESS,
        startedAt: {
          gte: thirtyDaysAgo
        }
      }
    })
  ]);

  const jobSuccessRate = completedRuns > 0 ? successfulRuns / completedRuns : null;

  return {
    totalPageViews,
    pageViewsLastSevenDays,
    jobRunSampleSize: completedRuns,
    jobSuccessRate
  };
}
