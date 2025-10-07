import { redirect } from "next/navigation";
import AnalyticsSummary from "@/components/analytics-summary";
import LinkGoogleAccountButton from "@/components/link-google-account-button";
import SyncJobPlanner from "@/components/sync-job-planner";
import type { CalendarOption } from "@/components/sync-job-planner";
import SyncJobsDashboard from "@/components/sync-jobs-dashboard";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordPageView } from "@/lib/telemetry";
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
  const [
    linkedAccounts,
    calendars,
    syncJobs,
    pageViewAggregation,
    jobRunAggregations
  ] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" }
    }),
    prisma.calendar.findMany({
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

  const googleAccounts = linkedAccounts.filter((account) => account.provider === "google");

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

  const formatAccountId = (value: string) => {
    if (value.length <= 8) {
      return value;
    }

    return `${value.slice(0, 4)}…${value.slice(-4)}`;
  };

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
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-emerald-500/5">
        <h2 className="text-2xl font-semibold text-emerald-300">Welcome to Kitchen Sync</h2>
        <p className="mt-2 text-sm text-slate-400">Signed in as {displayName}.</p>
        <p className="mt-4 text-slate-300">
          This Next.js scaffold combines Tailwind CSS styling, next-auth authentication hooks, and Prisma ORM integrations.
          It serves as the foundation for orchestrating Google-to-Google calendar synchronization using the CalendarSync CLI.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Authentication Ready</h3>
            <p className="mt-2 text-sm text-slate-400">
              next-auth will power Google sign-in, enabling multi-account linking and secure session management.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Database Connected</h3>
            <p className="mt-2 text-sm text-slate-400">
              Prisma acts as the data access layer for PostgreSQL, giving us type-safe models for users, calendars, and jobs.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Tailwind Styling</h3>
            <p className="mt-2 text-sm text-slate-400">
              TailwindCSS provides a composable design system so future dashboards and configuration flows stay consistent.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">Docker Friendly</h3>
            <p className="mt-2 text-sm text-slate-400">
              A production-ready Dockerfile packages the app, paving the way for docker-compose orchestration in later tasks.
            </p>
          </div>
        </div>
      </section>
      <AnalyticsSummary
        totalPageViews={totalPageViews}
        lastPageViewAt={lastPageViewAt}
        jobSuccessRate={jobSuccessRate}
        completedRuns={completedRuns}
        successfulRuns={successfulRuns}
        failedRuns={failedRuns}
        cancelledRuns={cancelledRuns}
      />
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-emerald-300">Linked Google accounts</h3>
            <p className="mt-1 text-sm text-slate-400">
              Connect additional Google identities to power cross-account calendar synchronisation. Tokens are stored encrypted
              in PostgreSQL.
            </p>
          </div>
          <LinkGoogleAccountButton />
        </div>
        <div className="mt-6 space-y-3">
          {googleAccounts.length === 0 ? (
            <p className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-sm text-slate-400">
              Your primary sign-in account is ready. Link another Google account to start configuring cross-calendar syncs.
            </p>
          ) : (
            googleAccounts.map((account, index) => {
              const maskedId = formatAccountId(account.providerAccountId);
              const linkedLabel = index === 0 ? "Primary sign-in account" : "Linked account";
              const linkedAt = linkedDateFormatter.format(account.createdAt);

              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-emerald-200">{linkedLabel}</p>
                    <p className="text-xs text-slate-400">Google account ID: {maskedId}</p>
                  </div>
                  <p className="text-xs text-slate-500">Linked on {linkedAt}</p>
                </div>
              );
            })
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <SyncJobPlanner calendars={calendarOptions} />
      </section>
      <SyncJobsDashboard jobs={syncJobs} />
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <h3 className="text-xl font-semibold text-emerald-300">Next Steps</h3>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-slate-300">
          <li>Define Prisma schema and database migrations.</li>
          <li>Introduce docker-compose services for database and scheduler workers.</li>
          <li>Wire up next-auth Google provider and secure token handling.</li>
          <li>Integrate CalendarSync CLI execution pipelines.</li>
        </ol>
      </section>
    </div>
  );
}
