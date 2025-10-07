import { redirect } from "next/navigation";
import AnalyticsSummary from "@/components/analytics-summary";
import CalendarDiscoveryTrigger from "@/components/calendar-discovery-trigger";
import LinkGoogleAccountButton from "@/components/link-google-account-button";
import SyncJobPlanner from "@/components/sync-job-planner";
import type { CalendarOption } from "@/components/sync-job-planner";
import SyncJobsDashboard from "@/components/sync-jobs-dashboard";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordPageView } from "@/lib/telemetry";
import { fetchLiveCalendarsForUser } from "@/lib/google/calendars";
import { JobRunStatus, TelemetryEventType } from "@prisma/client";

export default async function HomePage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/signin");
  }

  await recordPageView({
    userId: session.user.id,
    path: "/",
  });

  const displayName = session.user?.name ?? session.user?.email ?? "there";
  
  // Fetch live calendars from Google API for up-to-date data
  let calendars;
  try {
    const liveCalendars = await fetchLiveCalendarsForUser(session.user.id);
    calendars = liveCalendars.map(cal => ({
      id: cal.id,
      googleCalendarId: cal.googleCalendarId,
      summary: cal.summary,
      timeZone: cal.timeZone,
      description: cal.description,
      color: cal.color,
      accessRole: cal.accessRole,
      accountId: cal.accountId,
      account: {
        id: cal.accountId,
        providerAccountId: cal.providerAccountId
      }
    }));
  } catch (error) {
    console.error("Failed to fetch live calendars, using database fallback:", error);
    calendars = await prisma.calendar.findMany({
      where: {
        account: {
          userId: session.user.id
        }
      },
      include: {
        account: {
          select: {
            id: true,
            providerAccountId: true
          }
        }
      },
      orderBy: {
        summary: "asc"
      }
    });
  }

  const [
    linkedAccounts,
    syncJobs,
    pageViewAggregation,
    jobRunAggregations
  ] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        email: true,
        createdAt: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.syncJob.findMany({
      where: {
        ownerId: session.user.id
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        sourceCalendar: {
          include: { account: true }
        },
        destinationCalendar: {
          include: { account: true }
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 5
        }
      }
    }),
    prisma.telemetryEvent.aggregate({
      where: {
        userId: session.user.id,
        type: TelemetryEventType.PAGE_VIEW
      },
      _count: { _all: true },
      _max: { createdAt: true }
    }),
    prisma.jobRun.groupBy({
      by: ["status"],
      where: {
        job: {
          ownerId: session.user.id
        }
      },
      _count: { _all: true }
    })
  ]);

  // Helper function to format account IDs
  const formatAccountId = (value: string) => {
    if (value.length <= 8) {
      return value;
    }

    return `${value.slice(0, 4)}…${value.slice(-4)}`;
  };

  const googleAccounts = linkedAccounts
    .filter((account) => account.provider === "google")
    .map((account) => ({
      ...account,
      displayEmail: account.email || formatAccountId(account.providerAccountId)
    }));

  const jobRunStatusCounts = jobRunAggregations.reduce<Record<JobRunStatus, number>>(
    (acc, group) => {
      acc[group.status] = group._count._all;
      return acc;
    },
    {
      [JobRunStatus.PENDING]: 0,
      [JobRunStatus.RUNNING]: 0,
      [JobRunStatus.SUCCESS]: 0,
      [JobRunStatus.FAILED]: 0,
      [JobRunStatus.CANCELLED]: 0
    }
  );

  const successfulRuns = jobRunStatusCounts[JobRunStatus.SUCCESS];
  const failedRuns = jobRunStatusCounts[JobRunStatus.FAILED];
  const cancelledRuns = jobRunStatusCounts[JobRunStatus.CANCELLED];
  const completedRuns = successfulRuns + failedRuns + cancelledRuns;
  const jobSuccessRate = completedRuns > 0 ? successfulRuns / completedRuns : null;
  const totalPageViews = pageViewAggregation._count?._all ?? 0;
  const lastPageViewAt = pageViewAggregation._max?.createdAt ?? null;

  const linkedDateFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  const calendarOptions: CalendarOption[] = calendars.map((calendar) => ({
    id: calendar.id,
    googleCalendarId: calendar.googleCalendarId,
    summary: calendar.summary,
    timeZone: calendar.timeZone,
    accountId: calendar.account.id,
    accountLabel: formatAccountId(calendar.account.providerAccountId)
  }));

  return (
    <div className="space-y-8">
      <AnalyticsSummary
        totalPageViews={totalPageViews}
        lastPageViewAt={lastPageViewAt}
        jobSuccessRate={jobSuccessRate}
        completedRuns={completedRuns}
        successfulRuns={successfulRuns}
        failedRuns={failedRuns}
        cancelledRuns={cancelledRuns}
      />
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Google Accounts</h3>
          <LinkGoogleAccountButton />
        </div>
        <div className="mt-4 space-y-3">
          {googleAccounts.length === 0 ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No additional accounts linked yet.
            </p>
          ) : (
            googleAccounts.map((account, index) => {
              const linkedLabel = index === 0 ? "Primary" : "Linked";
              const linkedAt = linkedDateFormatter.format(account.createdAt);

              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{linkedLabel}</p>
                    <p className="text-sm text-gray-600">{account.displayEmail}</p>
                  </div>
                  <p className="text-xs text-gray-400">{linkedAt}</p>
                </div>
              );
            })
          )}
        </div>
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <CalendarDiscoveryTrigger
          hasCalendars={calendars.length > 0}
          hasLinkedAccounts={googleAccounts.length > 0}
        />
        <div className={calendars.length > 0 ? "mt-6" : ""}>
          <SyncJobPlanner 
            calendars={calendarOptions} 
            accounts={googleAccounts.map(acc => ({
              id: acc.id,
              label: acc.displayEmail
            }))}
          />
        </div>
      </section>
      <SyncJobsDashboard jobs={syncJobs} />
    </div>
  );
}
