import { JobRunStatus, Prisma, SyncJobCadence, SyncJobStatus } from "@prisma/client";

const cadenceLabels: Record<SyncJobCadence, string> = {
  FIFTEEN_MINUTES: "Every 15 minutes",
  HOURLY: "Hourly",
  DAILY: "Daily",
};

const jobStatusStyles: Record<SyncJobStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
  PAUSED: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
};

const jobStatusLabels: Record<SyncJobStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
};

const runStatusStyles: Record<JobRunStatus, string> = {
  PENDING: "bg-slate-500/10 text-slate-300 border border-slate-500/30",
  RUNNING: "bg-blue-500/10 text-blue-200 border border-blue-500/30",
  SUCCESS: "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30",
  FAILED: "bg-rose-500/10 text-rose-200 border border-rose-500/30",
  CANCELLED: "bg-amber-500/10 text-amber-200 border border-amber-500/30",
};

const runStatusLabels: Record<JobRunStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  SUCCESS: "Success",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

type SyncJobWithHistory = Prisma.SyncJobGetPayload<{
  include: {
    sourceCalendar: {
      include: { account: true };
    };
    destinationCalendar: {
      include: { account: true };
    };
    runs: true;
  };
}>;

type SyncJobsDashboardProps = {
  jobs: SyncJobWithHistory[];
};

function formatAccountId(value: string): string {
  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return "–";
  }

  const dateValue = typeof value === "string" ? new Date(value) : value;
  return dateTimeFormatter.format(dateValue);
}

export default function SyncJobsDashboard({ jobs }: SyncJobsDashboardProps) {
  if (jobs.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <div className="space-y-4 text-slate-300">
          <h3 className="text-xl font-semibold text-emerald-300">Sync job activity</h3>
          <p className="text-sm text-slate-400">
            You haven&apos;t created any sync jobs yet. Once a job is configured it will appear here with the most recent run
            history and status so you can keep an eye on automation health.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-emerald-300">Sync job activity</h3>
          <p className="text-sm text-slate-400">
            Track the status of each automation, review the latest run, and inspect any failures without leaving the dashboard.
          </p>
        </div>
        <div className="space-y-5">
          {jobs.map((job) => {
            const lastRun = job.runs[0] ?? null;
            const hasError = lastRun
              ? lastRun.status === JobRunStatus.FAILED || lastRun.status === JobRunStatus.CANCELLED
              : false;
            const sourceAccountLabel = formatAccountId(job.sourceCalendar.account.providerAccountId);
            const destinationAccountLabel = formatAccountId(job.destinationCalendar.account.providerAccountId);

            return (
              <article
                key={job.id}
                className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-lg shadow-emerald-500/5"
              >
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h4 className="text-lg font-semibold text-emerald-200">{job.name}</h4>
                    <p className="text-sm text-slate-400">
                      {job.sourceCalendar.summary} ({sourceAccountLabel})
                      <span className="mx-2 text-slate-600">→</span>
                      {job.destinationCalendar.summary} ({destinationAccountLabel})
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${jobStatusStyles[job.status]}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {jobStatusLabels[job.status]}
                  </span>
                </header>
                <dl className="grid gap-4 text-sm text-slate-300 sm:grid-cols-3">
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Cadence</dt>
                    <dd>{cadenceLabels[job.cadence]}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Next run</dt>
                    <dd>{formatDate(job.nextRunAt)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Last run</dt>
                    <dd>{lastRun ? formatDate(lastRun.startedAt) : "No runs yet"}</dd>
                  </div>
                </dl>
                {hasError ? (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
                    <p className="font-semibold">Recent failure</p>
                    <p className="mt-1 text-rose-100/80">
                      {lastRun?.message ?? "The most recent run did not complete successfully."}
                    </p>
                    {lastRun?.logLocation ? (
                      <p className="mt-2 text-xs text-rose-100/70">Log location: {lastRun.logLocation}</p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Run history</h5>
                  {job.runs.length === 0 ? (
                    <p className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-4 text-xs text-slate-500">
                      No execution history yet. Runs will appear here once the scheduler kicks off this job.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {job.runs.map((run) => (
                        <li
                          key={run.id}
                          className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${runStatusStyles[run.status]}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {runStatusLabels[run.status]}
                            </span>
                            <div className="text-xs text-slate-400">
                              <p>Started {formatDate(run.startedAt)}</p>
                              <p>Finished {formatDate(run.finishedAt)}</p>
                            </div>
                          </div>
                          {run.message ? (
                            <p className="text-xs text-slate-400 sm:text-right">{run.message}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
